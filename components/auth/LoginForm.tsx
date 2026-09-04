'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import PasswordResetDialog from '@/components/auth/PasswordResetDialog';

// Division roles funnel through the escalation select screen (green Customer
// Service card is shown there only for OS/OCS divisions). HC keeps its own page.
const ESKALASI_SELECT = '/dashboard/eskalasi/select';
const roleRedirects: Record<string, string> = {
    SUPER_ADMIN: '/dashboard/admin',
    DIVISI_ESKALASI: ESKALASI_SELECT,
    DIVISI_OCS: ESKALASI_SELECT,
    DIVISI_OS: ESKALASI_SELECT,
    DIVISI_OP: ESKALASI_SELECT,
    DIVISI_OT: ESKALASI_SELECT,
    DIVISI_UQ: ESKALASI_SELECT,
    DIVISI_HT: ESKALASI_SELECT,
    DIVISI_HC: '/dashboard/hc',
    ANALYST: '/dashboard/analyst',
    MANAGER_CABANG: '/dashboard/manager',
    STAFF_CABANG: '/dashboard/employee',
    CABANG: '/dashboard/employee',
    PARTNER_OCS: ESKALASI_SELECT,
    PARTNER_OS: ESKALASI_SELECT,
    PARTNER_OP: ESKALASI_SELECT,
    PARTNER_OT: ESKALASI_SELECT,
    PARTNER_UQ: ESKALASI_SELECT,
    PARTNER_HT: ESKALASI_SELECT,
    PARTNER_HC: '/dashboard/hc',
};

export default function LoginForm() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            let data: { error?: string; role?: string; division?: string | null } | null = null;
            const ct = res.headers.get('content-type') || '';

            if (ct.includes('application/json')) {
                const parsed = await res.json() as unknown;
                if (parsed && typeof parsed === 'object') {
                    data = parsed as { error?: string; role?: string; division?: string | null };
                }
            } else {
                const text = await res.text();
                data = { error: text?.slice(0, 200) || 'Unknown error' };
            }

            if (!res.ok) {
                throw new Error(data?.error || 'Login failed');
            }

            // Resolve against this origin and compare, rather than checking the
            // string's prefix. The URL parser treats a backslash as a slash for
            // http(s), so `/\evil.com` passes `startsWith('/')`, fails
            // `startsWith('//')`, and still resolves to https://evil.com — an
            // open redirect landing on the page right after a successful login.
            const requestedNext = new URLSearchParams(window.location.search).get('next');
            if (requestedNext) {
                try {
                    const target = new URL(requestedNext, window.location.origin);
                    if (target.origin === window.location.origin) {
                        window.location.assign(`${target.pathname}${target.search}${target.hash}`);
                        return;
                    }
                } catch {
                    // Unparseable `next` — fall through to the role-based redirect.
                }
            }

            const normalizedRole = data?.role ? String(data.role).trim().toUpperCase() : '';
            const dest = roleRedirects[normalizedRole] || '/dashboard/employee';
            router.push(dest);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
            {error && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-50 border border-red-100 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <p className="text-xs sm:text-sm font-medium text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            className="w-full min-h-[44px] pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white"
                            placeholder="email@company.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            className="w-full min-h-[44px] pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? <EyeOff size={16} className="sm:hidden" /> : <Eye size={16} className="sm:hidden" />}
                            {showPassword ? <EyeOff size={18} className="hidden sm:block" /> : <Eye size={18} className="hidden sm:block" />}
                        </button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-xs sm:text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
                    >
                        Forgot password?
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{
                        background: loading ? '#9ca3af' : 'linear-gradient(135deg, #059669, #10b981)',
                        boxShadow: loading ? 'none' : '0 4px 14px -2px rgba(16, 185, 129, 0.4)',
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            Sign In
                            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-3 sm:mt-4">
                <Link
                    href="/auth/public-report"
                    className="block w-full text-center py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-emerald-700 text-sm border border-emerald-100 bg-emerald-50/70 transition hover:bg-emerald-50"
                >
                    Quick Access Irregularity
                </Link>
            </div>

            <div className="mt-6 text-center">
                <p className="text-xs sm:text-sm text-gray-500">
                    Don&apos;t have an account?{' '}
                    <Link href="/auth/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
                        Register here
                    </Link>
                </p>
            </div>

            <PasswordResetDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
        </div>
    );
}
