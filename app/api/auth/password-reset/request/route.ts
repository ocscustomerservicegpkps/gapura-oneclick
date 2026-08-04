import { NextResponse } from 'next/server';
import { issuePasswordResetOtp, normalizeEmail } from '@/lib/auth/password-reset';
import { logSecurityEvent } from '@/lib/security/event-service';
import { getClientIp } from '@/lib/security/utils';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

// Same body for every outcome — the endpoint must not reveal whether an email
// is registered.
const GENERIC_RESPONSE = {
    success: true,
    message: 'If the email is registered, an OTP code has been sent to it.',
};

export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);

        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail((body as { email?: unknown }).email);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const ipLimit = await checkDbRateLimit(`pwreset-ip:${clientIp}`, 10, 15 * 60_000);
        if (!ipLimit.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again in a few minutes.' },
                { status: 429 }
            );
        }

        const emailLimit = await checkDbRateLimit(`pwreset-email:${email}`, 3, 15 * 60_000);
        if (!emailLimit.success) {
            return NextResponse.json(
                { error: 'Too many requests for this email. Please try again in a few minutes.' },
                { status: 429 }
            );
        }

        await issuePasswordResetOtp(email, clientIp);

        await logSecurityEvent({
            source: 'auth-password-reset',
            event_type: 'access',
            severity: 'LOW',
            payload: { action: 'password_reset_request', email, ip: clientIp },
            ip_address: getClientIp(request),
        });

        return NextResponse.json(GENERIC_RESPONSE);
    } catch (error) {
        console.error('[PASSWORD_RESET] request error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}
