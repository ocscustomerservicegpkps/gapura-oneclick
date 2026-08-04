
import { after, NextResponse } from 'next/server';
import { reportsService } from '@/lib/services/reports-service';
import { notifyNewRecordEmail, notifyNewReport } from '@/lib/notifications';
import { persistReportMetadata } from '@/lib/report-persistence';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';
import { linkEvidenceFilesToReport, normalizeEvidenceSubmissionId, validateEvidenceForReport } from '@/lib/evidence-files';
import type { Report } from '@/types';
import { signReportDocumentToken } from '@/lib/report-document-token';
import { bumpSyncVersion } from '@/lib/sync-state';
import { purgeDashboardSnapshots, purgeExpiredDashboardSnapshots } from '@/lib/dashboard-cache';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromRequest(request);
    const rateLimit = await checkDbRateLimit(`public-report:${clientIp}`, 5, 60 * 60_000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Terlalu banyak laporan. Coba lagi dalam 1 jam.' }, { status: 429 });
    }

    const body = await request.json();
    const email = String(body.reporter_email || '').trim();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const reporterName = String(body.reporter_name || '').trim().slice(0, 200);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    }
    if (!title || !description) {
      return NextResponse.json({ error: 'Judul dan deskripsi wajib diisi' }, { status: 400 });
    }

    const {
      station_id,
      station_code,
      hub,
      jenis_maskapai,
      route,
      delay_code,
      delay_duration,
      area,
      incident_type_id,
      terminal_area_category,
      apron_area_category,
      general_category,
      week_in_month,
      form_submitted_at,
      form_completed_at,
      evidence_url,
      evidence_urls,
      evidence_file_ids,
      evidence_submission_id,
      severity,
      airlines,
      airline,
      flight_number,
      date_of_event,
      incident_date,
      root_cause,
      action_taken,
      preventive_action,
      gse_available_requirement,
      gse_motorized,
      gse_non_motorized,
      category_case_gse,
      case_classification,
    } = body;

    const submissionId = normalizeEvidenceSubmissionId(evidence_submission_id);
    const evidenceValidation = await validateEvidenceForReport({
      evidenceFileIds: evidence_file_ids,
      evidenceUrls: evidence_urls || evidence_url,
      submissionId,
      mode: 'public',
      reporterEmail: email,
      requireLedger: true,
    });
    if (evidenceValidation.urls.length === 0) {
      return NextResponse.json({ error: 'Evidence wajib diunggah sebelum laporan dikirim' }, { status: 400 });
    }

    // This is an unauthenticated public endpoint: the caller has not proven
    // ownership of `email`, so a match against a registered account must not
    // grant that account's identity or report visibility. Never auto-link
    // user_id/full name from an unverified email — use only submitted values.
    const reportData: Partial<Report> = {
      reporter_email: email,
      reporter_name: reporterName || email,
      user_id: undefined,
      title,
      description,
      location: body.location || '',
      specific_location: body.specific_location || body.location || '',
      airlines: airlines || airline || '',
      flight_number: flight_number || '',
      date_of_event: date_of_event || incident_date || '',
      area: area || '',
      category: body.main_category || 'Irregularity',
      irregularity_complain_category: incident_type_id || body.main_category || 'Irregularity',
      root_cause: root_cause || null,
      root_caused: root_cause || null,
      action_taken: action_taken || null,
      preventive_action: preventive_action || null,
      gse_available_requirement: gse_available_requirement || null,
      gse_motorized: gse_motorized || null,
      gse_non_motorized: gse_non_motorized || null,
      category_case_gse: category_case_gse || null,
      evidence_url: evidenceValidation.urls[0] || '',
      evidence_urls: evidenceValidation.urls,
      evidence_file_ids: evidenceValidation.evidenceFileIds,
      evidence_submission_id: submissionId,
      severity: severity || 'low',
      status: 'OPEN',
      created_at: new Date().toISOString(),

      station_id: station_id || null,
      station_code: station_code || station_id || null,
      branch: station_code || station_id || null,
      hub: hub || null,
      jenis_maskapai: jenis_maskapai || null,
      route: route || null,
      delay_code: delay_code || null,
      delay_duration: delay_duration || null,
      incident_type_id: incident_type_id || null,
      terminal_area_category: terminal_area_category || null,
      apron_area_category: apron_area_category || null,
      general_category: general_category || null,
      case_classification: case_classification || null,
      week_in_month: week_in_month || null,
      report: description,
      reporting_branch: station_code || station_id || null,
      kode_cabang: station_code || station_id || null,
      form_submitted_at: form_submitted_at || new Date().toISOString(),
      form_completed_at: form_completed_at || new Date().toISOString(),
    };

    const newReport = await reportsService.createReport(reportData);

    try {
      await linkEvidenceFilesToReport({
        evidenceFileIds: evidenceValidation.evidenceFileIds,
        submissionId,
        reportSheetId: newReport.original_id || newReport.sheet_id || null,
        reportId: newReport.id || null,
      });
    } catch (linkError) {
      console.error('[Public Report] Evidence link failed, deleting created sheet row:', linkError);
      await reportsService.deleteReport(newReport.original_id || newReport.sheet_id || newReport.id).catch((deleteError) => {
        console.warn('[Public Report] Rollback delete failed:', deleteError);
      });
      throw linkError;
    }

    await Promise.all([
      persistReportMetadata(newReport).catch((persistError) => {
        console.warn('[Public Report] Metadata persistence failed (non-blocking):', persistError);
      }),
      notifyNewRecordEmail(newReport, 'public').catch((notificationError) => {
        console.warn('[Public Report] New-record notification failed:', notificationError);
      }),
    ]);

    const targetDivision = newReport.esklasi_divisi;

    // Scheduled via after() rather than fire-and-forget: an un-awaited promise
    // outside the request lifecycle risks being killed mid-flight once the
    // response is sent on serverless. after() guarantees it runs to completion.
    after(async () => {
      if (targetDivision) {
        await notifyNewReport(
          String(newReport.id || newReport.original_id || ''),
          targetDivision,
          newReport.title || newReport.report || 'Untitled report',
          String(newReport.priority || 'medium'),
          newReport.sla_deadline || ''
        ).catch((notificationError) => {
          console.warn('[Public Report] Division new-report notification failed:', notificationError);
        });
      }
      try {
        const state = await bumpSyncVersion('reports');
        await purgeDashboardSnapshots({ maxSyncVersion: Number(state.sync_version) });
        await purgeExpiredDashboardSnapshots();
      } catch (syncStateError) {
        console.warn('[Public Report] Post-create cache invalidation failed:', syncStateError);
      }
    });

    // The report is already committed by this point. A token-signing failure
    // here must not surface as a submission failure (client could retry and
    // create a duplicate report) — degrade to a missing token instead.
    const reportId = String(newReport.id || newReport.original_id || newReport.sheet_id || '');
    let documentFinalizationToken: string | null = null;
    try {
      documentFinalizationToken = await signReportDocumentToken({
        reportId,
        reportType: 'IRREGULARITY',
      });
    } catch (tokenError) {
      console.error('[Public Report] Document finalization token signing failed:', tokenError);
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dikirim',
      data: newReport,
      document_finalization_token: documentFinalizationToken,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim laporan' }, { status: 500 });
  }
}
