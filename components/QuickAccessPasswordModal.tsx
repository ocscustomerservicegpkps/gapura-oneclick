
'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface QuickAccessPasswordModalProps {

    isOpen: boolean;

    onClose: () => void;

    label: string;

    href: string;

    external?: boolean;
}

export function QuickAccessPasswordModal({
    isOpen,
    onClose,
    label,
    href,
    external = true,
}: QuickAccessPasswordModalProps) {
    const [value, setValue] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue('');
            setError(false);
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/auth/verify-quick-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: value }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.valid) {
                    onClose();
                    if (external) {
                        window.open(href, '_blank', 'noopener,noreferrer');
                    } else {
                        window.location.href = href;
                    }
                    return;
                }
            }
        } catch {

        } finally {
            setLoading(false);
        }
        setError(true);
        setShake(true);
        setValue('');
        setTimeout(() => setShake(false), 500);
    };

    if (typeof document === 'undefined') return null;
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity:1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity:1, scale:1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="qa-modal-title"
                    >
                        <motion.div
                            animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
                            transition={{ duration: 0.4 }}
                            className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            {}
                            <div className="flex items-start justify-between p-5 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                                        <Lock size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2
                                            id="qa-modal-title"
                                            className="text-sm font-bold text-gray-900 leading-tight"
                                        >
                                            Akses Dibatasi
                                        </h2>
                                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                                            {label}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors active:scale-95"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {}
                            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="qa-password-input"
                                        className="text-[11px] font-bold uppercase tracking-widest text-gray-400"
                                    >
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            ref={inputRef}
                                            id="qa-password-input"
                                            type={showPw ? 'text' : 'password'}
                                            value={value}
                                            onChange={(e) => {
                                                setValue(e.target.value);
                                                setError(false);
                                            }}
                                            placeholder="Masukkan password"
                                            className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm transition-colors outline-none focus:ring-2 ${
                                                error
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                                                    : 'border-gray-200 bg-gray-50 focus:ring-emerald-200 focus:border-emerald-400'
                                            }`}
                                            autoComplete="off"
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
                                    {error && (
                                        <p className="text-xs text-red-500 font-medium">
                                            Incorrect password. Please try again.
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={value.length === 0 || loading}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ExternalLink size={14} />
                                    {loading ? 'Memverifikasi...' : 'Buka Akses'}
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
