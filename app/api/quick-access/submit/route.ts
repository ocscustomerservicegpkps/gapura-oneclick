import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

const MAX_DATA_BYTES = 16_000;
const MAX_VALUE_LENGTH = 2000;

/**
 * Store a built-in form tile submission.
 * The client gate (password modal) is trusted for internal tooling; the
 * endpoint is rate-limited and validates the payload against the tile's
 * configured fields.
 */
export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);
        const rateLimit = checkRateLimit(`qa-submit:${clientIp}`, 10, 60_000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Terlalu banyak pengiriman. Coba lagi dalam 1 menit.' }, { status: 429 });
        }

        const body = await request.json();
        const { tileId, data } = body;

        if (!tileId || typeof tileId !== 'string') {
            return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
        }
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return NextResponse.json({ error: 'data harus berupa objek JSON' }, { status: 400 });
        }
        if (JSON.stringify(data).length > MAX_DATA_BYTES) {
            return NextResponse.json({ error: 'Data terlalu besar' }, { status: 400 });
        }

        const { data: tile, error } = await supabaseAdmin
            .from('quick_access_tiles')
            .select('id, display_mode, content')
            .eq('id', tileId)
            .single();

        if (error || !tile) {
            return NextResponse.json({ error: 'Tile tidak ditemukan' }, { status: 404 });
        }
        if (tile.display_mode !== 'form') {
            return NextResponse.json({ error: 'Tile bukan form' }, { status: 400 });
        }

        const fields: Array<{ key: string; required?: boolean }> =
            (tile.content as { fields?: Array<{ key: string; required?: boolean }> })?.fields || [];
        const validKeys = new Set(fields.map((f) => f.key));

        const values = data as Record<string, unknown>;
        for (const key of Object.keys(values)) {
            if (!validKeys.has(key)) {
                return NextResponse.json({ error: `Field tidak dikenal: ${key}` }, { status: 400 });
            }
            const value = values[key];
            const ok =
                typeof value === 'string' || typeof value === 'number' ||
                typeof value === 'boolean' ||
                (Array.isArray(value) && value.every((v) => typeof v === 'string'));
            if (!ok) {
                return NextResponse.json({ error: `Field ${key} tidak valid` }, { status: 400 });
            }
            if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
                return NextResponse.json({ error: `Field ${key} terlalu panjang` }, { status: 400 });
            }
        }
        for (const field of fields) {
            if (field.required && (values[field.key] === undefined || values[field.key] === null || values[field.key] === '')) {
                return NextResponse.json({ error: `Field wajib belum diisi: ${field.key}` }, { status: 400 });
            }
        }

        const { error: insertError } = await supabaseAdmin
            .from('quick_access_submissions')
            .insert({ tile_id: tileId, data: values });

        if (insertError) {
            console.error('[QUICK_ACCESS] submit insert failed:', insertError);
            return NextResponse.json({ error: 'Gagal menyimpan data' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
