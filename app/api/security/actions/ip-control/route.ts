import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logSecurityAudit } from '@/lib/security/audit-logger';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1] || request.headers.get('cookie')?.split('session=')[1]?.split(';')[0];

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

        if (action === 'BLOCK') {
            const expiresAt = durationHours ? new Date(Date.now() + durationHours * 3600000).toISOString() : null;

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
