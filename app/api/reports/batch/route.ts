
import { NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { reportsService } from '@/lib/services/reports-service';
import { notifyNewRecordEmail } from '@/lib/notifications';
import { persistReportMetadata } from '@/lib/report-persistence';
import { bumpSyncVersion } from '@/lib/sync-state';

/**
 * Fields a batch row may set — the same set the single-report POST in
 * app/api/reports/route.ts destructures out of its body, so the two paths
 * accept exactly the same shape. Anything else in an imported row is dropped.
 */
const BATCH_REPORT_FIELDS = [
    'title', 'description', 'location', 'station_id', 'location_id',
    'incident_type_id', 'severity', 'flight_number', 'aircraft_reg', 'gse_number',
    'evidence_url', 'evidence_urls', 'evidence_file_ids', 'evidence_submission_id',
    'evidence_meta', 'incident_date', 'incident_time', 'area', 'specific_location',
    'main_category', 'sub_category', 'immediate_action', 'priority',
    'is_flight_related', 'is_gse_related', 'airline', 'route', 'root_cause',
    'action_taken', 'reporter_name', 'area_category', 'delay_code', 'delay_duration',
    'station_code', 'airline_type', 'jenis_maskapai', 'report_content',
    'reporting_branch', 'week_in_month', 'reporter_email', 'form_submitted_at',
    'form_completed_at', 'terminal_area_category', 'apron_area_category',
    'general_category', 'case_classification', 'preventive_action',
    'gse_available_requirement', 'gse_motorized', 'gse_non_motorized',
    'category_case_gse',
] as const;

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        // Batch import writes straight into the Google Sheet (the source of
        // truth) and fans out notification email, so it is not a thing every
        // authenticated account should be able to do 100 rows at a time.
        if (!['SUPER_ADMIN', 'ANALYST'].includes(String(payload.role))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { reports } = body;

        if (!Array.isArray(reports) || reports.length === 0) {
            return NextResponse.json({ error: 'Data laporan tidak valid' }, { status: 400 });
        }

        if (reports.length > 100) {
            return NextResponse.json({ error: 'Maksimal 100 laporan per batch' }, { status: 400 });
        }

        // Allowlisted rather than spread. `{...r}` passed every key the caller
        // sent through to the writer, so a batch row could set columns the
        // single-report handler in app/api/reports/route.ts never accepts —
        // status, timestamps, sync bookkeeping, or an id of its own choosing.
        // user_id stays server-assigned for the same reason.
        const processedReports = reports.map((row: Record<string, unknown>) => {
            const report: Record<string, unknown> = {};
            for (const field of BATCH_REPORT_FIELDS) {
                if (row[field] !== undefined) report[field] = row[field];
            }
            report.user_id = payload.id;
            return report;
        });

        const createdReports = await reportsService.batchCreateReports(processedReports);

        const persistenceResults = await Promise.allSettled(
            createdReports.map((report) =>
                persistReportMetadata(report, { userId: payload.id, markSynced: true })
            )
        );

        // Email is not part of the import succeeding, and it was the slowest
        // part of it by far: notifyNewRecordEmail walks its recipients serially,
        // two DB round trips and one SMTP handshake each, so 100 imported rows
        // ran hundreds of sequential network calls inside the request and timed
        // the function out mid-batch with the mail half sent. after() runs it
        // once the response has already gone back.
        after(async () => {
            for (const report of createdReports) {
                try {
                    await notifyNewRecordEmail(report, 'batch');
                } catch (error) {
                    console.error('[REPORTS_BATCH] Notification failed:', error);
                }
            }
        });

        persistenceResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`[Batch Reports] Post-create persistence/notification failed for row ${index + 1}:`, result.reason);
            }
        });

        // The dashboard snapshot cache (dashboard_cache_entries) and the
        // /api/dashboard/reports ETag both validate on sync_state.sync_version.
        // Rows just landed in the corpus, so the version must move or every
        // dashboard serves the pre-import snapshot as if it were fresh.
        try {
            await bumpSyncVersion('reports');
        } catch (versionError) {
            console.warn('[Batch Reports] Failed to bump sync version:', versionError);
        }

        return NextResponse.json({
            success: true, 
            message: `${reports.length} laporan berhasil diimport ke Google Sheets`,
            count: createdReports.length
        });
    } catch (error) {
        console.error('Error in batch import:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan saat batch import' }, { status: 500 });
    }
}
