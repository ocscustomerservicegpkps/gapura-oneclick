'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Lock, Mail, ShieldCheck, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'reset' | 'done';

interface PasswordResetDialogProps {
    open: boolean;
    onClose: () => void;
    /** Pre-fills (and locks) the email field — used from the profile page. */
    lockedEmail?: string | null;
}

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const inputClass =
    'w-full min-h-[44px] pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white disabled:opacity-60';

export default function PasswordResetDialog({ open, onClose, lockedEmail }: PasswordResetDialogProps) {
    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState(lockedEmail || '');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    // Bumped on every open/reset so a late response from a previous dialog
    // instance can never write into the current one.
    const requestVersion = useRef(0);

    const requestClose = useCallback(() => {
        // Closing mid-flight would strand a request whose result the user needs.
        if (loading) return;
        onClose();
    }, [loading, onClose]);

    useEffect(() => setMounted(true), []);

    const reset = useCallback(() => {
        requestVersion.current += 1;
        setStep('email');
        setEmail(lockedEmail || '');
        setOtp('');
        setResetToken('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setError('');
        setInfo('');
        setLoading(false);
        setCooldown(0);
    }, [lockedEmail]);

    useEffect(() => {
        if (open) reset();
    }, [open, reset]);

    // Modal focus management: focus the first control on open, keep Tab inside
    // the dialog, and hand focus back to the trigger on close.
    useEffect(() => {
        if (!open) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;
        // Prefer the step's first field over the Close button, which merely
        // happens to come first in DOM order.
        const dialog = dialogRef.current;
        const firstField = dialog?.querySelector<HTMLElement>('input:not([readonly]), select, textarea');
        (firstField ?? dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)[0])?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                requestClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
            if (!items || items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused.current?.focus();
        };
    }, [open, requestClose, step]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const post = useCallback(async (url: string, payload: Record<string, unknown>) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
        return data;
    }, []);

    const requestOtp = useCallback(async (targetEmail: string) => {
        const version = requestVersion.current;
        setError('');
        setLoading(true);
        try {
            const data = await post('/api/auth/password-reset/request', { email: targetEmail });
            if (version !== requestVersion.current) return;
            setEmail(targetEmail);
            setStep('otp');
            setOtp('');
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setInfo(typeof data.message === 'string' ? data.message : 'An OTP code has been sent.');
        } catch (err) {
            if (version !== requestVersion.current) return;
            setError(err instanceof Error ? err.message : 'Request failed');
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [post]);

    const handleEmailSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        void requestOtp(email.trim().toLowerCase());
    };

    const handleOtpSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const version = requestVersion.current;
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const data = await post('/api/auth/password-reset/verify', { email, otp });
            if (version !== requestVersion.current) return;
            setResetToken(String(data.resetToken || ''));
            setStep('reset');
        } catch (err) {
            if (version !== requestVersion.current) return;
            setError(err instanceof Error ? err.message : 'Verification failed');
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    };

    const handleResetSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Password confirmation does not match');
            return;
        }
        const version = requestVersion.current;
        setLoading(true);
        try {
            const data = await post('/api/auth/password-reset/confirm', { email, resetToken, password });
            if (version !== requestVersion.current) return;
            setInfo(typeof data.message === 'string' ? data.message : 'Password updated successfully.');
            setStep('done');
        } catch (err) {
            if (version !== requestVersion.current) return;
            setError(err instanceof Error ? err.message : 'Password reset failed');
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    };

    if (!mounted || !open) return null;

    const title =
        step === 'email' ? 'Forgot Password'
        : step === 'otp' ? 'Verify OTP Code'
        : step === 'reset' ? 'Create New Password'
        : 'Password Updated';

    const subtitle =
        step === 'email' ? 'Enter your account email. We will send a 6-digit OTP code to it.'
        : step === 'otp' ? `Enter the 6-digit OTP code sent to ${email}.`
        : step === 'reset' ? 'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.'
        : 'Please sign in again using your new password.';

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) requestClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-reset-title"
                className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="password-reset-title" className="text-lg font-bold text-gray-900">{title}</h2>
                        <p id="password-reset-subtitle" className="mt-1 text-sm text-gray-500">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={requestClose}
                        disabled={loading}
                        aria-label="Close"
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        <p className="text-xs font-medium text-red-600 sm:text-sm">{error}</p>
                    </div>
                )}

                {info && step !== 'done' && !error && (
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-xs font-medium text-emerald-700 sm:text-sm">{info}</p>
                    </div>
                )}

                {step === 'email' && (
                    <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                readOnly={!!lockedEmail}
                                aria-label="Email address"
                                className={inputClass}
                                placeholder="email@company.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </div>
                        <SubmitButton loading={loading} label="Send OTP Code" />
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={handleOtpSubmit} className="mt-5 space-y-4">
                        <div className="relative">
                            <ShieldCheck className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                required
                                maxLength={OTP_LENGTH}
                                aria-label="6-digit OTP code"
                                className={`${inputClass} text-center tracking-[0.6em] font-semibold`}
                                placeholder="000000"
                                value={otp}
                                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                            />
                        </div>
                        <SubmitButton loading={loading} label="Verify" disabled={otp.length !== OTP_LENGTH} />
                        <button
                            type="button"
                            disabled={loading || cooldown > 0}
                            onClick={() => void requestOtp(email)}
                            className="w-full text-center text-xs font-semibold text-emerald-700 transition hover:text-emerald-800 disabled:text-gray-400"
                        >
                            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend OTP code'}
                        </button>
                    </form>
                )}

                {step === 'reset' && (
                    <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                aria-label="New password"
                                aria-describedby="password-reset-subtitle"
                                className={`${inputClass} pr-11`}
                                placeholder="New password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                aria-label="Repeat new password"
                                aria-describedby="password-reset-subtitle"
                                className={inputClass}
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                            />
                        </div>
                        <SubmitButton loading={loading} label="Save New Password" />
                    </form>
                )}

                {step === 'done' && (
                    <div className="mt-5 space-y-4">
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">{info}</p>
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

function SubmitButton({ loading, label, disabled }: { loading: boolean; label: string; disabled?: boolean }) {
    return (
        <button
            type="submit"
            disabled={loading || disabled}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
            style={{
                background: loading || disabled ? '#9ca3af' : 'linear-gradient(135deg, #059669, #10b981)',
                boxShadow: loading || disabled ? 'none' : '0 4px 14px -2px rgba(16, 185, 129, 0.4)',
            }}
        >
            {loading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                label
            )}
        </button>
    );
}
