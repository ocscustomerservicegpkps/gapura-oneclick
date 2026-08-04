import 'server-only';

import { createHash, timingSafeEqual } from 'crypto';
import { jwtVerify } from 'jose';
import { DEFAULT_EXTERNAL_LINKS } from '@/lib/external-links';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TOKEN_AUDIENCE = 'gapura-virtual-assistant';
const TOKEN_TYPE = 'va_access';
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

type VirtualAssistantClaims = {
    userId: string;
    sessionId: string;
};

type VirtualAssistantQuota = {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    currentCount: number;
};

function getRequiredEnv(key: string): string {
    const value = process.env[key]?.trim();
    if (!value) {
        throw new Error(`${key} is not configured`);
    }
    return value;
}

function getAccessTokenSecret(): Uint8Array {
    return new TextEncoder().encode(getRequiredEnv('VA_ACCESS_TOKEN_SECRET'));
}

function getVirtualAssistantChatbotUrl(): string {
    return (
        process.env.VA_CHATBOT_URL?.trim() ||
        DEFAULT_EXTERNAL_LINKS['ai-virtual-assistant'].url
    );
}

export function getVirtualAssistantChatApiUrl(): string {
    const explicitApiUrl = process.env.VA_CHATBOT_API_URL?.trim();
    if (explicitApiUrl) return explicitApiUrl;

    return new URL('/api/chat', getVirtualAssistantChatbotUrl()).toString();
}

export function getVirtualAssistantRagProxySecret(): string {
    return (
        process.env.VA_RAG_PROXY_SECRET?.trim() ||
        process.env.VA_INTERNAL_API_SECRET?.trim() ||
        ''
    );
}

export function getVirtualAssistantDailyLimit(): number {
    const raw = process.env.VA_DAILY_MESSAGE_LIMIT?.trim();
    if (!raw) return 5;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
}

export async function verifyVirtualAssistantToken(
    token: string,
): Promise<VirtualAssistantClaims | null> {
    try {
        const { payload } = await jwtVerify(token, getAccessTokenSecret(), {
            algorithms: ['HS256'],
            audience: TOKEN_AUDIENCE,
        });

        if (
            payload.type !== TOKEN_TYPE ||
            typeof payload.sub !== 'string' ||
            typeof payload.sid !== 'string'
        ) {
            return null;
        }

        return {
            userId: payload.sub,
            sessionId: payload.sid,
        };
    } catch {
        return null;
    }
}

export function hasValidVirtualAssistantInternalSecret(
    authorizationHeader: string | null,
): boolean {
    const expected = process.env.VA_INTERNAL_API_SECRET?.trim();
    const provided = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!expected || !provided) return false;

    const expectedHash = createHash('sha256').update(expected).digest();
    const providedHash = createHash('sha256').update(provided).digest();
    return timingSafeEqual(expectedHash, providedHash);
}

export async function isVirtualAssistantSessionActive(
    claims: VirtualAssistantClaims,
): Promise<boolean> {
    const { data: sessionRow, error: sessionError } = await supabaseAdmin
        .from('security_sessions')
        .select('is_revoked, expires_at')
        .eq('session_id', claims.sessionId)
        .eq('user_id', claims.userId)
        .single();

    if (sessionError || !sessionRow || sessionRow.is_revoked) return false;
    if (sessionRow.expires_at && new Date(sessionRow.expires_at).getTime() <= Date.now()) {
        return false;
    }

    const { data: userRow, error: userError } = await supabaseAdmin
        .from('users')
        .select('status')
        .eq('id', claims.userId)
        .single();

    return !userError && userRow?.status === 'active';
}

function getJakartaDateKey(now: Date): string {
    return new Date(now.getTime() + JAKARTA_OFFSET_MS)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
}

function getNextJakartaMidnight(now: Date): Date {
    const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const nextMidnightAsUtc = Date.UTC(
        jakartaNow.getUTCFullYear(),
        jakartaNow.getUTCMonth(),
        jakartaNow.getUTCDate() + 1,
    );
    return new Date(nextMidnightAsUtc - JAKARTA_OFFSET_MS);
}

export async function consumeVirtualAssistantQuota(
    userId: string,
    now: Date = new Date(),
): Promise<VirtualAssistantQuota> {
    const limit = getVirtualAssistantDailyLimit();
    const resetAt = getNextJakartaMidnight(now);
    const key = `va-chat:${userId}:${getJakartaDateKey(now)}`;

    const { data, error } = await supabaseAdmin.rpc('consume_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_reset_at: resetAt.toISOString(),
    });

    if (error) {
        throw new Error(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        throw new Error('Rate limit consume returned no data');
    }

    return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining ?? 0),
        resetAt: new Date(row.reset_at),
        currentCount: Number(row.current_count ?? 0),
    };
}
