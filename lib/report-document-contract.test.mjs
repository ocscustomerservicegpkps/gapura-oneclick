import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFinalDocumentFilenames,
  inferReportDocumentType,
  isReportDocumentFormat,
  isReportDocumentType,
  sanitizeDocumentSegment,
} from './report-document-contract.ts';

test('recognizes only supported report document types and formats', () => {
  assert.equal(isReportDocumentType('IRREGULARITY'), true);
  assert.equal(isReportDocumentType('JOUMPA'), true);
  assert.equal(isReportDocumentType('OTHER'), false);
  assert.equal(isReportDocumentFormat('docx'), true);
  assert.equal(isReportDocumentFormat('pdf'), true);
  assert.equal(isReportDocumentFormat('xlsx'), false);
});

test('detects JOUMPA reports without misclassifying ordinary irregularity reports', () => {
  assert.equal(inferReportDocumentType({ service_business_type: 'Joumpa Service' }), 'JOUMPA');
  assert.equal(inferReportDocumentType({ category_case_joumpa: 'Reservation' }), 'JOUMPA');
  assert.equal(inferReportDocumentType({ category: 'Irregularity', area: 'APRON' }), 'IRREGULARITY');
});

test('builds safe stable DOCX and PDF names from the frozen editor snapshot', () => {
  const filenames = buildFinalDocumentFilenames({
    doc_title: 'IRREGULARITY REPORT FORM',
    flight_number: 'GA 123 / CGK',
  }, 'report-id');

  assert.deepEqual(filenames, {
    docx: 'IRREGULARITY_REPORT_FORM_GA_123_CGK.docx',
    pdf: 'IRREGULARITY_REPORT_FORM_GA_123_CGK.pdf',
  });
  assert.equal(sanitizeDocumentSegment('../../unsafe name', 'fallback'), 'unsafe_name');
});
