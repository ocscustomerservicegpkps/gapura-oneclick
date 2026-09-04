import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ponytail: cabang = PARTNER_* + MANAGER_CABANG + STAFF_CABANG
const CABANG_RE = /^(PARTNER_|MANAGER_CABANG$|STAFF_CABANG$)/i;

/**
 * Station a branch-tier user is confined to, or `null` for a role that is not
 * confined at all.
 *
 * Throws rather than returning `null` when the lock cannot be established.
 * Every caller reads `null` as "no station restriction", so swallowing the
 * query errors meant a transient database failure silently promoted a branch
 * user to company-wide visibility — the one outcome this function exists to
 * prevent. `null` now means only what it should: a user with no station.
 */
export async function getStationLock(userId: string, role: string): Promise<string | null> {
    if (!CABANG_RE.test(role || '')) return null;

    const { data: u, error: userError } = await supabaseAdmin
        .from('users')
        .select('station_id')
        .eq('id', userId)
        .single();
    if (userError) throw new Error(`getStationLock: user lookup failed: ${userError.message}`);
    if (!u) throw new Error(`getStationLock: no user record for ${userId}`);
    if (!u.station_id) return null;

    const { data: s, error: stationError } = await supabaseAdmin
        .from('stations')
        .select('code')
        .eq('id', u.station_id)
        .single();
    if (stationError) throw new Error(`getStationLock: station lookup failed: ${stationError.message}`);
    // The user *is* pinned to a station; not being able to name it is a reason
    // to refuse, not a reason to unlock.
    if (!s?.code) throw new Error(`getStationLock: station ${u.station_id} has no code`);

    return String(s.code).toUpperCase();
}
