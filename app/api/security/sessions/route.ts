import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySession, evictSessionCache } from '@/lib/auth-utils';
import { logSecurityEvent } from '@/lib/security/event-service';
import { getClientIp } from '@/lib/security/utils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;
        if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = await verifySession(sessionToken);
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

        const { data: sessions, error } = await supabaseAdmin
            .from('security_sessions')
            .select('*')
            .eq('user_id', payload.id)
            .eq('is_revoked', false)
            .gt('expires_at', new Date().toISOString())
            .order('last_active', { ascending: false });

        if (error) throw error;

        const safeSessions = sessions.map(s => ({
            id: s.id,
            ip: s.ip_address,
            ua: s.user_agent,
            device: s.device_name || 'Unknown Device',
            lastActive: s.last_active,
            isCurrent: s.session_id === payload.sid
        }));

        return NextResponse.json({ sessions: safeSessions }, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (err) {
        console.error('Fetch sessions failed:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;
        if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = await verifySession(sessionToken);
        if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

        const { sessionId } = await request.json();
        if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

        const { data: revokedRow, error } = await supabaseAdmin
            .from('security_sessions')
            .update({ is_revoked: true })
            .eq('id', sessionId)
            .eq('user_id', payload.id)
            .select('session_id')
            .single();

        if (error) throw error;

        if (revokedRow?.session_id) {
            evictSessionCache(revokedRow.session_id);
        }

        await logSecurityEvent({
            source: 'security-session-api',
            event_type: 'access',
            severity: 'LOW',
            payload: { action: 'REVOKE_SESSION', target_id: sessionId },
            ip_address: getClientIp(request),
            actor_id: payload.id
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Revocation failed' }, { status: 500 });
    }
}
