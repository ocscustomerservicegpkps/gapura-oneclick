import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { SecurityEvent } from '@/types/security';

const SENSITIVE_PAYLOAD_KEY = /authorization|cookie|credential|jwt|password|secret|session|token/i;

function redactPayload(value: unknown, depth = 0): unknown {
    if (depth > 3) return '[truncated]';
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => redactPayload(item, depth + 1));
    }
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' && value.length > 500
            ? value.slice(0, 500) + '…'
            : value;
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .slice(0, 40)
            .map(([key, entry]) => [
                key,
                SENSITIVE_PAYLOAD_KEY.test(key)
                    ? '[redacted]'
                    : redactPayload(entry, depth + 1),
            ])
    );
}

function toSecurityEvent(row: Record<string, unknown>): SecurityEvent {
    return {
        id: String(row.id || ''),
        source: String(row.source || 'system'),
        event_type: String(row.event_type || 'access') as SecurityEvent['event_type'],
        severity: String(row.severity || 'LOW') as SecurityEvent['severity'],
        payload: redactPayload(row.payload) as Record<string, unknown>,
        ip_address: typeof row.ip_address === 'string' ? row.ip_address : undefined,
        actor_id: typeof row.actor_id === 'string' ? row.actor_id : undefined,
        created_at: String(row.created_at || ''),
    };
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(session.role).trim().toUpperCase() !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
        .from('security_events')
        .select('id, source, event_type, severity, payload, ip_address, actor_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('[Security Events] Query failed:', error.message);
        return NextResponse.json({ error: 'Failed to load security events' }, { status: 500 });
    }

    return NextResponse.json(
        { events: (data || []).map((row) => toSecurityEvent(row as Record<string, unknown>)) },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
}
