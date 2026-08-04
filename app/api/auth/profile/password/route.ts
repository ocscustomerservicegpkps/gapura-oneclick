import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword, verifyPassword, verifySession } from '@/lib/auth-utils';
import { revokeAllSessions, validatePasswordStrength } from '@/lib/auth/password-reset';
import { logSecurityEvent } from '@/lib/security/event-service';
import { getClientIp } from '@/lib/security/utils';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        const session = token ? await verifySession(token) : null;

        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const clientIp = getClientIpFromRequest(request);
        const rateLimit = await checkDbRateLimit(`pwchange:${session.id}`, 5, 15 * 60_000);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in a few minutes.' },
                { status: 429 }
            );
        }

        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        const newPassword = body.newPassword;

        if (!currentPassword) {
            return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
        }

        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        if (currentPassword === newPassword) {
            return NextResponse.json(
                { error: 'The new password must be different from the current one' },
                { status: 400 }
            );
        }

        const { data: user, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, email, password')
            .eq('id', session.id)
            .single();

        if (fetchError || !user) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const valid = await verifyPassword(currentPassword, user.password);
        if (!valid) {
            await logSecurityEvent({
                source: 'auth-profile-password',
                event_type: 'access',
                severity: 'MEDIUM',
                payload: { action: 'password_change_failed', email: user.email, ip: clientIp },
                ip_address: getClientIp(request),
                actor_id: user.id,
            });
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
        }

        const hashed = await hashPassword(newPassword as string);

        const { error } = await supabaseAdmin
            .from('users')
            .update({ password: hashed, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        if (error) {
            console.error('[PROFILE] Password update error:', error);
            return NextResponse.json({ error: 'Failed to update the password' }, { status: 500 });
        }

        // Other devices are signed out; the session making the change survives.
        await revokeAllSessions(user.id, session.sid ?? null);

        await logSecurityEvent({
            source: 'auth-profile-password',
            event_type: 'access',
            severity: 'MEDIUM',
            payload: { action: 'password_change_completed', email: user.email },
            ip_address: getClientIp(request),
            actor_id: user.id,
        });

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully. Other devices have been signed out.',
        });
    } catch (error) {
        console.error('[PROFILE] password error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}
