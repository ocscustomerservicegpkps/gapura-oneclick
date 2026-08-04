import { NextResponse } from 'next/server';
import { authorizeReportDocumentRead } from '@/lib/report-document-access';
import { isReportDocumentType } from '@/lib/report-document-contract';
import { getReportDocumentBundle } from '@/lib/report-documents-server';
import { fallbackIrregularityReportFilenames } from '@/lib/irregularity-report-fallback-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportType: string; reportId: string }> },
) {
  try {
    const resolved = await params;
    const reportType = resolved.reportType.toUpperCase();
    const reportId = decodeURIComponent(resolved.reportId);
    if (!isReportDocumentType(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    const access = await authorizeReportDocumentRead(reportType, reportId);
    if (access.ok === false) return NextResponse.json({ error: access.error }, { status: access.status });

    const bundle = await getReportDocumentBundle(reportType, reportId);
    if (!bundle) {
      const filenames = fallbackIrregularityReportFilenames(access.report, reportId);
      return NextResponse.json({
        available: true,
        source: 'generated',
        docx_filename: filenames.docx,
        pdf_filename: filenames.pdf,
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    return NextResponse.json({
      available: true,
      source: 'finalized',
      revision_id: bundle.revision_id,
      docx_filename: bundle.docx_filename,
      pdf_filename: bundle.pdf_filename,
      updated_at: bundle.updated_at,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[REPORT_DOCUMENTS_METADATA]', error);
    return NextResponse.json({ error: 'Failed to load report documents' }, { status: 500 });
  }
}
