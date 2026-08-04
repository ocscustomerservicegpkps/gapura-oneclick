'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    BarChart3, ShieldCheck, AlertTriangle,
    MapPin, FileText, FileSpreadsheet, Loader2, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/lib/auth-context';
import { useData } from '@/lib/swr';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { exportManagerDashboardToExcel } from '@/lib/manager-dashboard-export';
import type { DashboardData } from './ManagerCharts';

// Recharts (~heavy) and all seven charts live in a separate chunk so they are
// pulled in only after the shell paints. Charts render only once SWR data
// arrives, so lazy-loading has no perceptible cost while shrinking the route's
// first-load JS and hydration work.
const ManagerCharts = dynamic(
    () => import('./ManagerCharts').then((mod) => mod.ManagerCharts),
    {
        ssr: false,
        loading: () => (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-72" />)}
            </div>
        ),
    }
);

const KPI_COLORS = {
    total: '#0072B2',
    open: '#D55E00',
    closed: '#009E9D',
};

function KPICard({ label, value, subtitle, icon: Icon, color, onClick }: {
    label: string; value: string | number; subtitle?: string;
    icon: React.ElementType; color: string; onClick?: () => void;
}) {
    return (
        <div
            className={`bg-white rounded-[1.5rem] p-5 md:p-6 border border-gray-100 shadow-sm relative overflow-hidden group${onClick ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            onClick={onClick}
        >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.07] transition-opacity duration-700 group-hover:opacity-[0.14]"
                style={{ background: color }} />
            <div className="flex justify-between items-start relative z-10">
                <p className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </p>
                <div className="p-2.5 rounded-xl border border-gray-100" style={{ background: `${color}10` }}>
                    <Icon size={18} style={{ color }} />
                </div>
            </div>
            <div className="mt-5 relative z-10">
                <p className="text-4xl md:text-5xl font-display font-extrabold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                    {value}
                </p>
                {subtitle && (
                    <p className="text-xs font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                )}
            </div>
        </div>
    );
}

export default function ManagerDashboard() {
    const { user } = useAuthContext();
    const router = useRouter();
    const { data, isLoading } = useData<DashboardData>('/api/dashboard/manager-cabang');
    const [exporting, setExporting] = useState(false);
    const { openDrilldown, DrilldownRenderer } = useDrilldown();

    const stationName = useMemo(() => data?.station.name || user?.station?.name || '...', [data, user]);
    const stationCode = useMemo(() => data?.station.code || user?.station?.code || '...', [data, user]);

    const handleExport = useCallback(async () => {
        if (!data) return;
        setExporting(true);
        try {
            await exportManagerDashboardToExcel(data);
        } finally {
            setExporting(false);
        }
    }, [data]);

    if (isLoading || !data) {
        return (
            <div className="p-6 md:p-8 pb-24 space-y-6">
                <div className="space-y-2">
                    <div className="skeleton h-8 w-64" />
                    <div className="skeleton h-4 w-40" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-72" />)}
                </div>
            </div>
        );
    }

    const { summary, rows } = data;

    return (
        <div className="p-6 md:p-8 pb-24 space-y-6 stagger-children">

            <header className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--brand-primary)' }} />
                    <p className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--brand-primary)' }}>
                        Airport Operations
                    </p>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display" style={{ color: 'var(--text-primary)' }}>
                    Dashboard{' '}
                    <span className="bg-clip-text text-transparent" style={{
                        backgroundImage: 'linear-gradient(to right, var(--brand-gradient-start), var(--brand-gradient-end))'
                    }}>
                        {stationCode}
                    </span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{stationName}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                        href="/dashboard/manager/reports"
                        aria-label="View all reports for this station"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary,#0072B2)] px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
                    >
                        <FileText size={14} />
                        <span>All Reports</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/employee/new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus size={14} />
                        <span>Create Report</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleExport()}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        <span>Export Excel</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KPICard label="Total Reports" value={summary.total} subtitle="All periods" icon={BarChart3} color={KPI_COLORS.total} onClick={() => openDrilldown(rows, 'All Reports')} />
                <KPICard label="Open" value={summary.open} subtitle="Not yet resolved" icon={AlertTriangle} color={KPI_COLORS.open} onClick={() => openDrilldown(rows.filter(r => r.status === 'OPEN'), 'Open Reports')} />
                <KPICard label="Closed" value={summary.closed} subtitle="Successfully resolved" icon={ShieldCheck} color={KPI_COLORS.closed} onClick={() => openDrilldown(rows.filter(r => r.status === 'CLOSED'), 'Closed Reports')} />
            </div>

            <ManagerCharts data={data} openDrilldown={openDrilldown} />

            <DrilldownRenderer />
        </div>
    );
}
