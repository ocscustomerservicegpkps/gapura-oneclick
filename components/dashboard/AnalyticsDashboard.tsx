'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
    Clock, CheckCircle2,
    FileText, RefreshCw, Loader2, Plus,
    AlertTriangle, LayoutDashboard,
    Plane, ClipboardList, Search
} from 'lucide-react';

import { STATUS_CONFIG, type ReportStatus } from '@/lib/constants/report-status';
import { type Report, type AnalyticsData } from '@/types';
import { reportsFromPayload } from '@/lib/report-page';
import { cn } from '@/lib/utils';
import { ReportDetailModal } from '@/components/dashboard/ReportDetailModal';
import { calculateComparisonData } from '@/lib/utils/comparison-utils';
import { CustomerFeedbackFilterModal } from './analyst/CustomerFeedbackFilterModal';
import { NoiseTexture } from '@/components/ui/NoiseTexture';

// Shared loader so we can warm the chunk during the data fetch instead of
// waiting for it to start downloading only after `loading` flips false — that
// serial waterfall was the "loading ends, then ~3s of nothing" gap.
const loadAnalystCharts = () => import('./analyst/AnalystCharts');

const AnalystCharts = dynamic(loadAnalystCharts, {
    ssr: false,
    loading: () => (
        <div className="min-h-[40vh] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--surface-4)', borderTopColor: 'var(--brand-primary)' }} />
        </div>
    ),
});

export interface DivisionConfig {
    code: string;
    name: string;
    color: string;
    gradient: string;
    bgLight: string;
    textColor: string;
}

interface AnalyticsDashboardProps {
    division: DivisionConfig;
    showGenerateFeedback?: boolean;
}

export function AnalyticsDashboard({ division, showGenerateFeedback = true }: AnalyticsDashboardProps) {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | { from: string; to: string }>('all');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [cfLoading, setCfLoading] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [allowCF, setAllowCF] = useState(false);

    const [globalFilters, setGlobalFilters] = useState<{
        hubs: string[];
        branches: string[];
        airlines: string[];
        categories: string[];
    }>({
        hubs: [],
        branches: [],
        airlines: [],
        categories: [],
    });

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [reportsRes, analyticsRes] = await Promise.all([
                fetch('/api/admin/reports'),
                fetch('/api/admin/analytics')
            ]);

            if (reportsRes.ok) {
                setReports(reportsFromPayload<Report>(await reportsRes.json()));
            }
            if (analyticsRes.ok) {
                const data = await analyticsRes.json();
                setAnalytics(data);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleCustomerFeedbackShortcut = useCallback(async () => {
        setCfLoading(true);
        try {
            const res = await fetch('/api/dashboards/customer-feedback-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), 
            });

            if (!res.ok) throw new Error('Failed to generate dashboard');

            const data = await res.json();
            if (data.dashboard?.slug) {
                router.push(`/embed/custom/${data.dashboard.slug}`);
            } else {
                throw new Error('No slug returned');
            }
        } catch (err) {
            console.error('Customer Feedback shortcut error:', err);
            alert('Failed to open Customer Feedback Dashboard. Please try again.');
        } finally {
            setCfLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
        // Warm the AnalystCharts chunk AND the default (summary) tab chunk in
        // parallel with the fetch above. Previously these loaded as a serial
        // waterfall — fetch → AnalystCharts chunk → SummaryReportTab chunk — so
        // after the spinner ended the user stared at "Loading analysis
        // workspace..." while chunks downloaded one after another. Warming them
        // here overlaps all of it with the fetch.
        loadAnalystCharts().catch(() => {});
        import('@/components/dashboard/tabs/SummaryReportTab').catch(() => {});
    }, [fetchData]);

    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch('/api/auth/session', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                const role = String(data?.user?.role || '').trim().toUpperCase();
                setAllowCF(role === 'ANALYST' || role === 'SUPER_ADMIN' || (role === 'DIVISI_OS' || role === 'DIVISI_OCS'));
            } catch {
                setAllowCF(false);
            }
        };
        run();
    }, []);

    // Defer refiltering so search keystrokes paint before the list recomputes.
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const filteredReportsList = useMemo(() => {
        let result = reports;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let cutoffDate: Date;
        let explicitEndDate: Date | null = null;

        if (typeof dateRange === 'object') {
            cutoffDate = new Date(dateRange.from);
            cutoffDate.setHours(0, 0, 0, 0);
            explicitEndDate = new Date(dateRange.to);
            explicitEndDate.setHours(23, 59, 59, 999);
        } else if (dateRange === 'all') {
            cutoffDate = new Date(0);
        } else if (dateRange === 'month') {
            cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        } else {
            cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        }

        const endDate = explicitEndDate || today;

        result = result.filter((r) => {
            const dateStr = r.date_of_event || r.created_at;
            if (!dateStr) return false;

            let d: Date;
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [y, m, day] = dateStr.split('-').map(Number);
                d = new Date(y, m - 1, day);
            } else {
                d = new Date(dateStr);
            }

            return d >= cutoffDate && d <= endDate;
        });

        if (deferredSearchQuery) {
            const query = deferredSearchQuery.toLowerCase();
            result = result.filter(r => 
                (r.report || r.title || '').toLowerCase().includes(query) ||
                (r.airlines || r.airline || '').toLowerCase().includes(query) ||
                (r.flight_number || '').toLowerCase().includes(query) ||
                (r.branch || r.station_code || '').toLowerCase().includes(query)
            );
        }

        if (globalFilters.hubs.length > 0) {
            result = result.filter(r => globalFilters.hubs.includes(r.hub || ''));
        }
        if (globalFilters.branches.length > 0) {
            result = result.filter(r => {
                const branchCode = r.station_code || r.branch || '';
                return globalFilters.branches.includes(branchCode);
            });
        }
        if (globalFilters.airlines.length > 0) {
            result = result.filter(r => {
                const airlineCode = r.airlines || r.airline || '';
                return globalFilters.airlines.includes(airlineCode);
            });
        }
        if (globalFilters.categories.length > 0) {
            result = result.filter(r => globalFilters.categories.includes(r.main_category || ''));
        }

        return result;
    }, [reports, dateRange, deferredSearchQuery, globalFilters]);

    const comparisonData = useMemo(() => {
        return calculateComparisonData(filteredReportsList);
    }, [filteredReportsList]);

    const drilldownUrl = (type: string, value: string) =>
        `/dashboard/analyst/drilldown?type=${type}&value=${encodeURIComponent(value)}&period=${dateRange}`;

    const availableOptions = useMemo(() => {
        const hubs = new Set<string>();
        const branches = new Set<string>();
        const airlines = new Set<string>();
        const categories = new Set<string>();

        reports.forEach((r) => {
            if (r.hub) hubs.add(r.hub);
            if (r.station_code) branches.add(r.station_code);
            else if (r.branch) branches.add(r.branch);
            if (r.airlines) airlines.add(r.airlines);
            else if (r.airline) airlines.add(r.airline);
            if (r.main_category) categories.add(r.main_category);
        });

        return {
            hubs: Array.from(hubs).sort(),
            branches: Array.from(branches).sort(),
            airlines: Array.from(airlines).sort(),
            categories: Array.from(categories).sort(),
        };
    }, [reports]);

    const caseCategoryData = useMemo(() => {
        const irregularity = filteredReportsList.filter(r => r.category === 'Irregularity').length;
        const complaint = filteredReportsList.filter(r => r.category === 'Complaint').length;
        const compliment = filteredReportsList.filter(r => r.category === 'Compliment').length;
        return [
            { name: 'Irregularity', value: irregularity, fill: '#10b981' },
            { name: 'Complaint', value: complaint, fill: '#ec4899' },
            { name: 'Compliment', value: compliment, fill: '#06b6d4' },
        ];
    }, [filteredReportsList]);

    const branchReportData = useMemo(() => {
        const stations: Record<string, number> = {};
        filteredReportsList.forEach(r => {
            const station = r.station_code || r.branch || 'Unknown';
            stations[station] = (stations[station] || 0) + 1;
        });
        return Object.entries(stations)
            .map(([station, count]) => ({ station, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [filteredReportsList]);

    const monthlyReportData = useMemo(() => {
        const dataMap = new Map<string, { irregularity: number; complaint: number; compliment: number; date: Date }>();
        filteredReportsList.forEach(r => {
            const dateStr = r.date_of_event || r.created_at;
            if (!dateStr) return;

            let d: Date;
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [y, m, day] = dateStr.split('-').map(Number);
                d = new Date(y, m - 1, day);
            } else {
                d = new Date(dateStr);
            }

            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!dataMap.has(key)) dataMap.set(key, { irregularity: 0, complaint: 0, compliment: 0, date: d });
            const entry = dataMap.get(key)!;
            if (r.category === 'Irregularity') entry.irregularity++;
            else if (r.category === 'Complaint') entry.complaint++;
            else if (r.category === 'Compliment') entry.compliment++;
        });
        return Array.from(dataMap.values())
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((val) => ({
                month: val.date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
                irregularity: val.irregularity,
                complaint: val.complaint,
                compliment: val.compliment
            }))
            .slice(-14);
    }, [filteredReportsList]);

    const categoryByAreaData = useMemo(() => {
        const areas: Record<string, number> = {};
        filteredReportsList.forEach(r => {
            const raw = (r.area || '').toString().trim().toLowerCase();
            let area: string | null = null;
            if (raw.includes('terminal')) area = 'Terminal Area';
            else if (raw.includes('apron')) area = 'Apron Area';
            else if (raw.includes('general')) area = 'General';

            if (area) {
                areas[area] = (areas[area] || 0) + 1;
            }
        });
        return Object.entries(areas)
            .map(([area, count]) => ({ name: area, value: count }))
            .sort((a, b) => b.value - a.value)
            .map((item, i) => ({ ...item, fill: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5] }));
    }, [filteredReportsList]);

    const areaSubCategoryData = useMemo(() => {
        const areaMap: Record<string, Record<string, number>> = {};
        filteredReportsList.forEach(r => {
            const raw = (r.area || '').toString().trim().toLowerCase();
            let area: string | null = null;
            if (raw.includes('terminal')) area = 'Terminal Area';
            else if (raw.includes('apron')) area = 'Apron Area';
            else if (raw.includes('general')) area = 'General';
            if (!area) return;
            const sub = r.main_category || 'Other';
            if (!areaMap[area]) areaMap[area] = {};
            areaMap[area][sub] = (areaMap[area][sub] || 0) + 1;
        });

        return Object.entries(areaMap).map(([area, subs]) => ({
            area,
            ...subs
        })).sort((a, b) => {
            const sumA = Object.values(a).reduce((acc: number, v) => typeof v === 'number' ? acc + v : acc, 0);
            const sumB = Object.values(b).reduce((acc: number, v) => typeof v === 'number' ? acc + v : acc, 0);
            return sumB - sumA;
        }).slice(0, 10);
    }, [filteredReportsList]);

    const categoryByBranchData = useMemo(() => {
        const branchData: Record<string, { irregularity: number; complaint: number; compliment: number }> = {};
        filteredReportsList.forEach(r => {
            const branch = r.station_code || r.branch || 'Unknown';
            if (!branchData[branch]) branchData[branch] = { irregularity: 0, complaint: 0, compliment: 0 };
            if (r.category === 'Irregularity') branchData[branch].irregularity++;
            else if (r.category === 'Complaint') branchData[branch].complaint++;
            else if (r.category === 'Compliment') branchData[branch].compliment++;
        });
        return Object.entries(branchData)
            .map(([branch, data]) => ({ branch, ...data }))
            .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment))
            .slice(0, 10);
    }, [filteredReportsList]);

    const categoryByAirlinesData = useMemo(() => {
        const airlinesData: Record<string, { irregularity: number; complaint: number; compliment: number }> = {};
        filteredReportsList.forEach(r => {
            const airline = r.airlines || r.airline || 'Unknown';
            if (!airlinesData[airline]) airlinesData[airline] = { irregularity: 0, complaint: 0, compliment: 0 };
            if (r.category === 'Irregularity') airlinesData[airline].irregularity++;
            else if (r.category === 'Complaint') airlinesData[airline].complaint++;
            else if (r.category === 'Compliment') airlinesData[airline].compliment++;
        });
        return Object.entries(airlinesData)
            .map(([airline, data]) => ({ airline, ...data }))
            .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment))
            .slice(0, 8);
    }, [filteredReportsList]);

    const monthlyComparisonData = useMemo(() => {
        const dataMap = new Map<string, { masuk: number; selesai: number; date: Date }>();
        filteredReportsList.forEach(r => {
            const dateStrCreated = r.date_of_event || r.created_at;
            if (dateStrCreated) {
                let dCreated: Date;
                if (typeof dateStrCreated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStrCreated)) {
                    const [y, m, day] = dateStrCreated.split('-').map(Number);
                    dCreated = new Date(y, m - 1, day);
                } else {
                    dCreated = new Date(dateStrCreated);
                }

                if (!isNaN(dCreated.getTime())) {
                    const key = `${dCreated.getFullYear()}-${String(dCreated.getMonth() + 1).padStart(2, '0')}`;
                    if (!dataMap.has(key)) dataMap.set(key, { masuk: 0, selesai: 0, date: dCreated });
                    dataMap.get(key)!.masuk++;
                }
            }
            if (r.resolved_at) {
                const dResolved = new Date(r.resolved_at);
                if (!isNaN(dResolved.getTime())) {
                    const key = `${dResolved.getFullYear()}-${String(dResolved.getMonth() + 1).padStart(2, '0')}`;
                    if (!dataMap.has(key)) dataMap.set(key, { masuk: 0, selesai: 0, date: dResolved });
                    dataMap.get(key)!.selesai++;
                }
            }
        });
        return Array.from(dataMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(([_, val]) => ({
                month: val.date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
                masuk: val.masuk,
                selesai: val.selesai,
                rate: val.masuk > 0 ? Math.round((val.selesai / val.masuk) * 100) : 0
            }))
            .slice(-14);
    }, [filteredReportsList]);

    const hubDistributionData = useMemo(() => {
        const hubMap: Record<string, number> = {};
        filteredReportsList.forEach(r => {
            const hub = r.hub || 'Unknown';
            hubMap[hub] = (hubMap[hub] || 0) + 1;
        });
        return Object.entries(hubMap).map(([hub, count]) => ({ hub, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    }, [filteredReportsList]);

    const resolutionByBranchData = useMemo(() => {
        const branchMap: Record<string, { total: number; resolved: number }> = {};
        filteredReportsList.forEach(r => {
            const branch = r.station_code || r.branch || 'Unknown';
            if (!branchMap[branch]) branchMap[branch] = { total: 0, resolved: 0 };
            branchMap[branch].total++;
            if (r.status === 'CLOSED') branchMap[branch].resolved++;
        });
        return Object.entries(branchMap).map(([branch, data]) => ({
            branch,
            total: data.total,
            resolved: data.resolved,
            rate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
        })).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [filteredReportsList]);

    const caseReportByAreaData = useMemo(() => {
        const branchMap: Record<string, Record<string, { terminal: number; apron: number; general: number }>> = {};
        filteredReportsList.forEach((r) => {
            const branch = r.branch || r.station_code || 'Unknown';
            const airline = (r.airlines || r.airline || 'Unknown').trim() || 'Unknown';
            const area = (r.area || '').toLowerCase();
            if (!branchMap[branch]) branchMap[branch] = {};
            if (!branchMap[branch][airline]) branchMap[branch][airline] = { terminal: 0, apron: 0, general: 0 };
            if (area.includes('terminal')) branchMap[branch][airline].terminal++;
            else if (area.includes('apron')) branchMap[branch][airline].apron++;
            else if (area.includes('general')) branchMap[branch][airline].general++;
        });
        return Object.entries(branchMap)
            .map(([branch, airlineData]) => {
                const airlines = Object.entries(airlineData)
                    .map(([name, c]) => ({
                        name,
                        terminal: c.terminal,
                        apron: c.apron,
                        general: c.general,
                        total: c.terminal + c.apron + c.general,
                    }))
                    .sort((a, b) => b.total - a.total);
                return {
                    branch,
                    airlines,
                    totalTerminal: Object.values(airlineData).reduce((s, v) => s + v.terminal, 0),
                    totalApron: Object.values(airlineData).reduce((s, v) => s + v.apron, 0),
                    totalGeneral: Object.values(airlineData).reduce((s, v) => s + v.general, 0),
                    grandTotal: Object.values(airlineData).reduce((s, v) => s + v.terminal + v.apron + v.general, 0),
                };
            })
            .sort((a, b) => b.grandTotal - a.grandTotal);
    }, [filteredReportsList]);

    const terminalAreaCategoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredReportsList.forEach((r) => {
            const rawArea = (r.area || '').toString().trim().toLowerCase();
            if (!rawArea.includes('terminal')) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = (r as any).terminal_area_category as string | undefined;
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredReportsList]);

    const apronAreaCategoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredReportsList.forEach((r) => {
            const rawArea = (r.area || '').toString().trim().toLowerCase();
            if (!rawArea.includes('apron')) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = (r as any).apron_area_category as string | undefined;
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredReportsList]);

    const generalCategoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredReportsList.forEach((r) => {
            const rawArea = (r.area || '').toString().trim().toLowerCase();
            if (!rawArea.includes('general')) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = (r as any).general_category as string | undefined;
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredReportsList]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                    <div className={`absolute inset-0 ${division.bgLight} rounded-full blur-xl animate-pulse`} />
                    <Loader2 className={`w-12 h-12 animate-spin ${division.textColor} relative`} />
                </div>
                <p className="text-[var(--text-secondary)] tracking-widest uppercase text-xs font-bold">
                    Loading {division.name}...
                </p>
            </div>
        );
    }

    return (
        <div className="px-3 sm:px-6 py-6 sm:py-8 lg:p-12 space-y-6 sm:space-y-8 lg:space-y-12 pb-24 stagger-children overflow-x-hidden">
            <header className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 animate-fade-in-up bg-gradient-to-br ${division.gradient}`}>
                <NoiseTexture />
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 border border-white/30">
                                <Plane size={14} className="text-white" />
                                <span className="text-white text-xs font-bold uppercase tracking-wider">{division.code}</span>
                            </span>
                        </div>
                        <h1 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2 leading-tight break-words">
                            Dashboard {division.name}
                        </h1>
                        <p className="text-white/80 text-xs sm:text-sm">Operational Services Analytics Center</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {showGenerateFeedback && allowCF && (
                            <button 
                                onClick={handleCustomerFeedbackShortcut}
                                disabled={cfLoading}
                                title="Customer Feedback Dashboard"
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white text-[var(--brand-primary)] hover:bg-white/90 shadow-xl disabled:opacity-50"
                            >
                                {cfLoading ? <Loader2 size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
                                <span className="hidden sm:inline">Customer Feedback</span>
                                <span className="sm:hidden">Feedback</span>
                            </button>
                        )}
                        {allowCF && (
                            <button 
                                onClick={() => setShowFilterModal(true)} 
                                title="Filter Reports"
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm"
                            >
                                <Plus size={16} /> 
                                <span className="hidden sm:inline">Filter L&A</span>
                                <span className="sm:hidden">Filter</span>
                            </button>
                        )}
                        <button 
                            onClick={() => fetchData(true)} 
                            disabled={refreshing} 
                            title="Refresh Data"
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm disabled:opacity-50"
                        >
                            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-8 pt-6 border-t border-white/20">
                    <MiniStat icon={FileText} label="Total Reports" value={analytics?.summary.totalReports || 0} />
                    <MiniStat icon={CheckCircle2} label="Resolved" value={analytics?.summary.resolvedReports || 0} />
                    <MiniStat icon={Clock} label="Pending" value={analytics?.summary.pendingReports || 0} highlight />
                    <MiniStat icon={AlertTriangle} label="High Severity" value={analytics?.summary.highSeverity || 0} />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                <div className="md:col-span-3">
                     <AnalystCharts
                        analytics={analytics}
                        caseCategoryData={caseCategoryData}
                        branchReportData={branchReportData}
                        monthlyReportData={monthlyReportData}
                        categoryByAreaData={categoryByAreaData}
                        categoryByBranchData={categoryByBranchData}
                        areaSubCategoryData={areaSubCategoryData}
                        categoryByAirlinesData={categoryByAirlinesData}
                        monthlyComparisonData={monthlyComparisonData}
                        hubDistributionData={hubDistributionData}
                        resolutionByBranchData={resolutionByBranchData}
                        filteredReports={filteredReportsList}
                        caseReportByAreaData={caseReportByAreaData}
                        terminalAreaCategoryData={terminalAreaCategoryData}
                        apronAreaCategoryData={apronAreaCategoryData}
                        generalCategoryData={generalCategoryData}
                        comparisonData={comparisonData}
                        onDrilldown={(url) => router.push(url)}
                        drilldownUrl={drilldownUrl}
                        globalFilters={globalFilters}
                        setGlobalFilters={setGlobalFilters}
                        availableOptions={availableOptions}
                        allReports={reports}
                    />
                </div>
            </div>

            <div className="card-solid p-0 overflow-hidden animate-fade-in-up">
                <div className={cn("p-4 sm:p-6 border-b border-[var(--surface-4)]", division.bgLight)}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ClipboardList size={20} className={division.textColor} />
                            <div>
                                <h3 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">Report List</h3>
                                <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">{filteredReportsList.length} laporan ditampilkan</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1 sm:min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] border-none" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search airline, flight..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-[var(--surface-4)] rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                                />
                            </div>
                            <div className="flex bg-[var(--surface-3)] p-1 rounded-xl border border-[var(--surface-4)] self-start sm:self-auto">
                                {(['all', 'week', 'month'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setDateRange(r)}
                                        className={cn(
                                            "px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all",
                                            dateRange === r ? "bg-white text-[var(--brand-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                        )}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--surface-4)]">
                                <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Maskapai / Flight</th>
                                <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Incident Date</th>
                                <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Station</th>
                                <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReportsList.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No reports found</td></tr>
                            ) : (
                                filteredReportsList.map((r) => (
                                    <tr key={r.id} className="border-b border-[var(--surface-4)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer" onClick={() => setSelectedReport(r)}>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    {r.primary_tag === 'CGO' ? (
                                                        <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">CGO</span>
                                                    ) : (
                                                        <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 uppercase">L&A</span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-[var(--text-primary)]">{r.airlines || r.airline || '-'}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{r.report || r.title || '-'}</span>
                                                <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">{r.flight_number || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)] font-medium">
                                            {r.date_of_event ? new Date(r.date_of_event).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)]">{r.branch || r.station_code || '-'}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase" style={{ color: STATUS_CONFIG[r.status as ReportStatus]?.color, backgroundColor: STATUS_CONFIG[r.status as ReportStatus]?.bgColor }}>
                                                {STATUS_CONFIG[r.status as ReportStatus]?.label || r.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReportDetailModal
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                report={selectedReport}
            />

            {allowCF && (
                <CustomerFeedbackFilterModal
                    isOpen={showFilterModal}
                    onClose={() => setShowFilterModal(false)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onApply={async (config: any) => {
                        setFilterLoading(true);
                        try {
                            const res = await fetch('/api/dashboards/customer-feedback-generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(config),
                            });
                            if (!res.ok) throw new Error('Failed to create dashboard');
                            const data = await res.json();
                            const slug = data.dashboard?.slug;
                            if (!slug) throw new Error('No dashboard slug returned');
                            router.push(`/embed/custom/${slug}`);
                        } catch {
                            alert('Failed to create filtered dashboard');
                        } finally {
                            setFilterLoading(false);
                        }
                    }}
                    loading={filterLoading}
                    availableHubs={[]}
                    availableBranches={[]}
                    availableAirlines={[]}
                    availableCategories={[]}
                />
            )}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MiniStat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string | number; highlight?: boolean }) {
    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl", highlight ? "bg-white/30" : "bg-white/20")}>
                <Icon size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
            </div>
            <div className="min-w-0">
                <p className="text-white/70 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium truncate">{label}</p>
                <p className="text-white text-base sm:text-xl font-bold leading-tight">{value}</p>
            </div>
        </div>
    );
}
