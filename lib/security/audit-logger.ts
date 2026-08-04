
import { supabaseAdmin } from '@/lib/supabase-admin';

interface AuditEntry {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logSecurityAudit(entry: AuditEntry) {

    // actor_id is a UUID FK; automated actors (cron, system, admin-sync-api)
    // aren't real user rows, so their label can't go in that column without
    // failing the insert. Keep the label in the payload instead of dropping it.
    const isRealUserId = UUID_PATTERN.test(entry.actorId);
    const newValue = isRealUserId
        ? entry.newValue
        : { ...(entry.newValue && typeof entry.newValue === 'object' ? entry.newValue : { value: entry.newValue }), _actorLabel: entry.actorId };

    try {
        const { error } = await supabaseAdmin
            .from('audit_logs')
            .insert({
                actor_id: isRealUserId ? entry.actorId : null,
                action: entry.action,
                entity_type: entry.entityType,
                // entity_id is NOT NULL; batch/system actions (sync, retrain)
                // have no single entity, so fall back to the action name.
                entity_id: entry.entityId || entry.action,
                old_value: entry.oldValue,
                new_value: newValue,
                ip_address: entry.ipAddress,
                user_agent: entry.userAgent,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('[AUDIT_LOG_ERROR]', error);
        }
    } catch (e) {
        console.error('[AUDIT_LOG_CRITICAL]', e);
    }
}
