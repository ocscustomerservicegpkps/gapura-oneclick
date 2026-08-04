import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJoumpaStatusUpdate, isJoumpaReportSource } from './status-update.ts';

test('normalizes JOUMPA status updates and keeps final remarks aliases aligned', () => {
  assert.deepEqual(buildJoumpaStatusUpdate({
    status: 'selesai',
    action_taken: '  Followed up  ',
    kps_remarks: '  Case completed  ',
    remarks_by: '  OP - Test User  ',
  }), {
    status: 'CLOSED',
    action_taken: 'Followed up',
    final_remarks: 'Case completed',
    kps_remarks: 'Case completed',
    remarks_by: 'OP - Test User',
  });
});

test('prefers final_remarks when both final remark aliases are supplied', () => {
  const update = buildJoumpaStatusUpdate({
    status: 'OPEN',
    final_remarks: 'Canonical value',
    kps_remarks: 'Legacy value',
  });

  assert.equal(update.final_remarks, 'Canonical value');
  assert.equal(update.kps_remarks, 'Canonical value');
});

test('identifies JOUMPA reports without classifying ground-handling reports', () => {
  const spreadsheetId = 'joumpa-spreadsheet';
  const sheetName = 'Form Responses 1';

  assert.equal(isJoumpaReportSource({ source_spreadsheet_id: spreadsheetId }, spreadsheetId, sheetName), true);
  assert.equal(isJoumpaReportSource({
    source_sheet: sheetName,
    service_business_type: 'Joumpa Service',
  }, spreadsheetId, sheetName), true);
  assert.equal(isJoumpaReportSource({
    source_sheet: 'CGO',
    service_business_type: 'Ground Handling',
  }, spreadsheetId, sheetName), false);
});
