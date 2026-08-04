import type * as ExcelJS from "exceljs";

const GAPURA_EXCEL_THEME = {
  primary: "FF276B57",
  accent: "FF0F766E",
  headerText: "FFFFFFFF",
  bodyText: "FF1E293B",
  mutedText: "FF64748B",
  alternateRow: "FFF2F7F5",
  baseRow: "FFFFFFFF",
  border: "FFD8E3DF",
  openFill: "FFFFF3CD",
  openText: "FF9A6700",
  closedFill: "FFE7F6EC",
  closedText: "FF18794E",
  criticalFill: "FFFFE7E7",
  criticalText: "FFB42318",
  highFill: "FFFFEAD5",
  highText: "FFC2410C",
  mediumFill: "FFFFF3CD",
  mediumText: "FF9A6700",
  lowFill: "FFE7F6EC",
  lowText: "FF18794E",
  link: "FF0F766E",
} as const;

export type ExcelColumnKind =
  | "text"
  | "identifier"
  | "number"
  | "percentage"
  | "date"
  | "datetime"
  | "status"
  | "severity"
  | "multiline"
  | "url";

export interface AdvancedExcelColumn {
  header: string;
  kind?: ExcelColumnKind;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  horizontal?: "left" | "center" | "right";
}

interface AdvancedExcelTableOptions {
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
  name: string;
  columns: AdvancedExcelColumn[];
  rows: ExcelJS.CellValue[][];
  startRow?: number;
  startColumn?: number;
  freezeRows?: number;
  freezeColumns?: number;
  emptyMessage?: string;
}

const workbookTableNames = new WeakMap<ExcelJS.Workbook, Set<string>>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cellDisplayLength(value: ExcelJS.CellValue): number {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return 12;
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.length;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.reduce((total, part) => total + part.text.length, 0);
    }
    return 12;
  }
  return String(value).split("\n").reduce((longest, line) => Math.max(longest, line.length), 0);
}

function defaultColumnBounds(kind: ExcelColumnKind): { min: number; max: number } {
  switch (kind) {
    case "number": return { min: 10, max: 15 };
    case "percentage": return { min: 12, max: 16 };
    case "date": return { min: 14, max: 16 };
    case "datetime": return { min: 18, max: 22 };
    case "status": return { min: 13, max: 18 };
    case "severity": return { min: 13, max: 18 };
    case "identifier": return { min: 12, max: 22 };
    case "url": return { min: 24, max: 38 };
    case "multiline": return { min: 28, max: 48 };
    default: return { min: 12, max: 32 };
  }
}

function inferredHorizontal(kind: ExcelColumnKind): "left" | "center" | "right" {
  if (["number", "percentage"].includes(kind)) return "right";
  if (["date", "datetime", "status", "severity", "identifier"].includes(kind)) return "center";
  return "left";
}

function styleSemanticCell(cell: ExcelJS.Cell, kind: ExcelColumnKind): void {
  const wrapText = kind === "multiline" || kind === "url";
  cell.alignment = {
    vertical: wrapText ? "top" : "middle",
    horizontal: inferredHorizontal(kind),
    wrapText,
  };

  if (kind === "date") cell.numFmt = "dd mmm yyyy";
  if (kind === "datetime") cell.numFmt = "dd mmm yyyy, hh:mm";
  if (kind === "number") cell.numFmt = "#,##0";
  if (kind === "percentage") cell.numFmt = "0.0%";

  if (kind === "url" && cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
    cell.font = { name: "Aptos", size: 10, color: { argb: GAPURA_EXCEL_THEME.link }, underline: true };
  }

  const raw = typeof cell.value === "string"
    ? cell.value
    : cell.value && typeof cell.value === "object" && "text" in cell.value
      ? String(cell.value.text)
      : "";
  const normalized = raw.trim().toUpperCase();

  if (kind === "status") {
    if (normalized.includes("CLOSED") || normalized.includes("RESOLVED") || normalized.includes("SELESAI")) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.closedFill } };
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: GAPURA_EXCEL_THEME.closedText } };
    } else if (normalized.includes("OPEN") || normalized.includes("PENDING")) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.openFill } };
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: GAPURA_EXCEL_THEME.openText } };
    }
  }

  if (kind === "severity") {
    const semantic = normalized.includes("TOP") || normalized.includes("CRITICAL")
      ? [GAPURA_EXCEL_THEME.criticalFill, GAPURA_EXCEL_THEME.criticalText]
      : normalized.includes("HIGH")
        ? [GAPURA_EXCEL_THEME.highFill, GAPURA_EXCEL_THEME.highText]
        : normalized.includes("MEDIUM")
          ? [GAPURA_EXCEL_THEME.mediumFill, GAPURA_EXCEL_THEME.mediumText]
          : normalized.includes("LOW")
            ? [GAPURA_EXCEL_THEME.lowFill, GAPURA_EXCEL_THEME.lowText]
            : null;
    if (semantic) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: semantic[0] } };
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: semantic[1] } };
    }
  }
}

export function configureExcelWorkbook(workbook: ExcelJS.Workbook, subject: string): void {
  const now = new Date();
  workbook.creator = "Gapura Oneclick";
  workbook.lastModifiedBy = "Gapura Oneclick";
  workbook.created = now;
  workbook.modified = now;
  workbook.title = subject;
  workbook.subject = subject;
  workbook.company = "PT Gapura Angkasa";
  workbook.category = "Operational Export";
  workbook.keywords = "Gapura Oneclick, operational reports, export";
}

export function configureExcelWorksheet(
  worksheet: ExcelJS.Worksheet,
  options: { freezeRows?: number; freezeColumns?: number; landscape?: boolean } = {},
): void {
  const freezeRows = options.freezeRows ?? 1;
  const freezeColumns = options.freezeColumns ?? 0;
  worksheet.views = [{
    state: freezeRows || freezeColumns ? "frozen" : "normal",
    xSplit: freezeColumns,
    ySplit: freezeRows,
    showGridLines: false,
  }];
  worksheet.properties.defaultRowHeight = 18;
  worksheet.pageSetup = {
    orientation: options.landscape === false ? "portrait" : "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddFooter = "&LGapura Oneclick - Internal operational document&RPage &P of &N";
}

export function uniqueExcelTableName(workbook: ExcelJS.Workbook, preferredName: string): string {
  const names = workbookTableNames.get(workbook) ?? new Set<string>();
  workbookTableNames.set(workbook, names);

  let base = preferredName.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 220);
  if (!base || !/^[A-Za-z_]/.test(base)) base = `Table_${base || "Data"}`;
  if (/^[A-Za-z]{1,3}\d+$/i.test(base)) base = `Table_${base}`;

  let candidate = base;
  let suffix = 2;
  while (names.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  names.add(candidate.toLowerCase());
  return candidate;
}

export function styleExcelTitle(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromColumn: number,
  toColumn: number,
  title: string,
): void {
  if (toColumn > fromColumn) worksheet.mergeCells(rowNumber, fromColumn, rowNumber, toColumn);
  const row = worksheet.getRow(rowNumber);
  const cell = row.getCell(fromColumn);
  cell.value = title;
  cell.font = { name: "Aptos Display", bold: true, size: 16, color: { argb: GAPURA_EXCEL_THEME.headerText } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.primary } };
  cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  row.height = 32;
  for (let column = fromColumn + 1; column <= toColumn; column += 1) {
    row.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.primary } };
  }
}

export function styleExcelSectionHeader(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromColumn: number,
  toColumn: number,
  title?: string,
): void {
  if (title !== undefined) worksheet.getCell(rowNumber, fromColumn).value = title;
  if (toColumn > fromColumn) worksheet.mergeCells(rowNumber, fromColumn, rowNumber, toColumn);
  const row = worksheet.getRow(rowNumber);
  for (let column = fromColumn; column <= toColumn; column += 1) {
    const cell = row.getCell(column);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.accent } };
    cell.font = { name: "Aptos", bold: true, size: 11, color: { argb: GAPURA_EXCEL_THEME.headerText } };
    cell.alignment = { horizontal: "left", vertical: "middle", indent: column === fromColumn ? 1 : 0 };
  }
  row.height = 22;
}

export function addAdvancedExcelTable(options: AdvancedExcelTableOptions): ExcelJS.Table {
  const {
    workbook,
    worksheet,
    columns,
    rows,
    startRow = 1,
    startColumn = 1,
    freezeRows = startRow,
    freezeColumns = 0,
    emptyMessage,
  } = options;
  const name = uniqueExcelTableName(workbook, options.name);
  const safeRows = rows.length ? rows : [columns.map((_, index) => index === 0 ? (emptyMessage ?? "No data available") : "")];
  const ref = worksheet.getCell(startRow, startColumn).address;

  const table = worksheet.addTable({
    name,
    ref,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium4", showRowStripes: true, showFirstColumn: false, showLastColumn: false },
    columns: columns.map((column) => ({ name: column.header, filterButton: true })),
    rows: safeRows,
  });

  configureExcelWorksheet(worksheet, { freezeRows, freezeColumns, landscape: columns.length > 6 });
  worksheet.getRow(startRow).height = 32;

  columns.forEach((column, index) => {
    const columnNumber = startColumn + index;
    const headerCell = worksheet.getCell(startRow, columnNumber);
    headerCell.font = { name: "Aptos", bold: true, size: 10, color: { argb: GAPURA_EXCEL_THEME.headerText } };
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GAPURA_EXCEL_THEME.primary } };
    headerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerCell.border = { bottom: { style: "medium", color: { argb: GAPURA_EXCEL_THEME.accent } } };

    const kind = column.kind ?? "text";
    const bounds = defaultColumnBounds(kind);
    const longest = safeRows.reduce(
      (max, row) => Math.max(max, cellDisplayLength(row[index] ?? null) + 2),
      column.header.length + 2,
    );
    worksheet.getColumn(columnNumber).width = column.width ?? clamp(
      longest,
      column.minWidth ?? bounds.min,
      column.maxWidth ?? bounds.max,
    );

    for (let rowOffset = 0; rowOffset < safeRows.length; rowOffset += 1) {
      const rowNumber = startRow + 1 + rowOffset;
      const cell = worksheet.getCell(rowNumber, columnNumber);
      cell.font = { name: "Aptos", size: 10, color: { argb: GAPURA_EXCEL_THEME.bodyText } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowOffset % 2 === 0 ? GAPURA_EXCEL_THEME.baseRow : GAPURA_EXCEL_THEME.alternateRow },
      };
      cell.border = { bottom: { style: "hair", color: { argb: GAPURA_EXCEL_THEME.border } } };
      styleSemanticCell(cell, kind);
    }
  });

  for (let rowOffset = 0; rowOffset < safeRows.length; rowOffset += 1) {
    const row = worksheet.getRow(startRow + 1 + rowOffset);
    const needsWrap = columns.some((column, index) => {
      const value = safeRows[rowOffset][index];
      return column.kind === "multiline" || column.kind === "url" || cellDisplayLength(value ?? null) > 45;
    });
    row.height = needsWrap ? 32 : 20;
  }

  return table;
}

export function excelDate(value?: string | Date | null): Date | string {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const parsed = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  // Unambiguous ISO 8601 datetime (YYYY-MM-DDTHH:mm[:ss[.sss]][Z|+HH:MM]).
  // Other string formats (e.g. MM/DD/YYYY) are locale-ambiguous and are
  // returned as-is rather than risking a silently wrong date.
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(trimmed);
  if (isoDateTime) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
}

export function excelHyperlink(url?: string | null, label = "Open link"): ExcelJS.CellValue {
  const value = url?.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value;
  return { text: label, hyperlink: value, tooltip: value };
}
