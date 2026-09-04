'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, X, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface VirtualAssistantLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Tile label shown as the dialog subtitle. */
    label?: string;
    /** Where to go once the session cookie is set. */
    next?: string;
}

/**
 * Login gate for the "I'm in Charge" bento tile. The assistant needs a real
 * account session, but sending a guest to /auth/login throws away the public
 * page they were on — so the credentials are collected here and the browser
 * only moves once the session cookie exists.
 */
export function VirtualAssistantLoginModal({
    isOpen,
    onClose,
    label = "I'm in Charge",
    next = '/virtual-assistant',
}: VirtualAssistantLoginModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const [loading, setLoading] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setEmail('');
        setPassword('');
        setError('');
        setLoading(false);
        const timer = window.setTimeout(() => emailRef.current?.focus(), 120);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const failWith = (message: string) => {
        setError(message);
        setShake(true);
        setPassword('');
        window.setTimeout(() => setShake(false), 500);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = (await res.json().catch(() => null)) as { error?: string } | null;

            if (!res.ok) {
                failWith(data?.error || 'Login gagal. Periksa email dan password.');
                return;
            }

            // Full navigation, not router.push: the assistant page reads the
            // session cookie on the server, so it must be a fresh request.
            window.location.assign(next);
        } catch {
            failWith('Tidak dapat terhubung ke server. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="va-login-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    <motion.div
                        key="va-login-modal"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="va-login-title"
                    >
                        <motion.div
                            animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
                            transition={{ duration: 0.4 }}
                            className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            <div className="flex items-start justify-between p-5 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                                        <Bot size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 id="va-login-title" className="text-sm font-bold text-gray-900 leading-tight">
                                            Login Virtual Assistant
                                        </h2>
                                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{label}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors active:scale-95"
                                    aria-label="Tutup"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="va-login-email"
                                        className="text-[11px] font-bold uppercase tracking-widest text-gray-400"
                                    >
                                        Email
                                    </label>
                                    <input
                                        ref={emailRef}
                                        id="va-login-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="email@gapura.co.id"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none focus:ring-2 ${
                                            error
                                                ? 'border-red-300 bg-red-50 focus:ring-red-200'
                                                : 'border-gray-200 bg-gray-50 focus:ring-emerald-200 focus:border-emerald-400'
                                        }`}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="va-login-password"
                                        className="text-[11px] font-bold uppercase tracking-widest text-gray-400"
                                    >
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="va-login-password"
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setError('');
                                            }}
                                            placeholder="••••••••"
                                            className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm transition-colors outline-none focus:ring-2 ${
                                                error
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                                                    : 'border-gray-200 bg-gray-50 focus:ring-emerald-200 focus:border-emerald-400'
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw((p) => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                                            aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                                        >
                                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={loading || email.trim().length === 0 || password.length === 0}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                                    {loading ? 'Memverifikasi...' : 'Masuk & Buka Assistant'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
