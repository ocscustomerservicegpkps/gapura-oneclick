export const REPORT_DOCUMENTS_BUCKET = 'report-documents';
export const MAX_REPORT_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_REPORT_DOCUMENT_SNAPSHOT_BYTES = 256 * 1024;
export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME_TYPE = 'application/pdf';

const REPORT_DOCUMENT_TYPES = ['IRREGULARITY', 'JOUMPA'] as const;
export type ReportDocumentType = typeof REPORT_DOCUMENT_TYPES[number];
export type ReportDocumentFormat = 'docx' | 'pdf';

export function isReportDocumentType(value: unknown): value is ReportDocumentType {
  return typeof value === 'string' && REPORT_DOCUMENT_TYPES.includes(value as ReportDocumentType);
}

export function isReportDocumentFormat(value: unknown): value is ReportDocumentFormat {
  return value === 'docx' || value === 'pdf';
}

export function sanitizeDocumentSegment(value: string, fallback: string): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(0, 100);
  return sanitized || fallback;
}

export function inferReportDocumentType(report: Record<string, unknown>): ReportDocumentType {
  if (
    report.category_case_joumpa ||
    report.customer_joumpa ||
    report.detail_customer_joumpa
  ) {
    return 'JOUMPA';
  }

  const values = [
    report.category,
    report.main_category,
    report.source_sheet,
    report.service_business_type,
  ].map((value) => String(value || '').toLowerCase());

  return values.some((value) => value.includes('joumpa')) ? 'JOUMPA' : 'IRREGULARITY';
}

export function buildFinalDocumentFilenames(
  snapshot: Record<string, unknown>,
  reportId: string,
): { docx: string; pdf: string } {
  const title = sanitizeDocumentSegment(String(snapshot.doc_title || 'Irregularity_Report'), 'Irregularity_Report');
  const reference = sanitizeDocumentSegment(
    String(snapshot.flight_number || snapshot.reference_no || reportId),
    'Report',
  );
  const base = `${title}_${reference}`.slice(0, 180);
  return { docx: `${base}.docx`, pdf: `${base}.pdf` };
}
