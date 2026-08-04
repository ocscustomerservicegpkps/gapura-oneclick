'use client';

import { useEffect, useState, useCallback, useDeferredValue, useMemo } from 'react';
import {
    FileText, Search, Filter, ChevronDown,
    AlertTriangle,
    Building2
} from 'lucide-react';
import { Report } from '@/types';
import { useReportsData } from '@/hooks/use-reports-cache';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { type TimePeriod } from '@/components/dashboard/TimePeriodFilter';
import { ReportDetailModal } from '@/components/dashboard/ReportDetailModal';
import { type StatusUpdateDetails } from '@/components/dashboard/ReportDetailView';
import { ReportsDetailTable } from '@/components/dashboard/analyst/ReportsDetailTable';

export default function AdminReportsPage() {
    const [stationFilter, setStationFilter] = useState('all');
    const [filter, setFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [stations, setStations] = useState<Array<{ id: string; code: string; name: string }>>([]);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [period, setPeriod] = useState<TimePeriod>(null);

    const fetchStations = useCallback(async () => {
        try {
            const res = await fetch('/api/master-data?type=stations');
            const data = await res.json();
            if (Array.isArray(data)) setStations(data);
            else if (data.stations) setStations(data.stations);
        } catch (error) {
            console.error('Error fetching stations:', error);
        }
    }, []);

    const reportUrl = useMemo(() => {
        const queryParams = new URLSearchParams();
        if (filter !== 'all') queryParams.set('status', filter);
        if (stationFilter !== 'all') queryParams.set('station', stationFilter);
        if (severityFilter !== 'all') queryParams.set('severity', severityFilter);
        if (deferredSearch.trim()) queryParams.set('search', deferredSearch.trim());
        return `/api/admin/reports?${queryParams.toString()}`;
    }, [deferredSearch, filter, severityFilter, stationFilter]);
    const {
        reports,
        isLoading: loading,
        isLoadingMore,
        hasMore,
        loadMore,
        refresh: fetchReports,
        updateReport,
    } = useReportsData(reportUrl);

    useEffect(() => {
        const timeoutId = setTimeout(fetchStations, 0);
        return () => clearTimeout(timeoutId);
    }, [fetchStations]);

    const handleUpdateStatus = async (reportId: string, status: string, notes?: string, evidenceUrl?: string, details?: StatusUpdateDetails) => {
        const res = await fetch(`/api/reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                action_taken: notes,
                evidence_urls: evidenceUrl ? [evidenceUrl] : undefined,
                kps_remarks: details?.finalRemarks,
                final_remarks: details?.finalRemarks,
                remarks_by: details?.remarksBy,
            }),
        });

        if (!res.ok) {
            const errorPayload = await res.json().catch(() => null);
            throw new Error(errorPayload?.error || 'Failed to update status');
        }

        await updateReport(reportId, { status: status as Report['status'] });
        await fetchReports();
    };

    const filteredReports = reports.filter(report => {
        const matchesSearch = 
            report.title?.toLowerCase().includes(search.toLowerCase()) ||
            report.location?.toLowerCase().includes(search.toLowerCase()) ||
            report.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            report.stations?.name?.toLowerCase().includes(search.toLowerCase()) ||
            report.id?.toLowerCase().includes(search.toLowerCase()) ||
            report.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
            report.flight_number?.toLowerCase().includes(search.toLowerCase());
        const matchesSeverity = severityFilter === 'all' || 
            String(report.severity).toUpperCase() === String(severityFilter).toUpperCase();
        return matchesSearch && matchesSeverity;
    });

    return (
        <div className="space-y-8 stagger-children">
            {}
            <DashboardHeader
                title="Manage Reports"
                subtitle="Kelola dan tindaklanjuti semua laporan masuk"
                totalReports={reports.length}
                pendingReports={reports.filter(r => r.status === 'OPEN').length}
                resolvedReports={reports.filter(r => r.status === 'CLOSED').length}
                period={period}
                onPeriodChange={(p) => setPeriod(p)}
            />

            {}
            <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search reports, case number, location, reporter, or station..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 'calc(var(--space-lg) + 1.5rem)' }}
                    />
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[160px]">
                        <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} className="input-field pl-10 pr-10 cursor-pointer" style={{ background: 'var(--surface-2)' }}>
                            <option value="all">All Stations</option>
                            {stations.map((s) => (<option key={s.id} value={s.id}>{s.code} - {s.name}</option>))}
                        </select>
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="relative flex-1 min-w-[140px]">
                        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field pl-10 pr-10 cursor-pointer" style={{ background: 'var(--surface-2)' }}>
                            <option value="all">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="ON PROGRESS">On Progress</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="relative flex-1 min-w-[140px]">
                        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="input-field pl-10 pr-10 cursor-pointer" style={{ background: 'var(--surface-2)' }}>
                            <option value="all">All Severities</option>
                            <option value="TOP RISK">🔴 Top Risk</option>
                            <option value="HIGH RISK">🟠 High Risk</option>
                            <option value="MEDIUM">🟡 Medium</option>
                            <option value="LOW">🟢 Low</option>
                        </select>
                        <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                </div>
            </div>

            {}
            <div className="card-solid animate-fade-in-up" style={{ padding: 0, overflow: 'hidden', animationDelay: '150ms' }}>
                {}
                <div 
                    className="flex items-center justify-between" 
                    style={{ padding: 'var(--space-lg) var(--space-xl)', borderBottom: '1px solid var(--surface-4)' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ background: 'oklch(0.55 0.14 160 / 0.12)' }}>
                            <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <div>
                            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Report List</h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filteredReports.length} laporan</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--surface-4)', borderTopColor: 'var(--brand-primary)' }} />
                    </div>
                ) : (
                    <ReportsDetailTable
                        reports={filteredReports}
                        onReportClick={setSelectedReport}
                        onStatusUpdate={handleUpdateStatus}
                        loading={loading}
                        fullHeight
                    />
                )}
                {hasMore && !loading && (
                    <div className="flex justify-center border-t border-[var(--surface-3)] p-5">
                        <button
                            type="button"
                            onClick={() => void loadMore()}
                            disabled={isLoadingMore}
                            className="rounded-full border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
                        >
                            {isLoadingMore ? 'Loading reports…' : 'Load more reports'}
                        </button>
                    </div>
                )}
            </div>

            {}
            {selectedReport && (
                <ReportDetailModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                    userRole="SUPER_ADMIN"
                    onUpdateStatus={handleUpdateStatus}
                    onRefresh={fetchReports}
                />
            )}
        </div>
    );
}
