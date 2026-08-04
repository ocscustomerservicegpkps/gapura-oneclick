
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SecurityEvent, SecuritySeverity } from '@/types/security';
import { DetectionEngine } from './detection-engine';

interface SecurityEventParams {
    source: string;
    event_type: 'login' | 'traffic' | 'access' | 'anomaly';
    severity: SecuritySeverity;
    payload: Record<string, unknown>;
    ip_address?: string;
    actor_id?: string;
}

let pendingEvents: SecurityEvent[] = [];
let flushScheduled = false;

function scheduleDetectionFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    process.nextTick(() => {
        flushScheduled = false;
        const events = pendingEvents;
        pendingEvents = [];
        if (events.length > 0) {
            DetectionEngine.getInstance().analyze(events).catch(err =>
                console.error('[SECURITY EVENT SERVICE] Detection trigger failure:', err)
            );
        }
    });
}

export async function logSecurityEvent(params: SecurityEventParams) {
    try {
        const { error } = await supabaseAdmin
            .from('security_events')
            .insert([{
                ...params,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('[SECURITY EVENT SERVICE] Persistence error:', error);
            return;
        }

        const event: SecurityEvent = {
            id: 'internal',
            ...params,
            created_at: new Date().toISOString()
        };

        pendingEvents.push(event);
        scheduleDetectionFlush();

    } catch (err) {
        console.error('[SECURITY EVENT SERVICE] Critical failure:', err);
    }
}
