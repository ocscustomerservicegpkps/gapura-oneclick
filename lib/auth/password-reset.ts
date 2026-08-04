import 'server-only';

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { emailLogoAttachment, renderEmail, renderEmailText, type EmailOptions } from '@/lib/email-template';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

interface OtpRow {
    id: string;
    email: string;
    user_id: string | null;
    otp_hash: string;
    reset_token_hash: string | null;
    attempts: number;
    verified_at: string | null;
    consumed_at: string | null;
    expires_at: string;
}

let transporter: nodemailer.Transporter | null = null;

function smtpConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || '465');
    const secure = process.env.SMTP_SECURE
        ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
        : port === 465;
    const user = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER || '';
    const pass = process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASS || '';

    return { host, port, secure, user, pass };
}

function mailFrom() {
    const configured = process.env.NOTIFICATION_FROM_EMAIL?.trim();
    if (configured) return configured;
    const { user } = smtpConfig();
    return user ? `OneKlik <${user}>` : 'OneKlik <notifications@localhost>';
}

function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizeEmail(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function generateOtp(): string {
    // 6 digits, uniformly distributed (rejection sampling avoids modulo bias).
    let n: number;
    do {
        n = crypto.randomBytes(4).readUInt32BE(0);
    } while (n >= 4_294_000_000);
    return String(n % 1_000_000).padStart(6, '0');
}

async function sendOtpEmail(to: string, otp: string, fullName: string | null) {
    const { host, port, secure, user, pass } = smtpConfig();

    if (!user || !pass) {
        console.warn('[PASSWORD_RESET] SMTP credentials missing — OTP email not sent.');
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`[PASSWORD_RESET] (dev) OTP for ${to}: ${otp}`);
        }
        return;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
            // Bounded so a stalled SMTP handshake cannot hold the request open.
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
        });
    }

    const minutes = Math.round(OTP_TTL_MS / 60_000);
    const greeting = fullName ? fullName.split(' ')[0] : 'there';

    const content: EmailOptions = {
        status: 'Password reset',
        title: 'Your verification code',
        lead: `Hi ${greeting}, use the code below to finish resetting your OneClick password.`,
        preheader: `Your OneClick verification code expires in ${minutes} minutes.`,
        code: otp,
        codeCaption: `Valid for ${minutes} minutes, single use.`,
        note: 'Did not request this? Ignore this email — your password stays unchanged. Never share this code with anyone, including Gapura staff.',
    };

    await transporter.sendMail({
        from: mailFrom(),
        to,
        // The code stays out of the subject so it is not exposed in notification previews.
        subject: 'Your OneClick verification code',
        text: renderEmailText(content),
        html: renderEmail(content),
        attachments: [emailLogoAttachment()],
    });
}

/**
 * Issues a fresh OTP for `email` when an active account exists. Returns silently
 * (without sending anything) for unknown/inactive accounts so callers can always
 * answer with the same generic response — the endpoint must not double as an
 * account-existence oracle.
 */
export async function issuePasswordResetOtp(email: string, ipAddress: string | null): Promise<void> {
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, status')
        .eq('email', email)
        .single();

    if (!user || user.status !== 'active') return;

    const otp = generateOtp();

    // Any previous unconsumed code for this email becomes unusable.
    await supabaseAdmin
        .from('password_reset_otps')
        .update({ consumed_at: new Date().toISOString() })
        .eq('email', email)
        .is('consumed_at', null);

    const { error } = await supabaseAdmin.from('password_reset_otps').insert({
        email,
        user_id: user.id,
        otp_hash: sha256(otp),
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        ip_address: ipAddress,
    });

    if (error) {
        // Swallowed on purpose: surfacing a 500 only for registered emails would
        // turn this endpoint into an account-existence oracle.
        console.error('[PASSWORD_RESET] Failed to persist OTP:', error);
        return;
    }

    try {
        await sendOtpEmail(user.email, otp, user.full_name ?? null);
    } catch (sendError) {
        console.error('[PASSWORD_RESET] Failed to send OTP email:', sendError);
    }

    void purgeStaleOtps();
}

/** Best-effort cleanup so the table does not grow without bound. */
async function purgeStaleOtps(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
        .from('password_reset_otps')
        .delete()
        .lt('expires_at', cutoff);
    if (error) console.warn('[PASSWORD_RESET] Stale OTP purge failed:', error);
}

async function loadActiveOtp(email: string): Promise<OtpRow | null> {
    const { data } = await supabaseAdmin
        .from('password_reset_otps')
        .select('id, email, user_id, otp_hash, reset_token_hash, attempts, verified_at, consumed_at, expires_at')
        .eq('email', email)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return (data as OtpRow | null) ?? null;
}

// Flat result shapes (not discriminated unions): this project compiles with
// `strict: false`, where narrowing on a boolean discriminant does not apply.
export interface VerifyOtpResult {
    ok: boolean;
    resetToken?: string;
    error?: string;
    status?: number;
}

export async function verifyPasswordResetOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    const row = await loadActiveOtp(email);

    if (!row || row.verified_at || new Date(row.expires_at).getTime() < Date.now()) {
        return { ok: false, error: 'The OTP code is invalid or has expired', status: 400 };
    }

    // Atomic claim of one attempt: the `attempts` guard lives in the WHERE
    // clause, so concurrent requests cannot each read the same stale count and
    // collectively exceed MAX_OTP_ATTEMPTS.
    const { data: claimed } = await supabaseAdmin
        .from('password_reset_otps')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id)
        .eq('attempts', row.attempts)
        .lt('attempts', MAX_OTP_ATTEMPTS)
        .is('consumed_at', null)
        .select('attempts');

    if (!claimed || claimed.length === 0) {
        return { ok: false, error: 'Too many attempts. Please request a new OTP code.', status: 429 };
    }

    const attemptsUsed = (claimed[0] as { attempts: number }).attempts;
    const candidate = sha256(otp);
    const expected = row.otp_hash;
    const matches =
        candidate.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));

    if (!matches) {
        const left = MAX_OTP_ATTEMPTS - attemptsUsed;
        return {
            ok: false,
            error: left > 0
                ? `Incorrect OTP code. Attempts remaining: ${left}.`
                : 'Incorrect OTP code. Please request a new one.',
            status: 400,
        };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    const { error } = await supabaseAdmin
        .from('password_reset_otps')
        .update({
            verified_at: new Date().toISOString(),
            reset_token_hash: sha256(resetToken),
            expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
        })
        .eq('id', row.id);

    if (error) {
        console.error('[PASSWORD_RESET] Failed to store reset token:', error);
        return { ok: false, error: 'Something went wrong on the server', status: 500 };
    }

    return { ok: true, resetToken };
}

export interface ConsumeTokenResult {
    ok: boolean;
    userId?: string;
    error?: string;
    status?: number;
}

/**
 * Validates a reset token issued by {@link verifyPasswordResetOtp} and marks it
 * consumed, so a token can drive exactly one password change.
 */
export async function consumeResetToken(email: string, resetToken: string): Promise<ConsumeTokenResult> {
    const row = await loadActiveOtp(email);

    if (!row || !row.reset_token_hash || !row.verified_at || !row.user_id) {
        return { ok: false, error: 'Invalid password reset session. Please start over.', status: 400 };
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
        return { ok: false, error: 'Password reset session expired. Please start over.', status: 400 };
    }

    const candidate = sha256(resetToken);
    const matches =
        candidate.length === row.reset_token_hash.length &&
        crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(row.reset_token_hash));

    if (!matches) {
        return { ok: false, error: 'Invalid password reset session. Please start over.', status: 400 };
    }

    const { data: consumed, error } = await supabaseAdmin
        .from('password_reset_otps')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('consumed_at', null)
        .select('id');

    if (error) {
        console.error('[PASSWORD_RESET] Failed to consume reset token:', error);
        return { ok: false, error: 'Something went wrong on the server', status: 500 };
    }

    // Empty result means a concurrent request already consumed this token.
    if (!consumed || consumed.length === 0) {
        return { ok: false, error: 'Invalid password reset session. Please start over.', status: 400 };
    }

    return { ok: true, userId: row.user_id };
}

/** Mirrors the password policy enforced at registration. */
export function validatePasswordStrength(password: unknown): string | null {
    if (typeof password !== 'string' || !password) return 'New password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password.length > 128) return 'Password must be at most 128 characters';
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must contain an uppercase letter, a lowercase letter, and a number';
    }
    return null;
}

/** Revokes every active session of a user after their password changed. */
export async function revokeAllSessions(userId: string, exceptSid?: string | null): Promise<void> {
    let query = supabaseAdmin
        .from('security_sessions')
        .update({ is_revoked: true })
        .eq('user_id', userId)
        .eq('is_revoked', false);

    if (exceptSid) query = query.neq('session_id', exceptSid);

    const { error } = await query;
    if (error) console.warn('[PASSWORD_RESET] Failed to revoke sessions:', error);
}
