import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ponytail: cabang = PARTNER_* + MANAGER_CABANG + STAFF_CABANG
const CABANG_RE = /^(PARTNER_|MANAGER_CABANG$|STAFF_CABANG$)/i;

export async function getStationLock(userId: string, role: string): Promise<string | null> {
    if (!CABANG_RE.test(role || '')) return null;
    const { data: u } = await supabaseAdmin.from('users').select('station_id').eq('id', userId).single();
    if (!u?.station_id) return null;
    const { data: s } = await supabaseAdmin.from('stations').select('code').eq('id', u.station_id).single();
    return s?.code ? s.code.toUpperCase() : null;
}
