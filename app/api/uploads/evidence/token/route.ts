import { NextResponse } from 'next/server';
import { generateUploadToken, checkRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
    const ip = getClientIpFromRequest(request);
    const rl = checkRateLimit(`upload-token:${ip}`, 10, 60_000);
    if (!rl.success) {
        return NextResponse.json(
            { error: 'Too many token requests. Please try again later.' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
        );
    }

    const token = generateUploadToken();
    if (!token) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    return NextResponse.json({
        token,
        expiresIn: 300,
    });
}
