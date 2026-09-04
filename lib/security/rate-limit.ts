
import { createHmac, timingSafeEqual } from 'crypto';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Sweeping expired entries is housekeeping, not work worth keeping the process
 * alive for — unref'd so importing this module never blocks a script or test
 * runner from exiting.
 */
function sweepEvery(ms: number, sweep: () => void) {
    const timer = setInterval(sweep, ms);
    timer.unref?.();
}

sweepEvery(60_000, () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetTime) rateLimitMap.delete(key);
    }
});

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetAt: number;
}

export function checkRateLimit(
    key: string,
    limit: number = 5,
    windowMs: number = 60_000,
): RateLimitResult {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return { success: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count += 1;

    if (entry.count > limit) {
        return { success: false, remaining: 0, resetAt: entry.resetTime };
    }

    return { success: true, remaining: limit - entry.count, resetAt: entry.resetTime };
}

const byteBudgetMap = new Map<string, { bytes: number; resetTime: number }>();

sweepEvery(60_000, () => {
    const now = Date.now();
    for (const [key, entry] of byteBudgetMap) {
        if (now > entry.resetTime) byteBudgetMap.delete(key);
    }
});

export interface ByteBudgetResult {
    success: boolean;
    remainingBytes: number;
    resetAt: number;
}

/**
 * Volume limit rather than a request-count limit. Counting requests alone is
 * the wrong control once a single request may carry tens of megabytes: five
 * uploads a minute is trivial for photos and a firehose for video. This caps
 * what one client can push through a window regardless of how it is split up.
 *
 * In-memory, so it is per-instance and resets on deploy — it is a throttle on
 * casual abuse, not an accounting system. Pair it with a count limit on the
 * durable store (`checkDbRateLimit`) for anything that must hold across
 * instances.
 */
export function checkByteBudget(
    key: string,
    bytes: number,
    budgetBytes: number,
    windowMs: number,
): ByteBudgetResult {
    const now = Date.now();
    const requested = Math.max(0, Math.floor(bytes));
    const entry = byteBudgetMap.get(key);

    if (!entry || now > entry.resetTime) {
        const resetTime = now + windowMs;
        // A single request larger than the whole budget is still refused, and
        // recording it keeps a retry loop from resetting the window each time.
        byteBudgetMap.set(key, { bytes: requested, resetTime });
        return {
            success: requested <= budgetBytes,
            remainingBytes: Math.max(0, budgetBytes - requested),
            resetAt: resetTime,
        };
    }

    entry.bytes += requested;
    return {
        success: entry.bytes <= budgetBytes,
        remainingBytes: Math.max(0, budgetBytes - entry.bytes),
        resetAt: entry.resetTime,
    };
}

const RATE_LIMIT_RPC_TIMEOUT_MS = 3_000;

export async function checkDbRateLimit(
    key: string,
    limit: number = 5,
    windowMs: number = 60_000,
): Promise<RateLimitResult> {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const normalizedWindowMs = Math.max(1_000, Math.floor(windowMs));
    const fallbackResetAt = Date.now() + normalizedWindowMs;

    // Fail closed on any RPC error or timeout: a hung/erroring DB call must
    // never block the request indefinitely or silently let it through.
    let data: unknown;
    let error: { message: string } | null;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
        const rpcPromise = supabaseAdmin
            .rpc('consume_rate_limit', {
                p_key: key.slice(0, 512),
                p_limit: normalizedLimit,
                p_reset_at: new Date(fallbackResetAt).toISOString(),
            })
            .single();
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
                () => reject(new Error('consume_rate_limit RPC timed out')),
                RATE_LIMIT_RPC_TIMEOUT_MS,
            );
        });
        ({ data, error } = await Promise.race([rpcPromise, timeoutPromise]));
    } catch (rpcError) {
        console.error(
            '[Rate Limit] Atomic RPC failed:',
            rpcError instanceof Error ? rpcError.message : String(rpcError),
        );
        return { success: false, remaining: 0, resetAt: fallbackResetAt };
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    if (error || !data) {
        console.error('[Rate Limit] Atomic RPC failed:', error?.message || 'empty response');
        return { success: false, remaining: 0, resetAt: fallbackResetAt };
    }

    const result = data as {
        allowed: boolean;
        remaining: number;
        reset_at: string;
    };
    const resetAt = new Date(result.reset_at).getTime();

    return {
        success: result.allowed === true,
        remaining: Math.max(0, Number(result.remaining) || 0),
        resetAt: Number.isFinite(resetAt) ? resetAt : fallbackResetAt,
    };
}

export function timingSafeStringEqual(provided: string | null | undefined, expected: string): boolean {
    const providedBuf = Buffer.from(provided ?? '');
    const expectedBuf = Buffer.from(expected);
    return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * The *first* X-Forwarded-For entry is whatever the client sent — a proxy
 * appends to the chain, it does not clear it. Reading it meant anyone could
 * rotate the key on every IP-based limit (login, the qa-verify brute-force
 * gate, uploads, the 5/hr public report cap) by varying one header.
 *
 * x-real-ip is written by the reverse proxy itself. Failing that, the *last*
 * XFF entry is the one the nearest proxy appended, which a client cannot forge
 * past. With no proxy at all neither header means anything, but then the
 * attacker is already talking straight to the origin.
 *
 * ponytail: no trusted-proxy CIDR list — add one if you ever run more than one
 * hop you don't control.
 */
export function getClientIpFromRequest(request: Request): string {
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    const chain = request.headers.get('x-forwarded-for')?.split(',') ?? [];
    return chain[chain.length - 1]?.trim() || 'unknown';
}

export function verifyUploadToken(token: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
    const secret = process.env.JWT_SECRET;
    if (!secret) return false;

    const sepIndex = token.lastIndexOf('.');
    if (sepIndex <= 0 || sepIndex === token.length - 1) return false;

    const timestamp = token.slice(0, sepIndex);
    const providedSig = token.slice(sepIndex + 1);

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > maxAgeMs) return false;

    const expectedSig = createHmac('sha256', secret).update(timestamp).digest('base64url');

    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
}

export function generateUploadToken(): string | null {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const timestamp = String(Date.now());
    const signature = createHmac('sha256', secret).update(timestamp).digest('base64url');
    return `${timestamp}.${signature}`;
}
