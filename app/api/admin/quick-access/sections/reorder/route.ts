import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Reorder sections: PATCH { ids: string[] } → sort_order = index. */
export async function PATCH(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const ids: string[] = body.ids;
        if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
            return NextResponse.json({ error: 'ids array wajib diisi' }, { status: 400 });
        }

        // Full rows merged first — Postgres evaluates NOT NULL constraints on
        // the INSERT row before the ON CONFLICT match (same as tiles/reorder).
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('quick_access_sections')
            .select('*')
            .in('id', ids);
        if (fetchError) {
            console.error('[QUICK_ACCESS] section reorder fetch failed:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const byId = new Map((existing || []).map((row) => [row.id, row]));
        const rows = ids.map((id, index) => ({
            ...(byId.get(id) || { id }),
            sort_order: index,
        }));

        const { error } = await supabaseAdmin
            .from('quick_access_sections')
            .upsert(rows, { onConflict: 'id' });

        if (error) {
            console.error('[QUICK_ACCESS] section reorder failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
