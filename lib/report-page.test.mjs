import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_REPORT_PAGE_LIMIT,
  MAX_REPORT_PAGE_LIMIT,
  isPersistedReportPage,
  normalizeReportPage,
  parseReportLimit,
  reportsFromPayload,
  resolveReportPageAccess,
  withReportCursor,
} from './report-page.ts';
import {
  buildReportCursorFilter,
  decodeReportCursor,
  encodeReportCursor,
  sanitizeReportSearch,
} from './report-page-cursor.ts';

test('bounds report page limits', () => {
  assert.equal(parseReportLimit(null), DEFAULT_REPORT_PAGE_LIMIT);
  assert.equal(parseReportLimit('0'), 1);
  assert.equal(parseReportLimit('500'), MAX_REPORT_PAGE_LIMIT);
  assert.equal(parseReportLimit('invalid'), DEFAULT_REPORT_PAGE_LIMIT);
});

test('round trips a compound cursor and rejects malformed input', () => {
  const cursor = { createdAt: '2026-07-16T08:00:00.000Z', id: 'report_123' };
  assert.deepEqual(decodeReportCursor(encodeReportCursor(cursor)), cursor);
  assert.equal(decodeReportCursor('not-base64-json'), null);
  assert.equal(decodeReportCursor(encodeReportCursor({ ...cursor, id: 'bad,id' })), null);
  assert.equal(
    buildReportCursorFilter(cursor),
    'created_at.lt."2026-07-16T08:00:00.000Z",and(created_at.eq."2026-07-16T08:00:00.000Z",id.lt."report_123")',
  );
  assert.equal(sanitizeReportSearch('  Gate 1,(OPEN)*  '), 'Gate 1 OPEN');
});

test('normalizes legacy arrays while preserving the typed page contract', () => {
  const legacy = [{ id: 'report-1' }];
  const page = normalizeReportPage(legacy);
  assert.deepEqual(reportsFromPayload(page), legacy);
  assert.equal(page.pagination.hasMore, false);
  assert.equal(page.meta.source, 'fresh');
});

test('builds stable next-page URLs without duplicating cursor parameters', () => {
  assert.equal(
    withReportCursor('/api/reports?status=OPEN&cursor=old', 'next', 50),
    '/api/reports?status=OPEN&cursor=next&limit=50',
  );
});

test('accepts only matching, non-expired persistent pages', () => {
  const now = Date.now();
  const page = normalizeReportPage([{ id: 'report-1' }]);
  const cached = { schema: 1, query: '/api/reports', timestamp: now, page };
  assert.equal(isPersistedReportPage(cached, '/api/reports', now), true);
  assert.equal(isPersistedReportPage(cached, '/api/admin/reports', now), false);
  assert.equal(isPersistedReportPage({ ...cached, timestamp: 0 }, '/api/reports', now), false);
});

test('keeps report page authorization role-scoped', () => {
  assert.deepEqual(resolveReportPageAccess('SUPER_ADMIN', 'admin'), { kind: 'company' });
  assert.deepEqual(resolveReportPageAccess('DIVISI_OS', 'admin'), { kind: 'company' });
  assert.deepEqual(resolveReportPageAccess('PARTNER_OP', 'standard'), { kind: 'company' });
  assert.deepEqual(resolveReportPageAccess('MANAGER_CABANG', 'admin'), { kind: 'manager' });
  assert.deepEqual(resolveReportPageAccess('STAFF_CABANG', 'admin'), { kind: 'forbidden' });
  assert.deepEqual(resolveReportPageAccess('STAFF_CABANG', 'standard'), { kind: 'employee' });
});
