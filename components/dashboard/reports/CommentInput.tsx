'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Send,
    X,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentInputProps {
    reportId: string;
    onSuccess?: () => void;
    placeholder?: string;
}

export function CommentInput({
    reportId,
    onSuccess,
    placeholder = "Type a message...",
}: CommentInputProps) {
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!content.trim() || sending) return;

        setSending(true);
        setError(null);
        try {
            const res = await fetch(`/api/reports/${reportId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                })
            });

            if (res.ok) {
                setContent('');
                if (onSuccess) onSuccess();
                if (textareaRef.current) textareaRef.current.style.height = 'auto';
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to send message');
            }
        } catch (err) {
            console.error('Failed to send comment', err);
            setError('Connection error occurred');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const canSubmit = content.trim();

    return (
        <div className="space-y-3">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} className="shrink-0" />
                    <p className="flex-1 font-medium">{error}</p>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}
            {}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none transition-all resize-none font-sans"
                rows={3}
            />

            {}
            <div className="flex items-center justify-end">
                {}
                <button
                    onClick={() => handleSubmit()}
                    disabled={!canSubmit || sending}
                    className={cn(
                        "flex min-h-[44px] items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                        canSubmit && !sending
                            ? "bg-[var(--brand-primary)] text-white hover:shadow-lg active:scale-95"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    )}
                >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Send</span>
                </button>
            </div>
        </div>
    );
}
