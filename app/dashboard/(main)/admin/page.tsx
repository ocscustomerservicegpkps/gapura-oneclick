'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FileText, Users, TrendingUp,
    MapPin, ArrowRight, AlertTriangle, AlertCircle, Shield, Zap
} from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { type TimePeriod } from '@/components/dashboard/TimePeriodFilter';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { ReportDetailModal } from '@/components/dashboard/ReportDetailModal';
import { type Report } from '@/types';

interface Stats {
    overview: {
        totalReports: number;
        menungguFeedback: number;
        sudahDiverifikasi: number;
        selesai: number;
        pendingUsers: number;
        activeUsers: number;
        resolutionRate: number;
        slaBreachCount: number;
    };
    severity: { HIGH: number; MEDIUM: number; LOW: number; 'TOP RISK': number };
    trends: { today: number; thisWeek: number; thisMonth: number };
    recentReports: Array<{
        id: string;
        title: string;
        report?: string;
        primary_tag?: string;
        location: string;
        status: string;
        severity: string;
        created_at: string;
        users: { full_name: string };
        stations: { code: string } | null;
    }>;
    topLocations: Array<{ location: string; count: number }>;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>(null);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    // Guards against a slower, earlier period's response landing after a
    // newer period's and overwriting fresher stats.
    const activePeriodRef = useRef(period);

    const fetchData = useCallback(async () => {
        const requestPeriod = period;
        setLoading(true);
        try {
            const url = requestPeriod ? `/api/admin/stats?period=${requestPeriod}` : '/api/admin/stats';
            const res = await fetch(url);
            const data = await res.json();
            if (activePeriodRef.current === requestPeriod) setStats(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            if (activePeriodRef.current === requestPeriod) setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        activePeriodRef.current = period;
        fetchData();
    }, [period, fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div
                    className="w-12 h-12 rounded-full border-4 animate-spin"
                    style={{
                        borderColor: 'var(--surface-4)',
                        borderTopColor: 'var(--brand-primary)'
                    }}
                />
            </div>
        );
    }

    const severity = stats?.severity ?? { HIGH: 0, MEDIUM: 0, LOW: 0, 'TOP RISK': 0 };
    const maxLocation = Math.max(...(stats?.topLocations.map(l => l.count) || [1]));

    return (
        <div className="space-y-8 stagger-children snap-y">
            {}
            <PresentationSlide className="!p-0 !min-h-0 !bg-transparent !shadow-none !border-0">
                <div className="space-y-6">
                    <DashboardHeader
                        title="Ringkasan"
                        subtitle="Analitik operasional bandara Gapura Angkasa"
                        totalReports={stats?.overview.totalReports || 0}
                        pendingReports={stats?.overview.menungguFeedback || 0}
                        resolvedReports={stats?.overview.selesai || 0}
                        period={period}
                        onPeriodChange={(p) => setPeriod(p)}
                    />

                    {severity.HIGH > 0 && (
                        <div
                            className="card-solid flex items-center gap-4 animate-fade-in-up cursor-pointer"
                            style={{
                                background: 'oklch(0.60 0.22 25 / 0.08)',
                                border: '1px solid oklch(0.60 0.22 25 / 0.2)',
                                padding: 'var(--space-lg)'
                            }}
                            onClick={() => router.push('/dashboard/admin/drilldown?type=severity&value=HIGH')}
                        >
                            <div
                                className="p-3 rounded-xl"
                                style={{ background: 'oklch(0.60 0.22 25 / 0.15)' }}
                            >
                                <AlertTriangle size={24} style={{ color: 'oklch(0.50 0.20 25)' }} />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold" style={{ color: 'oklch(0.40 0.18 25)' }}>
                                    {severity.HIGH} High Priority Reports
                                </p>
                                <p className="text-sm" style={{ color: 'oklch(0.55 0.15 25)' }}>
                                    Membutuhkan penanganan segera
                                </p>
                            </div>
                            <div
                                className="btn-primary"
                                style={{
                                    background: 'oklch(0.55 0.20 25)',
                                    boxShadow: '0 4px 16px oklch(0.55 0.20 25 / 0.3)'
                                }}
                            >
                                Lihat
                                <ArrowRight size={16} />
                            </div>
                        </div>
                    )}
                </div>
            </PresentationSlide>

            {}
            <PresentationSlide
                title="Analisis & Tren"
                subtitle="Breakdown severity, aktivitas, dan lokasi terbanyak"
                icon={TrendingUp}
                hint="Klik item untuk melihat detail laporan"
            >
                <div className="bento-grid bento-3">
                    {}
                    <div className="card-solid animate-fade-in-up">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: 'var(--text-muted)' }}>
                            Berdasarkan Severity
                        </p>
                        <div className="space-y-4">
                            {[
                                { label: 'High (Accident)', value: severity.HIGH, color: 'oklch(0.55 0.20 25)', icon: AlertTriangle, filterValue: 'HIGH' },
                                { label: 'Medium (Incident)', value: severity.MEDIUM, color: 'oklch(0.65 0.18 75)', icon: AlertCircle, filterValue: 'MEDIUM' },
                                { label: 'Low (Hazard)', value: severity.LOW, color: 'oklch(0.55 0.15 160)', icon: Shield, filterValue: 'LOW' },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between cursor-pointer hover:bg-[var(--surface-2)] rounded-lg p-2 -mx-2 transition-colors"
                                        onClick={() => router.push(`/dashboard/admin/drilldown?type=severity&value=${item.filterValue}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="p-2 rounded-lg"
                                                style={{ background: `${item.color} / 0.12)`.replace(')', '') }}
                                            >
                                                <Icon size={16} style={{ color: item.color }} />
                                            </div>
                                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                                        </div>
                                        <span className="text-xl font-bold" style={{ color: item.color }}>
                                            {item.value}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {}
                    <div className="card-solid animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: 'var(--text-muted)' }}>
                            Aktivitas
                        </p>
                        <div className="space-y-4">
                            {[
                                { label: 'Hari Ini', value: stats?.trends.today, trendKey: 'today' },
                                { label: 'This Week', value: stats?.trends.thisWeek, trendKey: 'thisWeek' },
                                { label: 'This Month', value: stats?.trends.thisMonth, trendKey: 'thisMonth' },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex items-center justify-between cursor-pointer hover:bg-[var(--surface-2)] rounded-lg p-2 -mx-2 transition-colors"
                                    onClick={() => router.push(`/dashboard/admin/drilldown?type=trend&value=${item.trendKey}`)}
                                >
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                                    <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {}
                    <div className="card-solid animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: 'var(--text-muted)' }}>
                            Lokasi Terbanyak
                        </p>
                        <div className="space-y-4">
                            {stats?.topLocations.length === 0 ? (
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Belum ada data</p>
                            ) : (
                                stats?.topLocations.slice(0, 4).map((loc, idx) => (
                                    <div
                                        key={idx}
                                        className="cursor-pointer hover:bg-[var(--surface-2)] rounded-lg p-2 -mx-2 transition-colors"
                                        onClick={() => router.push(`/dashboard/admin/drilldown?type=location&value=${encodeURIComponent(loc.location)}`)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm truncate max-w-[180px] sm:max-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
                                                {loc.location}
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {loc.count}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-4)' }}>
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(loc.count / maxLocation) * 100}%`,
                                                    background: 'linear-gradient(90deg, var(--brand-gradient-start), var(--brand-gradient-end))'
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </PresentationSlide>

            {}
            <PresentationSlide
                title="Latest Reports"
                subtitle="5 laporan terakhir"
                icon={FileText}
            >
                <div className="card-solid" style={{ padding: 0, overflow: 'hidden' }}>
                    {stats?.recentReports.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText size={40} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-4 opacity-50" />
                            <p style={{ color: 'var(--text-muted)' }}>Belum ada laporan</p>
                        </div>
                    ) : (
                        <div>
                            {stats?.recentReports.map((report, idx) => (
                                <div
                                    key={report.id}
                                    onClick={() => setSelectedReport(report as unknown as Report)}
                                    className="flex items-center gap-4 transition-colors hover:bg-[var(--surface-3)] min-h-[48px]"
                                    style={{
                                        padding: 'var(--space-lg) var(--space-xl)',
                                        borderBottom: idx < (stats?.recentReports.length || 0) - 1 ? '1px solid var(--surface-4)' : 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{
                                            background: (report.severity === 'HIGH' || report.severity === 'TOP RISK') ? 'oklch(0.55 0.20 25)' :
                                                       report.severity === 'MEDIUM' ? 'oklch(0.65 0.18 75)' :
                                                       'oklch(0.55 0.15 160)'
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {report.primary_tag === 'CGO' ? (
                                                <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">CGO</span>
                                            ) : (
                                                <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 uppercase">L&A</span>
                                            )}
                                            <p className="font-medium truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                                                {report.report || report.title}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            {report.stations && (
                                                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    <MapPin size={12} />
                                                    {report.stations.code}
                                                </span>
                                            )}
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {report.users?.full_name}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PresentationSlide>

            {}
            <PresentationSlide
                title="Aksi Cepat"
                subtitle="Kelola laporan dan pengguna"
                icon={Zap}
                className="!min-h-0"
            >
                <div className="bento-grid bento-2">
                    <Link
                        href="/dashboard/admin/reports"
                        className="card-solid flex items-center gap-4 group animate-fade-in-up"
                    >
                        <div
                            className="p-4 rounded-xl transition-all group-hover:scale-105"
                            style={{ background: 'oklch(0.65 0.18 160 / 0.1)' }}
                        >
                            <FileText size={24} style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Manage Reports</p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tinjau dan proses insiden</p>
                        </div>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--text-muted)' }} />
                    </Link>

                    <Link
                        href="/dashboard/admin/users"
                        className="card-solid flex items-center gap-4 group animate-fade-in-up"
                        style={{ animationDelay: '80ms' }}
                    >
                        <div
                            className="p-4 rounded-xl transition-all group-hover:scale-105"
                            style={{ background: 'oklch(0.60 0.15 250 / 0.1)' }}
                        >
                            <Users size={24} style={{ color: 'oklch(0.55 0.15 250)' }} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Kelola Pengguna</p>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Akses & persetujuan pengguna</p>
                        </div>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                </div>
            </PresentationSlide>

            {}
            <ReportDetailModal
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                report={selectedReport}
                userRole="SUPER_ADMIN"
            />
        </div>
    );
}
