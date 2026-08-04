import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReportsPdf,
  DEFAULT_REPORT_EXPORT_FILTERS,
  FULL_REPORT_COLUMNS,
  PDF_TABLE_COLUMN_HEADERS,
} from './reports-export.ts';

function baseReport(overrides = {}) {
  return {
    id: 'report-001',
    user_id: 'internal-user-id',
    title: 'Baggage handling irregularity',
    description: '',
    location: 'Make-up Area',
    status: 'OPEN',
    severity: 'HIGH RISK',
    created_at: '2026-07-12T03:04:00.000Z',
    updated_at: '2026-07-14T01:20:00.000Z',
    reference_number: 'IP302',
    date_of_event: '2026-07-12',
    branch: 'CGK',
    airlines: 'Pelita Air',
    flight_number: 'IP302',
    case_classification: 'Baggage',
    ...overrides,
  };
}

test('every PDF table column maps to a known full-report column', () => {
  const headers = new Set(FULL_REPORT_COLUMNS.map((column) => column.header));
  PDF_TABLE_COLUMN_HEADERS.forEach((header) => {
    assert.ok(headers.has(header), `missing full-report column for PDF header "${header}"`);
  });
});

test('full report columns resolve operational context and cause identification fields', () => {
  const report = baseReport({
    report: 'Full operational narrative',
    root_cause: 'Incorrect booking destination was selected.',
    action_taken: 'The baggage was traced and redirected.',
    primary_tag: 'Terminal - Check-in',
    evidence_urls: ['https://example.com/evidence-1', 'https://example.com/evidence-1'],
    evidence_url: 'https://example.com/evidence-2',
  });

  const byHeader = Object.fromEntries(FULL_REPORT_COLUMNS.map((column) => [column.header, column.get(report)]));
  assert.equal(byHeader['Report'], 'Full operational narrative');
  assert.equal(byHeader['Root Cause'], 'Incorrect booking destination was selected.');
  assert.equal(byHeader['Action Taken'], 'The baggage was traced and redirected.');
  assert.equal(byHeader['Area Category'], 'Terminal - Check-in');
  assert.equal(byHeader['Case Classification'], 'Baggage');
  assert.equal(byHeader['Branch'], 'CGK');
  assert.equal(byHeader['Airline'], 'Pelita Air');
  assert.equal(byHeader['Evidence'], 'https://example.com/evidence-1\nhttps://example.com/evidence-2');
});

test('builds a landscape PDF table that paginates a large report set', async () => {
  const reports = Array.from({ length: 60 }, (_, index) => baseReport({
    id: `report-${index}`,
    reference_number: `IP${index}`,
    report: `Row ${index} narrative describing baggage handling, verification, coordination, and corrective action in detail.`,
  }));
  const doc = await buildReportsPdf(reports, DEFAULT_REPORT_EXPORT_FILTERS, { logoDataUrl: null });

  assert.equal(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight(), true);
  assert.ok(doc.getNumberOfPages() >= 2);
  assert.ok(doc.output('arraybuffer').byteLength > 5_000);
});

test('renders a placeholder page when there are no reports to export', async () => {
  const doc = await buildReportsPdf([], DEFAULT_REPORT_EXPORT_FILTERS, { logoDataUrl: null });
  assert.equal(doc.getNumberOfPages(), 1);
});
