'use client';

import type { DocEdits } from '@/components/public-report/wizard-shared';
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  buildFinalDocumentFilenames,
  type ReportDocumentType,
} from '@/lib/report-document-contract';
import { generatePDF, generateWord } from '@/lib/utils/document-generator';

interface FinalizeReportDocumentsInput {
  reportId: string;
  reportType: ReportDocumentType;
  editedSnapshot: DocEdits;
  signatureDataUrl: string | null;
  finalizationToken?: string | null;
}

async function sha256Text(value: string): Promise<string | null> {
  if (!value) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function finalizeReportDocuments(input: FinalizeReportDocumentsInput): Promise<void> {
  const snapshot = structuredClone(input.editedSnapshot);
  const signature = input.signatureDataUrl;
  const filenames = buildFinalDocumentFilenames(snapshot as unknown as Record<string, unknown>, input.reportId);
  const revisionId = crypto.randomUUID();

  const [docxBlob, pdfBlob, signatureSha256] = await Promise.all([
    generateWord(snapshot, signature, { download: false, filename: filenames.docx }),
    generatePDF(snapshot, signature, { download: false, filename: filenames.pdf }),
    sha256Text(signature || ''),
  ]);

  const form = new FormData();
  form.append('report_type', input.reportType);
  form.append('report_id', input.reportId);
  form.append('revision_id', revisionId);
  form.append('edited_snapshot', JSON.stringify(snapshot));
  if (signatureSha256) form.append('signature_sha256', signatureSha256);
  form.append('docx', new File([docxBlob], filenames.docx, { type: DOCX_MIME_TYPE }));
  form.append('pdf', new File([pdfBlob], filenames.pdf, { type: PDF_MIME_TYPE }));

  const headers: HeadersInit = input.finalizationToken
    ? { 'X-Report-Finalization-Token': input.finalizationToken }
    : {};
  const response = await fetch('/api/report-documents/finalize', {
    method: 'POST',
    headers,
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || 'Failed to store final report documents');
  }
}
