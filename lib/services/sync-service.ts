
import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import { notifyNewRecordEmail } from '@/lib/notifications';
import { buildReportFingerprint } from '@/lib/report-fingerprint';
import { buildReportsSyncRow, persistReportMetadata } from '@/lib/report-persistence';
import type { Report } from '@/types';
import { acquireSyncLock, bumpSyncVersion, completeSyncState, getSyncState } from '@/lib/sync-state';

interface SyncResult {
  success: boolean;
  totalProcessed: number;
  inserted: number;
  updated: number;
  deleted: number;
  errors: number;
  duration: number;
  error?: string;
  joined?: boolean;
}

interface UpsertBatchResult {
  inserted: number;
  updated: number;
  errors: number;
  insertedReports: Report[];
}

interface SyncWorkItem {
  kind: 'insert' | 'update';
  report: Report;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>;
}

interface RelinkWorkItem {
  report: Report;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>;
  existingId: string;
  previousSheetId: string;
}

interface ExistingSyncRecord {
  id: string;
  sheet_id: string;
  source_fingerprint: string | null;
  source_sheet?: string | null;
}

interface SyncStatus {
  lastSyncAt: string | null;
  totalReports: number;
  syncVersion: number;
}

export class SyncService {
  private static BATCH_SIZE = 100;
  private static DELETE_BATCH_SIZE = 500;
  private static PAGE_SIZE = 1000;
  private static activeSyncPromise: Promise<SyncResult> | null = null;

  static async syncReportsFromSheets(triggerSource = 'direct'): Promise<SyncResult> {
    if (this.activeSyncPromise) {
      const result = await this.activeSyncPromise;
      return {
        ...result,
        joined: true,
      };
    }

    const syncPromise = this.performSyncReportsFromSheets(triggerSource);
    this.activeSyncPromise = syncPromise;

    try {
      return await syncPromise;
    } finally {
      if (this.activeSyncPromise === syncPromise) {
        this.activeSyncPromise = null;
      }
    }
  }

  // Scoped counterpart to syncReportsFromSheets() for the edit webhook: pulls
  // and upserts exactly the one row that changed instead of a full sheet pull
  // plus the whole push-back-to-sheets backlog. Deletion detection and pushing
  // *other* locally-dirty rows back to Sheets stay the job of the periodic
  // full sync (login-triggered and the daily cron) — this only needs to get
  // one freshly-edited sheet row into Supabase quickly.
  static async syncSingleRowFromSheets(
    sheetName: string,
    rowNumber: number
  ): Promise<{ success: boolean; changed: boolean; error?: string }> {
    try {
      const report = await reportsService.fetchSingleReportFromSheet(sheetName, rowNumber);
      if (!report) {
        return { success: true, changed: false };
      }

      report.source_fingerprint = report.source_fingerprint || buildReportFingerprint(report);
      const sheetId = String(report.sheet_id || report.original_id || '');

      const { data: existing } = sheetId
        ? await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select('id')
            .eq('sheet_id', sheetId)
            .maybeSingle()
        : { data: null };

      await persistReportMetadata(report);
      reportsService.invalidateCache();

      // The full sync bumps sync_version via completeSyncState({ bumpVersion: true }),
      // which is what the dashboard snapshot cache (dashboard_cache_entries) keys off
      // to know it's stale. This scoped single-row path skipped that bump, so a Sheets
      // edit delivered by the webhook would land in Supabase but dashboards would keep
      // serving the pre-edit snapshot until the next full sync bumped the version.
      try {
        await bumpSyncVersion('reports');
      } catch (versionError) {
        console.warn('[SyncService] Failed to bump sync version after scoped row sync:', versionError);
      }

      if (!existing) {
        await notifyNewRecordEmail(report, 'sheets-sync').catch((notificationError) => {
          console.warn('[SyncService] New-record webhook notification failed:', notificationError);
        });
      }

      return { success: true, changed: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SyncService] syncSingleRowFromSheets failed for ${sheetName}!row_${rowNumber}:`, error);
      return { success: false, changed: false, error: message };
    }
  }

  private static async performSyncReportsFromSheets(triggerSource: string): Promise<SyncResult> {
    const startTime = Date.now();
    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let errors = 0;
    let lockAcquired = false;

    try {
      const lock = await acquireSyncLock('reports', 300);
      lockAcquired = lock.acquired;
      if (!lockAcquired) {
        return {
          success: true,
          totalProcessed: 0,
          inserted: 0,
          updated: 0,
          deleted: 0,
          errors: 0,
          duration: Date.now() - startTime,
          joined: true,
        };
      }


      const reports = await reportsService.fetchSheetsReports();

      reports.forEach((report) => {
        if (!report.source_fingerprint) {
          report.source_fingerprint = buildReportFingerprint(report);
        }
      });

      const sourceSheets = Array.from(
        new Set(
          reports
            .map((report) => report.source_sheet)
            .filter((sheetName): sheetName is string => !!sheetName)
        )
      );

      const existingRecords = await this.listExistingSyncRecords(sourceSheets);
      this.logDuplicateFingerprintGroups(
        reports.map((report) => ({
          fingerprint: report.source_fingerprint,
          locator: report.original_id || report.sheet_id || report.id,
        })),
        'fetched Google Sheets rows'
      );
      this.logDuplicateFingerprintGroups(
        existingRecords.map((record) => ({
          fingerprint: record.source_fingerprint,
          locator: record.sheet_id,
        })),
        'existing reports_sync rows'
      );

      const totalProcessed = reports.length;
      const syncResult = await this.syncFetchedReports(reports, existingRecords);
      inserted += syncResult.inserted;
      updated += syncResult.updated;
      errors += syncResult.errors;

      try {
        deleted = await this.deleteMissingFromSync(reports);
        if (deleted > 0) {
        }
      } catch (delErr) {
        console.warn('[SyncService] Delete-missing step failed:', delErr);
      }

      try {
        const pushed = await this.pushLocalUpdatesToSheets();
        if (pushed > 0) {
        }
      } catch (recErr) {
        console.warn('[SyncService] Reconciliation step failed:', recErr);
      }

      try {
        reportsService.invalidateCache();
      } catch (e) {
        console.warn('[SyncService] Failed to invalidate reports cache:', e);
      }

      const duration = Date.now() - startTime;
      await completeSyncState({
        source: 'reports',
        success: true,
        rowCount: reports.length,
        bumpVersion: true,
      });
      // Batched rather than unbounded so a large sync batch doesn't fire
      // every new-record email concurrently against the email provider.
      const NOTIFY_BATCH_SIZE = 10;
      for (let i = 0; i < syncResult.insertedReports.length; i += NOTIFY_BATCH_SIZE) {
        const batch = syncResult.insertedReports.slice(i, i + NOTIFY_BATCH_SIZE);
        await Promise.allSettled(batch.map((report) =>
          notifyNewRecordEmail(report, 'sheets-sync').catch((notificationError) => {
            console.warn('[SyncService] New-record sync notification failed:', notificationError);
          })
        ));
      }

      return {
        success: true,
        totalProcessed,
        inserted,
        updated,
        deleted,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error 
        ? error.message 
        : (typeof error === 'object' && error !== null && 'message' in error)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? String((error as any).message)
          : String(error || 'Unknown error');

      if (lockAcquired) {
        try {
          await completeSyncState({
            source: 'reports',
            success: false,
            rowCount: null,
            error: errorMessage,
            bumpVersion: false,
          });
        } catch (stateError) {
          console.error('[SyncService] Failed to persist sync failure state:', stateError);
        }
      }

      console.error(`[SyncService] Sync failed (trigger: ${triggerSource}):`, error);
      if (error instanceof Error && error.stack) {
        console.error(`[SyncService] Stack trace:`, error.stack);
      }

      return {
        success: false,
        totalProcessed: 0,
        inserted: 0,
        updated: 0,
        deleted: 0,
        errors: 1,
        duration,
        error: errorMessage,
      };
    }
  }

  private static logDuplicateFingerprintGroups(
    items: Array<{ fingerprint?: string | null; locator?: string | null }>,
    context: string
  ) {
    const grouped = new Map<string, string[]>();

    items.forEach(({ fingerprint, locator }) => {
      if (!fingerprint) return;
      const list = grouped.get(fingerprint) || [];
      list.push(locator || '-');
      grouped.set(fingerprint, list);
    });

    grouped.forEach((locators, fingerprint) => {
      if (locators.length < 2) return;
      const sampleLocators = locators.slice(0, 5).join(', ');
      console.warn(
        `[SyncService] Duplicate fingerprint detected in ${context}: ${fingerprint.slice(0, 12)}... (${locators.length} rows: ${sampleLocators})`
      );
    });
  }

  private static async listExistingSyncRecords(sourceSheets: string[]): Promise<ExistingSyncRecord[]> {
    const rows: ExistingSyncRecord[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const baseQuery = supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select('id, sheet_id, source_fingerprint, source_sheet')
        .order('sheet_id', { ascending: true })
        .range(offset, offset + this.PAGE_SIZE - 1);

      const query = sourceSheets.length > 0
        ? baseQuery.in('source_sheet', sourceSheets)
        : baseQuery;

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const batch = (data || []) as ExistingSyncRecord[];
      rows.push(...batch);
      hasMore = batch.length === this.PAGE_SIZE;
      offset += this.PAGE_SIZE;
    }

    return rows;
  }

  private static async syncFetchedReports(
    reports: Report[],
    existingRecords: ExistingSyncRecord[]
  ): Promise<UpsertBatchResult> {
    const existingBySheetId = new Map<string, ExistingSyncRecord>();
    const existingByFingerprint = new Map<string, ExistingSyncRecord[]>();

    existingRecords.forEach((record) => {
      existingBySheetId.set(record.sheet_id, record);
      if (!record.source_fingerprint) return;
      const list = existingByFingerprint.get(record.source_fingerprint) || [];
      list.push(record);
      existingByFingerprint.set(record.source_fingerprint, list);
    });

    const fetchedDuplicateFingerprints = new Set<string>();
    const fetchedFingerprintCounts = new Map<string, number>();
    reports.forEach((report) => {
      const fingerprint = report.source_fingerprint || buildReportFingerprint(report);
      report.source_fingerprint = fingerprint;
      fetchedFingerprintCounts.set(fingerprint, (fetchedFingerprintCounts.get(fingerprint) || 0) + 1);
    });
    fetchedFingerprintCounts.forEach((count, fingerprint) => {
      if (count > 1) fetchedDuplicateFingerprints.add(fingerprint);
    });

    const upsertItems: SyncWorkItem[] = [];
    const relinkItems: RelinkWorkItem[] = [];

    for (const report of reports) {
      const row = buildReportsSyncRow(report);
      const sheetId = String(row.sheet_id);
      const fingerprint = String(row.source_fingerprint || '');
      const exactMatch = existingBySheetId.get(sheetId);

      if (exactMatch) {
        upsertItems.push({ kind: 'update', report, row });
        continue;
      }

      const fingerprintMatches = fingerprint
        ? existingByFingerprint.get(fingerprint) || []
        : [];

      const canRelink =
        fingerprint &&
        !fetchedDuplicateFingerprints.has(fingerprint) &&
        fingerprintMatches.length === 1;

      if (canRelink) {
        const match = fingerprintMatches[0];
        relinkItems.push({
          report,
          row,
          existingId: match.id,
          previousSheetId: match.sheet_id,
        });
        continue;
      }

      if (fingerprint && fingerprintMatches.length > 1) {
        console.warn(
          `[SyncService] Ambiguous fingerprint relink skipped for ${sheetId}: ${fingerprint.slice(0, 12)}... matches ${fingerprintMatches.length} existing rows`
        );
      }

      upsertItems.push({ kind: 'insert', report, row });
    }

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const insertedReports: Report[] = [];

    for (const item of relinkItems) {
      try {
        const { error } = await supabaseAdmin
          .from('ground_handling_irregularity_report')
          .update(item.row)
          .eq('id', item.existingId);

        if (error) {
          throw error;
        }

        await this.relinkReportCommentReferences(
          item.previousSheetId,
          String(item.row.sheet_id)
        );

        updated++;
      } catch (error) {
        console.warn(
          `[SyncService] Failed to relink ${item.previousSheetId} -> ${item.row.sheet_id}:`,
          error
        );
        errors++;
      }
    }

    for (let i = 0; i < upsertItems.length; i += this.BATCH_SIZE) {
      const batch = upsertItems.slice(i, i + this.BATCH_SIZE);
      try {
        const { error } = await supabaseAdmin
          .from('ground_handling_irregularity_report')
          .upsert(
            batch.map((item) => item.row),
            {
              onConflict: 'sheet_id',
              ignoreDuplicates: false,
            }
          );

        if (error) {
          throw error;
        }

        batch.forEach((item) => {
          if (item.kind === 'insert') {
            inserted++;
            insertedReports.push(item.report);
          } else {
            updated++;
          }
        });
      } catch (error) {
        console.error('[SyncService] Batch upsert failed:', error);
        errors += batch.length;
      }
    }

    return { inserted, updated, errors, insertedReports };
  }

  private static async relinkReportCommentReferences(
    previousSheetId: string,
    newSheetId: string
  ) {
    if (previousSheetId === newSheetId) return;

    const { error } = await supabaseAdmin
      .from('report_comments')
      .update({ sheet_id: newSheetId })
      .eq('sheet_id', previousSheetId);

    if (error) {
      console.warn('[SyncService] Failed to relink report comment references:', error);
    }
  }

  private static async pushLocalUpdatesToSheets(): Promise<number> {
    let pushed = 0;
    try {

      const { data: candidates, error } = await supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error || !candidates || candidates.length === 0) return 0;

      const dirtyReports = candidates
        .filter((report) => !report.synced_at || new Date(report.updated_at) > new Date(report.synced_at))
        .slice(0, 50);

      if (dirtyReports.length === 0) return 0;

      // Bounded concurrency (not fully sequential, not unbounded) — the
      // Sheets API enforces a per-minute write quota, so a small batch size
      // cuts wall-clock time versus one row at a time without bursting it.
      // synced_at is stamped in one batched update after the push, instead
      // of one Supabase round trip per successful row.
      const PUSH_BATCH_SIZE = 5;
      const syncedRows: typeof dirtyReports = [];
      for (let i = 0; i < dirtyReports.length; i += PUSH_BATCH_SIZE) {
        const batch = dirtyReports.slice(i, i + PUSH_BATCH_SIZE);
        const results = await Promise.allSettled(batch.map((report) =>
          // report is the full DB row, so it's already the authoritative
          // source being pushed out to Sheets here — no need to live-merge
          // evidence/video URLs against a fresh Sheets read for every row.
          reportsService.updateReport(report.sheet_id, report, { skipLiveFetch: true })
        ));
        results.forEach((result, idx) => {
          const report = batch[idx];
          if (result.status === 'fulfilled' && result.value) {
            syncedRows.push(report);
            pushed++;
          } else if (result.status === 'rejected') {
            console.warn(`[SyncService] Failed to push report ${report.sheet_id} to Sheets:`, result.reason);
          }
        });
      }

      if (syncedRows.length > 0) {
        const stampedAt = new Date().toISOString();
        for (let i = 0; i < syncedRows.length; i += PUSH_BATCH_SIZE) {
          // Guard on the updated_at observed at read time: if the row
          // changed concurrently (another edit landed mid-push), skip the
          // stamp so it stays dirty and gets re-pushed next sync instead of
          // the concurrent edit being silently marked as already synced.
          const stampResults = await Promise.allSettled(syncedRows.slice(i, i + PUSH_BATCH_SIZE).map((report) =>
            supabaseAdmin
              .from('ground_handling_irregularity_report')
              .update({ synced_at: stampedAt })
              .eq('id', report.id)
              .eq('updated_at', report.updated_at)
          ));
          stampResults.forEach((result, idx) => {
            const report = syncedRows[i + idx];
            if (result.status === 'rejected') {
              console.warn(`[SyncService] Failed to stamp synced_at for ${report.sheet_id}:`, result.reason);
            } else if (result.value.error) {
              console.warn(`[SyncService] Failed to stamp synced_at for ${report.sheet_id}:`, result.value.error);
            }
          });
        }
      }
    } catch (err) {
      console.error('[SyncService] pushLocalUpdatesToSheets exception:', err);
    }
    return pushed;
  }

  private static async deleteMissingFromSync(reports: Report[]): Promise<number> {
    const fetchedIds = new Set<string>(
      reports
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r) => (r as any).original_id as string | undefined)
        .filter((id): id is string => !!id)
    );
    const fetchedFingerprints = new Set<string>(
      reports
        .map((report) => report.source_fingerprint || buildReportFingerprint(report))
        .filter((fingerprint): fingerprint is string => !!fingerprint)
    );

    if (fetchedIds.size === 0 && fetchedFingerprints.size === 0) {

      return 0;
    }

    const sourceSheets = Array.from(
      new Set(
        reports
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r) => (r as any).source_sheet as string | undefined)
          .filter((s): s is string => !!s)
      )
    );

    const existingSyncRows = await this.listExistingSyncRecords(sourceSheets);
    const syncToDelete = existingSyncRows.filter((row) => {
      if (fetchedIds.has(row.sheet_id)) return false;
      if (row.source_fingerprint && fetchedFingerprints.has(row.source_fingerprint)) return false;
      return true;
    });
    let deleted = 0;

    if (syncToDelete.length > 0) {

      for (let i = 0; i < syncToDelete.length; i += this.DELETE_BATCH_SIZE) {
        const batch = syncToDelete.slice(i, i + this.DELETE_BATCH_SIZE);
        const { data, error } = await supabaseAdmin
          .from('ground_handling_irregularity_report')
          .delete()
          .in('id', batch.map((row) => row.id))
          .select('id');
        if (error) {
          console.warn('[SyncService] Delete batch failed:', error);
          continue;
        }
        deleted += data?.length || 0;
      }
    }

    return deleted;
  }

  static async getSyncStatus(): Promise<SyncStatus> {
    try {
      const syncState = await getSyncState('reports');
      const { count } = await supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select('*', { count: 'exact', head: true });

      return {
        lastSyncAt: syncState.last_sync_at || null,
        totalReports: count || 0,
        syncVersion: syncState.sync_version || 0,
      };
    } catch (error) {
      console.error('[SyncService] Failed to get sync status:', error);
      return {
        lastSyncAt: null,
        totalReports: 0,
        syncVersion: 0,
      };
    }
  }

  static async clearSyncedData(): Promise<{ success: boolean; deleted: number }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('ground_handling_irregularity_report')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');

      if (error) {
        console.error('[SyncService] Clear error:', error);
        return { success: false, deleted: 0 };
      }

      const deleted = data?.length || 0;
      try {
        await completeSyncState({
          source: 'reports',
          success: true,
          rowCount: 0,
          bumpVersion: true,
        });
      } catch (stateError) {
        console.warn('[SyncService] Failed to bump sync state after clear:', stateError);
      }
      return { success: true, deleted };
    } catch (error) {
      console.error('[SyncService] Clear exception:', error);
      return { success: false, deleted: 0 };
    }
  }

  // Piggybacks on the daily sync cron rather than its own Vercel cron slot
  // (Hobby plan caps at 2). notifySLABreach dedupes per report via the
  // notification fingerprint, so this only ever alerts once per breach.
  static async checkSlaBreaches(): Promise<{ checked: number; notified: number }> {
    const { notifySLABreach } = await import('@/lib/notifications');
    const nowIso = new Date().toISOString();

    const { data: overdue, error } = await supabaseAdmin
      .from('ground_handling_irregularity_report')
      .select('id, title, report, sla_deadline, status')
      .neq('status', 'CLOSED')
      .not('sla_deadline', 'is', null)
      .lt('sla_deadline', nowIso)
      .limit(200);

    if (error) {
      console.error('[SyncService] SLA breach query failed:', error);
      return { checked: 0, notified: 0 };
    }

    // Batched (not fully sequential, not fully unbounded) so up to 200
    // notifications don't fire 200 concurrent requests at the email
    // provider, while still avoiding one-at-a-time round-trip waits.
    const NOTIFY_BATCH_SIZE = 10;
    let notified = 0;
    const reports = overdue || [];
    for (let i = 0; i < reports.length; i += NOTIFY_BATCH_SIZE) {
      const batch = reports.slice(i, i + NOTIFY_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((report) => {
        const deadline = new Date(String(report.sla_deadline));
        const hoursOverdue = Math.round((Date.now() - deadline.getTime()) / 3_600_000);
        return notifySLABreach(
          String(report.id),
          String(report.title || report.report || 'Untitled report'),
          hoursOverdue
        );
      }));
      for (const result of results) {
        if (result.status === 'fulfilled') {
          notified++;
        } else {
          console.warn('[SyncService] SLA breach notification failed:', result.reason);
        }
      }
    }

    return { checked: overdue?.length || 0, notified };
  }
}
