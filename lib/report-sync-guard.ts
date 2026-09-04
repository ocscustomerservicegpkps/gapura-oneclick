import crypto from 'crypto';

/**
 * Pull-side guard for the Google Sheets sync: should the sync keep the stored
 * (local) row instead of overwriting it with the sheet's values?
 *
 * The stored row wins when it carries an app edit that has not been confirmed
 * on the sheet yet (updated_at newer than synced_at) and that edit is at
 * least as new as the sheet's own edit timestamp. A sheet row with no edit
 * timestamp cannot prove it is newer, so the local edit stays.
 *
 * `synced_at` is stamped only when the row's content was written to the sheet
 * (see buildReportsSyncRow's markSynced option), so "updated_at > synced_at"
 * is the dirty flag: an app edit waiting to be pushed to the sheet.
 */
export function shouldKeepLocalEdit(
  existing: { updated_at?: string | null; synced_at?: string | null },
  sheetUpdatedAt: string | null | undefined
): boolean {
  if (!existing.synced_at || !existing.updated_at) return false;
  const localEdit = new Date(existing.updated_at).getTime();
  if (!(localEdit > new Date(existing.synced_at).getTime())) return false;
  if (!sheetUpdatedAt) return true;
  return localEdit >= new Date(sheetUpdatedAt).getTime();
}

/**
 * Largest share of one sheet's stored rows a single sync may delete as orphans.
 * A real day of edits removes a handful of rows; anything past this is a sheet
 * that failed to load, got renamed, or came back filtered.
 */
export const ORPHAN_DELETE_MAX_RATIO = 0.5;

export type OrphanDeletionScope = {
  /** Sheet tab the counts belong to — used only in the reason string. */
  scope: string;
  /** Rows this run parsed out of that sheet. */
  parsedRows: number;
  /** Rows currently stored for that sheet. */
  storedRows: number;
  /** Stored rows the diff wants to delete. */
  orphanRows: number;
};

export type OrphanDeletionVerdict = { allowed: boolean; reason: string };

/**
 * Orphan deletion is the only destructive step in the pull sync, and it derives
 * "orphan" from the sheet's contents — so an empty, renamed, or half-read sheet
 * reads as "every stored row is gone" and wipes the tab's history. This scopes
 * the blast radius per sheet: a sheet that produced no rows can never authorise
 * a delete, and no sheet may drop more than `maxRatio` of what it has stored.
 */
export function checkOrphanDeletion(
  { scope, parsedRows, storedRows, orphanRows }: OrphanDeletionScope,
  maxRatio: number = ORPHAN_DELETE_MAX_RATIO
): OrphanDeletionVerdict {
  if (orphanRows <= 0) return { allowed: true, reason: `"${scope}": no orphans` };

  if (parsedRows <= 0) {
    return {
      allowed: false,
      reason: `"${scope}": sheet returned 0 rows but ${storedRows} are stored — refusing to delete ${orphanRows} (sheet empty, renamed, or unreadable)`,
    };
  }

  const ratio = storedRows > 0 ? orphanRows / storedRows : 1;
  if (ratio > maxRatio) {
    return {
      allowed: false,
      reason: `"${scope}": ${orphanRows}/${storedRows} stored rows are orphans (${(ratio * 100).toFixed(0)}% > ${(maxRatio * 100).toFixed(0)}% limit) — refusing to delete`,
    };
  }

  return { allowed: true, reason: `"${scope}": deleting ${orphanRows}/${storedRows} orphans` };
}

/**
 * Columns the app owns outright — the sheet has no source for any of them, so a
 * sheet-derived payload that mentions them can only ever erase user work.
 * Stripped from every pull-sync write; the DB defaults cover fresh inserts.
 */
export const APP_OWNED_REPORT_COLUMNS = [
  'investigator_notes',
  'manager_notes',
  'partner_response_notes',
  'validation_notes',
  'partner_evidence_urls',
  'remarks_gapura_kps',
  'user_id',
] as const;

export function stripAppOwnedColumns<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const column of APP_OWNED_REPORT_COLUMNS) delete out[column];
  return out;
}

// Regenerated on every sync regardless of whether anything changed, so they
// must not participate in change detection. created_at/updated_at fall back to
// now() when the sheet row carries no timestamp (see toIsoOrNow).
const VOLATILE_ROW_KEYS = new Set(['synced_at', 'updated_at', 'created_at', 'content_hash']);

/**
 * The same instant can come back from Postgres and from a parser in two
 * spellings — '2025-07-15T00:00:00.000Z' vs '2025-07-15 00:00:00+00'. Comparing
 * the raw strings makes every timestamp column look permanently changed.
 */
export function normalizeComparableValue(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/**
 * Which of the payload's own columns would actually change if it were written.
 * Empty means the write is a no-op and should be skipped.
 *
 * Scoped to the payload's keys so columns this writer does not set cannot make
 * a row look dirty, and run through the same volatile-key exclusions as
 * buildRowContentHash so the regenerated stamps don't either.
 */
export function diffAgainstStored(
  payload: Record<string, unknown>,
  stored: Record<string, unknown> | null | undefined
): string[] {
  if (!stored) return Object.keys(payload);

  return Object.keys(payload)
    .filter((key) => !VOLATILE_ROW_KEYS.has(key))
    .filter((key) => {
      const fresh = normalizeComparableValue(payload[key]);
      const current = normalizeComparableValue(stored[key]);
      return JSON.stringify(fresh ?? null) !== JSON.stringify(current ?? null);
    });
}

/** NUL — cannot occur inside a JSON-stringified value, so key=value pairs
 *  cannot be made to collide by crafting a cell that contains the separator. */
const HASH_FIELD_SEPARATOR = String.fromCharCode(0);

/**
 * Hash of everything a sync would actually write for a row. source_fingerprint
 * cannot serve this purpose — it covers only the ~15 identity fields used to
 * tell two incidents apart, so a Sheets edit to status, evidence, notes, or any
 * other column leaves it unchanged. Comparing this hash instead lets the sync
 * skip rows that are byte-identical to what is already stored.
 */
export function buildRowContentHash(row: Record<string, unknown>): string {
  const stable = Object.keys(row)
    .filter((key) => !VOLATILE_ROW_KEYS.has(key))
    .sort()
    .map((key) => `${key}=${JSON.stringify(row[key] ?? null)}`)
    .join(HASH_FIELD_SEPARATOR);

  return crypto.createHash('sha256').update(stable).digest('hex');
}
