import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_OWNED_REPORT_COLUMNS,
  buildRowContentHash,
  checkOrphanDeletion,
  diffAgainstStored,
  normalizeComparableValue,
  shouldKeepLocalEdit,
  stripAppOwnedColumns,
} from './report-sync-guard.ts';

const T0 = '2026-08-08T00:00:00.000Z';
const later = (ms) => new Date(Date.parse(T0) + ms).toISOString();

test('returns false when the row is not locally dirty (synced_at newer than updated_at)', () => {
  assert.equal(shouldKeepLocalEdit({ updated_at: T0, synced_at: later(60_000) }, null), false);
});

test('returns false when the row was never pushed (synced_at null) — sheet-origin rows stay overwritable', () => {
  assert.equal(shouldKeepLocalEdit({ updated_at: T0, synced_at: null }, null), false);
});

test('dirty row + no sheet edit timestamp → keep local edit (sheet cannot prove recency)', () => {
  const row = { updated_at: later(60_000), synced_at: T0 };
  assert.equal(shouldKeepLocalEdit(row, null), true);
  assert.equal(shouldKeepLocalEdit(row, undefined), true);
});

test('dirty row + sheet edit strictly newer → sheet wins (LWW)', () => {
  const row = { updated_at: later(60_000), synced_at: T0 };
  assert.equal(shouldKeepLocalEdit(row, later(120_000)), false);
});

test('dirty row + sheet edit same instant → keep local edit (tie goes to the app)', () => {
  const row = { updated_at: later(60_000), synced_at: T0 };
  assert.equal(shouldKeepLocalEdit(row, later(60_000)), true);
});

test('dirty row + sheet edit older → keep local edit', () => {
  const row = { updated_at: later(120_000), synced_at: T0 };
  assert.equal(shouldKeepLocalEdit(row, later(60_000)), true);
});

test('edge: invalid dates are treated as not-dirty (false) instead of throwing', () => {
  assert.equal(shouldKeepLocalEdit({ updated_at: 'garbage', synced_at: T0 }, null), false);
  assert.equal(shouldKeepLocalEdit({ updated_at: T0, synced_at: 'garbage' }, null), false);
});

const scope = (over) => ({ scope: 'NON CARGO', parsedRows: 100, storedRows: 100, orphanRows: 0, ...over });

test('checkOrphanDeletion: nothing to delete is always allowed', () => {
  assert.equal(checkOrphanDeletion(scope({ orphanRows: 0 })).allowed, true);
  assert.equal(checkOrphanDeletion(scope({ parsedRows: 0, storedRows: 0, orphanRows: 0 })).allowed, true);
});

test('checkOrphanDeletion: empty sheet can never authorise a delete', () => {
  const verdict = checkOrphanDeletion(scope({ parsedRows: 0, storedRows: 4231, orphanRows: 4231 }));
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /sheet returned 0 rows/);
});

test('checkOrphanDeletion: a normal day of deletions passes', () => {
  assert.equal(checkOrphanDeletion(scope({ parsedRows: 995, storedRows: 1000, orphanRows: 5 })).allowed, true);
});

test('checkOrphanDeletion: deleting more than half the sheet is refused', () => {
  const verdict = checkOrphanDeletion(scope({ parsedRows: 400, storedRows: 1000, orphanRows: 600 }));
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /60% > 50% limit/);
});

test('checkOrphanDeletion: exactly at the ratio is allowed, one row past is not', () => {
  assert.equal(checkOrphanDeletion(scope({ parsedRows: 50, storedRows: 100, orphanRows: 50 })).allowed, true);
  assert.equal(checkOrphanDeletion(scope({ parsedRows: 49, storedRows: 100, orphanRows: 51 })).allowed, false);
});

test('checkOrphanDeletion: ratio is configurable', () => {
  const input = scope({ parsedRows: 900, storedRows: 1000, orphanRows: 100 });
  assert.equal(checkOrphanDeletion(input, 0.05).allowed, false);
  assert.equal(checkOrphanDeletion(input, 0.5).allowed, true);
});

test('stripAppOwnedColumns: removes every app-owned column and keeps the rest', () => {
  const row = { sheet_id: 'NON CARGO!row_2', status: 'CLOSED', report: 'text' };
  for (const column of APP_OWNED_REPORT_COLUMNS) row[column] = 'user work';

  const stripped = stripAppOwnedColumns(row);

  assert.deepEqual(Object.keys(stripped).sort(), ['report', 'sheet_id', 'status']);
  assert.equal(stripped.status, 'CLOSED');
});

test('stripAppOwnedColumns: does not mutate the input row', () => {
  const row = { sheet_id: 'CGO!row_9', manager_notes: 'keep me' };
  stripAppOwnedColumns(row);
  assert.equal(row.manager_notes, 'keep me');
});

// Golden digest, pinned. Stored content_hash values are compared against fresh
// ones to decide whether a row needs writing, so any drift in the separator,
// the key ordering, or the volatile-key set makes the next sync see every row
// as changed and rewrite the entire corpus.
test('buildRowContentHash: is byte-stable against the pinned digest', () => {
  const row = {
    sheet_id: 'NON CARGO!row_7',
    report: 'Baggage left on the apron',
    status: 'CLOSED',
    evidence_urls: ['https://drive.example/a', 'https://drive.example/b'],
    row_number: 7,
    delay_code: null,
    synced_at: '2026-08-08T00:00:00.000Z',
    updated_at: '2026-08-08T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    content_hash: 'stale',
  };
  assert.equal(
    buildRowContentHash(row),
    '8e071aa7d91ff6dca7b273859640c9680746f385aef2e39bb8886b702d7f4d30'
  );
});

test('buildRowContentHash: separator is a character JSON values cannot contain', () => {
  // With a printable separator, {a:'x', b:'y'} could be forged by one crafted key.
  assert.notEqual(buildRowContentHash({ a: 'x', b: 'y' }), buildRowContentHash({ 'a="x" b': 'y' }));
});

test('buildRowContentHash: volatile columns do not affect the hash', () => {
  const base = { sheet_id: 'CGO!row_3', report: 'x' };
  assert.equal(
    buildRowContentHash({ ...base, synced_at: 'a', updated_at: 'b', created_at: 'c', content_hash: 'd' }),
    buildRowContentHash(base)
  );
});

test('buildRowContentHash: key order does not affect the hash, values do', () => {
  assert.equal(
    buildRowContentHash({ a: 1, b: 2 }),
    buildRowContentHash({ b: 2, a: 1 })
  );
  assert.notEqual(
    buildRowContentHash({ a: 1, b: 2 }),
    buildRowContentHash({ a: 1, b: 3 })
  );
});

test('buildRowContentHash: undefined and null are the same absent value', () => {
  assert.equal(buildRowContentHash({ a: undefined }), buildRowContentHash({ a: null }));
});

test('normalizeComparableValue: the same instant in either spelling compares equal', () => {
  assert.equal(
    normalizeComparableValue('2025-07-15 00:00:00+00'),
    normalizeComparableValue('2025-07-15T00:00:00.000Z')
  );
  assert.equal(normalizeComparableValue('2025-07-15'), '2025-07-15', 'bare dates are left alone');
  assert.equal(normalizeComparableValue('OPEN'), 'OPEN');
  assert.equal(normalizeComparableValue(undefined), null);
});

test('diffAgainstStored: an unchanged row produces no diff', () => {
  const stored = { sheet_id: 'CGO!row_3', status: 'CLOSED', report: 'x', evidence_urls: ['a', 'b'] };
  assert.deepEqual(diffAgainstStored({ ...stored }, stored), []);
});

test('diffAgainstStored: a real change is still caught', () => {
  const stored = { sheet_id: 'CGO!row_3', status: 'CLOSED', report: 'x' };
  assert.deepEqual(diffAgainstStored({ ...stored, status: 'OPEN' }, stored), ['status']);
  assert.deepEqual(diffAgainstStored({ ...stored, report: 'y' }, stored), ['report']);
});

test('diffAgainstStored: array contents are compared, not identity', () => {
  const stored = { evidence_urls: ['a', 'b'] };
  assert.deepEqual(diffAgainstStored({ evidence_urls: ['a', 'b'] }, stored), []);
  assert.deepEqual(diffAgainstStored({ evidence_urls: ['a'] }, stored), ['evidence_urls']);
});

test('diffAgainstStored: regenerated stamps never count as a change', () => {
  const stored = { sheet_id: 'x', synced_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z' };
  const fresh = { sheet_id: 'x', synced_at: '2026-08-08T00:00:00Z', updated_at: '2026-08-08T00:00:00Z', created_at: '2026-08-08T00:00:00Z' };
  assert.deepEqual(diffAgainstStored(fresh, stored), []);
});

test('diffAgainstStored: timestamp spelling differences are not changes', () => {
  const stored = { resolved_at: '2025-01-24 17:00:00+00' };
  assert.deepEqual(diffAgainstStored({ resolved_at: '2025-01-24T17:00:00.000Z' }, stored), []);
});

test('diffAgainstStored: columns the writer does not set cannot dirty the row', () => {
  const stored = { sheet_id: 'x', status: 'OPEN', manager_notes: 'set by a human' };
  assert.deepEqual(diffAgainstStored({ sheet_id: 'x', status: 'OPEN' }, stored), []);
});

test('diffAgainstStored: no stored row means everything is new', () => {
  assert.deepEqual(diffAgainstStored({ a: 1, b: 2 }, null), ['a', 'b']);
});
