import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getGoogleSheets } from '@/lib/google-sheets';
import {
  JOUMPA_SHEET_ID,
  JOUMPA_SHEET_NAME,
  buildColumnMap,
  buildRecordFromForm,
  buildSheetRowValues,
  joumpaIdFromSheetId,
  parseSheetRowValues,
  clean,
  type JoumpaFormInput,
  type JoumpaRow,
} from '@/lib/joumpa/mapping';
import { buildJoumpaStatusUpdate, type JoumpaStatusUpdateInput } from '@/lib/joumpa/status-update';

const UPSERT_BATCH = 100;
const DELETE_BATCH = 500;
const PUSH_LIMIT = 50;
const ORPHAN_SCAN_PAGE = 1000;

interface JoumpaSyncResult {
  success: boolean;
  rows: number;
  upsertErrors: number;
  deleted: number;
  pushed: number;
  durationMs: number;
  error?: string;
}

function columnLetter(index: number): string {
  // 0-based index -> spreadsheet column letters (0 -> A, 26 -> AA)
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function rowNumberFromRange(range: string | null | undefined): number | null {
  if (!range) return null;
  const match = range.match(/![A-Z]+(\d+)(?::|$)/);
  return match ? Number(match[1]) : null;
}

export class JoumpaSyncService {
  private static activeSync: Promise<JoumpaSyncResult> | null = null;

  static async sync(): Promise<JoumpaSyncResult> {
    if (this.activeSync) return this.activeSync;
    const run = this.performSync();
    this.activeSync = run;
    try {
      return await run;
    } finally {
      if (this.activeSync === run) this.activeSync = null;
    }
  }

  private static async fetchHeaders(): Promise<string[]> {
    const sheets = await getGoogleSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `'${JOUMPA_SHEET_NAME}'!1:1`,
    });
    return ((res.data.values?.[0] || []) as string[]).map((h) => clean(h));
  }

  private static async fetchSheet(): Promise<{ headers: string[]; rows: JoumpaRow[] }> {
    const sheets = await getGoogleSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `'${JOUMPA_SHEET_NAME}'!A1:AZ`,
    });
    const values = (res.data.values || []) as string[][];
    if (values.length === 0) return { headers: [], rows: [] };
    const headers = (values[0] || []).map((h) => clean(h));
    const colMap = buildColumnMap(headers);
    const rows = values
      .slice(1)
      .filter((row) => row.some((cell) => clean(cell)))
      .map((row, idx) => parseSheetRowValues(row, headers, colMap, idx));
    return { headers, rows };
  }

  private static async performSync(): Promise<JoumpaSyncResult> {
    const started = Date.now();
    try {
      const headers = await this.fetchHeaders();

      // 1. Push: Supabase edits -> Sheets (updated_at > synced_at) first, so the
      // pull below upserts a sheet snapshot that already reflects pending local
      // edits instead of overwriting them with stale sheet values.
      const pushed = await this.pushLocalUpdatesToSheets(headers);

      // 2. Pull: Sheets -> Supabase (upsert by sheet_id, deterministic id)
      const { rows } = await this.fetchSheet();
      let upsertErrors = 0;
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const batch = rows.slice(i, i + UPSERT_BATCH);
        const { error } = await supabaseAdmin
          .from('joumpa_reports_sync')
          .upsert(batch, { onConflict: 'sheet_id', ignoreDuplicates: false });
        if (error) {
          upsertErrors += batch.length;
          console.error('[JoumpaSync] upsert failed:', error.message);
        }
      }

      // 3. Delete rows removed from the sheet
      const deleted = await this.deleteOrphans(rows);

      return {
        success: upsertErrors === 0,
        rows: rows.length,
        upsertErrors,
        deleted,
        pushed,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[JoumpaSync] sync failed:', message);
      return { success: false, rows: 0, upsertErrors: 0, deleted: 0, pushed: 0, durationMs: Date.now() - started, error: message };
    }
  }

  // The default PostgREST/Supabase row cap (1000) means a single unpaginated
  // select silently truncates on large tables, making every row past the cap
  // look orphaned. Page through with a stable order until a short page ends it.
  private static async fetchAllSyncRowIds(): Promise<{ id: string; sheet_id: string }[]> {
    const allRows: { id: string; sheet_id: string }[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from('joumpa_reports_sync')
        .select('id, sheet_id')
        .order('id', { ascending: true })
        .range(from, from + ORPHAN_SCAN_PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < ORPHAN_SCAN_PAGE) break;
      from += ORPHAN_SCAN_PAGE;
    }
    return allRows;
  }

  private static async deleteOrphans(rows: JoumpaRow[]): Promise<number> {
    // Fail closed: an empty fetch is far more likely a transient Sheets error
    // (429/5xx, quota, hidden sheet) than the user deleting every row. Deleting
    // orphans here would wipe the entire table. Mirror the canonical reports-sync
    // guard and refuse to orphan-delete when nothing was fetched.
    if (rows.length === 0) {
      console.warn('[JoumpaSync] Refusing orphan-delete: zero rows fetched (likely a transient upstream error).');
      return 0;
    }
    const currentSheetIds = new Set(rows.map((row) => row.sheet_id));
    let allRows: { id: string; sheet_id: string }[];
    try {
      allRows = await this.fetchAllSyncRowIds();
    } catch (error) {
      console.warn('[JoumpaSync] orphan fetch failed:', error instanceof Error ? error.message : String(error));
      return 0;
    }
    const orphans = allRows.filter((row) => !currentSheetIds.has(row.sheet_id));
    let deleted = 0;
    for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
      const ids = orphans.slice(i, i + DELETE_BATCH).map((row) => row.id);
      const { data: removed, error: removeError } = await supabaseAdmin
        .from('joumpa_reports_sync')
        .delete()
        .in('id', ids)
        .select('id');
      if (removeError) console.warn('[JoumpaSync] orphan delete failed:', removeError.message);
      else deleted += removed?.length || 0;
    }
    return deleted;
  }

  private static async pushLocalUpdatesToSheets(headers: string[]): Promise<number> {
    if (headers.length === 0) return 0;
    // Narrowed to bookkeeping columns (id/row_number/updated_at/synced_at/
    // sheet_id) plus every property buildSheetRowValues() can read (every key
    // in CANDIDATES, lib/joumpa/mapping.ts) — this table also carries many
    // JOUMPA customer/GSE-style columns that a sheet-row rewrite never touches.
    const { data: candidates, error } = await supabaseAdmin
      .from('joumpa_reports_sync')
      .select(`
        id, row_number, updated_at, synced_at, sheet_id,
        no, timestamp_raw, date_of_event, report_by, jenis_maskapai, airlines,
        flight_number, station, hub, route, delay_code, category_report, area,
        report, root_caused, action_taken, preventive_action, email_address,
        category_case_joumpa, joumpa_compliment_report_excellent_service,
        reservation_scheduling, pax_assistance_staff_service_performance,
        baggage_delivery_baggage_assistance, administration_payment_documentation_marketing,
        supporting_evidence, severity_level, status, final_remarks, remarks_by,
        customer_satisfaction_score, customer_joumpa, detail_customer_joumpa,
        corporate, customer_company_profile_corporate, detail_customer_corporate,
        non_corporate, customer_background_non_corporate, detail_customer_non_corporate,
        customer_satisfaction_label, case_joumpa, airport_name, airport_code, branch_code
      `)
      .order('updated_at', { ascending: false })
      .limit(PUSH_LIMIT * 10);
    if (error) {
      console.warn('[JoumpaSync] dirty-row fetch failed:', error.message);
      return 0;
    }
    if (!candidates || candidates.length === 0) return 0;

    const data = (candidates as JoumpaRow[])
      .filter((row) => !row.synced_at || new Date(row.updated_at) > new Date(row.synced_at))
      .slice(0, PUSH_LIMIT);
    if (data.length === 0) return 0;

    const sheets = await getGoogleSheets();
    const lastCol = columnLetter(headers.length - 1);
    const rowsToPush = (data as JoumpaRow[]).filter((row) => row.row_number);

    // Bounded concurrency (not fully sequential, not unbounded): each row
    // still gets its own Sheets write + independently-guarded synced_at
    // stamp, so one bad row can't block the rest of the batch (unlike a
    // single spreadsheets.values.batchUpdate call, which fails as a whole
    // on a single malformed range) — just done a few at a time instead of
    // one full round trip at a time.
    const PUSH_BATCH_SIZE = 5;
    let pushed = 0;
    for (let i = 0; i < rowsToPush.length; i += PUSH_BATCH_SIZE) {
      const batch = rowsToPush.slice(i, i + PUSH_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (row) => {
        const rowNum = row.row_number;
        const values = buildSheetRowValues(headers, row);
        await sheets.spreadsheets.values.update({
          spreadsheetId: JOUMPA_SHEET_ID,
          range: `'${JOUMPA_SHEET_NAME}'!A${rowNum}:${lastCol}${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
        // Guard on the updated_at observed at read time: if the row changed
        // concurrently (another edit landed mid-push), skip the stamp so the
        // row stays dirty and gets re-pushed on the next sync instead of the
        // concurrent edit being silently marked as already synced. A stamp
        // failure doesn't undo the successful sheet write, so it's reported
        // separately rather than failing the row.
        const { error: stampError } = await supabaseAdmin
          .from('joumpa_reports_sync')
          .update({ synced_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('updated_at', row.updated_at);
        if (stampError) {
          console.warn(`[JoumpaSync] synced_at stamp failed for row ${row.sheet_id}:`, stampError.message);
        }
      }));
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          pushed++;
        } else {
          console.warn(`[JoumpaSync] push row ${batch[idx].sheet_id} failed:`, result.reason);
        }
      });
    }
    return pushed;
  }

  static async updateReport(id: string, input: JoumpaStatusUpdateInput): Promise<JoumpaRow | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let currentRow: JoumpaRow | null = null;
    try {
      if (isUuid) {
        const { data, error } = await supabaseAdmin
          .from('joumpa_reports_sync')
          .select('*')
          .eq('id', id)
          .limit(1);
        if (error) throw error;
        if (data && data.length > 0) currentRow = data[0] as JoumpaRow;
      }
      if (!currentRow) {
        const { data, error } = await supabaseAdmin
          .from('joumpa_reports_sync')
          .select('*')
          .eq('sheet_id', id)
          .limit(1);
        if (error) throw error;
        if (data && data.length > 0) currentRow = data[0] as JoumpaRow;
      }
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : String(lookupError);
      throw new Error(`Failed to load JOUMPA report: ${message}`);
    }

    if (!currentRow) return null;
    const rowNumber = Number(currentRow.row_number)
      || Number(String(currentRow.sheet_id || '').match(/!row_(\d+)$/)?.[1]);
    if (!rowNumber) {
      throw new Error('JOUMPA report row number is missing');
    }

    const update = buildJoumpaStatusUpdate(input);
    if (Object.keys(update).length === 0) {
      throw new Error('No supported JOUMPA status fields were supplied');
    }

    const sheets = await getGoogleSheets();
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `'${JOUMPA_SHEET_NAME}'!1:1`,
    });
    const headers = ((headerRes.data.values?.[0] || []) as string[]).map((header) => clean(header));
    const columnMap = buildColumnMap(headers);
    const mergedRow = { ...currentRow, ...update };
    const sheetValues = buildSheetRowValues(headers, mergedRow);
    const sheetFields = ['status', 'action_taken', 'final_remarks', 'remarks_by'] as const;
    const batchData = sheetFields.flatMap((field) => {
      if (!(field in update)) return [];
      const columnIndex = columnMap[field];
      if (columnIndex === undefined) return [];
      return [{
        range: `'${JOUMPA_SHEET_NAME}'!${columnLetter(columnIndex)}${rowNumber}`,
        values: [[sheetValues[columnIndex]]],
      }];
    });

    if (batchData.length > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: JOUMPA_SHEET_ID,
          requestBody: {
            data: batchData,
            valueInputOption: 'RAW',
          },
        });
      } catch (error) {
        console.error('[JoumpaSync] status sheet update failed:', error);
        throw new Error('Failed to update the JOUMPA source sheet');
      }
    }

    const syncedAt = new Date().toISOString();
    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from('joumpa_reports_sync')
      .update({ ...update, synced_at: syncedAt })
      .eq('id', currentRow.id)
      .select('*')
      .single();

    if (updateError || !updatedRow) {
      console.error('[JoumpaSync] status Supabase update failed:', updateError);
      throw new Error('JOUMPA status was saved to Google Sheets, but Supabase synchronization failed');
    }

    return updatedRow as JoumpaRow;
  }

  // Create a JOUMPA report: append to the sheet (source of truth backup),
  // derive the row number, then insert the deterministic Supabase row.
  static async createReport(input: JoumpaFormInput): Promise<JoumpaRow> {
    const record = buildRecordFromForm(input);
    const sheets = await getGoogleSheets();

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `'${JOUMPA_SHEET_NAME}'!1:1`,
    });
    const headers = ((headerRes.data.values?.[0] || []) as string[]).map((h) => clean(h));

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `'${JOUMPA_SHEET_NAME}'!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [buildSheetRowValues(headers, record)] },
    });
    const appendedRange = appendRes.data.updates?.updatedRange;

    try {
      const rowNumber = rowNumberFromRange(appendedRange);
      if (!rowNumber) {
        throw new Error('Could not determine appended JOUMPA row number');
      }

      const sheetId = `${JOUMPA_SHEET_NAME}!row_${rowNumber}`;
      const nowIso = new Date().toISOString();
      const fullRow: JoumpaRow = {
        ...record,
        id: joumpaIdFromSheetId(sheetId),
        sheet_id: sheetId,
        row_number: rowNumber,
        created_at: nowIso,
        updated_at: nowIso,
        synced_at: nowIso,
      };

      const { error } = await supabaseAdmin
        .from('joumpa_reports_sync')
        .upsert(fullRow, { onConflict: 'sheet_id', ignoreDuplicates: false });
      if (error) throw error;

      return fullRow;
    } catch (error) {
      // The sheet append already committed a row before this failure. A caller
      // retry would otherwise append a second row on top of this orphaned one,
      // duplicating the JOUMPA entry. Best-effort clear it so retries stay clean.
      if (appendedRange) {
        try {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: JOUMPA_SHEET_ID,
            range: appendedRange,
          });
        } catch (cleanupError) {
          console.error(`[JoumpaSync] Failed to clean up orphaned append at ${appendedRange}:`, cleanupError);
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`JOUMPA report creation failed after sheet append (range ${appendedRange ?? 'unknown'}): ${message}`);
    }
  }
}
