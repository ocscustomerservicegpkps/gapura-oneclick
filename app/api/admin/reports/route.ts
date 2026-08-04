import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { validateStatusTransition, getTimestampFieldForStatus, getUserFieldForStatus } from '@/lib/utils/validate-transition';
import { reportsService } from '@/lib/services/reports-service';
import { notifyReportClosedEmail, notifyStatusChange } from '@/lib/notifications';
import { parseReportLimit } from '@/lib/report-page';
import { queryReportPage, ReportPageQueryError } from '@/lib/server/report-page-query';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

function statusToAction(status: unknown): string | null {
    const normalized = String(status || '').trim().toUpperCase().replace(/_/g, ' ');

    if (normalized === 'ON PROGRESS') return 'update_progress';
    if (normalized === 'CLOSED') return 'close';
    if (normalized === 'OPEN') return 'reopen';

    return null;
}

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        const payload = token ? await verifySession(token) : null;

        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const includeDetails = searchParams.get('detail') === '1';
        const page = await queryReportPage({
            session: payload,
            scope: 'admin',
            limit: parseReportLimit(searchParams.get('limit')),
            cursor: searchParams.get('cursor'),
            projection: includeDetails ? 'detail' : 'list',
            includeComments: !includeDetails,
            filters: {
                status: searchParams.get('status'),
                station: searchParams.get('station'),
                search: searchParams.get('search'),
                from: searchParams.get('from'),
                to: searchParams.get('to'),
                severity: searchParams.get('severity'),
                hub: searchParams.get('hub'),
                category: searchParams.get('category'),
                airline: searchParams.get('airline') || searchParams.get('airlines'),
                area: searchParams.get('area'),
                sourceSheet: searchParams.get('sourceSheet'),
            },
        });

        return NextResponse.json(page, {
            headers: {
                'Cache-Control': 'private, no-store, max-age=0',
                'Vary': 'Cookie',
                'Server-Timing': `reports;dur=${page.meta.durationMs || 0}`,
            },
        });
    } catch (error) {
        if (error instanceof ReportPageQueryError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error fetching reports:', error);
        return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value ?? null;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(token);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const {
            reportId,
            action,
            status,
            notes,
            resolution_evidence_url,
            final_remarks,
            kps_remarks,
            remarks_by,
        } = body;
        const requestedAction = action || statusToAction(status);

        if (!reportId || !requestedAction) {
            return NextResponse.json({ error: 'reportId dan action/status wajib diisi' }, { status: 400 });
        }

        const report = await reportsService.getReportById(reportId);

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const userRole = session.role;
        const userId = session.id;

        if (!userRole) {
            return NextResponse.json({ error: 'Role pengguna tidak ditemukan' }, { status: 400 });
        }

        const validation = validateStatusTransition(report.status, requestedAction, userRole);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 403 });
        }

        const newStatus = validation.newStatus!;
        const finalRemarksValue = String(kps_remarks ?? final_remarks ?? notes ?? '').trim();
        const remarksByValue = String(remarks_by ?? '').trim();

        if (requestedAction === 'close' && (!finalRemarksValue || !remarksByValue)) {
            return NextResponse.json(
                { error: 'Final Remarks dan Remarks By wajib diisi sebelum menutup laporan' },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        const timestampField = getTimestampFieldForStatus(newStatus);
        if (timestampField) {
            updateData[timestampField] = new Date().toISOString();
        }

        const userField = getUserFieldForStatus(newStatus);
        if (userField && userId) {
            updateData[userField] = userId;
        }

        if (notes) {
            if (requestedAction === 'verify' || requestedAction === 'update_progress') {
                updateData.validation_notes = notes;
            } else if (requestedAction === 'close') {
                updateData.investigator_notes = notes;
            } else if (requestedAction === 'reopen') {
                updateData.manager_notes = notes;
            }
        }

        if (requestedAction === 'close') {
            updateData.kps_remarks = finalRemarksValue;
            updateData.remarks_by = remarksByValue;
        }

        if (resolution_evidence_url) {
            updateData.resolution_evidence_url = resolution_evidence_url;
        }

        if (requestedAction === 'reopen') {
            updateData.resolved_at = null;
            updateData.resolved_by = null;
        }

        const updatedReport = await reportsService.updateReport(reportId, updateData);

        if (!updatedReport) {
             return NextResponse.json({ error: 'Gagal mengupdate laporan' }, { status: 500 });
        }

        if (
            newStatus === 'CLOSED' &&
            String(report.status || '').toUpperCase() !== 'CLOSED'
        ) {
            notifyReportClosedEmail(updatedReport).catch((notificationError) => {
                console.warn('[ADMIN_REPORTS] Report closed notification failed:', notificationError);
            });
        }

        if (String(newStatus).trim().toUpperCase() !== String(report.status || '').trim().toUpperCase()) {
            notifyStatusChange(
                String(updatedReport.id || reportId),
                updatedReport.title || updatedReport.report || 'Untitled report',
                String(report.status || '-'),
                String(newStatus)
            ).catch((notificationError) => {
                console.warn('[ADMIN_REPORTS] Status-change notification failed:', notificationError);
            });
        }

        return NextResponse.json({ success: true, newStatus });
    } catch (error) {
        console.error('Error updating report:', error);
        return NextResponse.json({ error: 'Failed to change status' }, { status: 500 });
    }
}
