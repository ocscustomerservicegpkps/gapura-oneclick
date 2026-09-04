import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { getSecurityRouteToken } from '@/lib/security/route-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logSecurityAudit } from '@/lib/security/audit-logger';

export async function POST(request: Request) {
    const token = await getSecurityRouteToken(request);

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await verifySession(token);
    if (!session || session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { alertId, action } = await request.json();

        if (!alertId || !action) {
            return NextResponse.json({ error: 'Missing alertId or action' }, { status: 400 });
        }

        const statusMap: Record<string, string> = {
            'ACKNOWLEDGE': 'INVESTIGATING',
            'RESOLVE': 'RESOLVED'
        };

        const targetStatus = statusMap[action];
        if (!targetStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

        // `.select()` so a non-existent alertId is a 404 rather than a silent
        // success: an update matching no rows returns no error, so the caller
        // was told the alert had been acknowledged and the audit log recorded
        // that it had.
        const { data: updated, error } = await supabaseAdmin
            .from('security_alerts')
            .update({
                status: targetStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', alertId)
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!updated) {
            return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        }

        await logSecurityAudit({
            actorId: session.id,
            action: `ALERT_${action}`,
            entityType: 'SECURITY_ALERT',
            entityId: alertId,
            // The status the alert was actually moved to. 'SUCCESS' is not a
            // status any alert can hold, so the audit trail recorded nothing
            // about what changed.
            newValue: { status: targetStatus }
        });

        return NextResponse.json({ success: true, status: targetStatus });
    } catch (err) {
        console.error('[ALERT CONTROL] Failure:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
