'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowLeft,
    Bot,
    ChevronRight,
    Clock3,
    Loader2,
    Send,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { AssistantMarkdown } from './AssistantMarkdown';

type ChatRole = 'user' | 'assistant';

type Evidence = {
    source: string;
    page: number;
    snippet: string;
    score: number;
};

type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    status?: 'streaming' | 'done' | 'error';
    evidence?: Evidence[];
};

type StreamEvent =
    | { type: 'token'; content?: string }
    | { type: 'done'; answer?: string; citations?: unknown[]; evidence?: Evidence[] }
    | { type: 'error'; content?: string }
    | { type: 'status'; content?: string };

type VirtualAssistantChatProps = {
    userEmail: string;
    dailyLimit: number;
};

const INITIAL_MESSAGE: ChatMessage = {
    id: 'assistant-initial',
    role: 'assistant',
    content: "Welcome. Ask anything about Gapura operations you'd like to check.",
    status: 'done',
};

function makeId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanSourceName(filename: string): string {
    return filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
}

// One-way, non-reversible hash — the storage key must not embed the plaintext
// email so a shared/inspected browser profile doesn't leak it.
function hashEmail(email: string): string {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = (Math.imul(31, hash) + email.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}
const STORAGE_KEY = (email: string) => `va_chat_v2_${hashEmail(email)}`;
const MAX_STORED_MESSAGES = 40;
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredChat = { messages: ChatMessage[]; expiresAt: number };

function parseSseChunk(buffer: string): { events: StreamEvent[]; rest: string } {
    const parts = buffer.split('\n\n');
    const rest = parts.pop() || '';
    const events: StreamEvent[] = [];

    for (const part of parts) {
        const data = part
            .split('\n')
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n')
            .trim();

        if (!data || data === '[DONE]') continue;

        try {
            events.push(JSON.parse(data) as StreamEvent);
        } catch {
            events.push({ type: 'token', content: data });
        }
    }

    return { events, rest };
}

function applyStreamEvent(
    current: ChatMessage[],
    assistantId: string,
    event: StreamEvent,
): ChatMessage[] {
    return current.map((message) => {
        if (message.id !== assistantId) return message;

        if (event.type === 'status') {
            return message;
        }

        if (event.type === 'token') {
            return {
                ...message,
                content: `${message.content}${event.content || ''}`,
                status: 'streaming',
            };
        }

        if (event.type === 'done') {
            const raw = event.answer || message.content;
            const clean = raw.replace(/\s*\[E\d+\]/g, '').trim();
            return {
                ...message,
                content: clean,
                status: 'done',
                evidence: event.evidence ?? [],
            };
        }

        return {
            ...message,
            content: event.content || 'Virtual Assistant gagal memberi respons.',
            status: 'error',
        };
    });
}

export function VirtualAssistantChat({
    userEmail,
    dailyLimit,
}: VirtualAssistantChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [remaining, setRemaining] = useState<number | null>(null);
    const [resetAt, setResetAt] = useState<string | null>(null);
    const [waitingSeconds, setWaitingSeconds] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    const isSendingRef = useRef(false);
    const skipNextPersistRef = useRef(true);
    const endRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        skipNextPersistRef.current = true;
        try {
            const raw = localStorage.getItem(STORAGE_KEY(userEmail));
            if (raw) {
                const stored = JSON.parse(raw) as StoredChat;
                if (stored.expiresAt && stored.expiresAt > Date.now()) {
                    const clean = stored.messages.filter((m) => m.status !== 'streaming');
                    setMessages(clean.length > 0 ? [INITIAL_MESSAGE, ...clean] : [INITIAL_MESSAGE]);
                } else {
                    localStorage.removeItem(STORAGE_KEY(userEmail));
                    setMessages([INITIAL_MESSAGE]);
                }
            } else {
                setMessages([INITIAL_MESSAGE]);
            }
        } catch {
            setMessages([INITIAL_MESSAGE]);
            // ignore parse/quota errors
        }
    }, [userEmail]);

    useEffect(() => {
        if (skipNextPersistRef.current) {
            skipNextPersistRef.current = false;
            return;
        }
        if (messages.some((m) => m.status === 'streaming')) return;
        const toStore = messages
            .filter((m) => m.id !== INITIAL_MESSAGE.id)
            .slice(-MAX_STORED_MESSAGES);
        try {
            if (toStore.length === 0) {
                localStorage.removeItem(STORAGE_KEY(userEmail));
            } else {
                const record: StoredChat = { messages: toStore, expiresAt: Date.now() + STORAGE_TTL_MS };
                localStorage.setItem(STORAGE_KEY(userEmail), JSON.stringify(record));
            }
        } catch {
            // ignore quota errors
        }
    }, [messages, userEmail]);

    useEffect(() => {
        if (!isSending) return;

        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isSending]);

    useEffect(() => {
        endRef.current?.scrollIntoView({
            behavior: isSending ? 'smooth' : 'auto',
            block: 'end',
        });
    }, [isSending, messages]);

    const remainingMessages = remaining ?? dailyLimit;
    const quotaText = useMemo(
        () => `${remainingMessages} dari ${dailyLimit} pesan tersisa`,
        [dailyLimit, remainingMessages],
    );

    const submitQuestion = async () => {
        const question = input.trim();
        if (!question || isSendingRef.current) return;
        isSendingRef.current = true;

        const userMessage: ChatMessage = {
            id: makeId('user'),
            role: 'user',
            content: question,
            status: 'done',
        };
        const assistantId = makeId('assistant');
        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            status: 'streaming',
        };

        const history = messages
            .filter((message) => message.id !== INITIAL_MESSAGE.id)
            .slice(-8)
            .map((message) => ({ role: message.role, content: message.content }));

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setMessages((current) => [...current, userMessage, assistantMessage]);
        setInput('');
        setWaitingSeconds(0);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setError('');
        setIsSending(true);

        try {
            const response = await fetch('/api/virtual-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, language: 'id', history }),
                signal: controller.signal,
            });

            const nextRemaining = response.headers.get('x-va-remaining');
            const nextResetAt = response.headers.get('x-va-reset-at');
            if (nextRemaining !== null) setRemaining(Number(nextRemaining));
            if (nextResetAt) setResetAt(nextResetAt);

            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error || 'Virtual Assistant belum bisa merespons.');
            }

            if (!response.body) {
                throw new Error('Virtual Assistant tidak mengirim stream respons.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parsed = parseSseChunk(buffer);
                buffer = parsed.rest;
                for (const event of parsed.events) {
                    setMessages((current) => applyStreamEvent(current, assistantId, event));
                }
            }

            setMessages((current) =>
                current.map((message) =>
                    message.id === assistantId && message.status === 'streaming'
                        ? { ...message, status: 'done' }
                        : message,
                ),
            );
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            const message = err instanceof Error ? err.message : 'Virtual Assistant gagal merespons.';
            setError(message);
            setMessages((current) =>
                current.map((item) =>
                    item.id === assistantId
                        ? { ...item, content: message, status: 'error' }
                        : item,
                ),
            );
        } finally {
            isSendingRef.current = false;
            setIsSending(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submitQuestion();
    };

    const resetLabel = resetAt
        ? new Date(resetAt).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        })
        : 'setiap hari, 00.00 WIB';

    const loadingEstimate = waitingSeconds <= 5
        ? 'Estimasi respons biasanya 2-5 detik.'
        : 'Sedang memproses dokumen. Respons dapat sedikit lebih lama.';

    return (
        <main className="flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#fbfcfd] text-slate-900">
            <header className="shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link
                            href="/auth/public-report"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            aria-label="Back"
                            title="Back"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <Bot className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-semibold text-slate-950 md:text-base">
                                I&apos;m in Charge
                            </h1>
                            <p className="truncate text-xs text-slate-500">{userEmail}</p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 sm:flex">
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                                <div>
                                    <div className="text-[10px] font-semibold uppercase text-emerald-700">
                                        Sisa chat
                                    </div>
                                    <div className="text-xs font-semibold text-emerald-900">
                                        {remainingMessages} dari {dailyLimit} pesan
                                    </div>
                                </div>
                            </div>
                            <div className="h-7 w-px bg-emerald-200" />
                            <div className="flex items-center gap-1.5">
                                <Clock3 className="h-4 w-4 text-emerald-700" />
                                <div>
                                    <div className="text-[10px] font-semibold uppercase text-emerald-700">
                                        Reset kuota
                                    </div>
                                    <div className="text-xs font-semibold text-emerald-900">
                                        {resetLabel}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 sm:hidden">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>{quotaText}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                abortRef.current?.abort();
                                setMessages([INITIAL_MESSAGE]);
                                setInput('');
                                setError('');
                                localStorage.removeItem(STORAGE_KEY(userEmail));
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            aria-label="Bersihkan chat"
                            title="Bersihkan chat"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            <section
                className="min-h-0 flex-1 overflow-y-auto"
                role="log"
                aria-live="polite"
                aria-label="Percakapan virtual assistant"
            >
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 md:px-6 md:py-10">
                    {messages.map((message) =>
                        message.role === 'assistant' ? (
                            <article key={message.id} className="mb-8 flex items-start gap-3 md:gap-4">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                                    <Bot className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1 pt-0.5">
                                    {message.content ? (
                                        message.status === 'error' ? (
                                            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
                                                {message.content}
                                            </div>
                                        ) : (
                                            <>
                                                <AssistantMarkdown content={message.content} />
                                                {message.status === 'done' && message.evidence && message.evidence.length > 0 && (() => {
                                                    const grouped = new Map<string, { source: string; page: number; snippets: string[] }>();
                                                    for (const e of message.evidence) {
                                                        const key = `${e.source}::${e.page}`;
                                                        if (!grouped.has(key)) grouped.set(key, { source: e.source, page: e.page, snippets: [] });
                                                        if (e.snippet) grouped.get(key)!.snippets.push(e.snippet);
                                                    }
                                                    return (
                                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Sumber</p>
                                                            <ul className="space-y-1.5">
                                                                {[...grouped.values()].map((item, i) => (
                                                                    <li key={i}>
                                                                        <details className="group">
                                                                            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-700">
                                                                                <span className="shrink-0 text-slate-300">·</span>
                                                                                <span className="font-medium text-slate-700">{cleanSourceName(item.source)}</span>
                                                                                <span className="text-slate-400">hal. {item.page}</span>
                                                                                {item.snippets.length > 0 && (
                                                                                    <ChevronRight className="ml-0.5 h-3 w-3 shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                                                                )}
                                                                            </summary>
                                                                            {item.snippets.length > 0 && (
                                                                                <div className="ml-4 mt-1.5 space-y-1.5 border-l border-slate-100 pl-3">
                                                                                    {item.snippets.map((s, si) => (
                                                                                        <p key={si} className="text-[11px] italic leading-relaxed text-slate-500">
                                                                                            &ldquo;{s}&rdquo;
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </details>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )
                                    ) : (
                                        <div className="space-y-1">
                                            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                                                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                                                Menyiapkan jawaban...
                                            </span>
                                            <p className="text-xs leading-5 text-slate-400">
                                                {loadingEstimate} Menunggu {waitingSeconds} detik.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ) : (
                            <article key={message.id} className="mb-8 flex justify-end">
                                <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-100 px-4 py-3 text-[15px] leading-7 text-slate-800 md:max-w-[75%]">
                                    {message.content}
                                </div>
                            </article>
                        ),
                    )}
                    <div ref={endRef} />
                </div>
            </section>

            <footer className="shrink-0 border-t border-slate-200/80 bg-white">
                <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 md:px-6">
                    {error ? (
                        <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    ) : null}

                    <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 pl-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition focus-within:border-emerald-500/60 focus-within:shadow-[0_8px_30px_rgba(5,150,105,0.09)]">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => {
                                setInput(event.target.value);
                                event.currentTarget.style.height = 'auto';
                                event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`;
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void submitQuestion();
                                }
                            }}
                            rows={1}
                            placeholder="Tanyakan hal operasional Gapura..."
                            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isSending}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                            aria-label="Kirim"
                            title="Kirim"
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        Kuota chat direset {resetLabel}
                    </div>
                </form>
            </footer>
        </main>
    );
}
