
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { reportsService } from '@/lib/services/reports-service';
import { persistReportMetadata } from '@/lib/report-persistence';
import { notifyReportClosedEmail, notifyStatusChange } from '@/lib/notifications';
import { linkEvidenceFilesToReport, normalizeEvidenceFileIds } from '@/lib/evidence-files';
import { canChangeReportStatus } from '@/lib/constants/report-status';
import { JOUMPA_SHEET_ID, JOUMPA_SHEET_NAME } from '@/lib/joumpa/mapping';
import { isJoumpaReportSource } from '@/lib/joumpa/status-update';
import { JoumpaSyncService } from '@/lib/services/joumpa-sync-service';
import { canViewReport } from '@/lib/report-access';

function normalizeAccessValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function isEditedWordEvidencePatch(body: Record<string, unknown>): boolean {
    const keys = Object.keys(body).filter((key) => body[key] !== undefined);
    if (!keys.includes('evidence_urls')) return false;
    if (keys.some((key) => key !== 'evidence_urls' && key !== 'evidence_file_ids')) return false;
    if (!Array.isArray(body.evidence_urls) || body.evidence_urls.length === 0) return false;

    return body.evidence_urls.every((url) => {
        const decoded = decodeURIComponent(String(url || '')).toUpperCase();
        return decoded.includes('IRREGULARITY_REPORT_EDITED') && decoded.includes('.DOCX');
    });
}

// Builds a single .or() filter matching any of the given id-like values
// against id/original_id/sheet_id, so a report can be found/updated/deleted
// by any of its known identifiers in one round trip instead of one query per
// candidate.
function buildReportIdOrFilter(candidates: string[]): string {
    return [...new Set(candidates)]
        .flatMap((candidate) => {
            // PostgREST quoted filter values escape backslashes and double
            // quotes with a backslash prefix, not by doubling the quote
            // (SQL string-literal convention, which doesn't apply here).
            const safe = `"${candidate.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            return [`id.eq.${safe}`, `original_id.eq.${safe}`, `sheet_id.eq.${safe}`];
        })
        .join(',');
}

function normalizeUrlList(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string' && value.trim()) {
        return value.split(/\s*\|\s*|\n+/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const paramsResolved = await params;
        const id = decodeURIComponent(paramsResolved.id);
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const report = await reportsService.getReportById(id);

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        if (!canViewReport(payload, report)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const commentIds = [id, report.original_id].filter((val): val is string => !!val);

        const [userResult, commentsResult] = await Promise.all([
            report.user_id && !report.user_id.includes('!')
                ? supabaseAdmin.from('users').select('id, full_name, email').eq('id', report.user_id).single()
                : Promise.resolve({ data: null }),
            supabaseAdmin
                .from('report_comments')
                .select(`
                    id,
                    content,
                    created_at,
                    is_system_message,
                    sheet_id,
                    users:user_id (
                        full_name
                    )
                `)
                .in('report_id', commentIds)
                .order('created_at', { ascending: true }),
        ]);

        const user = userResult?.data;
        const comments = commentsResult?.data;

        const enrichedReport = {
            ...report,
            users: user || (report.reporter_name ? { full_name: report.reporter_name } : null),
            comments: comments || [],

            user: user || (report.reporter_name ? { full_name: report.reporter_name } : null),
            station: report.stations ? { ...report.stations, id: report.station_id } : undefined,
        };

        return NextResponse.json(enrichedReport);
    } catch (error) {
        console.error('Error in GET /api/reports/[id]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const paramsResolved = await params;
        const id = decodeURIComponent(paramsResolved.id);
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const body = await request.json();
        const isSafeEditedWordPatch = isEditedWordEvidencePatch(body);
        const existingReport = await reportsService.getReportById(id);
        const allowedRoles = ['SUPER_ADMIN', 'ANALYST', 'DIVISI_ESKALASI', 'DIVISI_OP', 'DIVISI_OS', 'DIVISI_OCS', 'DIVISI_OT', 'DIVISI_UQ', 'DIVISI_HC', 'DIVISI_HT', 'MANAGER_CABANG'];
        const payloadEmail = normalizeAccessValue(payload.email);
        const reportEmail = normalizeAccessValue(existingReport?.reporter_email);
        // Station membership only grants *viewing* a station's reports (see
        // canViewReport in lib/report-access.ts) — it must not also grant
        // editing/deleting reports filed by other people at the same
        // station. Ownership here is the actual author: user_id, or the
        // verified session email matching the report's reporter email.
        // reporter_name is free text on the report and is NOT used for
        // ownership — it is not unique and is trivially spoofable by anyone
        // whose account full_name happens to match it.
        const canAccessOwnReport = Boolean(existingReport && (
            existingReport.user_id === payload.id ||
            (payloadEmail && reportEmail === payloadEmail)
        ));

        if (!allowedRoles.includes(payload.role as string)) {
            // isSafeEditedWordPatch previously bypassed ownership entirely for
            // evidence-only patches, letting any authenticated non-elevated
            // user attach files to a report they don't own by matching a
            // filename pattern. Ownership is still required here; the flag is
            // only used below to control how the merge is performed.
            if (!canAccessOwnReport) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (payload.role === 'MANAGER_CABANG') {
            // Being in allowedRoles skips the ownership check above, but a
            // branch manager must still be confined to their own station —
            // otherwise any MANAGER_CABANG could edit any station's reports.
            // Mirrors the MANAGER_CABANG branch of canViewReport. Also block
            // a submitted station_id that would relocate the report to a
            // different station than the one the manager is confined to.
            const managerStationId = payload.station_id;
            if (
                !managerStationId ||
                existingReport?.station_id !== managerStationId ||
                (body.station_id !== undefined && body.station_id !== managerStationId)
            ) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const {
            title,
            description,
            severity,
            status,
            evidence_urls,
            evidence_file_ids,
            flight_number,
            aircraft_reg,
            gse_number,
            category,
            priority,
            location,
            station_id,
            action_taken,
            root_cause,
            preventive_action,
            reporter_name,
            attachments,
            primary_tag,
            sub_category_note,
            route,
            airline,
            area,
            date_of_event,
            branch,
            kps_remarks,
            final_remarks,
            remarks_by,
        } = body;

        if (status !== undefined && !canChangeReportStatus(payload.role as string)) {
            return NextResponse.json(
                { error: `Role ${payload.role} tidak diizinkan mengubah status laporan` },
                { status: 403 }
            );
        }

        const updates: Record<string, unknown> = {};

        const normalizeStatus = (val: unknown) => {
            if (!val) return val;
            const up = String(val).trim().toUpperCase().replace(/_/g, ' ');
            if (up === 'SELESAI' || up === 'CLOSED') {
                return 'CLOSED';
            } else if (up === 'MENUNGGU FEEDBACK' || up === 'OPEN' || up === 'BARU' || up === 'MENUNGGU' || up === 'ACTIVE') {
                return 'OPEN';
            } else if (up === 'SUDAH DIVERIFIKASI' || up === 'ON PROGRESS') {
                return 'ON PROGRESS';
            }
            return up;
        };

        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (severity !== undefined) updates.severity = severity;
        if (status !== undefined) updates.status = normalizeStatus(status);
        if (evidence_urls !== undefined) updates.evidence_urls = evidence_urls;
        if (evidence_file_ids !== undefined) updates.evidence_file_ids = normalizeEvidenceFileIds(evidence_file_ids);
        if (flight_number !== undefined) updates.flight_number = flight_number;
        if (aircraft_reg !== undefined) updates.aircraft_reg = aircraft_reg;
        if (gse_number !== undefined) updates.gse_number = gse_number;
        if (category !== undefined) updates.category = category;
        if (priority !== undefined) updates.priority = priority;
        if (location !== undefined) updates.location = location;
        if (station_id !== undefined) updates.station_id = station_id;
        if (action_taken !== undefined) updates.action_taken = action_taken;
        if (root_cause !== undefined) updates.root_caused = root_cause;
        if (preventive_action !== undefined) updates.preventive_action = preventive_action;
        if (reporter_name !== undefined) updates.reporter_name = reporter_name;
        if (attachments !== undefined) updates.attachments = attachments;

        if (primary_tag !== undefined) updates.primary_tag = primary_tag;
        if (sub_category_note !== undefined) updates.sub_category_note = sub_category_note;

        if (route !== undefined) updates.route = route;
        if (airline !== undefined) updates.airline = airline;
        if (area !== undefined) updates.area = area;
        if (date_of_event !== undefined) updates.date_of_event = date_of_event;
        if (branch !== undefined) updates.branch = branch;
        if (kps_remarks !== undefined || final_remarks !== undefined) {
            updates.kps_remarks = kps_remarks ?? final_remarks;
        }
        if (remarks_by !== undefined) updates.remarks_by = remarks_by;

        const isStatusRemarksPatch =
            status !== undefined &&
            (
                Object.prototype.hasOwnProperty.call(body, 'kps_remarks') ||
                Object.prototype.hasOwnProperty.call(body, 'final_remarks') ||
                Object.prototype.hasOwnProperty.call(body, 'remarks_by')
            );

        if (isStatusRemarksPatch) {
            const statusValue = String(updates.status || '').trim();
            const finalRemarksValue = String(updates.kps_remarks ?? '').trim();
            const remarksByValue = String(updates.remarks_by ?? '').trim();

            if (!statusValue || !finalRemarksValue || !remarksByValue) {
                return NextResponse.json(
                    { error: 'Status, Final Remarks, dan Remarks By wajib diisi untuk update status laporan' },
                    { status: 400 }
                );
            }
        }

        const isClosingReport =
            updates.status === 'CLOSED' &&
            String(existingReport?.status || '').trim().toUpperCase() !== 'CLOSED';

        if (isClosingReport) {
            const finalRemarksValue = String(updates.kps_remarks ?? existingReport?.kps_remarks ?? '').trim();
            const remarksByValue = String(updates.remarks_by ?? existingReport?.remarks_by ?? '').trim();

            if (!finalRemarksValue || !remarksByValue) {
                return NextResponse.json(
                    { error: 'Final Remarks dan Remarks By wajib diisi sebelum menutup laporan' },
                    { status: 400 }
                );
            }
        }

        const isJoumpaStatusUpdate = isStatusRemarksPatch && isJoumpaReportSource(
            existingReport,
            JOUMPA_SHEET_ID,
            JOUMPA_SHEET_NAME,
        );

        let updatedReport;
        try {
            updatedReport = isJoumpaStatusUpdate
                ? await JoumpaSyncService.updateReport(id, {
                    status: updates.status,
                    action_taken: updates.action_taken,
                    kps_remarks: updates.kps_remarks,
                    remarks_by: updates.remarks_by,
                })
                : await reportsService.updateReport(id, updates);
        } catch (updateError) {
            const message = isJoumpaStatusUpdate && updateError instanceof Error
                ? updateError.message
                : 'Gagal mengupdate laporan';
            return NextResponse.json({ error: message }, { status: 502 });
        }

        if (!updatedReport) {
            if (isSafeEditedWordPatch) {
                const incomingUrls = normalizeUrlList(evidence_urls);
                const existingUrls = [
                    ...normalizeUrlList(existingReport?.evidence_urls),
                    ...normalizeUrlList(existingReport?.evidence_url),
                ];
                const mergedUrls = [...new Set([...existingUrls, ...incomingUrls])].filter(Boolean);

                const reportIdCandidates = [
                    id,
                    existingReport?.id,
                    existingReport?.original_id,
                    existingReport?.sheet_id,
                ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

                const orFilter = buildReportIdOrFilter(reportIdCandidates);
                if (orFilter) {
                    const { data: rows, error: syncUpdateError } = await supabaseAdmin
                        .from('ground_handling_irregularity_report')
                        .update({
                            evidence_url: mergedUrls[0] || null,
                            evidence_urls: mergedUrls,
                            evidence_file_ids: normalizeEvidenceFileIds(evidence_file_ids),
                            updated_at: new Date().toISOString(),
                        })
                        .or(orFilter)
                        .select('*')
                        .limit(1);

                    if (!syncUpdateError && rows && rows.length > 0) {
                        const fallbackReport = {
                            ...(existingReport || {}),
                            ...rows[0],
                            evidence_url: mergedUrls[0] || null,
                            evidence_urls: mergedUrls,
                        };
                        return NextResponse.json({ success: true, data: fallbackReport });
                    }
                }
            }

            return NextResponse.json({ error: 'Report not found or update failed' }, { status: 404 });
        }

        const isStatusChange =
            updates.status !== undefined &&
            String(updates.status).trim().toUpperCase() !== String(existingReport?.status || '').trim().toUpperCase();

        if (isStatusChange) {
            try {
                const actorName = payload.full_name || payload.email || 'Unknown';
                const actorDivision = payload.division || payload.role || '-';
                const statusMsg = `Status laporan diubah ke ${updates.status} oleh ${actorName} (${actorDivision})${updates.action_taken ? ` — Catatan: ${updates.action_taken}` : ''}`;
                await supabaseAdmin.from('report_comments').insert({
                    report_id: updatedReport.id || id,
                    user_id: payload.id,
                    content: statusMsg,
                    is_system_message: true,
                    sheet_id: updatedReport.original_id || updatedReport.sheet_id || id
                });
            } catch (statusErr) {
                console.warn('[Status] Failed to create system comment:', statusErr);
            }
        }

        if (isStatusChange) {
            notifyStatusChange(
                String(updatedReport.id || id),
                updatedReport.title || updatedReport.report || 'Untitled report',
                String(existingReport?.status || '-'),
                String(updates.status)
            ).catch((notificationError) => {
                console.warn('[REPORTS_PATCH] Status-change notification failed:', notificationError);
            });
        }

        if (!isJoumpaStatusUpdate) {
            await persistReportMetadata(updatedReport, {
                userId: updatedReport.user_id || payload.id,
            }).catch((syncErr) => {
                console.warn('[Supabase] PATCH sync error:', syncErr);
            });
        }

        if (evidence_file_ids !== undefined) {
            await linkEvidenceFilesToReport({
                evidenceFileIds: evidence_file_ids,
                submissionId: updatedReport.evidence_submission_id || null,
                reportSheetId: updatedReport.original_id || updatedReport.sheet_id || id,
                reportId: updatedReport.id || id,
            }).catch((linkErr) => {
                console.warn('[REPORTS_PATCH] Evidence metadata link failed:', linkErr);
            });
        }

        if (
            updates.status === 'CLOSED' &&
            String(existingReport?.status || '').toUpperCase() !== 'CLOSED'
        ) {
            notifyReportClosedEmail(updatedReport).catch((notificationError) => {
                console.warn('[REPORTS_PATCH] Report closed notification failed:', notificationError);
            });
        }

        try {
            const { bumpSyncVersion } = await import('@/lib/sync-state');
            const { purgeDashboardSnapshots, purgeExpiredDashboardSnapshots } = await import('@/lib/dashboard-cache');
            const state = await bumpSyncVersion('reports');
            await purgeDashboardSnapshots({ maxSyncVersion: Number(state.sync_version) });
            await purgeExpiredDashboardSnapshots();
        } catch (cacheErr) {
            console.warn('[REPORTS_PATCH] Cache invalidation failed:', cacheErr);
        }

        return NextResponse.json({ success: true, data: updatedReport });
    } catch (error) {
        console.error('Error updating report:', error);
        return NextResponse.json({ error: 'Gagal mengupdate laporan' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const paramsResolved = await params;
        const id = decodeURIComponent(paramsResolved.id);
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const existingReport = await reportsService.getReportById(id);
        const allowedRoles = ['SUPER_ADMIN', 'ANALYST'];
        const payloadEmail = normalizeAccessValue(payload.email);
        const reportEmail = normalizeAccessValue(existingReport?.reporter_email);
        // Station membership only grants *viewing* a station's reports (see
        // canViewReport in lib/report-access.ts) — it must not also grant
        // deleting reports filed by other people at the same station.
        // reporter_name is free text and NOT used for ownership — it is not
        // unique and is trivially spoofable (see the matching PATCH handler
        // above for the same fix).
        const canDeleteOwnDraft = Boolean(existingReport && (
            existingReport.user_id === payload.id ||
            (payloadEmail && reportEmail === payloadEmail)
        ));

        if (!allowedRoles.includes(payload.role as string) && !canDeleteOwnDraft) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const deletedFromSheet = await reportsService.deleteReport(id).catch((deleteError) => {
            console.warn('[REPORTS_DELETE] Google Sheets delete failed:', deleteError);
            return false;
        });

        const reportIdCandidates = [
            id,
            existingReport?.id,
            existingReport?.original_id,
            existingReport?.sheet_id,
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

        const deleteOrFilter = buildReportIdOrFilter(reportIdCandidates);
        if (deleteOrFilter) {
            await supabaseAdmin
                .from('ground_handling_irregularity_report')
                .delete()
                .or(deleteOrFilter);
        }

        try {
            const { bumpSyncVersion } = await import('@/lib/sync-state');
            const { purgeDashboardSnapshots, purgeExpiredDashboardSnapshots } = await import('@/lib/dashboard-cache');
            const state = await bumpSyncVersion('reports');
            await purgeDashboardSnapshots({ maxSyncVersion: Number(state.sync_version) });
            await purgeExpiredDashboardSnapshots();
        } catch (cacheErr) {
            console.warn('[REPORTS_DELETE] Cache invalidation failed:', cacheErr);
        }

        return NextResponse.json({ success: true, deletedFromSheet });
    } catch (error) {
        console.error('Error deleting report:', error);
        return NextResponse.json({ error: 'Gagal menghapus laporan' }, { status: 500 });
    }
}
