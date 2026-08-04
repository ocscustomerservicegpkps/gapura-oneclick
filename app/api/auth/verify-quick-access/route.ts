import { NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

const QUICK_ACCESS_PASSWORD = process.env.QUICK_ACCESS_PASSWORD;

export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);
        const rateLimit = checkRateLimit(`quick-access:${clientIp}`, 5, 60_000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' }, { status: 429 });
        }

        if (!QUICK_ACCESS_PASSWORD) {
            console.error('[QUICK_ACCESS] QUICK_ACCESS_PASSWORD env var is not set');
            return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
        }

        const body = await request.json();
        const { password } = body;

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        const a = Buffer.from(password);
        const b = Buffer.from(QUICK_ACCESS_PASSWORD);
        const isValid = a.length === b.length && timingSafeEqual(a, b);

        if (!isValid) {
            return NextResponse.json({ valid: false }, { status: 401 });
        }

        return NextResponse.json({
            valid: true,
            quick_access_session_id: randomUUID(),
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
