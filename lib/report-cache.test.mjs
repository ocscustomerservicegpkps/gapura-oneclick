import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeReportUpdate } from './report-cache.ts';

test('merges an updated report while preserving enriched cached fields', () => {
  const reports = [{
    id: 'report-1',
    status: 'OPEN',
    title: 'Cached title',
    stations: { code: 'CGK' },
  }];

  const result = mergeReportUpdate(reports, {
    id: 'report-1',
    status: 'CLOSED',
    kps_remarks: 'Completed',
  });

  assert.notEqual(result, reports);
  assert.deepEqual(result, [{
    id: 'report-1',
    status: 'CLOSED',
    title: 'Cached title',
    stations: { code: 'CGK' },
    kps_remarks: 'Completed',
  }]);
});

test('keeps the same cache reference when the report is not present', () => {
  const reports = [{ id: 'report-1', status: 'OPEN' }];
  const result = mergeReportUpdate(reports, { id: 'report-2', status: 'CLOSED' });

  assert.equal(result, reports);
});

test('keeps an uninitialized cache uninitialized', () => {
  assert.equal(mergeReportUpdate(undefined, { id: 'report-1', status: 'CLOSED' }), undefined);
});
