'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    Building2,
    Check,
    ChevronDown,
    Clock3,
    Edit2,
    Eye,
    Filter,
    Mail,
    MapPin,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Search,
    Shield,
    SlidersHorizontal,
    User,
    UserCheck,
    UserX,
    Users,
    Wrench,
    X,
    Zap,
} from 'lucide-react';
import type { DivisionType, UserRole } from '@/types';

type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

interface UserData {
    id: string;
    email: string;
    full_name: string;
    nik: string;
    phone: string;
    role: UserRole;
    division: DivisionType;
    status: AccountStatus;
    station_id: string | null;
    unit_id: string | null;
    position_id: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
    stations: { id: string; code: string; name: string } | null;
    units: { name: string } | null;
    positions: { name: string; level?: number | null } | null;
}

interface MasterOption {
    id: string;
    code?: string;
    name: string;
    level?: number;
}

const roleConfig: Record<UserRole, { label: string; tone: string; icon: typeof User }> = {
    SUPER_ADMIN: { label: 'Super Admin', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Shield },
    ANALYST: { label: 'Analyst', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Zap },
    DIVISI_OCS: { label: 'Divisi OCS', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Eye },
    DIVISI_OS: { label: 'Divisi OS', tone: 'bg-sky-50 text-sky-700 border-sky-100', icon: Eye },
    DIVISI_OP: { label: 'Divisi OP', tone: 'bg-teal-50 text-teal-700 border-teal-100', icon: UserCheck },
    DIVISI_OT: { label: 'Divisi OT', tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: UserCheck },
    DIVISI_UQ: { label: 'Divisi UQ', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: UserCheck },
    DIVISI_HC: { label: 'Divisi HC', tone: 'bg-violet-50 text-violet-700 border-violet-100', icon: Building2 },
    DIVISI_HT: { label: 'Divisi HT', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: User },
    DIVISI_ESKALASI: { label: 'Divisi Eskalasi', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: AlertCircle },
    MANAGER_CABANG: { label: 'Manager Cabang', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Shield },
    STAFF_CABANG: { label: 'Staff Cabang', tone: 'bg-slate-100 text-slate-700 border-slate-200', icon: User },
};

const divisionConfig: Record<DivisionType, string> = {
    GENERAL: 'General',
    OCS: 'Operational Customer Service',
    OS: 'Customer Service',
    OP: 'Operasi',
    OT: 'Operasi (OT)',
    UQ: 'Operasi (UQ)',
    HC: 'Human Capital',
    HT: 'Human Training',
};

const statusConfig: Record<AccountStatus, { label: string; tone: string; icon: typeof Clock3 }> = {
    pending: { label: 'Pending Approval', tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock3 },
    active: { label: 'Active', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: UserCheck },
    rejected: { label: 'Ditolak', tone: 'bg-red-50 text-red-700 border-red-200', icon: UserX },
    suspended: { label: 'Suspended', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', icon: Shield },
};

const roleOptions = Object.keys(roleConfig) as UserRole[];
const divisionOptions = Object.keys(divisionConfig) as DivisionType[];

function formatDate(value?: string | null) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function InfoLine({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | number | null }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="break-words text-sm font-semibold text-slate-800">{value || '-'}</p>
            </div>
        </div>
    );
}

function EditUserModal({
    user,
    onClose,
    onSave,
    isLoading,
}: {
    user: UserData;
    onClose: () => void;
    onSave: (data: { role: UserRole; division: DivisionType; station_id: string | null }) => void;
    isLoading: boolean;
}) {
    const [role, setRole] = useState<UserRole>(user.role);
    const [division, setDivision] = useState<DivisionType>(user.division || 'GENERAL');
    const [stationId, setStationId] = useState(user.station_id || '');
    const [stations, setStations] = useState<MasterOption[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        const loadStations = async () => {
            const rows = await fetch('/api/master-data?type=stations', { signal: controller.signal })
                .then((r) => r.json())
                .catch(() => []);
            setStations(Array.isArray(rows) ? rows : []);
        };
        loadStations();
        return () => controller.abort();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-500/30 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Edit akun</p>
                        <h3 className="text-xl font-bold text-slate-900">{user.full_name}</h3>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <InfoLine icon={Mail} label="Email" value={user.email} />
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-emerald-500">
                            {roleOptions.map((item) => <option key={item} value={item}>{roleConfig[item].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Divisi</label>
                        <select value={division} onChange={(e) => setDivision(e.target.value as DivisionType)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-emerald-500">
                            {divisionOptions.map((item) => <option key={item} value={item}>{divisionConfig[item]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Cabang</label>
                        <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-emerald-500">
                            <option value="">Tidak ada cabang</option>
                            {stations.map((station) => (
                                <option key={station.id} value={station.id}>
                                    {station.code ? `${station.code} - ` : ''}{station.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-7 flex gap-3">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                    <button onClick={() => onSave({ role, division, station_id: stationId || null })} disabled={isLoading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}

function AddUserModal({
    onClose,
    onCreated,
    isSuperAdmin,
}: {
    onClose: () => void;
    onCreated: () => void;
    isSuperAdmin: boolean;
}) {
    const [form, setForm] = useState({
        email: '',
        full_name: '',
        nik: '',
        phone: '',
        station_id: '',
        unit_id: '',
        position_id: '',
        role: 'STAFF_CABANG' as UserRole,
        division: 'GENERAL' as DivisionType,
        activate: false,
    });
    const [stations, setStations] = useState<MasterOption[]>([]);
    const [positions, setPositions] = useState<MasterOption[]>([]);
    const [units, setUnits] = useState<MasterOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            const [stationRows, positionRows, unitRows] = await Promise.all([
                fetch('/api/master-data?type=stations', { signal: controller.signal }).then((r) => r.json()).catch(() => []),
                fetch('/api/master-data?type=positions', { signal: controller.signal }).then((r) => r.json()).catch(() => []),
                fetch('/api/master-data?type=units', { signal: controller.signal }).then((r) => r.json()).catch(() => []),
            ]);
            setStations(Array.isArray(stationRows) ? stationRows : []);
            setPositions(Array.isArray(positionRows) ? positionRows : []);
            setUnits(Array.isArray(unitRows) ? unitRows : []);
        };
        load();
        return () => controller.abort();
    }, []);

    const update = (key: keyof typeof form, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleCreate = async () => {
        setError(null);
        if (!form.email || !form.full_name || !form.nik || !form.phone || !form.position_id || (isSuperAdmin && !form.station_id)) {
            setError('Lengkapi semua field wajib.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    unit_id: form.unit_id || null,
                    station_id: form.station_id || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create user');
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kesalahan jaringan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-500/30 p-4 backdrop-blur-sm">
            <div className="my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Add account</p>
                        <h3 className="text-xl font-bold text-slate-900">{isSuperAdmin ? 'Add system user' : 'Add branch staff'}</h3>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>
                {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama lengkap</span>
                        <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</span>
                        <input value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">NIK</span>
                        <input value={form.nik} onChange={(e) => update('nik', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nomor HP</span>
                        <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500" />
                    </label>
                    {isSuperAdmin && (
                        <>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cabang</span>
                                <select value={form.station_id} onChange={(e) => update('station_id', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500">
                                    <option value="">Select branch</option>
                                    {stations.map((station) => <option key={station.id} value={station.id}>{station.code ? `${station.code} - ` : ''}{station.name}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</span>
                                <select value={form.role} onChange={(e) => update('role', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500">
                                    {roleOptions.map((role) => <option key={role} value={role}>{roleConfig[role].label}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Posisi</span>
                        <select value={form.position_id} onChange={(e) => update('position_id', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500">
                            <option value="">Select position</option>
                            {positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unit</span>
                        <select value={form.unit_id} onChange={(e) => update('unit_id', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500">
                            <option value="">Tidak ada / Kantor Pusat (KPS)</option>
                            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                    </label>
                    {isSuperAdmin && (
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Divisi</span>
                            <select value={form.division} onChange={(e) => update('division', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500">
                                {divisionOptions.map((division) => <option key={division} value={division}>{divisionConfig[division]}</option>)}
                            </select>
                        </label>
                    )}
                    {isSuperAdmin && (
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <input type="checkbox" checked={form.activate} onChange={(e) => update('activate', e.target.checked)} />
                            <span className="text-sm font-semibold text-slate-700">Activate immediately without approval</span>
                        </label>
                    )}
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                    <button onClick={handleCreate} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Buat user
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('pending');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [stationFilter, setStationFilter] = useState('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [detailUser, setDetailUser] = useState<UserData | null>(null);
    const [showAdd, setShowAdd] = useState(false);

    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    const isBranchManager = userRole === 'MANAGER_CABANG';

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/session');
                if (!res.ok) throw new Error('Unauthorized');
                const data = await res.json();
                const role = data?.user?.role as UserRole | undefined;
                setUserRole(role || null);
                if (role === 'SUPER_ADMIN' || role === 'MANAGER_CABANG') setAuthorized(true);
                else {
                    setAuthorized(false);
                    router.replace('/dashboard');
                }
            } catch {
                setAuthorized(false);
                router.replace('/dashboard');
            }
        };
        checkAuth();
    }, [router]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch('/api/admin/users', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load user data');
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching users:', error);
            setLoadError(error instanceof Error ? error.message : 'Failed to load user data');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authorized) fetchUsers();
    }, [authorized, fetchUsers]);

    const updateUser = async (userId: string, body: Record<string, unknown>) => {
        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...body }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to update user');
            await fetchUsers();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to update user');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveUser = async (data: { role: UserRole; division: DivisionType; station_id: string | null }) => {
        if (!editingUser) return;
        await updateUser(editingUser.id, data);
        setEditingUser(null);
    };

    const stations = useMemo(() => {
        const map = new Map<string, { code: string; name: string }>();
        users.forEach((user) => {
            if (user.station_id && user.stations) map.set(user.station_id, { code: user.stations.code, name: user.stations.name });
        });
        return Array.from(map.entries()).sort((a, b) => a[1].code.localeCompare(b[1].code));
    }, [users]);

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase();
        return users.filter((user) => {
            const matchesTab = activeTab === 'all' || user.status === 'pending';
            const matchesTerm = !term || [
                user.full_name,
                user.email,
                user.nik,
                user.phone,
                user.stations?.code,
                user.stations?.name,
                user.units?.name,
                user.positions?.name,
            ].some((value) => String(value || '').toLowerCase().includes(term));
            const matchesStatus = activeTab === 'pending' || statusFilter === 'all' || user.status === statusFilter;
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const matchesStation = stationFilter === 'all' || user.station_id === stationFilter;
            return matchesTab && matchesStatus && matchesTerm && matchesRole && matchesStation;
        });
    }, [activeTab, roleFilter, search, stationFilter, statusFilter, users]);

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter((user) => user.status === 'active').length,
        pending: users.filter((user) => user.status === 'pending').length,
        suspended: users.filter((user) => user.status === 'suspended').length,
    }), [users]);

    const pageTitle = isSuperAdmin ? 'Manajemen User' : 'Approval Staff Cabang';

    if (authorized === false) return null;

    return (
        <>
            <div className="min-h-screen w-full bg-[var(--surface-0)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
                <div className="w-full max-w-none space-y-5">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                                    <Shield className="h-3.5 w-3.5" />
                                    {isSuperAdmin ? 'Super Admin' : 'Approval Staff Cabang'}
                                </div>
                                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{pageTitle}</h1>
                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                    {isSuperAdmin
                                        ? 'Kelola seluruh akun, approval registrasi baru, role, divisi, dan status akses dalam satu ruang kontrol.'
                                        : 'Kelola approval dan status staff cabang pada cabang Anda.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 self-end">
                                {[
                                    ['Total', stats.total, 'text-slate-900 bg-slate-50 border-slate-200'],
                                    ['Pending', stats.pending, 'text-amber-700 bg-amber-50 border-amber-200'],
                                    ['Active', stats.active, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
                                    ['Suspended', stats.suspended, 'text-zinc-700 bg-zinc-50 border-zinc-200'],
                                ].map(([label, value, tone]) => (
                                    <div key={label} className={`rounded-xl border p-3 ${tone}`}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
                                        <p className="mt-1 text-2xl font-extrabold">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                                        activeTab === 'all'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Users className="h-4 w-4" />
                                    All Users
                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{stats.total}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('pending')}
                                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                                        activeTab === 'pending'
                                            ? 'bg-white text-amber-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Clock3 className="h-4 w-4" />
                                    Approval Pending
                                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{stats.pending}</span>
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setFiltersOpen((value) => !value)}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Filter className="h-4 w-4" />
                                    Filter
                                    <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <button onClick={fetchUsers} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </button>
                                <button onClick={() => setShowAdd(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, ID number, phone, branch, position..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium outline-none focus:border-emerald-500" />
                            </div>

                            {activeTab === 'pending' && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                                    <div className="flex items-center gap-2">
                                        <Clock3 className="h-4 w-4" />
                                        <span>{stats.pending} akun menunggu approval. Gunakan tombol Approve atau Tolak pada kolom aksi.</span>
                                    </div>
                                </div>
                            )}

                            {filtersOpen && (
                                <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 lg:grid-cols-3">
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <select
                                            value={activeTab === 'pending' ? 'pending' : statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as 'all' | AccountStatus)}
                                            disabled={activeTab === 'pending'}
                                            className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-bold outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            <option value="all">All statuses</option>
                                            {Object.entries(statusConfig).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                    {isSuperAdmin && (
                                        <>
                                            <div className="relative">
                                                <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-bold outline-none focus:border-emerald-500">
                                                    <option value="all">All roles</option>
                                                    {roleOptions.map((role) => <option key={role} value={role}>{roleConfig[role].label}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            </div>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-bold outline-none focus:border-emerald-500">
                                                    <option value="all">All branches</option>
                                                    {stations.map(([id, station]) => <option key={id} value={id}>{station.code} - {station.name}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        {loading ? (
                            <div className="flex h-52 items-center justify-center">
                                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : loadError ? (
                            <div className="flex h-52 flex-col items-center justify-center px-6 text-center text-red-600">
                                <AlertCircle className="mb-3 h-10 w-10 text-red-300" />
                                <p className="font-bold">Data user gagal dimuat.</p>
                                <p className="mt-1 text-sm text-red-500">{loadError}</p>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="flex h-52 flex-col items-center justify-center text-slate-500">
                                <Users className="mb-3 h-10 w-10 text-slate-300" />
                                <p className="font-semibold">{activeTab === 'pending' ? 'No users pending approval.' : 'No users match the filter.'}</p>
                            </div>
                        ) : (
                            <>
                            {}
                            <div className="divide-y divide-slate-100 md:hidden">
                                {filteredUsers.map((user) => {
                                    const RoleIcon = roleConfig[user.role]?.icon || User;
                                    const StatusIcon = statusConfig[user.status]?.icon || Clock3;
                                    const canApprovePending = user.status === 'pending' && (
                                        isSuperAdmin || (isBranchManager && user.role === 'STAFF_CABANG')
                                    );
                                    const canSuspend = isSuperAdmin && user.status === 'active';
                                    const canActivate = isSuperAdmin && (user.status === 'rejected' || user.status === 'suspended');
                                    return (
                                        <div key={user.id} className="space-y-3 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black text-slate-900">{user.full_name}</p>
                                                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-slate-500"><Mail className="h-3 w-3 shrink-0" />{user.email}</p>
                                                    <p className="mt-0.5 text-xs text-slate-400">NIK {user.nik || '-'} | HP {user.phone || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge className={roleConfig[user.role]?.tone || 'bg-slate-100 text-slate-700 border-slate-200'}><RoleIcon className="h-3.5 w-3.5" />{roleConfig[user.role]?.label || user.role}</Badge>
                                                <Badge className={statusConfig[user.status]?.tone || statusConfig.pending.tone}><StatusIcon className="h-3.5 w-3.5" />{statusConfig[user.status]?.label || user.status}</Badge>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3 text-xs">
                                                <p className="font-bold text-slate-800">{user.stations ? `${user.stations.code} - ${user.stations.name}` : '-'}</p>
                                                <p className="text-slate-500">{divisionConfig[user.division] || user.division} {user.units?.name ? `| ${user.units.name}` : ''}</p>
                                                <p className="text-slate-400">{user.positions?.name || '-'}{user.positions?.level ? `, level ${user.positions.level}` : ''}</p>
                                                <p className="mt-2 text-slate-400"><span className="font-bold text-slate-600">Dibuat:</span> {formatDate(user.created_at)}</p>
                                                <p className="text-slate-400"><span className="font-bold text-slate-600">Update:</span> {formatDate(user.updated_at)}</p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2 pt-1">
                                                <button onClick={() => setDetailUser(user)} className="min-h-11 min-w-11 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Detail akun">
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {isSuperAdmin && (
                                                    <button onClick={() => setEditingUser(user)} className="min-h-11 min-w-11 rounded-lg border border-blue-100 p-2 text-blue-600 hover:bg-blue-50" title="Edit role, divisi, dan cabang">
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canApprovePending && (
                                                    <>
                                                        <button onClick={() => { if (window.confirm(`Tolak registrasi ${user.full_name}?`)) updateUser(user.id, { status: 'rejected' }); }} disabled={actionLoading === user.id} className="min-h-11 min-w-11 rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Tolak registrasi">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => updateUser(user.id, { status: 'active' })} disabled={actionLoading === user.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                                                            <Check className="h-4 w-4" />
                                                            Approve
                                                        </button>
                                                    </>
                                                )}
                                                {canSuspend && (
                                                    <button onClick={() => updateUser(user.id, { status: 'suspended' })} disabled={actionLoading === user.id} className="min-h-11 min-w-11 rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50" title="Suspend akun">
                                                        <Shield className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canActivate && (
                                                    <button onClick={() => updateUser(user.id, { status: 'active' })} disabled={actionLoading === user.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                                                        <Check className="h-4 w-4" />
                                                        Activate
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {}
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[1120px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-4">Akun</th>
                                            <th className="px-5 py-4">Cabang</th>
                                            <th className="px-5 py-4">Role & Status</th>
                                            <th className="px-5 py-4">Registrasi</th>
                                            <th className="px-5 py-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredUsers.map((user) => {
                                            const RoleIcon = roleConfig[user.role]?.icon || User;
                                            const StatusIcon = statusConfig[user.status]?.icon || Clock3;
                                            const canApprovePending = user.status === 'pending' && (
                                                isSuperAdmin || (isBranchManager && user.role === 'STAFF_CABANG')
                                            );
                                            const canSuspend = isSuperAdmin && user.status === 'active';
                                            const canActivate = isSuperAdmin && (user.status === 'rejected' || user.status === 'suspended');
                                            return (
                                                <tr key={user.id} className="hover:bg-slate-50/70">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                                                                {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-slate-900">{user.full_name}</p>
                                                                <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-slate-500"><Mail className="h-3 w-3" />{user.email}</p>
                                                                <p className="mt-0.5 text-xs text-slate-400">NIK {user.nik || '-'} | HP {user.phone || '-'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm">
                                                        <p className="font-bold text-slate-800">{user.stations ? `${user.stations.code} - ${user.stations.name}` : '-'}</p>
                                                        <p className="text-xs text-slate-500">{divisionConfig[user.division] || user.division} {user.units?.name ? `| ${user.units.name}` : ''}</p>
                                                        <p className="text-xs text-slate-400">{user.positions?.name || '-'}{user.positions?.level ? `, level ${user.positions.level}` : ''}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col items-start gap-2">
                                                            <Badge className={roleConfig[user.role]?.tone || 'bg-slate-100 text-slate-700 border-slate-200'}><RoleIcon className="h-3.5 w-3.5" />{roleConfig[user.role]?.label || user.role}</Badge>
                                                            <Badge className={statusConfig[user.status]?.tone || statusConfig.pending.tone}><StatusIcon className="h-3.5 w-3.5" />{statusConfig[user.status]?.label || user.status}</Badge>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-500">
                                                        <p><span className="font-bold text-slate-700">Dibuat:</span> {formatDate(user.created_at)}</p>
                                                        <p className="mt-1"><span className="font-bold text-slate-700">Update:</span> {formatDate(user.updated_at)}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setDetailUser(user)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Detail akun">
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                            {isSuperAdmin && (
                                                                <button onClick={() => setEditingUser(user)} className="rounded-lg border border-blue-100 p-2 text-blue-600 hover:bg-blue-50" title="Edit role, divisi, dan cabang">
                                                                    <Edit2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {canApprovePending && (
                                                                <>
                                                                    <button onClick={() => { if (window.confirm(`Tolak registrasi ${user.full_name}?`)) updateUser(user.id, { status: 'rejected' }); }} disabled={actionLoading === user.id} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Tolak registrasi">
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => updateUser(user.id, { status: 'active' })} disabled={actionLoading === user.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                                                                        <Check className="h-4 w-4" />
                                                                        Approve
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canSuspend && (
                                                                <button onClick={() => updateUser(user.id, { status: 'suspended' })} disabled={actionLoading === user.id} className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50" title="Suspend akun">
                                                                    <Shield className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {canActivate && (
                                                                <button onClick={() => updateUser(user.id, { status: 'active' })} disabled={actionLoading === user.id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                                                                    <Check className="h-4 w-4" />
                                                                    Activate
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            </>
                        )}
                    </section>
                </div>
            </div>

            {editingUser && isSuperAdmin && (
                <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser} isLoading={actionLoading === editingUser.id} />
            )}

            {detailUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-500/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Detail akun</p>
                                <h3 className="text-2xl font-black text-slate-900">{detailUser.full_name}</h3>
                            </div>
                            <button onClick={() => setDetailUser(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <InfoLine icon={Mail} label="Email" value={detailUser.email} />
                            <InfoLine icon={Phone} label="Nomor HP" value={detailUser.phone} />
                            <InfoLine icon={User} label="NIK" value={detailUser.nik} />
                            <InfoLine icon={Shield} label="Role" value={roleConfig[detailUser.role]?.label || detailUser.role} />
                            <InfoLine icon={UserCheck} label="Status" value={statusConfig[detailUser.status]?.label || detailUser.status} />
                            <InfoLine icon={Building2} label="Divisi" value={divisionConfig[detailUser.division] || detailUser.division} />
                            <InfoLine icon={MapPin} label="Cabang" value={detailUser.stations ? `${detailUser.stations.code} - ${detailUser.stations.name}` : '-'} />
                            <InfoLine icon={Building2} label="Unit" value={detailUser.units?.name} />
                            <InfoLine icon={Wrench} label="Posisi" value={detailUser.positions?.name} />
                            <InfoLine icon={Clock3} label="Dibuat" value={formatDate(detailUser.created_at)} />
                            <InfoLine icon={RefreshCw} label="Terakhir update" value={formatDate(detailUser.updated_at)} />
                            <InfoLine icon={User} label="User ID" value={detailUser.id} />
                        </div>
                    </div>
                </div>
            )}

            {showAdd && (
                <AddUserModal
                    onClose={() => setShowAdd(false)}
                    onCreated={() => {
                        setShowAdd(false);
                        fetchUsers();
                    }}
                    isSuperAdmin={isSuperAdmin}
                />
            )}
        </>
    );
}
