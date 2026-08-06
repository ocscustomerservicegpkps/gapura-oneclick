import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_STRING = 200;

async function getNextSortOrder(): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from('quick_access_sections')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
    if (error) throw error;
    return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function POST(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title || title.length > MAX_STRING) {
            return NextResponse.json({ error: 'title wajib diisi (maks 200 karakter)' }, { status: 400 });
        }
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_STRING) : '';

        const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : await getNextSortOrder();

        const { data, error } = await supabaseAdmin
            .from('quick_access_sections')
            .insert({ title, description, sort_order: sortOrder, is_visible: body.is_visible !== false })
            .select()
            .single();

        if (error) {
            console.error('[QUICK_ACCESS] section create failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ section: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (typeof body.title === 'string') {
            const title = body.title.trim();
            if (!title || title.length > MAX_STRING) {
                return NextResponse.json({ error: 'title wajib diisi (maks 200 karakter)' }, { status: 400 });
            }
            updates.title = title;
        }
        if (typeof body.description === 'string') {
            updates.description = body.description.trim().slice(0, MAX_STRING);
        }
        if (typeof body.is_visible === 'boolean') {
            updates.is_visible = body.is_visible;
        }
        if (typeof body.sort_order === 'number') {
            updates.sort_order = body.sort_order;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('quick_access_sections')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();

        if (error) {
            console.error('[QUICK_ACCESS] section update failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ section: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        // CASCADE removes tiles + their submissions.
        const { error } = await supabaseAdmin
            .from('quick_access_sections')
            .delete()
            .eq('id', body.id);

        if (error) {
            console.error('[QUICK_ACCESS] section delete failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
