import 'server-only';

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  REPORT_DOCUMENTS_BUCKET,
  sanitizeDocumentSegment,
  type ReportDocumentFormat,
  type ReportDocumentType,
} from '@/lib/report-document-contract';

interface ReportDocumentBundle {
  id: string;
  report_type: ReportDocumentType;
  report_id: string;
  revision_id: string;
  docx_path: string;
  docx_filename: string;
  docx_mime_type: string;
  docx_size_bytes: number;
  docx_sha256: string;
  pdf_path: string;
  pdf_filename: string;
  pdf_mime_type: string;
  pdf_size_bytes: number;
  pdf_sha256: string;
  edited_snapshot: Record<string, unknown>;
  signature_sha256: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StoreBundleInput {
  reportType: ReportDocumentType;
  reportId: string;
  revisionId: string;
  editedSnapshot: Record<string, unknown>;
  signatureSha256: string | null;
  createdBy: string | null;
  docx: { buffer: Buffer; filename: string };
  pdf: { buffer: Buffer; filename: string };
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(REPORT_DOCUMENTS_BUCKET).remove(paths);
  if (error) throw new Error(`Failed to remove report documents: ${error.message}`);
}

async function uploadObject(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(REPORT_DOCUMENTS_BUCKET).upload(path, buffer, {
    contentType,
    // Paths are deterministic per revision (type/reportId/revisionId/file).
    // A retry after a partial failure — where cleanup of the orphaned object
    // itself failed — must be able to overwrite it at the same path rather
    // than being stuck failing "already exists" forever.
    upsert: true,
    cacheControl: '0',
  });
  if (error) throw new Error(`Failed to upload report document: ${error.message}`);
}

export async function getReportDocumentBundle(
  reportType: ReportDocumentType,
  reportId: string,
): Promise<ReportDocumentBundle | null> {
  const { data, error } = await supabaseAdmin
    .from('report_documents')
    .select('*')
    .eq('report_type', reportType)
    .eq('report_id', reportId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load report documents: ${error.message}`);
  return (data as ReportDocumentBundle | null) || null;
}

export async function storeReportDocumentBundle(input: StoreBundleInput): Promise<ReportDocumentBundle> {
  const safeType = input.reportType.toLowerCase();
  const safeReportId = sanitizeDocumentSegment(input.reportId, 'report');
  const safeDocxName = sanitizeDocumentSegment(input.docx.filename.replace(/\.docx$/i, ''), 'report') + '.docx';
  const safePdfName = sanitizeDocumentSegment(input.pdf.filename.replace(/\.pdf$/i, ''), 'report') + '.pdf';
  const prefix = `${safeType}/${safeReportId}/${input.revisionId}`;
  const docxPath = `${prefix}/${safeDocxName}`;
  const pdfPath = `${prefix}/${safePdfName}`;

  const uploads = await Promise.allSettled([
    uploadObject(docxPath, input.docx.buffer, DOCX_MIME_TYPE),
    uploadObject(pdfPath, input.pdf.buffer, PDF_MIME_TYPE),
  ]);

  const uploadedPaths = uploads.flatMap((result, index) => (
    result.status === 'fulfilled' ? [index === 0 ? docxPath : pdfPath] : []
  ));
  const failed = uploads.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) {
    await removeObjects(uploadedPaths).catch((cleanupError) => {
      console.error('[REPORT_DOCUMENTS] Partial upload cleanup failed:', cleanupError);
    });
    throw failed.reason;
  }

  // Atomic RPC (not a client-side read-then-upsert): it locks the row for
  // this report inside the same transaction as the upsert, so the "previous"
  // paths it returns are exactly what THIS call replaced — concurrent saves
  // for the same report can no longer race on a pre-upload read and orphan
  // each other's uploads.
  const { data, error } = await supabaseAdmin
    .rpc('upsert_report_document_bundle', {
      p_report_type: input.reportType,
      p_report_id: input.reportId,
      p_revision_id: input.revisionId,
      p_docx_path: docxPath,
      p_docx_filename: safeDocxName,
      p_docx_mime_type: DOCX_MIME_TYPE,
      p_docx_size_bytes: input.docx.buffer.length,
      p_docx_sha256: sha256(input.docx.buffer),
      p_pdf_path: pdfPath,
      p_pdf_filename: safePdfName,
      p_pdf_mime_type: PDF_MIME_TYPE,
      p_pdf_size_bytes: input.pdf.buffer.length,
      p_pdf_sha256: sha256(input.pdf.buffer),
      p_edited_snapshot: input.editedSnapshot,
      p_signature_sha256: input.signatureSha256,
      p_created_by: input.createdBy,
    })
    .single();

  if (error || !data) {
    await removeObjects([docxPath, pdfPath]).catch((cleanupError) => {
      console.error('[REPORT_DOCUMENTS] Metadata rollback cleanup failed:', cleanupError);
    });
    throw new Error(`Failed to register report documents: ${error?.message || 'unknown error'}`);
  }

  const resultRow = data as ReportDocumentBundle & { previous_docx_path: string | null; previous_pdf_path: string | null };
  const supersededPaths = [resultRow.previous_docx_path, resultRow.previous_pdf_path]
    .filter((path): path is string => Boolean(path) && path !== docxPath && path !== pdfPath);
  await removeObjects(supersededPaths).catch((cleanupError) => {
    console.warn('[REPORT_DOCUMENTS] Superseded document cleanup failed:', cleanupError);
  });

  return data as ReportDocumentBundle;
}

export async function downloadReportDocument(
  bundle: ReportDocumentBundle,
  format: ReportDocumentFormat,
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const path = format === 'docx' ? bundle.docx_path : bundle.pdf_path;
  const { data, error } = await supabaseAdmin.storage.from(REPORT_DOCUMENTS_BUCKET).download(path);
  if (error || !data) throw new Error(`Stored ${format.toUpperCase()} document not found`);
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    filename: format === 'docx' ? bundle.docx_filename : bundle.pdf_filename,
    mimeType: format === 'docx' ? bundle.docx_mime_type : bundle.pdf_mime_type,
  };
}
