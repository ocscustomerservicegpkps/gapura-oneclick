import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import {
    consumeVirtualAssistantQuota,
    getVirtualAssistantChatApiUrl,
    getVirtualAssistantRagProxySecret,
} from '@/lib/virtual-assistant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ChatRequestBody = {
    question?: unknown;
    language?: unknown;
    history?: unknown;
    sources?: unknown;
};

function secondsUntil(date: Date): number {
    return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

function buildQuotaHeaders(remaining: number, resetAt: Date): Headers {
    const headers = new Headers({
        'Cache-Control': 'no-store, max-age=0',
        'X-VA-Remaining': String(remaining),
        'X-VA-Reset-At': resetAt.toISOString(),
    });
    return headers;
}

async function getAuthenticatedUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;

    const session = await verifySession(token);
    return session?.id || null;
}

function normalizeChatBody(body: ChatRequestBody) {
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const language = typeof body.language === 'string' ? body.language : 'auto';
    const history = Array.isArray(body.history) ? body.history : [];
    const sources = Array.isArray(body.sources) ? body.sources : undefined;

    return {
        question,
        language,
        history,
        stream_mode: 'plain',
        ...(sources ? { sources } : {}),
    };
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json(
                { error: 'Virtual Assistant login is required.' },
                { status: 401 },
            );
        }

        const rawBody = (await request.json().catch(() => null)) as ChatRequestBody | null;
        if (!rawBody) {
            return NextResponse.json({ error: 'Invalid chat request.' }, { status: 400 });
        }

        const chatBody = normalizeChatBody(rawBody);
        if (!chatBody.question) {
            return NextResponse.json({ error: 'Question cannot be empty.' }, { status: 400 });
        }

        const quota = await consumeVirtualAssistantQuota(userId);
        const retryAfter = secondsUntil(quota.resetAt);
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error: 'Batas 5 pesan harian untuk Virtual Assistant sudah habis.',
                    remaining: quota.remaining,
                    retry_after_seconds: retryAfter,
                    reset_at: quota.resetAt.toISOString(),
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfter),
                        'Cache-Control': 'no-store, max-age=0',
                        'X-VA-Remaining': String(quota.remaining),
                        'X-VA-Reset-At': quota.resetAt.toISOString(),
                    },
                },
            );
        }

        const upstreamHeaders: HeadersInit = {
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json',
        };
        const proxySecret = getVirtualAssistantRagProxySecret();
        if (proxySecret) {
            upstreamHeaders['X-Gapura-Proxy-Secret'] = proxySecret;
        }

        const upstreamResponse = await fetch(getVirtualAssistantChatApiUrl(), {
            method: 'POST',
            headers: upstreamHeaders,
            body: JSON.stringify(chatBody),
            cache: 'no-store',
        });

        const responseHeaders = buildQuotaHeaders(quota.remaining, quota.resetAt);
        const upstreamContentType = upstreamResponse.headers.get('content-type') || '';
        const upstreamRetryAfter = upstreamResponse.headers.get('retry-after');
        if (upstreamRetryAfter) responseHeaders.set('Retry-After', upstreamRetryAfter);

        if (upstreamContentType.includes('text/event-stream') && upstreamResponse.body) {
            responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
            responseHeaders.set('Connection', 'keep-alive');
            responseHeaders.set('X-Accel-Buffering', 'no');
            return new Response(upstreamResponse.body, {
                status: upstreamResponse.status,
                headers: responseHeaders,
            });
        }

        const text = await upstreamResponse.text();
        responseHeaders.set(
            'Content-Type',
            upstreamContentType.includes('application/json')
                ? upstreamContentType
                : 'application/json; charset=utf-8',
        );

        return new Response(
            text || JSON.stringify({ error: 'Virtual Assistant backend returned no response.' }),
            {
                status: upstreamResponse.status,
                headers: responseHeaders,
            },
        );
    } catch (error) {
        console.error('[VA_CHAT] Proxy failed:', error);
        return NextResponse.json(
            { error: 'Virtual Assistant backend is unavailable.' },
            { status: 502 },
        );
    }
}
