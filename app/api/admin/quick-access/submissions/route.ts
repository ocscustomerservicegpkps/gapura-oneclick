import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_LIST = 200;

export async function GET(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const tileId = searchParams.get('tileId');

        let query = supabaseAdmin
            .from('quick_access_submissions')
            .select('id, tile_id, data, created_at')
            .order('created_at', { ascending: false })
            .limit(MAX_LIST);
        if (tileId) {
            query = query.eq('tile_id', tileId);
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ submissions: data || [] });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** DELETE single submission: { id } — or clear all for a tile: { tileId }. */
export async function DELETE(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (body.id && typeof body.id === 'string') {
            const { error } = await supabaseAdmin
                .from('quick_access_submissions')
                .delete()
                .eq('id', body.id);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }
        if (body.tileId && typeof body.tileId === 'string') {
            const { error } = await supabaseAdmin
                .from('quick_access_submissions')
                .delete()
                .eq('tile_id', body.tileId);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'id atau tileId wajib diisi' }, { status: 400 });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
