import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/auth-utils';
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

/**
 * Verify a per-tile password (bcrypt, stored in quick_access_tiles.password_hash).
 * Rate-limited per IP — mirrors /api/auth/verify-quick-access.
 */
export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);
        const rateLimit = checkRateLimit(`qa-verify:${clientIp}`, 5, 60_000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.' }, { status: 429 });
        }

        const body = await request.json();
        const { tileId, password } = body;

        if (!tileId || typeof tileId !== 'string') {
            return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
        }
        if (!password || typeof password !== 'string' || password.length > 200) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        const { data: tile, error } = await supabaseAdmin
            .from('quick_access_tiles')
            .select('id, is_password_protected, password_hash')
            .eq('id', tileId)
            .single();

        if (error || !tile || !tile.is_password_protected || !tile.password_hash) {
            // Don't reveal whether the tile exists or is protected.
            return NextResponse.json({ valid: false }, { status: 401 });
        }

        const isValid = await verifyPassword(password, tile.password_hash);
        if (!isValid) {
            return NextResponse.json({ valid: false }, { status: 401 });
        }

        return NextResponse.json({ valid: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
