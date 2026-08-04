import { NextResponse } from 'next/server';
import { normalizeEmail, verifyPasswordResetOtp } from '@/lib/auth/password-reset';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);

        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail((body as { email?: unknown }).email);
        const otp = String((body as { otp?: unknown }).otp ?? '').trim();

        if (!email || !/^\d{6}$/.test(otp)) {
            return NextResponse.json({ error: 'The OTP code must be 6 digits' }, { status: 400 });
        }

        const rateLimit = await checkDbRateLimit(`pwreset-verify:${clientIp}`, 20, 15 * 60_000);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in a few minutes.' },
                { status: 429 }
            );
        }

        const result = await verifyPasswordResetOtp(email, otp);

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status || 400 });
        }

        return NextResponse.json({ success: true, resetToken: result.resetToken });
    } catch (error) {
        console.error('[PASSWORD_RESET] verify error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}
