import { after, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { canViewReport } from '@/lib/report-access';
import {
  DOCX_MIME_TYPE,
  MAX_REPORT_DOCUMENT_BYTES,
  MAX_REPORT_DOCUMENT_SNAPSHOT_BYTES,
  PDF_MIME_TYPE,
  inferReportDocumentType,
  isReportDocumentType,
} from '@/lib/report-document-contract';
import { verifyReportDocumentToken } from '@/lib/report-document-token';
import { storeReportDocumentBundle } from '@/lib/report-documents-server';
import { reportsService } from '@/lib/services/reports-service';
import { notifySubmittedReport } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { SessionPayload } from '@/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export async function POST(request: Request) {
  try {
    const scopedToken = request.headers.get('x-report-finalization-token');
    const tokenPayload = scopedToken ? await verifyReportDocumentToken(scopedToken) : null;
    let createdBy: string | null = null;
    let sessionPayload: SessionPayload | null = null;

    if (scopedToken && !tokenPayload) {
      return NextResponse.json({ error: 'Invalid or expired finalization token' }, { status: 403 });
    }
    if (!scopedToken) {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session')?.value;
      if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const payload = await verifySession(sessionToken);
      if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      sessionPayload = payload;
      createdBy = payload.id;
    }

    const form = await request.formData();
    const reportTypeValue = form.get('report_type');
    const reportId = String(form.get('report_id') || '').trim();
    const revisionId = String(form.get('revision_id') || '').trim();
    const snapshotJson = String(form.get('edited_snapshot') || '');
    const signatureSha256Value = String(form.get('signature_sha256') || '').trim().toLowerCase();
    const docx = form.get('docx');
    const pdf = form.get('pdf');

    if (!isReportDocumentType(reportTypeValue) || !reportId || !UUID_PATTERN.test(revisionId)) {
      return NextResponse.json({ error: 'Invalid report document identity' }, { status: 400 });
    }
    if (tokenPayload && (tokenPayload.reportId !== reportId || tokenPayload.reportType !== reportTypeValue)) {
      return NextResponse.json({ error: 'Finalization token does not match this report' }, { status: 403 });
    }
    if (Buffer.byteLength(snapshotJson, 'utf8') > MAX_REPORT_DOCUMENT_SNAPSHOT_BYTES) {
      return NextResponse.json({ error: 'Edited document snapshot is too large' }, { status: 413 });
    }

    let editedSnapshot: Record<string, unknown>;
    try {
      const parsed = JSON.parse(snapshotJson);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid');
      editedSnapshot = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid edited document snapshot' }, { status: 400 });
    }

    if (!(docx instanceof File) || !(pdf instanceof File)) {
      return NextResponse.json({ error: 'Both DOCX and PDF files are required' }, { status: 400 });
    }
    if (docx.type !== DOCX_MIME_TYPE || pdf.type !== PDF_MIME_TYPE) {
      return NextResponse.json({ error: 'Invalid report document format' }, { status: 415 });
    }
    if (
      docx.size <= 0 || pdf.size <= 0 ||
      docx.size > MAX_REPORT_DOCUMENT_BYTES || pdf.size > MAX_REPORT_DOCUMENT_BYTES
    ) {
      return NextResponse.json({ error: 'Report documents must be between 1 byte and 20 MB each' }, { status: 413 });
    }
    if (signatureSha256Value && !SHA256_PATTERN.test(signatureSha256Value)) {
      return NextResponse.json({ error: 'Invalid signature hash' }, { status: 400 });
    }

    const report = await reportsService.getReportById(reportId);
    if (!report || inferReportDocumentType(report as unknown as Record<string, unknown>) !== reportTypeValue) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    if (sessionPayload && !canViewReport(sessionPayload, report)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [docxBuffer, pdfBuffer] = await Promise.all([
      docx.arrayBuffer().then((value) => Buffer.from(value)),
      pdf.arrayBuffer().then((value) => Buffer.from(value)),
    ]);
    const bundle = await storeReportDocumentBundle({
      reportType: reportTypeValue,
      reportId,
      revisionId,
      editedSnapshot,
      signatureSha256: signatureSha256Value || null,
      createdBy,
      docx: { buffer: docxBuffer, filename: docx.name },
      pdf: { buffer: pdfBuffer, filename: pdf.name },
    });

    // Finalizing is the moment the reporter considers the submission done, and
    // the only moment their edited documents exist — so the confirmation email
    // is sent from here rather than at report creation, and carries both files.
    after(async () => {
      try {
        await sendSubmissionConfirmation(reportId, report, {
          docx: { buffer: docxBuffer, filename: bundle.docx_filename, mime: bundle.docx_mime_type },
          pdf: { buffer: pdfBuffer, filename: bundle.pdf_filename, mime: bundle.pdf_mime_type },
        }, sessionPayload);
      } catch (error) {
        console.warn('[REPORT_DOCUMENTS_FINALIZE] Confirmation email failed (non-blocking):', error);
      }
    });

    return NextResponse.json({
      success: true,
      revision_id: bundle.revision_id,
      docx_filename: bundle.docx_filename,
      pdf_filename: bundle.pdf_filename,
    });
  } catch (error) {
    console.error('[REPORT_DOCUMENTS_FINALIZE]', error);
    return NextResponse.json({ error: 'Failed to save final report documents' }, { status: 500 });
  }
}

interface FinalizedFiles {
  docx: { buffer: Buffer; filename: string; mime: string };
  pdf: { buffer: Buffer; filename: string; mime: string };
}

/**
 * Resolves who filed the report and mails them the confirmation. The reporter
 * is whoever owns the report row — the finalizing session is only a fallback,
 * since public submissions finalize with a scoped token and no session.
 */
async function sendSubmissionConfirmation(
  reportId: string,
  report: Record<string, unknown>,
  files: FinalizedFiles,
  sessionPayload: SessionPayload | null,
) {
  const ownerId = (report.user_id as string) || null;
  let recipientEmail = String(report.reporter_email || '').trim();
  let recipientRole: string | null = null;
  let recipientName = String(report.reporter_name || '').trim() || null;

  if (ownerId) {
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('email, full_name, role')
      .eq('id', ownerId)
      .maybeSingle();
    if (owner?.email) {
      recipientEmail = owner.email;
      recipientRole = owner.role;
      recipientName = recipientName || owner.full_name;
    }
  }

  if (!recipientEmail && sessionPayload?.email) {
    recipientEmail = String(sessionPayload.email);
    recipientRole = String(sessionPayload.role || '');
  }
  if (!recipientEmail) return;

  await notifySubmittedReport({
    reportId: String(report.original_id || report.sheet_id || reportId),
    recipientEmail,
    recipientRole,
    reporterName: recipientName,
    title: (report.title as string) || (report.report as string) || null,
    category: (report.main_category as string) || (report.incident_type as string) || null,
    severity: (report.severity as string) || null,
    station: (report.station_code as string) || (report.station_id as string) || null,
    incidentDate: (report.incident_date as string) || null,
    flightNumber: (report.flight_number as string) || null,
    documents: [
      { filename: files.docx.filename, content: files.docx.buffer, contentType: files.docx.mime },
      { filename: files.pdf.filename, content: files.pdf.buffer, contentType: files.pdf.mime },
    ],
  });
}
