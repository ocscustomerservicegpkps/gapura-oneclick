import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Reorder tiles within a section: PATCH { tileIds: string[] } → sort_order = index.
 * Full rows are fetched first and merged into the upsert — Postgres evaluates
 * NOT NULL constraints on the INSERT row BEFORE the ON CONFLICT match, so a
 * partial upsert ({id, sort_order}) would fail on section_id/title.
 */
export async function PATCH(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const tileIds: string[] = body.tileIds;
        if (!Array.isArray(tileIds) || tileIds.length === 0 || !tileIds.every((id) => typeof id === 'string')) {
            return NextResponse.json({ error: 'tileIds array wajib diisi' }, { status: 400 });
        }

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('quick_access_tiles')
            .select('*')
            .in('id', tileIds);
        if (fetchError) {
            console.error('[QUICK_ACCESS] tile reorder fetch failed:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const byId = new Map((existing || []).map((row) => [row.id, row]));
        const rows = tileIds.map((id, index) => ({
            ...(byId.get(id) || { id }),
            sort_order: index,
        }));

        const { error } = await supabaseAdmin
            .from('quick_access_tiles')
            .upsert(rows, { onConflict: 'id' });

        if (error) {
            console.error('[QUICK_ACCESS] tile reorder failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
