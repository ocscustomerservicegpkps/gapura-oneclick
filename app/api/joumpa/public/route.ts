import { NextResponse } from 'next/server';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';
import { linkEvidenceFilesToReport, normalizeEvidenceSubmissionId, validateEvidenceForReport } from '@/lib/evidence-files';
import { JoumpaSyncService } from '@/lib/services/joumpa-sync-service';
import { findRegisteredUserByEmail } from '@/lib/user-lookup';
import type { JoumpaFormInput } from '@/lib/joumpa/mapping';
import { signReportDocumentToken } from '@/lib/report-document-token';

const REQUIRED: Array<keyof JoumpaFormInput> = [
  'date_of_event',
  'airlines',
  'flight_number',
  'station',
  'route',
  'category_report',
  'customer_joumpa',
  'category_case_joumpa',
  'report',
  'report_by',
];

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromRequest(request);
    const rateLimit = await checkDbRateLimit(`public-joumpa:${clientIp}`, 5, 60 * 60_000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Terlalu banyak laporan. Coba lagi dalam 1 jam.' }, { status: 429 });
    }

    const body = await request.json();
    const email = String(body.reporter_email || body.email_address || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    }

    const missing = REQUIRED.filter((field) => !String(body[field] ?? '').trim());
    if (missing.length > 0) {
      return NextResponse.json({ error: `Field wajib belum lengkap: ${missing.join(', ')}` }, { status: 400 });
    }

    const submissionId = normalizeEvidenceSubmissionId(body.evidence_submission_id);
    const evidence = await validateEvidenceForReport({
      evidenceFileIds: body.evidence_file_ids,
      evidenceUrls: body.evidence_urls,
      submissionId,
      mode: 'public',
      reporterEmail: email,
      requireLedger: true,
    });
    if (evidence.urls.length === 0) {
      return NextResponse.json({ error: 'Evidence wajib diunggah sebelum laporan dikirim' }, { status: 400 });
    }

    // Attribute the submission to a registered account when the e-mail matches.
    const registered = await findRegisteredUserByEmail(email);

    const input: JoumpaFormInput = {
      date_of_event: body.date_of_event,
      airlines: body.airlines,
      flight_number: body.flight_number,
      station: body.station,
      route: body.route,
      category_report: body.category_report,
      customer_joumpa: body.customer_joumpa,
      corporate: body.corporate,
      customer_company_profile_corporate: body.customer_company_profile_corporate,
      detail_customer_corporate: body.detail_customer_corporate,
      non_corporate: body.non_corporate,
      customer_background_non_corporate: body.customer_background_non_corporate,
      detail_customer_non_corporate: body.detail_customer_non_corporate,
      category_case_joumpa: body.category_case_joumpa,
      report: body.report,
      root_caused: body.root_caused,
      action_taken: body.action_taken,
      preventive_action: body.preventive_action,
      severity_level: body.severity_level,
      status: body.status,
      report_by: registered?.fullName || body.report_by,
      email_address: email,
      evidence_urls: evidence.urls,
      user_id: registered?.userId,
    };

    const row = await JoumpaSyncService.createReport(input);

    try {
      await linkEvidenceFilesToReport({
        evidenceFileIds: evidence.evidenceFileIds,
        submissionId,
        reportSheetId: row.sheet_id || null,
        reportId: row.id || null,
      });
    } catch (linkError) {
      console.error('[Public JOUMPA] Evidence link failed (non-blocking):', linkError);
    }

    const documentFinalizationToken = await signReportDocumentToken({
      reportId: row.id,
      reportType: 'JOUMPA',
    });

    return NextResponse.json({
      success: true,
      id: row.id,
      sheet_id: row.sheet_id,
      document_finalization_token: documentFinalizationToken,
    }, { status: 201 });
  } catch (error) {
    console.error('[Public JOUMPA] Create failed:', error);
    return NextResponse.json({ error: 'Gagal mengirim laporan JOUMPA' }, { status: 500 });
  }
}
