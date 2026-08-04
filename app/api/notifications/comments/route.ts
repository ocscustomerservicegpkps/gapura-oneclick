import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';

async function getUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    const payload = await verifySession(token);
    return payload ? (payload.id as string) : null;
}

// Unread comment notifications for the current user (in-app bell).
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('report_comment_notifications')
            .select(`
                id,
                report_id,
                created_at,
                comment:comment_id (
                    content,
                    is_system_message,
                    users:user_id ( full_name, role )
                )
            `)
            .eq('user_id', userId)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error('Error fetching comment notifications:', error);
            return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
        }

        return NextResponse.json({ count: data?.length ?? 0, items: data ?? [] });
    } catch (error) {
        console.error('Error in GET /api/notifications/comments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Mark notifications read — for one report (body.reportId) or all of them.
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const reportId = typeof body?.reportId === 'string' ? body.reportId : null;

        let query = supabaseAdmin
            .from('report_comment_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        if (reportId) query = query.eq('report_id', reportId);

        const { error } = await query;
        if (error) {
            console.error('Error marking comment notifications read:', error);
            return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/notifications/comments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
