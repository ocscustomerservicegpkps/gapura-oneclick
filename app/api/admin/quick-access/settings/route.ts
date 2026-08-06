import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VALID_KEYS = ['ai_enabled', 'quick_access_enabled'] as const;

export async function GET() {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('quick_access_settings')
            .select('key, value');
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const settings: Record<string, boolean> = {};
        for (const row of data || []) {
            if (VALID_KEYS.includes(row.key as (typeof VALID_KEYS)[number])) {
                settings[row.key] = row.value === true || row.value === 'true';
            }
        }
        return NextResponse.json({ settings });
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
        const rows: { key: string; value: boolean }[] = [];

        for (const key of VALID_KEYS) {
            if (typeof body[key] === 'boolean') {
                rows.push({ key, value: body[key] });
            }
        }

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Tidak ada setting yang valid diupdate' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('quick_access_settings')
            .upsert(rows.map((r) => ({ key: r.key, value: r.value })), { onConflict: 'key' })
            .select();

        if (error) {
            console.error('[QUICK_ACCESS] settings update failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ settings: data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
