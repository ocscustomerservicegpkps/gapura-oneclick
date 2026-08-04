'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    BadgeCheck,
    Building2,
    CheckCircle2,
    Eye,
    EyeOff,
    IdCard,
    Loader2,
    Lock,
    Mail,
    Phone,
    ShieldCheck,
    User,
} from 'lucide-react';
import PasswordResetDialog from '@/components/auth/PasswordResetDialog';

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    nik: string | null;
    phone: string | null;
    role: string | null;
    division: string | null;
    status: string | null;
    unit_id: string | null;
    position_id: string | null;
    station: { id: string; code: string; name: string } | null;
}

const fieldClass =
    'w-full min-h-[44px] pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70';

export default function ProfileSettings() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [form, setForm] = useState({ full_name: '', phone: '', nik: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    const [resetOpen, setResetOpen] = useState(false);

    const loadProfile = useCallback(async () => {
        setLoadingProfile(true);
        setLoadError('');
        try {
            const res = await fetch('/api/auth/profile', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to load profile');
            const next = data as Profile;
            setProfile(next);
            setForm({
                full_name: next.full_name || '',
                phone: next.phone || '',
                nik: next.nik || '',
            });
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
        } finally {
            setLoadingProfile(false);
        }
    }, []);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const handleProfileSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setProfileError('');
        setProfileSuccess('');
        setSavingProfile(true);
        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to save changes');
            setProfile(data.profile as Profile);
            setProfileSuccess('Personal details updated successfully.');
        } catch (err) {
            setProfileError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('Password confirmation does not match');
            return;
        }

        setSavingPassword(true);
        try {
            const res = await fetch('/api/auth/profile/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to update the password');
            setPasswordSuccess(data.message || 'Password updated successfully.');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Failed to update the password');
        } finally {
            setSavingPassword(false);
        }
    };

    if (loadingProfile) {
        return (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-10 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile...
            </div>
        );
    }

    if (loadError || !profile) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
                <p className="text-sm font-medium text-red-600">{loadError || 'Profile is unavailable'}</p>
                <button
                    type="button"
                    onClick={() => void loadProfile()}
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                    Try again
                </button>
            </div>
        );
    }

    const initial = (profile.full_name || profile.email || '?').charAt(0).toUpperCase();

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-sm">
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-base font-bold text-gray-900">{profile.full_name || '—'}</p>
                        <p className="truncate text-sm text-gray-500">{profile.email}</p>
                    </div>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ReadOnlyBadge icon={BadgeCheck} label="Role" value={(profile.role || '—').replace(/_/g, ' ')} />
                    <ReadOnlyBadge icon={ShieldCheck} label="Status" value={profile.status || '—'} />
                    <ReadOnlyBadge icon={Building2} label="Division" value={profile.division || '—'} />
                    <ReadOnlyBadge
                        icon={Building2}
                        label="Station"
                        value={profile.station ? `${profile.station.code} — ${profile.station.name}` : '—'}
                    />
                </dl>
                <p className="mt-3 text-xs text-gray-500">
                    Role, status, division, station, and email are managed by an admin and cannot be changed here.
                </p>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Personal Details</h2>
                <p className="mt-1 text-sm text-gray-500">Update your name, phone number, and employee ID (NIK).</p>

                {profileError && <Alert tone="error">{profileError}</Alert>}
                {profileSuccess && <Alert tone="success">{profileSuccess}</Alert>}

                <form onSubmit={handleProfileSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field icon={User} label="Full Name">
                        <input
                            className={fieldClass}
                            required
                            maxLength={120}
                            value={form.full_name}
                            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                            placeholder="Full name"
                        />
                    </Field>

                    <Field icon={Mail} label="Email">
                        <input className={fieldClass} value={profile.email} disabled readOnly />
                    </Field>

                    <Field icon={Phone} label="Phone Number">
                        <input
                            className={fieldClass}
                            required
                            inputMode="tel"
                            value={form.phone}
                            onChange={(event) => setForm({ ...form, phone: event.target.value })}
                            placeholder="0812xxxxxxx"
                        />
                    </Field>

                    <Field icon={IdCard} label="Employee ID (NIK)">
                        <input
                            className={fieldClass}
                            required
                            value={form.nik}
                            onChange={(event) => setForm({ ...form, nik: event.target.value })}
                            placeholder="Employee ID"
                        />
                    </Field>

                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={savingProfile}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Change Password</h2>
                <p className="mt-1 text-sm text-gray-500">
                    At least 8 characters with an uppercase letter, a lowercase letter, and a number. Other devices will be signed out.
                </p>

                {passwordError && <Alert tone="error">{passwordError}</Alert>}
                {passwordSuccess && <Alert tone="success">{passwordSuccess}</Alert>}

                <form onSubmit={handlePasswordSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field icon={Lock} label="Current Password">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={`${fieldClass} pr-11`}
                            required
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </Field>

                    <div className="hidden sm:block" />

                    <Field icon={Lock} label="New Password">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={fieldClass}
                            required
                            autoComplete="new-password"
                            value={passwordForm.newPassword}
                            onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                        />
                    </Field>

                    <Field icon={Lock} label="Repeat New Password">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={fieldClass}
                            required
                            autoComplete="new-password"
                            value={passwordForm.confirmPassword}
                            onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                        />
                    </Field>

                    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                        <button
                            type="submit"
                            disabled={savingPassword}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                            Update Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setResetOpen(true)}
                            className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                            Forgot your current password? Reset via email OTP
                        </button>
                    </div>
                </form>
            </section>

            <PasswordResetDialog open={resetOpen} onClose={() => setResetOpen(false)} lockedEmail={profile.email} />
        </div>
    );
}

function Field({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof User;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-700 sm:text-sm">{label}</span>
            <div className="relative">
                <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {children}
            </div>
        </label>
    );
}

function ReadOnlyBadge({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </dt>
            <dd className="mt-1 truncate text-sm font-semibold text-gray-900">{value}</dd>
        </div>
    );
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
    const isError = tone === 'error';
    return (
        <div
            className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${
                isError ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'
            }`}
        >
            {isError ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <p className={`text-xs font-medium sm:text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`}>
                {children}
            </p>
        </div>
    );
}
