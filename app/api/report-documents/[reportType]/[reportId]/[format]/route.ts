import { NextResponse } from 'next/server';
import { authorizeReportDocumentRead } from '@/lib/report-document-access';
import { isReportDocumentFormat, isReportDocumentType } from '@/lib/report-document-contract';
import { downloadReportDocument, getReportDocumentBundle } from '@/lib/report-documents-server';
import { generateIrregularityReportFallback } from '@/lib/irregularity-report-fallback-server';

function attachmentHeader(filename: string): string {
  const ascii = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportType: string; reportId: string; format: string }> },
) {
  try {
    const resolved = await params;
    const reportType = resolved.reportType.toUpperCase();
    // Next.js already URL-decodes dynamic route segments; decoding again would
    // throw on malformed percent-encoding and turn a client error into a 500.
    const reportId = resolved.reportId;
    const format = resolved.format.toLowerCase();
    if (!isReportDocumentType(reportType) || !isReportDocumentFormat(format)) {
      return NextResponse.json({ error: 'Invalid report document request' }, { status: 400 });
    }

    const access = await authorizeReportDocumentRead(reportType, reportId);
    if (access.ok === false) return NextResponse.json({ error: access.error }, { status: access.status });

    const bundle = await getReportDocumentBundle(reportType, reportId);
    if (!bundle && reportType !== 'IRREGULARITY') {
      return NextResponse.json({ error: 'Report document not found' }, { status: 404 });
    }
    const file = bundle
      ? await downloadReportDocument(bundle, format)
      : await generateIrregularityReportFallback(access.report, reportId, format);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.buffer.length),
        'Content-Disposition': attachmentHeader(file.filename),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[REPORT_DOCUMENTS_DOWNLOAD]', error);
    return NextResponse.json({ error: 'Failed to download report document' }, { status: 500 });
  }
}
