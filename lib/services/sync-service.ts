
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import { notifyNewRecordEmail } from '@/lib/notifications';
import { buildReportFingerprint } from '@/lib/report-fingerprint';
import { buildReportsSyncRow, buildRowContentHash, persistReportMetadata } from '@/lib/report-persistence';
import { shouldKeepLocalEdit } from '@/lib/report-sync-guard';
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
  skipped?: boolean;
}

interface SyncOptions {
  /**
   * Skip the run entirely when the last successful sync is younger than this.
   * The DB lock in performSyncReportsFromSheets only prevents *overlapping*
   * runs — it frees the moment a sync finishes, so a burst of logins would
   * otherwise pull the whole Google Sheets corpus once per login and burn
   * through the API quota. Callers that must always run (cron, manual admin
   * sync, unscoped webhook ping) leave this unset.
   */
  minIntervalMs?: number;
}

interface UpsertBatchResult {
  inserted: number;
  updated: number;
  errors: number;
  insertedReports: Report[];
  unchanged: number;
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
  content_hash?: string | null;
  updated_at?: string | null;
  synced_at?: string | null;
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

  private static emptyResult(startTime: number, extra: Partial<SyncResult> = {}): SyncResult {
    return {
      success: true,
      totalProcessed: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      duration: Date.now() - startTime,
      ...extra,
    };
  }

  static async syncReportsFromSheets(
    triggerSource = 'direct',
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const { minIntervalMs } = options;
    if (minIntervalMs && minIntervalMs > 0) {
      const startTime = Date.now();
      try {
        const state = await getSyncState('reports');
        const lastSyncAt = state.last_sync_at ? Date.parse(state.last_sync_at) : NaN;
        if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < minIntervalMs) {
          return this.emptyResult(startTime, { skipped: true });
        }
      } catch (stateError) {
        // Cannot tell how fresh the corpus is — fall through and sync rather
        // than silently skipping reconciliation.
        console.warn(`[SyncService] Cooldown check failed for ${triggerSource}, syncing anyway:`, stateError);
      }
    }

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
            .select('id, updated_at, synced_at')
            .eq('sheet_id', sheetId)
            .maybeSingle()
        : { data: null };

      // Same guard the full sync's pull uses: a locally-dirty row carries an
      // app edit the sheet has not confirmed yet, so only a genuinely newer
      // sheet edit may overwrite it.
      if (existing && shouldKeepLocalEdit(existing, report.updated_at)) {
        return { success: true, changed: false };
      }

      // Content was just fetched from the sheet — it is sheet-confirmed, so
      // stamp synced_at; otherwise the outbox would push it back (a no-op
      // sheet write) on every full sync.
      await persistReportMetadata(report, { markSynced: true });
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
        return this.emptyResult(startTime, { joined: true });
      }


      // Local (app-side) edits must reach the sheet BEFORE the pull reads it:
      // the pull treats any row whose content differs from the sheet as
      // "sheet changed" and overwrites the DB row — which would silently
      // revert an app edit whose sheet write never landed (e.g. the PATCH
      // evidence fallback). Draining the outbox first means the pull reads
      // the app's own values back and sees "unchanged".
      try {
        await this.pushLocalUpdatesToSheets();
      } catch (recErr) {
        console.warn('[SyncService] Outbox drain failed:', recErr);
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
      } catch (delErr) {
        console.warn('[SyncService] Delete-missing step failed:', delErr);
      }

      try {
        reportsService.invalidateCache();
      } catch (e) {
        console.warn('[SyncService] Failed to invalidate reports cache:', e);
      }

      const duration = Date.now() - startTime;
      // sync_version is the validator behind the /api/dashboard/reports ETag and
      // the dashboard_cache_entries snapshots. A sync that changed nothing must
      // not bump it, or every reconciliation run needlessly invalidates both.
      await completeSyncState({
        source: 'reports',
        success: true,
        rowCount: reports.length,
        bumpVersion: inserted + updated + deleted > 0,
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
        .select('id, sheet_id, source_fingerprint, source_sheet, content_hash, updated_at, synced_at')
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
    let unchanged = 0;

    for (const report of reports) {
      const row = buildReportsSyncRow(report, { markSynced: true });
      row.content_hash = buildRowContentHash(row);
      const sheetId = String(row.sheet_id);
      const fingerprint = String(row.source_fingerprint || '');
      const exactMatch = existingBySheetId.get(sheetId);

      if (exactMatch) {
        // Nothing this sync would write differs from what is stored — skip the
        // UPDATE entirely. Without this the sync rewrote every row on every run,
        // which meant `updated` was always non-zero, which meant sync_version
        // bumped every time and invalidated the dashboard caches for nothing.
        if (exactMatch.content_hash && exactMatch.content_hash === row.content_hash) {
          unchanged++;
          continue;
        }
        // Locally-dirty rows carry an app edit the sheet hasn't confirmed yet.
        // The outbox drains them to the sheet earlier in the same sync run, so
        // the pull must not overwrite them with stale sheet values here —
        // only a genuinely newer sheet edit wins (see shouldKeepLocalEdit).
        if (shouldKeepLocalEdit(exactMatch, report.updated_at)) {
          unchanged++;
          continue;
        }
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

    // Children move first, for the whole shift at once. Each item.row carries
    // the new uuidv5(sheet_id) as its id, so the UPDATE below changes the
    // report's primary key, and every comment, notification, document and
    // evidence file keyed on the old id would be left pointing at an id this
    // report no longer has — one the next report to occupy that sheet row
    // inherits. It has to be one batched call rather than one per report: a
    // single sheet insert shifts a run of rows into a chain of mappings, and
    // moving them one at a time sweeps each report's children along into the
    // next report's id (see relink_report_children_batch).
    //
    // Moving first also means a failure here leaves every report row untouched,
    // so the next sync retries the same relinks rather than committing key
    // changes whose children can no longer be found.
    let childrenRelinked = relinkItems.length === 0;
    if (relinkItems.length > 0) {
      try {
        await this.relinkReportChildren(relinkItems);
        childrenRelinked = true;
      } catch (error) {
        console.warn('[SyncService] Relink of child rows failed, skipping all relinks:', error);
        errors += relinkItems.length;
      }
    }

    if (childrenRelinked) {
      for (const item of relinkItems) {
        try {
          const { error } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .update(item.row)
            .eq('id', item.existingId);

          if (error) {
            throw error;
          }

          updated++;
        } catch (error) {
          console.warn(
            `[SyncService] Failed to relink ${item.previousSheetId} -> ${item.row.sheet_id}:`,
            error
          );
          errors++;
        }
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

    if (unchanged > 0) {
      console.log(
        `[SyncService] Skipped ${unchanged} unchanged row(s); wrote ${inserted} insert(s), ${updated} update(s)`
      );
    }

    return { inserted, updated, errors, insertedReports, unchanged };
  }

  /**
   * Carry every relinked report's children across the id change, as one
   * transaction. Throws so the caller abandons the whole batch rather than
   * committing report rows whose history it can no longer reach.
   */
  private static async relinkReportChildren(items: RelinkWorkItem[]) {
    const pairs = items
      .map((item) => ({
        previous_id: item.existingId,
        new_id: String(item.row.id || ''),
        previous_sheet_id: item.previousSheetId,
        new_sheet_id: String(item.row.sheet_id || ''),
      }))
      .filter((pair) => pair.new_id && pair.new_id !== pair.previous_id);

    if (pairs.length === 0) return;

    const { data, error } = await supabaseAdmin.rpc('relink_report_children_batch', {
      p_pairs: pairs,
    });

    if (error) throw error;

    const moved = (data || {}) as Record<string, number>;
    const total =
      (moved.comments || 0) +
      (moved.notifications || 0) +
      (moved.documents || 0) +
      (moved.evidence_files || 0);
    if (total > 0) {
      console.log(`[SyncService] Relinked ${total} child row(s) across ${pairs.length} report(s)`, moved);
    }
    if (moved.document_conflicts) {
      console.warn(
        `[SyncService] ${moved.document_conflicts} report document(s) left on a temporary id: the destination already has one`
      );
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

      // All dirty rows go out as a single values.batchUpdate — one Sheets API
      // call instead of one-per-row — so a 50-row backlog can't blow the
      // per-minute write quota on login-triggered syncs. synced_at is stamped
      // in one batched update after the push, instead of one Supabase round
      // trip per successful row. All-or-nothing: if the push throws (e.g.
      // quota still exceeded after retries), no rows get stamped and the next
      // sync retries them.
      const PUSH_BATCH_SIZE = 5;
      let syncedRows: typeof dirtyReports = [];
      try {
        syncedRows = await reportsService.updateReportsToSheets(
          dirtyReports.map((report) => ({ sheetId: report.sheet_id, report })),
          { skipLiveFetch: true }
        );
        pushed = syncedRows.length;
      } catch (pushError) {
        console.warn('[SyncService] Failed to push local updates to Sheets:', pushError);
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
