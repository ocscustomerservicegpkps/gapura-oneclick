import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  addAdvancedExcelTable,
  configureExcelWorkbook,
  excelDate,
  excelHyperlink,
  uniqueExcelTableName,
} from './excel-export-style.ts';

test('creates a named native table with filter buttons, frozen panes, and typed cells', async () => {
  const workbook = new ExcelJS.Workbook();
  configureExcelWorkbook(workbook, 'Advanced export test');
  const worksheet = workbook.addWorksheet('Reports');

  const table = addAdvancedExcelTable({
    workbook,
    worksheet,
    name: 'All Reports Table',
    startRow: 3,
    freezeRows: 3,
    freezeColumns: 1,
    columns: [
      { header: 'Date', kind: 'date' },
      { header: 'Status', kind: 'status' },
      { header: 'Severity', kind: 'severity' },
      { header: 'Evidence', kind: 'url' },
    ],
    rows: [[
      excelDate('2026-07-16'),
      'OPEN',
      'TOP RISK',
      excelHyperlink('https://example.com/evidence', 'Evidence file'),
    ]],
  });

  assert.equal(table.name, 'All_Reports_Table');
  assert.equal(worksheet.views[0].state, 'frozen');
  assert.equal(worksheet.views[0].ySplit, 3);
  assert.equal(worksheet.getCell('A4').value instanceof Date, true);
  assert.equal(worksheet.getCell('A4').numFmt, 'dd mmm yyyy');
  assert.deepEqual(worksheet.getCell('D4').value, {
    text: 'Evidence file',
    hyperlink: 'https://example.com/evidence',
    tooltip: 'https://example.com/evidence',
  });
  assert.equal(table.table.columns.every((column) => column.filterButton !== false), true);

  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);
  assert.ok(reloaded.getWorksheet('Reports')?.getTable('All_Reports_Table'));
});

test('normalizes duplicate table names and produces a styled empty-state table', () => {
  const workbook = new ExcelJS.Workbook();
  const first = uniqueExcelTableName(workbook, 'A1');
  const second = uniqueExcelTableName(workbook, 'A1');
  assert.equal(first, 'Table_A1');
  assert.equal(second, 'Table_A1_2');

  const worksheet = workbook.addWorksheet('Empty');
  addAdvancedExcelTable({
    workbook,
    worksheet,
    name: 'EmptyTable',
    columns: [
      { header: 'Message', kind: 'text' },
      { header: 'Count', kind: 'number' },
    ],
    rows: [],
    emptyMessage: 'No data available',
  });
  assert.equal(worksheet.getCell('A2').value, 'No data available');
  assert.equal(worksheet.getCell('B2').value, '');
});
