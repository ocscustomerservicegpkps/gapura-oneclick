
import { after, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { UserRole } from '@/types';
import { notifyReportCommentEmail, type CommentRecipient } from '@/lib/notifications';
import { quoteForPostgrestFilter } from '@/lib/security/postgrest';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Lightweight report reference lookup for comment writes. Resolves the stable
// UUID + sheet id from the synced DB tables ONLY — never touches Google Sheets,
// so posting a comment is instant. Covers both ground-handling and JOUMPA reports.
async function resolveReportRef(
    reportId: string
): Promise<{ stableUuid: string; sheetId: string | null; source: 'ground_handling_irregularity_report' | 'joumpa_reports_sync' } | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
    const safe = quoteForPostgrestFilter(reportId);

    const ghFilter = isUuid
        ? `id.eq.${safe},original_id.eq.${safe},sheet_id.eq.${safe}`
        : `original_id.eq.${safe},sheet_id.eq.${safe}`;
    const { data: gh } = await supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select('id, sheet_id, original_id')
        .or(ghFilter)
        .limit(1);
    if (gh && gh.length > 0) {
        return { stableUuid: gh[0].id, sheetId: gh[0].sheet_id || gh[0].original_id || null, source: 'ground_handling_irregularity_report' };
    }

    const jpFilter = isUuid ? `id.eq.${safe},sheet_id.eq.${safe}` : `sheet_id.eq.${safe}`;
    const { data: jp } = await supabaseAdmin
        .from('joumpa_reports_sync')
        .select('id, sheet_id')
        .or(jpFilter)
        .limit(1);
    if (jp && jp.length > 0) {
        return { stableUuid: jp[0].id, sheetId: jp[0].sheet_id || null, source: 'joumpa_reports_sync' };
    }

    return null;
}

// Divisions, analysts, eskalasi and super admin can read/post on any report.
const GLOBAL_COMMENT_ROLES: UserRole[] = [
    'SUPER_ADMIN', 'DIVISI_ESKALASI', 'ANALYST',
    'DIVISI_OCS', 'DIVISI_OS', 'DIVISI_OP', 'DIVISI_OT', 'DIVISI_UQ', 'DIVISI_HT',
];

/**
 * `reportUuid` must be the resolved `stableUuid`, never the raw route
 * parameter.
 *
 * Both branch-tier arms used to short-circuit to `true` for any id containing
 * '!' — which is every sheet id ("NON CARGO!row_123"). The lookups below only
 * work against the uuid, so addressing a report by its sheet id skipped the
 * station and ownership checks entirely and let any branch user read and post
 * on any report in the company. Resolving the ref first removes the need for
 * the short-circuit.
 */
async function canAccessReportComments(reportUuid: string, userId: string, role: UserRole, stationId?: string): Promise<boolean> {

    if (GLOBAL_COMMENT_ROLES.includes(role)) {
        return true;
    }

    if (role === 'MANAGER_CABANG') {
        const { data: report } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select('station_id')
            .eq('id', reportUuid)
            .single();

        if (!report) return false;
        return report.station_id === stationId;
    }

    if (role === 'STAFF_CABANG') {
        const { data: report, error } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select('user_id')
            .eq('id', reportUuid)
            .single();

        if (error || !report) return false;
        return report.user_id === userId;
    }

    return false;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id: reportId } = await params;

        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        // DB-only ref resolution — never touches Google Sheets, so reading
        // comments is instant (getReportById could stall ~5s on a live fetch).
        // Resolved before the access check so the check always runs against the
        // report's uuid, whichever identifier the caller addressed it by.
        const ref = await resolveReportRef(reportId);
        if (!ref) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const hasAccess = await canAccessReportComments(ref.stableUuid, payload.id as string, payload.role as UserRole, payload.station_id as string);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const commentIds = [reportId, ref.stableUuid, ref.sheetId].filter((val): val is string => !!val);
        const { data, error } = await supabaseAdmin
            .from('report_comments')
            .select(`
                id,
                content,
                attachments,
                is_system_message,
                sheet_id,
                created_at,
                users:user_id (
                    id,
                    full_name,
                    role,
                    division
                )
            `)
            .in('report_id', commentIds)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching comments:', error);
            return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in GET /api/reports/[id]/comments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id: reportId } = await params;

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
        const { content, attachments = [] } = body;

        if (!content?.trim() && attachments.length === 0) {
            return NextResponse.json({ error: 'Content or attachments required' }, { status: 400 });
        }

        // Same ordering as GET: resolve first, then authorise against the
        // report's uuid. Addressing a report by its sheet id used to grant any
        // MANAGER_CABANG or STAFF_CABANG the right to post on it, whatever
        // station it belonged to and whoever filed it.
        const ref = await resolveReportRef(reportId);

        if (!ref) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const hasAccess = await canAccessReportComments(ref.stableUuid, payload.id as string, payload.role as UserRole, payload.station_id as string);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const stableUuid = ref.stableUuid;
        const sheetId = ref.sheetId;

        const { data: comment, error: insertError } = await supabaseAdmin
            .from('report_comments')
            .insert({
                report_id: stableUuid,
                user_id: payload.id,
                content: content?.trim() || '',
                attachments: attachments.length > 0 ? attachments : null,
                is_system_message: false,
                sheet_id: sheetId,
            })
            .select(`
                id,
                content,
                attachments,
                is_system_message,
                created_at,
                users:user_id (
                    id,
                    full_name,
                    role,
                    division
                )
            `)
            .single();

        if (insertError) {
            console.error('Error creating comment:', insertError);
            return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
        }

        // In-app bell: notify the reporter + everyone who previously commented.
        try {
            const recipientIds = new Set<string>();

            const { data: priorCommenters } = await supabaseAdmin
                .from('report_comments')
                .select('user_id')
                .in('report_id', [stableUuid, sheetId].filter((v): v is string => !!v));
            priorCommenters?.forEach((row) => row.user_id && recipientIds.add(row.user_id));

            // Was querying the legacy (always-empty) `reports` table, so the
            // report owner never actually got notified about comments on their
            // own report — resolveReportRef already knows which live table
            // (ground-handling or JOUMPA) this report actually came from.
            const { data: reportRow } = await supabaseAdmin
                .from(ref.source)
                .select('user_id, title')
                .eq('id', stableUuid)
                .single();
            const ownerId = reportRow?.user_id || null;
            if (ownerId) recipientIds.add(ownerId);

            recipientIds.delete(payload.id as string); // never notify the author

            if (recipientIds.size > 0 && comment?.id) {
                await supabaseAdmin.from('report_comment_notifications').insert(
                    [...recipientIds].map((uid) => ({
                        user_id: uid,
                        report_id: stableUuid,
                        comment_id: comment.id,
                    }))
                );

                queueCommentEmails({
                    recipientIds: [...recipientIds],
                    ownerId,
                    stableUuid,
                    publicReportId: sheetId || reportId,
                    reportTitle: (reportRow?.title as string) || null,
                    commentId: comment.id as string,
                    authorId: payload.id as string,
                    content: content?.trim() || '',
                    attachmentCount: attachments.length,
                });
            }
        } catch (notifyError) {
            console.error('Failed to create comment notifications:', notifyError);
        }

        return NextResponse.json(comment, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/reports/[id]/comments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

interface CommentEmailJob {
    recipientIds: string[];
    ownerId: string | null;
    stableUuid: string;
    /** Id used in links — the sheet id the UI routes on, when there is one. */
    publicReportId: string;
    reportTitle: string | null;
    commentId: string;
    authorId: string;
    content: string;
    attachmentCount: number;
}

/**
 * Emails the thread after the response is sent. Every recipient is re-checked
 * against canAccessReportComments: a staff account that has since lost access
 * to the report must not receive its comment text by email.
 */
function queueCommentEmails(job: CommentEmailJob) {
    after(async () => {
        try {
            const { data: author } = await supabaseAdmin
                .from('users')
                .select('full_name, role')
                .eq('id', job.authorId)
                .maybeSingle();

            const { data: users } = await supabaseAdmin
                .from('users')
                .select('id, email, full_name, role, status, station_id')
                .in('id', job.recipientIds);

            const recipients: CommentRecipient[] = [];

            for (const user of users || []) {
                if (!user.email || user.status !== 'active') continue;

                const allowed = await canAccessReportComments(
                    job.stableUuid,
                    user.id,
                    user.role as UserRole,
                    user.station_id as string
                );
                if (!allowed) continue;

                recipients.push({
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    relation: user.id === job.ownerId ? 'owner' : 'participant',
                });
            }

            if (recipients.length === 0) return;

            await notifyReportCommentEmail({
                reportId: job.publicReportId,
                reportTitle: job.reportTitle,
                authorName: author?.full_name || 'A team member',
                authorRole: author?.role || null,
                excerpt: job.content,
                commentId: job.commentId,
                attachmentCount: job.attachmentCount,
                recipients,
            });
        } catch (error) {
            console.warn('[REPORT_COMMENTS] Comment email failed (non-blocking):', error);
        }
    });
}
