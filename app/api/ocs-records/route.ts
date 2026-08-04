import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWorkspaceUser, normalizeRole } from '@/lib/server/workspace-auth';

const TABS = ['reminder', 'joumpa', 'joumpa_uplifting', 'rca', 'weekly_report', 'monthly_report', 'survey_report'] as const;
type OcsTab = (typeof TABS)[number];

// "analyst OCS" == ANALYST role scoped to the OCS division (plus SUPER_ADMIN),
// same rule as calendar-events.ts and the rest of the OCS-only analyst gating.
function canManage(role: string | null | undefined, division: string | null | undefined): boolean {
    const r = normalizeRole(role);
    return r === 'SUPER_ADMIN' || (r === 'ANALYST' && division === 'OCS');
}

const FIELDS = [
    'event_date', 'agenda', 'series', 'location', 'pic', 'branch', 'airline',
    'participants', 'case_report', 'remarks', 'report_url', 'materi_url',
    'attendance_url', 'record_url',
] as const;

export async function GET(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const tab = url.searchParams.get('tab');
    // Safety cap — this table is small (internal OCS meeting/report logs) but
    // had no bound at all; well above any realistic row count today, with an
    // opt-in `limit` query param for a genuine larger read.
    const requestedLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 10000)
        : 2000;
    let query = supabaseAdmin.from('ocs_tab_records').select('*').order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(0, limit - 1);
    if (tab && (TABS as readonly string[]).includes(tab)) query = query.eq('tab', tab);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null);
    const tab = body?.tab as OcsTab;
    if (!tab || !(TABS as readonly string[]).includes(tab)) {
        return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
    }

    const payload: Record<string, unknown> = { tab, created_by: user.id };
    for (const f of FIELDS) {
        const v = body?.[f];
        payload[f] = typeof v === 'string' && v.trim() ? v.trim() : null;
    }

    const { data, error } = await supabaseAdmin.from('ocs_tab_records').insert(payload).select('*').single();
    if (error) return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null);
    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const payload: Record<string, unknown> = {};
    for (const f of FIELDS) {
        if (f in (body ?? {})) {
            const v = body[f];
            payload[f] = typeof v === 'string' && v.trim() ? v.trim() : null;
        }
    }

    const { data, error } = await supabaseAdmin.from('ocs_tab_records').update(payload).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('ocs_tab_records').delete().eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    return NextResponse.json({ ok: true });
}
