"use client";

import type { Report } from "@/types";
import type { jsPDF as JsPdfDocument } from "jspdf";
import type { ExcelColumnKind } from "@/lib/excel-export-style";

export interface ReportExportFilters {
  startDate: string;
  endDate: string;
  branch: string;
  airline: string;
  area: string;
  caseClassification: string;
  status: string;
  severity: string;
  source: string;
  customerType: string;
  joumpaCategory: string;
  search: string;
}

export interface ReportFilterOptions {
  branches: string[];
  airlines: string[];
  areas: string[];
  caseClassifications: string[];
  statuses: string[];
  severities: string[];
  sources: string[];
  customerTypes: string[];
  joumpaCategories: string[];
}

export const DEFAULT_REPORT_EXPORT_FILTERS: ReportExportFilters = {
  startDate: "",
  endDate: "",
  branch: "",
  airline: "",
  area: "",
  caseClassification: "",
  status: "",
  severity: "",
  source: "",
  customerType: "",
  joumpaCategory: "",
  search: "",
};

const ILLEGAL_XML_CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g;
// Strip only *unpaired* surrogates (invalid in XML) \u2014 a blanket
// \uD800-\uDFFF match would also destroy valid surrogate pairs (e.g. emoji)
// since both halves of a pair fall in that range individually.
const UNPAIRED_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g;
const UNPAIRED_LOW_SURROGATE = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function stripIllegalXmlChars(text: string): string {
  return text
    .replace(ILLEGAL_XML_CONTROL_CHARS, "")
    .replace(UNPAIRED_HIGH_SURROGATE, "")
    .replace(UNPAIRED_LOW_SURROGATE, "");
}

export function cleanReportValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = stripIllegalXmlChars(String(value)).trim();
  if (!text || text === "-" || text === "#N/A" || text.toLowerCase() === "null") return "";
  return text;
}

export function reportDateValue(report: Report): Date | null {
  const raw = report.date_of_event || report.event_date || report.incident_date || report.created_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveReportBranch(report: Report): string {
  return cleanReportValue(report.branch)
    || cleanReportValue(report.reporting_branch)
    || cleanReportValue(report.station_code)
    || cleanReportValue(report.stations?.code)
    || cleanReportValue(report.kode_cabang);
}

export function resolveReportAirline(report: Report): string {
  return cleanReportValue(report.airlines)
    || cleanReportValue(report.airline)
    || cleanReportValue(report.maskapai_lookup);
}

export function resolveReportCaseClassification(report: Report): string {
  return cleanReportValue(report.case_classification)
    || cleanReportValue(report.case_category)
    || cleanReportValue(report.category)
    || cleanReportValue(report.main_category)
    || cleanReportValue(report.irregularity_complain_category);
}

export function resolveReportSeverity(report: Report): string {
  return cleanReportValue(report.severity_level)
    || cleanReportValue(report.severity)
    || "LOW";
}

export function reportMatchesSeverity(report: Report, severity: string): boolean {
  if (!severity) return true;
  const current = resolveReportSeverity(report).toUpperCase();
  const target = severity.toUpperCase();
  if (target === "TOP RISK") return current === "TOP RISK" || current === "CRITICAL";
  return current === target;
}

export function resolveReportSource(report: Report): string {
  return cleanReportValue(report.source_sheet)
    || cleanReportValue(report.primary_tag)
    || cleanReportValue(report.service_business_type)
    || "Manual";
}

function resolveReportArea(report: Report): string {
  return cleanReportValue(report.area);
}

function resolveCustomerType(report: Report): string {
  return cleanReportValue(report.customer_joumpa);
}

function resolveJoumpaCategory(report: Report): string {
  return cleanReportValue(report.category_case_joumpa);
}

function resolveReportAreaCategory(report: Report): string {
  return cleanReportValue(report.primary_tag)
    || cleanReportValue(report.terminal_area_category)
    || cleanReportValue(report.apron_area_category)
    || cleanReportValue(report.general_category)
    || resolveReportArea(report);
}

function resolveReportRootCause(report: Report): string {
  return cleanReportValue(report.root_cause)
    || cleanReportValue(report.root_caused)
    || cleanReportValue(report.identification_of_root);
}

function resolveReportActionTaken(report: Report): string {
  return cleanReportValue(report.action_taken)
    || cleanReportValue(report.immediate_action)
    || cleanReportValue(report.gapura_kps_action_taken);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function buildReportFilterOptions(reports: Report[]): ReportFilterOptions {
  return {
    branches: uniqueSorted(reports.map(resolveReportBranch)),
    airlines: uniqueSorted(reports.map(resolveReportAirline)),
    areas: uniqueSorted(reports.map(resolveReportArea)),
    caseClassifications: uniqueSorted(reports.map(resolveReportCaseClassification)),
    statuses: uniqueSorted(reports.map((report) => cleanReportValue(report.status))),
    severities: uniqueSorted(reports.map(resolveReportSeverity)),
    sources: uniqueSorted(reports.map(resolveReportSource)),
    customerTypes: uniqueSorted(reports.map(resolveCustomerType)),
    joumpaCategories: uniqueSorted(reports.map(resolveJoumpaCategory)),
  };
}

export function filterReportsForExport(reports: Report[], filters: ReportExportFilters): Report[] {
  const query = filters.search.trim().toLowerCase();
  const start = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
  const end = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

  return reports.filter((report) => {
    const date = reportDateValue(report);
    if (start && date && date < start) return false;
    if (end && date && date > end) return false;
    if (filters.branch && resolveReportBranch(report) !== filters.branch) return false;
    if (filters.airline && resolveReportAirline(report) !== filters.airline) return false;
    if (filters.area && resolveReportArea(report) !== filters.area) return false;
    if (filters.caseClassification && resolveReportCaseClassification(report) !== filters.caseClassification) return false;
    if (filters.status && cleanReportValue(report.status).toUpperCase() !== filters.status.toUpperCase()) return false;
    if (!reportMatchesSeverity(report, filters.severity)) return false;
    if (filters.source && resolveReportSource(report) !== filters.source) return false;
    if (filters.customerType && resolveCustomerType(report) !== filters.customerType) return false;
    if (filters.joumpaCategory && resolveJoumpaCategory(report) !== filters.joumpaCategory) return false;
    if (!query) return true;

    const haystack = [
      report.id,
      report.reference_number,
      report.title,
      report.report,
      report.description,
      report.flight_number,
      report.route,
      resolveReportBranch(report),
      resolveReportAirline(report),
      resolveReportArea(report),
      resolveReportCaseClassification(report),
      resolveReportSource(report),
      resolveCustomerType(report),
      resolveJoumpaCategory(report),
    ].map(cleanReportValue).join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

export function reportFilterSummary(filters: ReportExportFilters): string {
  const date = filters.startDate || filters.endDate
    ? `${filters.startDate || "start"} – ${filters.endDate || "now"}`
    : "All time";
  const parts = [
    date,
    filters.branch || "All branches",
    filters.airline || "All airlines",
    filters.area || "All areas",
    filters.caseClassification || "All classifications",
    filters.status || "All statuses",
    filters.severity || "All severities",
    filters.source || "All sources",
  ];
  if (filters.customerType) parts.push(filters.customerType);
  if (filters.joumpaCategory) parts.push(filters.joumpaCategory);
  return parts.join(" | ");
}

function formatDate(value: unknown): string {
  const text = cleanReportValue(value);
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportTitle(report: Report): string {
  return cleanReportValue(report.report) || cleanReportValue(report.title) || cleanReportValue(report.description) || "Untitled report";
}

function fileSafe(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report";
}

function formatPdfFieldValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map(cleanReportValue).filter(Boolean).join("\n");
  }
  return cleanReportValue(value);
}

function pdfSafeText(value: string): string {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ");
}

function formatDateTime(value: unknown): string {
  const text = cleanReportValue(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueReportLinks(values: unknown[]): string[] {
  return Array.from(new Set(values.flatMap((value) => Array.isArray(value) ? value : [value])
    .map(cleanReportValue)
    .filter(Boolean)));
}

interface ReportColumn {
  header: string;
  kind: ExcelColumnKind;
  get: (report: Report) => string;
}

function field(...keys: string[]): (report: Report) => string {
  return (report: Report) => keys.map((key) => cleanReportValue(report[key])).find(Boolean) || "";
}

function multilineField(...keys: string[]): (report: Report) => string {
  return (report: Report) => keys.map((key) => formatPdfFieldValue(report[key])).find(Boolean) || "";
}

function linksField(...keys: string[]): (report: Report) => string {
  return (report: Report) => uniqueReportLinks(keys.map((key) => report[key])).join("\n");
}

// Every column here corresponds to a Google Sheets column (via PROP_TO_HEADER
// in reports-service.ts). This is the canonical "all columns" list used for
// the full Excel export; the PDF export picks a curated subset of these.
export const FULL_REPORT_COLUMNS: ReportColumn[] = [
  { header: "Reference", kind: "identifier", get: (r) => cleanReportValue(r.reference_number) || r.id },
  { header: "Date of Event", kind: "date", get: field("date_of_event", "event_date", "incident_date") },
  { header: "Status", kind: "status", get: field("status") },
  { header: "Severity", kind: "severity", get: resolveReportSeverity },
  { header: "Priority", kind: "text", get: field("priority") },
  { header: "Source", kind: "text", get: resolveReportSource },
  { header: "Branch", kind: "identifier", get: resolveReportBranch },
  { header: "Hub", kind: "text", get: field("hub", "kode_hub") },
  { header: "Airline", kind: "text", get: resolveReportAirline },
  { header: "Flight Number", kind: "identifier", get: field("flight_number") },
  { header: "Aircraft Registration", kind: "identifier", get: field("aircraft_reg") },
  { header: "Route", kind: "identifier", get: field("route") },
  { header: "Area", kind: "text", get: resolveReportArea },
  { header: "Area Category", kind: "text", get: resolveReportAreaCategory },
  { header: "Terminal Area Category", kind: "text", get: field("terminal_area_category") },
  { header: "Apron Area Category", kind: "text", get: field("apron_area_category") },
  { header: "General Category", kind: "text", get: field("general_category") },
  { header: "Location", kind: "text", get: field("specific_location", "location") },
  { header: "Airport", kind: "text", get: field("airport_name", "airport_code", "branch_code") },
  { header: "Case Classification", kind: "text", get: resolveReportCaseClassification },
  { header: "Case Category", kind: "text", get: field("case_category") },
  { header: "Primary Tag", kind: "text", get: field("primary_tag") },
  { header: "Sub Category Note", kind: "text", get: field("sub_category_note") },
  { header: "Service Business Type", kind: "text", get: field("service_business_type") },
  { header: "Delay Code", kind: "text", get: field("delay_code") },
  { header: "Delay Duration", kind: "text", get: field("delay_duration") },
  { header: "Domestic / International", kind: "text", get: field("dom_inter", "kode_inter") },
  { header: "Week in Month", kind: "text", get: field("week_in_month") },
  { header: "Local MPA", kind: "text", get: field("lokal_mpa_lookup") },
  { header: "Report", kind: "multiline", get: reportTitle },
  { header: "Description", kind: "multiline", get: field("description") },
  { header: "Accident / Incident", kind: "multiline", get: field("accident_incident") },
  { header: "Issue Caused", kind: "multiline", get: field("issue_caused") },
  { header: "Breakdown Caused", kind: "multiline", get: field("breakdown_caused") },
  { header: "Root Cause", kind: "multiline", get: resolveReportRootCause },
  { header: "Immediate Action", kind: "multiline", get: field("immediate_action") },
  { header: "Action Taken", kind: "multiline", get: resolveReportActionTaken },
  { header: "Gapura / KPS Action Taken", kind: "multiline", get: field("gapura_kps_action_taken") },
  { header: "Preventive Action", kind: "multiline", get: field("preventive_action") },
  { header: "KPS Remarks", kind: "multiline", get: field("kps_remarks", "remarks_gapura_kps") },
  { header: "Remarks By", kind: "text", get: field("remarks_by") },
  { header: "Case Remarks", kind: "multiline", get: field("remarks_case") },
  { header: "Final Remarks", kind: "multiline", get: field("final_remarks") },
  { header: "Flight Related", kind: "text", get: multilineField("is_flight_related") },
  { header: "GSE Related", kind: "text", get: multilineField("is_gse_related") },
  { header: "GSE Number", kind: "text", get: field("gse_number") },
  { header: "GSE Name", kind: "text", get: field("gse_name") },
  { header: "GSE Availability Requirement", kind: "multiline", get: field("gse_available_requirement") },
  { header: "GSE Requirement", kind: "multiline", get: field("gse_requirement") },
  { header: "Motorized GSE", kind: "text", get: field("gse_motorized") },
  { header: "Non-Motorized GSE", kind: "text", get: field("gse_non_motorized") },
  { header: "Category Case GSE", kind: "text", get: field("category_case_gse") },
  { header: "Category Case Cargo", kind: "text", get: field("category_case_cargo") },
  { header: "JOUMPA Case", kind: "text", get: field("case_joumpa") },
  { header: "JOUMPA Compliment / Excellent Service", kind: "multiline", get: field("joumpa_compliment_report_excellent_service") },
  { header: "Category Case JOUMPA", kind: "text", get: resolveJoumpaCategory },
  { header: "JOUMPA Customer", kind: "text", get: resolveCustomerType },
  { header: "JOUMPA Customer Detail", kind: "multiline", get: field("detail_customer_joumpa") },
  { header: "Corporate Customer", kind: "text", get: field("corporate") },
  { header: "Corporate Profile", kind: "multiline", get: field("customer_company_profile_corporate") },
  { header: "Corporate Customer Detail", kind: "multiline", get: field("detail_customer_corporate") },
  { header: "Non-Corporate Customer", kind: "text", get: field("non_corporate") },
  { header: "Non-Corporate Background", kind: "multiline", get: field("customer_background_non_corporate") },
  { header: "Non-Corporate Customer Detail", kind: "multiline", get: field("detail_customer_non_corporate") },
  { header: "Cargo Case", kind: "text", get: field("case_cgo") },
  { header: "Reservation & Scheduling", kind: "multiline", get: field("reservation_scheduling") },
  { header: "Pax Assistance / Staff Performance", kind: "multiline", get: field("pax_assistance_staff_service_performance") },
  { header: "Baggage Delivery & Assistance", kind: "multiline", get: field("baggage_delivery_baggage_assistance") },
  { header: "Administration, Payment, Documentation & Marketing", kind: "multiline", get: field("administration_payment_documentation_marketing") },
  { header: "Customer Satisfaction Score", kind: "text", get: field("customer_satisfaction_score") },
  { header: "Customer Satisfaction Label", kind: "text", get: field("customer_satisfaction_label") },
  { header: "Investigator Notes", kind: "multiline", get: field("investigator_notes") },
  { header: "Manager Notes", kind: "multiline", get: field("manager_notes") },
  { header: "Partner Response Notes", kind: "multiline", get: field("partner_response_notes") },
  { header: "Validation Notes", kind: "multiline", get: field("validation_notes") },
  { header: "Escalation Division", kind: "text", get: field("esklasi_divisi") },
  { header: "Reporter", kind: "text", get: (r) => cleanReportValue(r.reporter_name) || cleanReportValue(r.users?.full_name) },
  { header: "Reporter Email", kind: "text", get: field("reporter_email") },
  { header: "Created At", kind: "datetime", get: field("created_at") },
  { header: "Updated At", kind: "datetime", get: field("updated_at") },
  { header: "Resolved At", kind: "datetime", get: field("resolved_at") },
  { header: "SLA Deadline", kind: "datetime", get: field("sla_deadline") },
  { header: "Source Row", kind: "text", get: field("row_number") },
  { header: "Supporting Evidence", kind: "multiline", get: field("supporting_evidence") },
  { header: "Evidence", kind: "url", get: linksField("evidence_urls", "evidence_url", "partner_evidence_urls") },
  { header: "Video Evidence", kind: "url", get: linksField("video_urls", "video_url") },
];

// Curated subset for the landscape PDF table export: operational context
// (when/where/who) plus cause identification and classification, per the
// station teams' printed-report requirements.
export const PDF_TABLE_COLUMN_HEADERS = [
  "Date of Event",
  "Branch",
  "Airline",
  "Flight Number",
  "Route",
  "Area Category",
  "Case Classification",
  "Severity",
  "Report",
  "Root Cause",
  "Action Taken",
  "Evidence",
];

const PDF_TABLE_COLUMN_WIDTHS: Record<string, number> = {
  "Date of Event": 16,
  Branch: 14,
  Airline: 20,
  "Flight Number": 15,
  Route: 17,
  "Area Category": 20,
  "Case Classification": 24,
  Severity: 15,
  Report: 38,
  "Root Cause": 30,
  "Action Taken": 30,
  Evidence: 22,
};

async function loadPdfLogoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  try {
    const response = await fetch("/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Unable to decode PDF logo"));
        element.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(320, image.naturalWidth);
      canvas.height = Math.round(canvas.width * (image.naturalHeight / image.naturalWidth));
      const drawing = canvas.getContext("2d");
      if (!drawing) return null;
      drawing.fillStyle = "#ffffff";
      drawing.fillRect(0, 0, canvas.width, canvas.height);
      drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.92);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

const PDF_TABLE_LAYOUT = {
  marginX: 14,
  tableStartY: 34,
  footerLineY: 199,
  footerTextY: 203,
} as const;

function drawPdfTableHeader(doc: JsPdfDocument, filters: ReportExportFilters, logoDataUrl: string | null, reportCount: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  if (logoDataUrl) {
    try {
      const imageFormat = logoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, imageFormat, PDF_TABLE_LAYOUT.marginX, 5, 32, 18, "gapura-oneclick-logo", "FAST");
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 118, 110);
      doc.text("Gapura Oneclick", PDF_TABLE_LAYOUT.marginX, 14);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text("Gapura Oneclick", PDF_TABLE_LAYOUT.marginX, 14);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Gapura Oneclick All Reports Export", pageWidth - PDF_TABLE_LAYOUT.marginX, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Operational context, cause identification and classification", pageWidth - PDF_TABLE_LAYOUT.marginX, 16, { align: "right" });

  const summary = pdfSafeText(reportFilterSummary(filters));
  const summaryLines = doc.splitTextToSize(summary, pageWidth - 110) as string[];
  doc.setFontSize(6.7);
  doc.text(summaryLines.slice(0, 2), 52, 23);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 118, 110);
  doc.text(`${reportCount} REPORTS`, pageWidth - PDF_TABLE_LAYOUT.marginX, 24, { align: "right" });
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.7);
  doc.line(PDF_TABLE_LAYOUT.marginX, 30, pageWidth - PDF_TABLE_LAYOUT.marginX, 30);
  doc.setTextColor(15, 23, 42);
}

function finalizePdfTableFooter(doc: JsPdfDocument): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(219, 229, 226);
    doc.setLineWidth(0.25);
    doc.line(PDF_TABLE_LAYOUT.marginX, PDF_TABLE_LAYOUT.footerLineY, pageWidth - PDF_TABLE_LAYOUT.marginX, PDF_TABLE_LAYOUT.footerLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Gapura Oneclick - Internal operational document", PDF_TABLE_LAYOUT.marginX, PDF_TABLE_LAYOUT.footerTextY);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - PDF_TABLE_LAYOUT.marginX, PDF_TABLE_LAYOUT.footerTextY, { align: "right" });
  }
}

function summaryTableCellValue(column: ReportColumn, report: Report): string {
  const value = column.get(report);
  if (!value) return "-";
  if (column.kind === "date") return formatDate(value);
  if (column.kind === "datetime") return formatDateTime(value);
  if (column.kind === "url") {
    const links = value.split("\n").filter(Boolean);
    return links.length ? `${links.length} file${links.length > 1 ? "s" : ""}` : "-";
  }
  return value;
}

function summaryTableColumns(): ReportColumn[] {
  return PDF_TABLE_COLUMN_HEADERS.map((header) => {
    const column = FULL_REPORT_COLUMNS.find((candidate) => candidate.header === header);
    if (!column) throw new Error(`Unknown summary table column: ${header}`);
    return column;
  });
}

function pdfTableCellValue(column: ReportColumn, report: Report): string {
  return pdfSafeText(summaryTableCellValue(column, report));
}

export async function buildReportsPdf(
  reports: Report[],
  filters: ReportExportFilters,
  options: { logoDataUrl?: string | null } = {},
): Promise<JsPdfDocument> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: false });
  const logoDataUrl = options.logoDataUrl === undefined ? await loadPdfLogoDataUrl() : options.logoDataUrl;

  if (!reports.length) {
    drawPdfTableHeader(doc, filters, logoDataUrl, reports.length);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("No reports matched the selected export filters.", PDF_TABLE_LAYOUT.marginX, PDF_TABLE_LAYOUT.tableStartY);
    return doc;
  }

  const columns = summaryTableColumns();

  autoTable(doc, {
    head: [["No", ...PDF_TABLE_COLUMN_HEADERS]],
    body: reports.map((report, index) => [
      String(index + 1),
      ...columns.map((column) => pdfTableCellValue(column, report)),
    ]),
    startY: PDF_TABLE_LAYOUT.tableStartY,
    margin: { left: PDF_TABLE_LAYOUT.marginX, right: PDF_TABLE_LAYOUT.marginX, top: PDF_TABLE_LAYOUT.tableStartY, bottom: 16 },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, overflow: "linebreak", valign: "top", textColor: [51, 65, 85] },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2, halign: "left" },
    alternateRowStyles: { fillColor: [247, 249, 248] },
    columnStyles: {
      0: { cellWidth: 8 },
      ...Object.fromEntries(
        PDF_TABLE_COLUMN_HEADERS.map((header, index) => [index + 1, { cellWidth: PDF_TABLE_COLUMN_WIDTHS[header] }]),
      ),
    },
    willDrawPage: () => drawPdfTableHeader(doc, filters, logoDataUrl, reports.length),
  });

  finalizePdfTableFooter(doc);
  return doc;
}

export async function exportReportsToExcel(reports: Report[], filters: ReportExportFilters): Promise<void> {
  const [exceljs, excelStyles] = await Promise.all([
    import("exceljs"),
    import("@/lib/excel-export-style"),
  ]);
  const { addAdvancedExcelTable, configureExcelWorkbook, excelDate, excelHyperlink, styleExcelTitle } = excelStyles;
  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet("All Reports");
  const now = new Date();
  const totalColumns = FULL_REPORT_COLUMNS.length + 1;
  configureExcelWorkbook(workbook, "Gapura Oneclick All Reports Export");
  styleExcelTitle(sheet, 1, 1, totalColumns, "Gapura Oneclick All Reports Export");
  sheet.mergeCells(2, 1, 2, totalColumns);
  sheet.getCell(2, 1).value = reportFilterSummary(filters);
  sheet.getCell(2, 1).font = { name: "Aptos", size: 10, color: { argb: "FF64748B" } };
  sheet.getCell(2, 1).alignment = { vertical: "middle", indent: 1 };
  sheet.mergeCells(3, 1, 3, totalColumns);
  sheet.getCell(3, 1).value = `Generated: ${now.toLocaleString("id-ID")}`;
  sheet.getCell(3, 1).font = { name: "Aptos", italic: true, size: 9, color: { argb: "FF64748B" } };
  sheet.getCell(3, 1).alignment = { vertical: "middle", indent: 1 };

  const columns = [
    { header: "No", kind: "number" as const, width: 7 },
    ...FULL_REPORT_COLUMNS.map((column) => ({ header: column.header, kind: column.kind })),
  ];
  const rows = reports.map((report, index) => [
    index + 1,
    ...FULL_REPORT_COLUMNS.map((column) => {
      const value = column.get(report);
      if (column.kind === "date" || column.kind === "datetime") return excelDate(value);
      if (column.kind === "url") {
        const links = value.split("\n").filter(Boolean);
        return links.length ? excelHyperlink(links[0], links.join("\n")) : "";
      }
      return value;
    }),
  ]);
  addAdvancedExcelTable({
    workbook,
    worksheet: sheet,
    name: "AllReportsTable",
    columns,
    rows,
    startRow: 5,
    freezeRows: 5,
    freezeColumns: 2,
    emptyMessage: "No reports matched the selected export filters.",
  });
  sheet.pageSetup.printTitlesRow = "5:5";

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `All-Reports-${Date.now()}.xlsx`);
}

export async function exportReportsToPdf(reports: Report[], filters: ReportExportFilters): Promise<void> {
  const doc = await buildReportsPdf(reports, filters);
  doc.save(`All-Reports-${Date.now()}.pdf`);
}

export async function exportReportsToDocx(reports: Report[], filters: ReportExportFilters): Promise<void> {
  const docx = await import("docx");
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType, PageOrientation,
  } = docx;

  const columns = summaryTableColumns();
  const headerLabels = ["No", ...PDF_TABLE_COLUMN_HEADERS];
  // Landscape twips (A4, 1in margins each side): 16838 page width - 2 * 1440 margin.
  const usableWidth = 13960;
  const noColumnWidth = 500;
  const columnWidth = Math.floor((usableWidth - noColumnWidth) / columns.length);

  const headerCell = (text: string, width: number) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "0F766E" },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 15 })] })],
  });
  const bodyCell = (text: string, width: number) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun({ text: text || "-", size: 15 })] })],
  });

  const table = new Table({
    width: { size: usableWidth, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1 }, insideVertical: { style: BorderStyle.SINGLE, size: 1 } },
    rows: [
      new TableRow({
        children: headerLabels.map((label, index) => headerCell(label, index === 0 ? noColumnWidth : columnWidth)),
      }),
      ...reports.map((report, index) => new TableRow({
        cantSplit: true,
        children: [
          bodyCell(String(index + 1), noColumnWidth),
          ...columns.map((column) => bodyCell(summaryTableCellValue(column, report), columnWidth)),
        ],
      })),
    ],
  });

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GAPURA ONECLICK ALL REPORTS EXPORT", bold: true, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: reportFilterSummary(filters), size: 16 })] }),
        new Paragraph({ text: "", spacing: { after: 100 } }),
        // Match the Excel/PDF exports: a header-only table with no rows
        // gives no indication the export is empty, so show the same
        // user-facing message instead of rendering the table shell.
        ...(reports.length
          ? [table]
          : [new Paragraph({ children: [new TextRun({ text: "No reports matched the selected export filters.", size: 20 })] })]),
      ],
    }],
  });
  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `All-Reports-${Date.now()}.docx`);
}

function evidenceLinks(report: Report): string[] {
  return [...(report.evidence_urls || []), report.evidence_url, ...(report.partner_evidence_urls || [])]
    .map(cleanReportValue)
    .filter(Boolean);
}

export async function exportSingleReportToDocx(report: Report): Promise<void> {
  const { generateWord } = await import("@/lib/utils/document-generator");
  const reference = cleanReportValue(report.reference_number) || report.id.slice(0, 8).toUpperCase();
  const flight = cleanReportValue(report.flight_number);
  const links = evidenceLinks(report);
  const normalizedForIrregularityTemplate = {
    ...report,
    reference_no: reference,
    incident_date: cleanReportValue(report.date_of_event)
      || cleanReportValue(report.event_date)
      || cleanReportValue(report.incident_date)
      || cleanReportValue(report.created_at),
    branch: resolveReportBranch(report),
    airline: resolveReportAirline(report),
    airlines: resolveReportAirline(report),
    main_category: resolveReportCaseClassification(report),
    category: resolveReportCaseClassification(report),
    subject: `${[resolveReportAirline(report), flight].filter(Boolean).join(" ")} - ${resolveReportCaseClassification(report)} - ${resolveReportSeverity(report)}`,
    attachment: links.length ? `${links.length} Files` : "",
    description: reportTitle(report),
    report: reportTitle(report),
    root_cause: cleanReportValue(report.root_cause)
      || cleanReportValue(report.root_caused)
      || cleanReportValue(report.identification_of_root)
      || cleanReportValue(report.issue_caused),
    root_caused: cleanReportValue(report.root_cause)
      || cleanReportValue(report.root_caused)
      || cleanReportValue(report.identification_of_root)
      || cleanReportValue(report.issue_caused),
    action_taken: cleanReportValue(report.action_taken)
      || cleanReportValue(report.immediate_action)
      || cleanReportValue(report.gapura_kps_action_taken),
    preventive_action: cleanReportValue(report.preventive_action)
      || cleanReportValue(report.remarks_case)
      || cleanReportValue(report.remarks_gapura_kps)
      || cleanReportValue(report.kps_remarks),
    reporter_name: cleanReportValue(report.reporter_name)
      || cleanReportValue(report.users?.full_name)
      || cleanReportValue(report.reporter_email),
    evidence_urls: links,
  };
  const nameParts = [flight, resolveReportBranch(report), reference].map(cleanReportValue).filter(Boolean).join("-");
  await generateWord(normalizedForIrregularityTemplate, null, {
    filename: `Download-This-Case-Report-${fileSafe(nameParts)}.docx`,
  });
}
