import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { getSecurityRouteToken } from '@/lib/security/route-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logSecurityAudit } from '@/lib/security/audit-logger';

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** Keeps arbitrary strings out of blocked_ips, where they would never match a real client. */
function isIpAddress(value: unknown): boolean {
    const raw = String(value ?? '').trim();
    if (!raw || raw.length > 45) return false;
    if (IPV4.test(raw)) return true;
    // IPv6 is varied enough that the URL parser is a better judge than a regex.
    try {
        return new URL(`http://[${raw}]`).hostname.startsWith('[');
    } catch {
        return false;
    }
}

/** Up to one year, in hours. */
function isBlockDuration(value: unknown): boolean {
    const hours = Number(value);
    return Number.isFinite(hours) && hours > 0 && hours <= 24 * 365;
}

export async function POST(request: Request) {
    const token = await getSecurityRouteToken(request);

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await verifySession(token);
    if (!session || session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { ip, action, reason, durationHours } = await request.json();

        if (!ip || !action) {
            return NextResponse.json({ error: 'Missing IP or action' }, { status: 400 });
        }

        if (!isIpAddress(ip)) {
            return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 });
        }

        if (action === 'BLOCK') {
            // Unvalidated, `durationHours * 3600000` is NaN for anything
            // non-numeric and out of range for anything large — both make
            // `toISOString()` throw, so a malformed body came back as a 500
            // instead of the 400 it is.
            if (durationHours !== undefined && durationHours !== null && !isBlockDuration(durationHours)) {
                return NextResponse.json({ error: 'Invalid durationHours' }, { status: 400 });
            }

            const expiresAt = durationHours
                ? new Date(Date.now() + Number(durationHours) * 3600000).toISOString()
                : null;

            const { error } = await supabaseAdmin
                .from('blocked_ips')
                .upsert({
                    ip_address: ip,
                    reason: reason || 'Manual block by admin',
                    expires_at: expiresAt,
                    blocked_at: new Date().toISOString()
                });

            if (error) throw error;

            await logSecurityAudit({
                actorId: session.id,
                action: 'BLOCK_IP',
                entityType: 'IP_ADDRESS',
                entityId: ip,
                newValue: { reason, expiresAt, status: 'SUCCESS' }
            });

            return NextResponse.json({ success: true, message: `IP ${ip} blocked.` });
        } else if (action === 'UNBLOCK') {
            const { error } = await supabaseAdmin
                .from('blocked_ips')
                .delete()
                .eq('ip_address', ip);

            if (error) throw error;

            await logSecurityAudit({
                actorId: session.id,
                action: 'UNBLOCK_IP',
                entityType: 'IP_ADDRESS',
                entityId: ip,
                newValue: { status: 'SUCCESS' }
            });

            return NextResponse.json({ success: true, message: `IP ${ip} unblocked.` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('[IP CONTROL] Failure:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
