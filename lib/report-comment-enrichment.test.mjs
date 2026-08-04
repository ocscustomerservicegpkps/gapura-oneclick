import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachCommentsToReports,
  buildReportDetailSnapshot,
  collectReportCommentIdentifiers,
} from './report-comment-enrichment.ts';

function comment(overrides) {
  return {
    id: 'comment-1',
    report_id: 'report-1',
    content: 'Feedback',
    created_at: '2026-07-16T08:00:00.000Z',
    users: { full_name: 'Reviewer' },
    ...overrides,
  };
}

test('attaches comments through stable and legacy identifiers in chronological order', () => {
  const reports = [
    { id: 'report-1', sheet_id: 'SHEET!row_2', original_id: 'legacy-1', title: 'First' },
    { id: 'report-2', sheet_id: 'SHEET!row_3', title: 'Second' },
  ];
  const comments = [
    comment({ id: 'comment-2', report_id: 'SHEET!row_2', created_at: '2026-07-16T09:00:00.000Z' }),
    comment({ id: 'comment-1', report_id: 'report-1', created_at: '2026-07-16T08:00:00.000Z' }),
    comment({ id: 'comment-1', report_id: 'legacy-1', created_at: '2026-07-16T08:00:00.000Z' }),
  ];

  const result = attachCommentsToReports(reports, comments);

  assert.deepEqual(result[0].comments.map(({ id }) => id), ['comment-1', 'comment-2']);
  assert.deepEqual(result[1].comments, []);
  assert.deepEqual(collectReportCommentIdentifiers(reports), [
    'report-1',
    'SHEET!row_2',
    'legacy-1',
    'report-2',
    'SHEET!row_3',
  ]);
});

test('does not attach a comment through an identifier shared by multiple reports', () => {
  const reports = [
    { id: 'report-1', sheet_id: 'shared-id' },
    { id: 'report-2', original_id: 'shared-id' },
  ];

  const result = attachCommentsToReports(reports, [comment({ report_id: 'shared-id' })]);

  assert.deepEqual(result.map((report) => report.comments), [[], []]);
});

test('uses preloaded comments on the first dialog snapshot and isolates later report responses', () => {
  const preloaded = [comment({ report_id: undefined })];
  const initialReport = { id: 'report-1', title: 'First', comments: preloaded };

  assert.equal(buildReportDetailSnapshot(initialReport, null, null).comments, preloaded);

  const staleLoadedComments = {
    reportId: 'report-2',
    comments: [comment({ id: 'other-comment', report_id: undefined })],
  };
  assert.equal(
    buildReportDetailSnapshot(initialReport, { id: 'report-2', title: 'Second', comments: [] }, staleLoadedComments).comments,
    preloaded,
  );
});
