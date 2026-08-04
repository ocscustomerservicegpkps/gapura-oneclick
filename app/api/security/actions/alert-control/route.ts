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

        const { error } = await supabaseAdmin
            .from('security_alerts')
            .update({ 
                status: targetStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', alertId);

        if (error) throw error;

        await logSecurityAudit({
            actorId: session.id,
            action: `ALERT_${action}`,
            entityType: 'SECURITY_ALERT',
            entityId: alertId,
            newValue: { status: 'SUCCESS' }
        });

        return NextResponse.json({ success: true, status: targetStatus });
    } catch (err) {
        console.error('[ALERT CONTROL] Failure:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
