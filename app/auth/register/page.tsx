
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Mail, Lock, UserPlus, Loader2, CheckCircle, Phone, Building2, Users, Briefcase, CreditCard, Info, Shield, Eye, EyeOff, Layers } from 'lucide-react';
import { GAPURA_STATIONS, HEAD_OFFICE_CODE } from '@/data/stations';

interface Station { id: string; code: string; name: string; }

// Head office (KPS) divisions. UQ & OT have no position selection.
const KPS_DIVISIONS = ['OP', 'OS', 'UQ', 'OT', 'OCS'] as const;
const DIVISIONS_WITHOUT_JABATAN = ['UQ', 'OT'];
const KPS_JABATAN_OPTIONS = ['Staff', 'Analyst', 'Division Head', 'Group Head', 'VP'];
// Branch positions are a fixed pair: Manager grants MANAGER_CABANG, Staff grants
// STAFF_CABANG. Role no longer depends on the email domain.
const BRANCH_JABATAN_OPTIONS = ['Manager', 'Staff'];

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        nik: '',
        phone: '',
        station_id: '',
        unit_kerja: '',
        jabatan: '',
        division: '',
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [stations, setStations] = useState<Station[]>([]);

    const isKPS = useMemo(() => {
        const station = stations.find(s => s.id === formData.station_id);
        return station?.code === HEAD_OFFICE_CODE;
    }, [formData.station_id, stations]);

    const needsJabatanSelect = isKPS && !!formData.division && !DIVISIONS_WITHOUT_JABATAN.includes(formData.division);

    useEffect(() => {
        const fetchStations = async () => {
            let data: Station[] = [];
            try {
                const res = await fetch('/api/master-data?type=stations');
                if (res.ok) {
                    const json = await res.json().catch(() => []);
                    if (Array.isArray(json)) data = json;
                }
            } catch {
                // fall through to canonical fallback
            }
            setStations(data.length ? data : GAPURA_STATIONS.map(s => ({ id: s.code, code: s.code, name: s.name })));
        };
        fetchStations();
    }, []);

    const filteredStations = useMemo(() => {
        const kps = stations.find(s => s.code === HEAD_OFFICE_CODE);
        const others = stations
            .filter(s => s.code !== HEAD_OFFICE_CODE)
            .sort((a, b) => a.code.localeCompare(b.code));
        return kps ? [kps, ...others] : others;
    }, [stations]);

    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'nik':
                if (!/^[A-Z0-9]{5,10}$/i.test(value) && value.length > 0) {
                    return 'NIK must be 5-10 characters (letters/numbers)';
                }
                break;
            case 'phone':
                if (!/^08\d{8,11}$/.test(value) && value.length > 0) {
                    return 'Format: 08xxxxxxxxxx (10-13 digits)';
                }
                break;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length > 0) {
                    return 'Invalid email format';
                }
                break;
            case 'password':
                // Must mirror the server rules in /api/auth/register (8+ chars, mixed case + digit).
                if (value.length > 0 && (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value))) {
                    return 'Min. 8 characters, combination of uppercase, lowercase & numbers';
                }
                break;
            case 'confirmPassword':
                if (value !== formData.password && value.length > 0) {
                    return 'Passwords do not match';
                }
                break;
        }
        return '';
    };

    const handleChange = (name: string, value: string) => {

        if (name === 'nik') value = value.toUpperCase();

        setFormData(prev => ({ ...prev, [name]: value }));

        const error = validateField(name, value);
        setFieldErrors(prev => ({ ...prev, [name]: error }));

        if (name === 'station_id') {
            setFormData(prev => ({ ...prev, station_id: value, unit_kerja: '', jabatan: '', division: '' }));
        }

        if (name === 'division' && DIVISIONS_WITHOUT_JABATAN.includes(value)) {
            setFormData(prev => ({ ...prev, division: value, jabatan: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const errors: Record<string, string> = {};
        Object.entries(formData).forEach(([key, value]) => {
            if (key !== 'confirmPassword' && key !== 'division' && key !== 'jabatan' && key !== 'unit_kerja') {
                const err = validateField(key, value);
                if (err) errors[key] = err;
            }
        });

        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setError('Please review the information you entered');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                nik: formData.nik,
                phone: formData.phone,
                station_id: formData.station_id,
                division: isKPS ? formData.division : undefined,
                jabatan: isKPS
                    ? (needsJabatanSelect ? formData.jabatan : undefined)
                    : formData.jabatan,
                unit_kerja: isKPS ? undefined : formData.unit_kerja,
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            setSuccess('Registration successful! Please wait for admin approval before logging in.');
            setTimeout(() => {
                router.push('/auth/login');
            }, 3000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = "w-full min-h-[44px] pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white";
    const inputErrorStyle = "w-full min-h-[44px] pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl border border-red-300 bg-red-50 text-gray-900 placeholder:text-gray-400 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 focus:bg-white";
    const selectStyle = "w-full min-h-[44px] pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[15px] sm:text-sm transition-all focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white appearance-none cursor-pointer";
    const labelStyle = "block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2";

    return (
        <div className="min-h-[100dvh] flex flex-col lg:flex-row relative overflow-hidden bg-slate-50">
            <div 
                className="hidden lg:flex lg:w-5/12 flex-col justify-between p-8 xl:p-12 relative"
                style={{ background: 'linear-gradient(145deg, #059669, #10b981, #34d399)' }}
            >
                <div className="absolute inset-0 opacity-10">
                    <div 
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `radial-gradient(circle at 25% 25%, white 2px, transparent 2px)`,
                            backgroundSize: '50px 50px'
                        }}
                    />
                </div>

                <div className="relative z-10">
                    <Image
                        src="/logo.png"
                        alt="Gapura"
                        width={180}
                        height={70}
                        className="object-contain brightness-0 invert"
                        style={{ width: 'auto', height: 'auto' }}
                        priority
                    />
                </div>

                <div className="relative z-10 space-y-4 xl:space-y-6">
                    <h1 className="text-2xl xl:text-4xl font-bold text-white leading-tight">
                        Join the<br />Best Operations<br />Team
                    </h1>
                    <p className="text-white/80 text-base xl:text-lg max-w-md">
                        Register to access the integrated irregularity reporting system.
                    </p>

                    <div className="flex items-center gap-4 pt-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full">
                            <Shield size={16} className="text-white" />
                            <span className="text-sm font-medium text-white">Admin Verified</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-white/60 text-xs xl:text-sm">
                    © 2025 PT Gapura Angkasa. All rights reserved.
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                <div className="w-full max-w-xl py-4 sm:py-8">
                    <div className="lg:hidden text-center mb-4 sm:mb-6">
                        <Image
                            src="/logo.png"
                            alt="Gapura"
                            width={140}
                            height={50}
                            className="mx-auto object-contain w-[100px] sm:w-[140px] h-auto"
                            style={{ height: 'auto' }}
                            priority
                        />
                    </div>

                    <div className="mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Account Registration</h1>
                        <p className="text-gray-500 mt-1 text-xs sm:text-sm">Complete your details to join Gapura Integrated Service Analytics</p>
                    </div>

                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 sm:p-6">
                        {error && (
                            <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-50 border border-red-100 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                <p className="text-xs sm:text-sm font-medium text-red-600">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 flex-shrink-0" />
                                <p className="text-xs sm:text-sm font-medium text-emerald-700">{success}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                            <div className="pb-3 sm:pb-4 border-b border-gray-100">
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 sm:mb-4">Personal Information</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className={labelStyle}>Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                required
                                                className={inputStyle}
                                                placeholder="Full name"
                                                value={formData.full_name}
                                                onChange={(e) => handleChange('full_name', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelStyle}>NIK (Employee ID Number)</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                required
                                                maxLength={10}
                                                className={fieldErrors.nik ? inputErrorStyle : inputStyle}
                                                placeholder="e.g. GA12345"
                                                value={formData.nik}
                                                onChange={(e) => handleChange('nik', e.target.value)}
                                            />
                                        </div>
                                        {fieldErrors.nik && <p className="text-[10px] sm:text-xs text-red-500 mt-1">{fieldErrors.nik}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="pb-3 sm:pb-4 border-b border-gray-100">
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 sm:mb-4">Contact</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className={labelStyle}>Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type="email"
                                                required
                                                className={fieldErrors.email ? inputErrorStyle : inputStyle}
                                                placeholder="email@company.com"
                                                value={formData.email}
                                                onChange={(e) => handleChange('email', e.target.value)}
                                            />
                                        </div>
                                        {fieldErrors.email && <p className="text-[10px] sm:text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                                    </div>
                                    <div>
                                        <label className={labelStyle}>WhatsApp Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type="tel"
                                                required
                                                maxLength={13}
                                                className={fieldErrors.phone ? inputErrorStyle : inputStyle}
                                                placeholder="08xxxxxxxxxx"
                                                value={formData.phone}
                                                onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                                            />
                                        </div>
                                        {fieldErrors.phone && <p className="text-[10px] sm:text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="pb-3 sm:pb-4 border-b border-gray-100">
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 sm:mb-4">Organization</p>
                                <div className="space-y-3 sm:space-y-4">
                                    <div>
                                        <label className={labelStyle}>Station</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <select
                                                required
                                                className={selectStyle}
                                                value={formData.station_id}
                                                onChange={(e) => handleChange('station_id', e.target.value)}
                                            >
                                                <option value="">Select Station</option>
                                                {filteredStations.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {isKPS && (
                                            <p className="text-[10px] sm:text-xs text-blue-600 mt-1 flex items-center gap-1">
                                                <Info size={12} />
                                                Head Office - Select division below
                                            </p>
                                        )}
                                    </div>

                                    {isKPS && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className={needsJabatanSelect ? '' : 'md:col-span-2'}>
                                                <label className={labelStyle}>Division</label>
                                                <div className="relative">
                                                    <Layers className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                    <select
                                                        required
                                                        className={selectStyle}
                                                        value={formData.division}
                                                        onChange={(e) => handleChange('division', e.target.value)}
                                                    >
                                                        <option value="">Select Division</option>
                                                        {KPS_DIVISIONS.map((d) => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            {needsJabatanSelect && (
                                                <div>
                                                    <label className={labelStyle}>Position</label>
                                                    <div className="relative">
                                                        <Briefcase className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                        <select
                                                            required
                                                            className={selectStyle}
                                                            value={formData.jabatan}
                                                            onChange={(e) => handleChange('jabatan', e.target.value)}
                                                        >
                                                            <option value="">Select Position</option>
                                                            {KPS_JABATAN_OPTIONS.map((j) => (
                                                                <option key={j} value={j}>{j}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!isKPS && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                            <div>
                                                <label className={labelStyle}>Work Unit</label>
                                                <div className="relative">
                                                    <Users className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={80}
                                                        className={inputStyle}
                                                        placeholder="e.g. Ramp, Passenger Service"
                                                        value={formData.unit_kerja}
                                                        onChange={(e) => handleChange('unit_kerja', e.target.value)}
                                                        disabled={!formData.station_id}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Position</label>
                                                <div className="relative">
                                                    <Briefcase className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                    <select
                                                        required
                                                        className={selectStyle}
                                                        value={formData.jabatan}
                                                        onChange={(e) => handleChange('jabatan', e.target.value)}
                                                        disabled={!formData.station_id}
                                                    >
                                                        <option value="">Select Position</option>
                                                        {BRANCH_JABATAN_OPTIONS.map((j) => (
                                                            <option key={j} value={j}>{j}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            {!formData.station_id && (
                                                <p className="md:col-span-2 text-[10px] sm:text-xs text-gray-400 -mt-1">Select a station first</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 sm:mb-4">Security</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className={labelStyle}>Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                className={fieldErrors.password ? inputErrorStyle : inputStyle}
                                                placeholder="Min. 8 characters"
                                                value={formData.password}
                                                onChange={(e) => handleChange('password', e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff size={16} className="sm:hidden" /> : <Eye size={16} className="sm:hidden" />}
                                                {showPassword ? <EyeOff size={18} className="hidden sm:block" /> : <Eye size={18} className="hidden sm:block" />}
                                            </button>
                                        </div>
                                        {formData.password.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                                                {[
                                                    { ok: formData.password.length >= 8, label: '8+ characters' },
                                                    { ok: /[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password), label: 'Uppercase & lowercase' },
                                                    { ok: /[0-9]/.test(formData.password), label: 'Number' },
                                                ].map((req) => (
                                                    <span key={req.label} className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-colors ${req.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        <CheckCircle size={12} className={req.ok ? 'opacity-100' : 'opacity-40'} />
                                                        {req.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {fieldErrors.password && <p className="text-[10px] sm:text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Confirm Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                className={fieldErrors.confirmPassword ? inputErrorStyle : inputStyle}
                                                placeholder="Repeat password"
                                                value={formData.confirmPassword}
                                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                            />
                                        </div>
                                        {fieldErrors.confirmPassword && <p className="text-[10px] sm:text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !!success}
                                className="w-full py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                                style={{
                                    background: (loading || success) ? '#9ca3af' : 'linear-gradient(135deg, #059669, #10b981)',
                                    boxShadow: (loading || success) ? 'none' : '0 4px 14px -2px rgba(16, 185, 129, 0.4)',
                                }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        Register Now
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-4 sm:mt-5 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                            <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-blue-700 text-xs sm:text-sm">
                                After registering, your account must be approved by an admin before you can log in.
                            </p>
                        </div>

                        <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-100 text-center">
                            <p className="text-gray-500 text-xs sm:text-sm">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="font-semibold text-emerald-600 hover:text-emerald-700 active:text-emerald-800 transition-colors">
                                    Sign in here
                                </Link>
                            </p>
                        </div>
                    </div>

                    <p className="lg:hidden text-center text-[10px] sm:text-xs text-gray-400 mt-4 sm:mt-6">
                        © 2025 PT Gapura Angkasa. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
