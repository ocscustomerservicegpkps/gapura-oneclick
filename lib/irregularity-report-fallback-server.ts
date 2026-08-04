import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeIrregularityReport } from '@/lib/irregularity-report-form';
import {
  buildFinalDocumentFilenames,
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  type ReportDocumentFormat,
} from '@/lib/report-document-contract';
import { generatePDF, generateWord } from '@/lib/utils/document-generator';
import type { Report } from '@/types';

interface GeneratedIrregularityReport {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export function fallbackIrregularityReportFilenames(
  report: Report | Record<string, unknown>,
  reportId: string,
): { docx: string; pdf: string } {
  const normalized = normalizeIrregularityReport(report);
  return buildFinalDocumentFilenames({
    doc_title: normalized.doc_title,
    flight_number: normalized.flight_number || normalized.reference_no,
  }, reportId);
}

export async function generateIrregularityReportFallback(
  report: Report,
  reportId: string,
  format: ReportDocumentFormat,
): Promise<GeneratedIrregularityReport> {
  const [logoBuffer, filenames] = await Promise.all([
    readFile(path.join(process.cwd(), 'public', 'logo.png')),
    Promise.resolve(fallbackIrregularityReportFilenames(report, reportId)),
  ]);
  const logoData = new Uint8Array(logoBuffer);
  const blob = format === 'docx'
    ? await generateWord(report, null, { download: false, filename: filenames.docx, logoData })
    : await generatePDF(report, null, { download: false, filename: filenames.pdf, logoData });

  return {
    buffer: Buffer.from(await blob.arrayBuffer()),
    filename: format === 'docx' ? filenames.docx : filenames.pdf,
    mimeType: format === 'docx' ? DOCX_MIME_TYPE : PDF_MIME_TYPE,
  };
}
