import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth-utils';
import {
    consumeResetToken,
    normalizeEmail,
    revokeAllSessions,
    validatePasswordStrength,
} from '@/lib/auth/password-reset';
import { logSecurityEvent } from '@/lib/security/event-service';
import { getClientIp } from '@/lib/security/utils';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);

        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail((body as { email?: unknown }).email);
        const resetToken = String((body as { resetToken?: unknown }).resetToken ?? '').trim();
        const password = (body as { password?: unknown }).password;

        if (!email || !resetToken) {
            return NextResponse.json(
                { error: 'Invalid password reset session. Please start over.' },
                { status: 400 }
            );
        }

        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        const rateLimit = await checkDbRateLimit(`pwreset-confirm:${clientIp}`, 10, 15 * 60_000);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in a few minutes.' },
                { status: 429 }
            );
        }

        const consumed = await consumeResetToken(email, resetToken);
        if (!consumed.ok) {
            return NextResponse.json({ error: consumed.error }, { status: consumed.status || 400 });
        }

        const hashed = await hashPassword(password as string);

        // Scoped to active accounts: a suspended/rejected account must not be
        // able to regain access through a reset. The token is consumed first
        // (above) so it stays single-use even if this write fails.
        const { data: updated, error } = await supabaseAdmin
            .from('users')
            .update({ password: hashed, updated_at: new Date().toISOString() })
            .eq('id', consumed.userId)
            .eq('status', 'active')
            .select('id');

        if (error) {
            console.error('[PASSWORD_RESET] Failed to update password:', error);
            return NextResponse.json({ error: 'Failed to update the password' }, { status: 500 });
        }

        if (!updated || updated.length === 0) {
            return NextResponse.json(
                { error: 'This account cannot be used right now. Please contact an admin.' },
                { status: 403 }
            );
        }

        // A reset always invalidates existing sessions — if the account was
        // compromised, the attacker's session must not survive the reset.
        await revokeAllSessions(consumed.userId);

        await logSecurityEvent({
            source: 'auth-password-reset',
            event_type: 'access',
            severity: 'MEDIUM',
            payload: { action: 'password_reset_completed', email },
            ip_address: getClientIp(request),
            actor_id: consumed.userId,
        });

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully. Please sign in with your new password.',
        });
    } catch (error) {
        console.error('[PASSWORD_RESET] confirm error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}
