import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import {
    consumeVirtualAssistantQuota,
    getVirtualAssistantChatApiUrl,
    getVirtualAssistantRagProxySecret,
    peekVirtualAssistantQuota,
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

// The RAG backend reports a failed generation as an SSE event inside an
// otherwise healthy 200 stream (an upstream LLM 429, for instance). Those must
// not cost the user a message either, so the stream is watched on its way
// through and the quota is only charged once it ends without one.
const SSE_ERROR_EVENT = /"type"\s*:\s*"error"/;

function chargeOnSuccessfulStream(
    upstreamBody: ReadableStream<Uint8Array>,
    onAnswered: () => void,
): ReadableStream<Uint8Array> {
    const decoder = new TextDecoder();
    let failed = false;

    return upstreamBody.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                if (!failed && SSE_ERROR_EVENT.test(decoder.decode(chunk, { stream: true }))) {
                    failed = true;
                }
                controller.enqueue(chunk);
            },
            flush() {
                if (!failed) onAnswered();
            },
        }),
    );
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json(
                { error: 'Sesi login Anda sudah berakhir. Silakan login ulang.' },
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

        // Read-only check up front; the slot is charged further down, once the
        // backend has actually produced an answer.
        const quota = await peekVirtualAssistantQuota(userId);
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

        // Optimistic figure for the client: the slot this request is about to
        // charge, assuming the answer arrives.
        const responseHeaders = buildQuotaHeaders(Math.max(quota.remaining - 1, 0), quota.resetAt);
        const upstreamContentType = upstreamResponse.headers.get('content-type') || '';
        const upstreamRetryAfter = upstreamResponse.headers.get('retry-after');
        if (upstreamRetryAfter) responseHeaders.set('Retry-After', upstreamRetryAfter);

        if (upstreamResponse.ok && upstreamContentType.includes('text/event-stream') && upstreamResponse.body) {
            responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
            responseHeaders.set('Connection', 'keep-alive');
            responseHeaders.set('X-Accel-Buffering', 'no');

            const body = chargeOnSuccessfulStream(upstreamResponse.body, () => {
                void consumeVirtualAssistantQuota(userId).catch((error) => {
                    console.error('[VA_CHAT] Quota consume failed after a delivered answer:', error);
                });
            });

            return new Response(body, {
                status: upstreamResponse.status,
                headers: responseHeaders,
            });
        }

        const text = await upstreamResponse.text();
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        // Nothing was delivered, so nothing is charged.
        responseHeaders.set('X-VA-Remaining', String(quota.remaining));

        // The RAG backend has its own account gate. When it rejects the
        // proxied call it answers with *its* copy of the login/quota error,
        // which read as if the user were signed out — they are not: this
        // request already passed our session check above. Say what actually
        // failed instead of forwarding a message that blames the user.
        if (upstreamResponse.status === 401 || upstreamResponse.status === 403 ||
            (upstreamResponse.status >= 300 && upstreamResponse.status < 400)) {
            console.error(
                `[VA_CHAT] Backend rejected the proxied request (${upstreamResponse.status}): ${text.slice(0, 300)}`,
            );
            return new Response(
                JSON.stringify({
                    error: 'Virtual Assistant backend menolak koneksi dari aplikasi ini. Hubungi admin — VA_RAG_PROXY_SECRET belum cocok dengan TRUSTED_PROXY_SECRET di layanan RAG.',
                }),
                { status: 502, headers: responseHeaders },
            );
        }

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
