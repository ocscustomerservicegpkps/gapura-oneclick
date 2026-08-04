
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart as RechartsPie, Pie, Cell, BarChart, Bar, LineChart, Line,
    LabelList
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';
import { CHART_TOOLTIP_STYLE, CHART_LEGEND_STYLE } from '@/lib/aviation-chart-config';
import { ChartTitle } from '@/components/charts/ChartTitle';
import { ExecutiveSummaryTables } from '@/components/dashboard/analyst/ExecutiveSummaryTables';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { calculateComparisonData } from '@/lib/utils/comparison-utils';

import {
    REFERENCE_COLORS,
    COLORS,
    ResponsiveContainer,
    WrappedXAxisTick,
    CustomTooltip,
    heatColor,
    OS_CARD_CLASS,
    OS_TABLE_HEADER_CLASS,
    OS_BORDER_CLASS,
} from './os-chart-utils';

import {
    type CaseCategoryItem,
    type MonthlyReportItem,
    type CategoryByAreaItem,
    type CategoryByBranchItem,
    type AreaSubCategoryItem,
    type CategoryCountItem,
    type AnalyticsData,
    type ComparisonData,
    type MonthlyComparisonItem,
} from './os-chart-types';

const PAGE_SIZE = 5;

function CategoryBarList({ data, color = '#08ad6f', title }: { data: readonly { name: string; value: number }[]; color?: string; title?: string }) {
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    const pageItems = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const maxValue = data[0]?.value || 1;
    const startIdx = page * PAGE_SIZE + 1;
    const endIdx = Math.min((page + 1) * PAGE_SIZE, data.length);

    return (
        <div>
            {title && <h3 className="font-semibold text-[13px] tracking-tight text-slate-900 mb-3">{title}</h3>}
            <div className="space-y-2">
                {pageItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-600 w-[100px] sm:w-[140px] shrink-0 whitespace-normal break-words leading-tight" title={item.name}>
                            {item.name}
                        </span>
                        <div className="flex-1 flex items-center gap-1.5">
                            <div className="flex-1 bg-slate-100 rounded-sm h-3.5 overflow-hidden">
                                <div
                                    className="h-full rounded-sm transition-all duration-300"
                                    style={{
                                        width: `${(item.value / maxValue) * 100}%`,
                                        backgroundColor: color,
                                    }}
                                />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-700 w-7 text-right shrink-0">
                                {item.value}
                            </span>
                        </div>
                    </div>
                ))}
                {data.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-4">No data</p>
                )}
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-3">
                    <span className="text-[10px] text-[var(--text-muted)]">
                        {startIdx}-{endIdx} / {data.length}
                    </span>
                    <button
                        aria-label="Halaman sebelumnya"
                        className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        <ChevronLeft size={14} className="text-[var(--text-secondary)]" aria-hidden="true" />
                    </button>
                    <button
                        aria-label="Halaman selanjutnya"
                        className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        <ChevronRight size={14} className="text-[var(--text-secondary)]" aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}

interface OsTrendSectionProps {
    readonly filteredReports: readonly Report[];
    readonly caseCategoryData: readonly CaseCategoryItem[];
    readonly categoryByAreaData: readonly CategoryByAreaItem[];
    readonly categoryByBranchData: readonly CategoryByBranchItem[];
    readonly areaSubCategoryData: readonly AreaSubCategoryItem[];
    readonly terminalAreaCategoryData: readonly CategoryCountItem[];
    readonly apronAreaCategoryData: readonly CategoryCountItem[];
    readonly generalCategoryData: readonly CategoryCountItem[];
    readonly caseClassificationData?: readonly CategoryCountItem[];
    readonly analytics: AnalyticsData | null;
    readonly monthlyComparisonData: readonly MonthlyComparisonItem[];
    readonly monthlyReportData: readonly MonthlyReportItem[];
    readonly comparisonData?: ComparisonData;
    readonly openDrawer: (title: string, data: Report[]) => void;
    readonly drilldownByBranchCategory: (branch: string, category: string, area?: string) => void;
}

export function OsTrendSection({
    filteredReports,
    caseCategoryData,
    categoryByAreaData,
    categoryByBranchData,
    areaSubCategoryData,
    terminalAreaCategoryData,
    apronAreaCategoryData,
    generalCategoryData,
    caseClassificationData = [],
    monthlyReportData,
    comparisonData,
    openDrawer,
    drilldownByBranchCategory,
}: OsTrendSectionProps) {
    const [timeframe, setTimeframe] = useState<'3m' | '6m' | '12m' | 'all' | 'custom'>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [focus, setFocus] = useState<'all' | 'Total' | 'Irregularity' | 'Complaint' | 'Compliment'>('all');
    const [branchFilter, setBranchFilter] = useState<string[]>([]);
    const [airlineFilter, setAirlineFilter] = useState<string[]>([]);
    const [areaFilter, setAreaFilter] = useState<string[]>([]);
    const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);

    const branchOptions = useMemo(() => {
        const set = new Set<string>();
        (filteredReports as Report[]).forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const code = (r as any).stations?.code || r.branch || r.reporting_branch || r.station_code;
            if (code) set.add(String(code).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [filteredReports]);

    const airlineOptions = useMemo(() => {
        const set = new Set<string>();
        (filteredReports as Report[]).forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = (r as any).airlines || (r as any).airline;
            if (a) set.add(String(a).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [filteredReports]);

    const areaOptions = useMemo(() => {
        const set = new Set<string>();
        (filteredReports as Report[]).forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = (r as any).area || (r as any).terminal_area_category || (r as any).apron_area_category || (r as any).general_category;
            if (!a) return;
            const v = String(a).toLowerCase();
            const canon = v.includes('terminal') ? 'Terminal Area' : v.includes('apron') ? 'Apron Area' : v.includes('general') ? 'General Area' : '';
            if (canon) set.add(canon);
        });
        return Array.from(set).sort();
    }, [filteredReports]);

    const filteredReportsForCalc = useMemo(() => {
        let base = filteredReports as Report[];
        if (branchFilter.length > 0) {
            base = base.filter(r => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const code = (r as any).stations?.code || r.branch || r.reporting_branch || r.station_code;
                return code ? branchFilter.includes(String(code)) : false;
            });
        }
        if (airlineFilter.length > 0) {
            base = base.filter(r => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const a = r.airlines || (r as any).airline;
                return a ? airlineFilter.includes(String(a)) : false;
            });
        }
        if (areaFilter.length > 0) {
            base = base.filter(r => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const a = (r as any).area || (r as any).terminal_area_category || (r as any).apron_area_category || (r as any).general_category;
                if (!a) return false;
                const v = String(a).toLowerCase();
                const canon = v.includes('terminal') ? 'Terminal Area' : v.includes('apron') ? 'Apron Area' : v.includes('general') ? 'General Area' : '';
                return areaFilter.includes(canon);
            });
        }
        if (timeframe !== 'all') {
            const monthsBack = timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12;
            const now = new Date();
            const cutoff = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1).getTime();
            if (timeframe === 'custom') {
                if (customFrom && customTo) {
                    const from = new Date(customFrom);
                    const to = new Date(customTo);
                    to.setHours(23,59,59,999);
                    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from.getTime() <= to.getTime()) {
                        base = base.filter(r => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const dateStr = (r as any).date_of_event || r.created_at;
                            if (!dateStr) return false;
                            let d: Date;
                            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                const [y, m, day] = dateStr.split('-').map(Number);
                                d = new Date(y, m - 1, day);
                            } else {
                                d = new Date(dateStr);
                            }
                            if (isNaN(d.getTime())) return false;
                            return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
                        });
                    }
                }
            } else {
                base = base.filter(r => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const dateStr = (r as any).date_of_event || r.created_at;
                    if (!dateStr) return false;
                    let d: Date;
                    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        const [y, m, day] = dateStr.split('-').map(Number);
                        d = new Date(y, m - 1, day);
                    } else {
                        d = new Date(dateStr);
                    }
                    if (isNaN(d.getTime())) return false;
                    const key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
                    return key >= cutoff;
                });
            }
        }
        return base;
    }, [filteredReports, branchFilter, airlineFilter, areaFilter, timeframe, customFrom, customTo]);

    const safeComparison = useMemo<ComparisonData | null>(() => {
        if (comparisonData) return comparisonData;
        try {
            const calc = calculateComparisonData(filteredReports as Report[]);
            return calc;
        } catch {
            return null;
        }
    }, [comparisonData, filteredReports]);

    const customComparison = useMemo(() => calculateComparisonData(filteredReportsForCalc), [filteredReportsForCalc]);

    const displayComparison = useMemo<ComparisonData | null>(() => {
        const base = (branchFilter.length || airlineFilter.length || areaFilter.length || timeframe !== 'all') ? customComparison : safeComparison;
        if (!base) return null;
        if (timeframe === 'all' || timeframe === 'custom') return base;
        const take = timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12;
        return { ...base, monthlyTrend: base.monthlyTrend.slice(-take) };
    }, [safeComparison, customComparison, timeframe, branchFilter.length, airlineFilter.length, areaFilter.length]);

    // Was previously derived from the unfiltered `monthlyReportData` prop, so
    // the Station/Airline/Area/Timeframe selectors above had no effect on
    // this chart. displayComparison is already the correctly filtered,
    // timeframe-scoped monthly series (see filteredReportsForCalc above); the
    // extra slice(-12) only matters for 'all'/'custom' timeframes, which
    // displayComparison otherwise leaves unbounded.
    const trendChartData = useMemo(
        () => (displayComparison?.monthlyTrend ?? []).slice(-12),
        [displayComparison],
    );

    const allSubCategories = useMemo(() => {
        const cats = new Set<string>();
        areaSubCategoryData.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key !== 'area' && typeof item[key] === 'number') cats.add(key);
            });
        });
        return Array.from(cats);
    }, [areaSubCategoryData]);

    const sortedCaseCategoryData = useMemo(() => {
        return [...caseCategoryData]
            .sort((a, b) => b.value - a.value)
            .map((item, index) => ({
                ...item,
                fill: COLORS[index % COLORS.length]
            }));
    }, [caseCategoryData]);

    const categoryByAreaWithColors = useMemo(() => {
        return categoryByAreaData.map((item, index) => ({
            ...item,
            fill: [
                REFERENCE_COLORS.irregularity,
                REFERENCE_COLORS.complaint,
                REFERENCE_COLORS.compliment
            ][index % 3]
        }));
    }, [categoryByAreaData]);

    const pivotTableData = useMemo(() => {
        const data = categoryByBranchData
            .map(item => ({
                branch: item.branch,
                irregularity: item.irregularity,
                complaint: item.complaint,
                compliment: item.compliment,
                total: item.irregularity + item.complaint + item.compliment
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);

        const grandTotal = data.reduce((acc, row) => ({
            irregularity: acc.irregularity + row.irregularity,
            complaint: acc.complaint + row.complaint,
            compliment: acc.compliment + row.compliment,
            total: acc.total + row.total
        }), { irregularity: 0, complaint: 0, compliment: 0, total: 0 });

        return { rows: data, grandTotal };
    }, [categoryByBranchData]);

    const maxValues = useMemo(() => {
        const { rows } = pivotTableData;
        return {
            irregularity: Math.max(...rows.map(r => r.irregularity), 1),
            complaint: Math.max(...rows.map(r => r.complaint), 1),
            compliment: Math.max(...rows.map(r => r.compliment), 1)
        };
    }, [pivotTableData]);

    const caseReportByAreaData = useMemo(() => {
        const branchMap: Record<string, Record<string, { terminal: number; apron: number; general: number }>> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalize = (v: any) => (typeof v === 'string' ? v.trim() : String(v || '')).trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getBranch = (r: any) => normalize(r.branch || r.stations?.code || r.station_code || 'Unknown') || 'Unknown';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getAirline = (r: any) => normalize(r.airlines || r.airline || 'Unknown') || 'Unknown';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getAreaKey = (r: any): 'terminal' | 'apron' | 'general' | null => {
            if (r?.terminal_area_category && String(r.terminal_area_category).trim()) return 'terminal';
            if (r?.apron_area_category && String(r.apron_area_category).trim()) return 'apron';
            if (r?.general_category && String(r.general_category).trim()) return 'general';
            const raw = normalize(r.area).toLowerCase();
            if (raw.includes('terminal')) return 'terminal';
            if (raw.includes('apron')) return 'apron';
            if (raw.includes('general')) return 'general';
            return null;
        };

        const targetReports = (filteredReports as Report[]).filter(r => r.source_sheet !== 'CGO');

        targetReports.forEach((r) => {
            const branch = getBranch(r);
            const airline = getAirline(r);
            const k = getAreaKey(r);
            if (!branchMap[branch]) branchMap[branch] = {};
            if (!branchMap[branch][airline]) branchMap[branch][airline] = { terminal: 0, apron: 0, general: 0 };
            if (k) branchMap[branch][airline][k]++;
        });

        return Object.entries(branchMap)
            .map(([branch, airlineData]) => {
                const airlines = Object.entries(airlineData)
                    .map(([name, counts]) => ({ name, ...counts, total: counts.terminal + counts.apron + counts.general }))
                    .sort((a, b) => b.total - a.total);
                return {
                    branch,
                    airlines,
                    totalTerminal: airlines.reduce((s, a) => s + a.terminal, 0),
                    totalApron: airlines.reduce((s, a) => s + a.apron, 0),
                    totalGeneral: airlines.reduce((s, a) => s + a.general, 0),
                    grandTotal: airlines.reduce((s, a) => s + a.total, 0),
                };
            })
            .sort((a, b) => b.grandTotal - a.grandTotal);
    }, [filteredReports]);

    return (
        <div className="space-y-6">
            <PresentationSlide
                title="MoM & YoY Comparison"
                subtitle="Month-over-Month and Year-over-Year"
                icon={TrendingUp}
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                            Filter Data Analysis
                        </h3>
                        <button
                            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--surface-3)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors text-xs font-bold text-[var(--text-secondary)]"
                        >
                            <span>{isFilterCollapsed ? 'Show Filter' : 'Hide Filter'}</span>
                            <motion.svg 
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                animate={{ rotate: isFilterCollapsed ? 0 : 180 }}
                                transition={{ duration: 0.2 }}
                            >
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </motion.svg>
                        </button>
                    </div>

                    <AnimatePresence>
                        {!isFilterCollapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                                exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                            >
                                <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-xl p-4 shadow-sm mb-6 relative before:absolute before:inset-0 before:bg-[url('/noise.svg')] before:opacity-[0.02] before:pointer-events-none">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end relative z-10">
                                        <div className="flex flex-col gap-2 lg:col-span-6">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Custom Range</label>
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                <div className="relative flex-1 min-w-[200px]">
                                                    <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="date"
                                                        value={customFrom}
                                                        onChange={(e)=>setCustomFrom(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-slate-200 bg-[#f8fafc] text-slate-700 outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 px-1">→</span>
                                                <div className="relative flex-1 min-w-[200px]">
                                                    <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="date"
                                                        value={customTo}
                                                        onChange={(e)=>setCustomTo(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-slate-200 bg-[#f8fafc] text-slate-700 outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                                                    />
                                                </div>
                                                <button
                                                    onClick={()=> setTimeframe('custom')}
                                                    className={`px-4 py-2.5 h-[42px] text-xs font-bold rounded-lg border whitespace-nowrap shrink-0 transition-colors ${timeframe==='custom' ? 'bg-[#10b981] text-white border-[#10b981] shadow-md shadow-emerald-500/20' : 'bg-[#f8fafc] text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                    disabled={!customFrom || !customTo}
                                                >
                                                    Terapkan
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 lg:col-span-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Timeframe</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(['3m','6m','12m','all'] as const).map(tf => (
                                                    <button
                                                        key={tf}
                                                        onClick={() => setTimeframe(tf)}
                                                        className={`px-3 py-2.5 text-xs font-bold rounded-lg border transition-colors ${timeframe===tf?'bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-md shadow-sky-500/20':'bg-[#f8fafc] text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                    >
                                                        {tf.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 lg:col-span-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Focus</label>
                                            <select
                                                value={focus}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                onChange={(e)=>setFocus(e.target.value as any)}
                                                className="px-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-slate-200 bg-[#f8fafc] text-slate-700 outline-none focus:border-[#3b82f6] transition-colors"
                                            >
                                                <option value="all">All Categories</option>
                                                <option value="Total">Total</option>
                                                <option value="Irregularity">Irregularity</option>
                                                <option value="Complaint">Complaint</option>
                                                <option value="Compliment">Compliment</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-2 lg:col-span-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Station</label>
                                            <select
                                                value={branchFilter[0] ?? 'all'}
                                                onChange={(e)=>setBranchFilter(e.target.value === 'all' ? [] : [e.target.value])}
                                                className="px-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-[#0ea5e9] bg-white text-slate-700 outline-none focus:border-[#0284c7] transition-colors ring-1 ring-sky-100"
                                            >
                                                <option value="all">All Stations</option>
                                                {branchOptions.map(b=>(
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-2 lg:col-span-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Airline</label>
                                            <select
                                                value={airlineFilter[0] ?? 'all'}
                                                onChange={(e)=>setAirlineFilter(e.target.value === 'all' ? [] : [e.target.value])}
                                                className="px-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-slate-200 bg-[#f8fafc] text-slate-700 outline-none focus:border-[#3b82f6] transition-colors"
                                            >
                                                <option value="all">All Airlines</option>
                                                {airlineOptions.map(a=>(
                                                    <option key={a} value={a}>{a}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-2 lg:col-span-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Area</label>
                                            <select
                                                value={areaFilter[0] ?? 'all'}
                                                onChange={(e)=>setAreaFilter(e.target.value === 'all' ? [] : [e.target.value])}
                                                className="px-3 py-2.5 h-[42px] text-xs font-bold rounded-lg border border-slate-200 bg-[#f8fafc] text-slate-700 outline-none focus:border-[#3b82f6] transition-colors"
                                            >
                                                <option value="all">All Areas</option>
                                                {areaOptions.map(a=>(
                                                    <option key={a} value={a}>{a}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {displayComparison && (
                        <ExecutiveSummaryTables data={displayComparison} className="mt-2" />
                    )}
                </div>
            </PresentationSlide>

            <PresentationSlide
                title="Tren & Distribusi Kategori Landside & Airside + CGO"
                subtitle="Volume laporan dan proporsi kategori"
                icon={PieChartIcon}
                hint="Klik segmen untuk filter berdasarkan kategori"
            >
                <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {}
                        <div
                            className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl relative")}
                            style={{
                                backgroundImage: `
                                    repeating-linear-gradient(
                                        2deg,
                                        transparent,
                                        transparent 20px,
                                        rgba(8, 173, 111, 0.02) 20px,
                                        rgba(8, 173, 111, 0.02) 21px
                                    )
                                `,
                            }}
                        >
                            <ChartTitle
                                title="Case Category Distribution"
                                subtitle="Landside, Airside & CGO"
                            />
                            <div className="h-[280px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPie>
                                        <Pie
                                          isAnimationActive={false}
                                            data={sortedCaseCategoryData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={100}
                                            fill={REFERENCE_COLORS.trend}
                                            dataKey="value"
                                            animationBegin={200}
                                            animationDuration={600}
                                        >
                                            {sortedCaseCategoryData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                        entry.name === 'Irregularity' ? REFERENCE_COLORS.irregularity :
                                                        entry.name === 'Complaint' ? REFERENCE_COLORS.complaint :
                                                        REFERENCE_COLORS.compliment
                                                    }
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip {...CHART_TOOLTIP_STYLE} />
                                        <Legend {...CHART_LEGEND_STYLE} />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">
                                Monthly Trend ({focus === 'all' ? 'Irregularity, Complaint, Compliment' : focus === 'Total' ? 'Total' : focus})
                            </h3>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={trendChartData}
                                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#dfe7dd" />
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        {(focus === 'all' || focus === 'Irregularity') && (
                                            <Line
                                                type="monotone"
                                                dataKey="irregularity"
                                                name="Irregularity"
                                                stroke={REFERENCE_COLORS.irregularity}
                                                strokeWidth={3}
                                                dot={{ fill: REFERENCE_COLORS.irregularity, strokeWidth: 0, r: 4 }}
                                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                                            />
                                        )}
                                        {(focus === 'all' || focus === 'Complaint') && (
                                            <Line
                                                type="monotone"
                                                dataKey="complaint"
                                                name="Complaint"
                                                stroke={REFERENCE_COLORS.complaint}
                                                strokeWidth={3}
                                                dot={{ fill: REFERENCE_COLORS.complaint, strokeWidth: 0, r: 4 }}
                                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                                            />
                                        )}
                                        {(focus === 'all' || focus === 'Compliment') && (
                                            <Line
                                                type="monotone"
                                                dataKey="compliment"
                                                name="Compliment"
                                                stroke={REFERENCE_COLORS.compliment}
                                                strokeWidth={3}
                                                dot={{ fill: REFERENCE_COLORS.compliment, strokeWidth: 0, r: 4 }}
                                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                                            />
                                        )}
                                        {focus === 'Total' && (
                                            <Line
                                                type="monotone"
                                                dataKey="total"
                                                name="Total"
                                                stroke={REFERENCE_COLORS.trend}
                                                strokeWidth={3}
                                                dot={{ fill: REFERENCE_COLORS.trend, strokeWidth: 0, r: 4 }}
                                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4">
                                {(focus === 'all' || focus === 'Irregularity') && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-lg shadow-emerald-500/20" style={{ background: REFERENCE_COLORS.irregularity }} />
                                        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Irregularity</span>
                                    </div>
                                )}
                                {(focus === 'all' || focus === 'Complaint') && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-lg shadow-blue-500/20" style={{ background: REFERENCE_COLORS.complaint }} />
                                        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Complaint</span>
                                    </div>
                                )}
                                {(focus === 'all' || focus === 'Compliment') && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-lg shadow-amber-500/20" style={{ background: REFERENCE_COLORS.compliment }} />
                                        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Compliment</span>
                                    </div>
                                )}
                                {focus === 'Total' && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-lg" style={{ background: REFERENCE_COLORS.trend }} />
                                        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Total</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Category by Area</h3>
                            <div className="h-[280px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPie>
                                        <Pie
                                          isAnimationActive={false}
                                            data={categoryByAreaWithColors}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={({ value }) => value}
                                            labelLine={false}
                                        >
                                            {categoryByAreaWithColors.map((entry, index) => (
                                                <Cell key={`cell-area-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-2">
                                {categoryByAreaWithColors.map((s) => (
                                    <div key={s.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm" style={{ background: s.fill }} />
                                        <span className="text-[11px] sm:text-xs font-medium text-[var(--text-secondary)]">{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">Case Category by Station</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Report Category / Record Count</p>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className={OS_TABLE_HEADER_CLASS}>
                                            <th className={cn("text-left py-2 px-2 font-black border", OS_BORDER_CLASS)}>Station</th>
                                            <th className={cn("text-center py-2 px-2 font-black border", OS_BORDER_CLASS)}>Irregularity</th>
                                            <th className={cn("text-center py-2 px-2 font-black border", OS_BORDER_CLASS)}>Complaint</th>
                                            <th className={cn("text-center py-2 px-2 font-black border", OS_BORDER_CLASS)}>Compliment</th>
                                            <th className={cn("text-center py-2 px-2 font-black border", OS_BORDER_CLASS)}>Grand total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pivotTableData.rows.map((row) => (
                                            <tr key={row.branch} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                <td className={cn("py-2 px-2 font-black text-gray-800 border-r border-l", OS_BORDER_CLASS)}>{row.branch}</td>
                                                <td 
                                                    className={cn("py-2 px-2 text-center font-bold border-r", OS_BORDER_CLASS)}
                                                    style={{
                                                        backgroundColor: `rgba(129, 199, 132, ${row.irregularity / maxValues.irregularity * 0.3 + 0.1})`
                                                    }}
                                                >
                                                    {row.irregularity || '-'}
                                                </td>
                                                <td 
                                                    className={cn("py-2 px-2 text-center font-bold border-r", OS_BORDER_CLASS)}
                                                    style={{
                                                        backgroundColor: `rgba(79, 195, 247, ${row.complaint / maxValues.complaint * 0.3 + 0.1})`
                                                    }}
                                                >
                                                    {row.complaint || '-'}
                                                </td>
                                                <td 
                                                    className={cn("py-2 px-2 text-center font-bold border-r", OS_BORDER_CLASS)}
                                                    style={{
                                                        backgroundColor: `rgba(220, 231, 117, ${row.compliment / maxValues.compliment * 0.3 + 0.1})`
                                                    }}
                                                >
                                                    {row.compliment || '-'}
                                                </td>
                                                <td className={cn("py-2 px-2 text-center font-black text-gray-800 bg-gray-50 border-r", OS_BORDER_CLASS)}>
                                                    {row.total}
                                                </td>
                                            </tr>
                                        ))}
                                        {}
                                        <tr className="bg-gray-100 font-black">
                                            <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                {pivotTableData.grandTotal.irregularity}
                                            </td>
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                {pivotTableData.grandTotal.complaint}
                                            </td>
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                {pivotTableData.grandTotal.compliment}
                                            </td>
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                {pivotTableData.grandTotal.total}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">Area and Sub-Category Breakdown</h3>
                                    <p className="text-[10px] font-medium text-[var(--text-muted)]">Detail kategori per wilayah</p>
                                </div>
                            </div>
                            <div className="h-[320px] sm:h-[360px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        data={areaSubCategoryData as any[]}
                                        margin={{ top: 25, right: 10, left: -20, bottom: 5 }}
                                        barCategoryGap="30%"
                                    >
                                         <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#dfe7dd" />
                                         <XAxis dataKey="area" tick={<WrappedXAxisTick />} axisLine={false} tickLine={false} height={80} interval={0} />
                                         <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                         <Tooltip content={<CustomTooltip />} />
                                         {allSubCategories.map((cat, idx) => (
                                             <Bar 
                                                 key={cat} 
                                                 dataKey={cat} 
                                                 name={cat} 
                                                 fill={COLORS[idx % COLORS.length]} 
                                                 radius={[4, 4, 0, 0]}
                                                 maxBarSize={16}
                                             >
                                                 <LabelList
                                                     dataKey={cat}
                                                     position="top"
                                                     fill="var(--text-muted)"
                                                     fontSize={9}
                                                     fontWeight={700}
                                                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                     formatter={(v: any) => v > 0 ? v : ''}
                                                 />
                                             </Bar>
                                         ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3 mt-4">
                                {allSubCategories.map((cat, idx) => (
                                    <div key={cat} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm" style={{ background: COLORS[idx % COLORS.length] }} />
                                        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{cat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-6 opacity-70">Case Classification</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Classification</span>
                                <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total</span>
                            </div>
                            <CategoryBarList data={caseClassificationData} color="#0f86c1" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1 opacity-70">Case Report by Area</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Area Report / Station by Airlines</p>
                            {caseReportByAreaData.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No data</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="max-h-[188px] overflow-y-auto">
                                        <table className="w-full text-xs min-w-[320px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className={OS_TABLE_HEADER_CLASS}>
                                                    <th className={cn("text-left py-2 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Station</th>
                                                    <th className={cn("text-left py-2 px-3 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Airlines</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Terminal<br/>Area</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Apron<br/>Area</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>General</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Grand<br/>total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const allRows = caseReportByAreaData.flatMap(b => b.airlines);
                                                    const maxT = Math.max(...allRows.map(a => a.terminal), 1);
                                                    const maxA = Math.max(...allRows.map(a => a.apron), 1);
                                                    const maxG = Math.max(...allRows.map(a => a.general), 1);
                                                    const maxTotal = Math.max(...allRows.map(a => a.total), 1);
                                                    return caseReportByAreaData.flatMap((branchRow) =>
                                                        branchRow.airlines.map((airline, aIdx) => {
                                                            const tC = heatColor(airline.terminal, maxT);
                                                            const aC = heatColor(airline.apron, maxA);
                                                            const gC = heatColor(airline.general, maxG);
                                                            const totC = heatColor(airline.total, maxTotal);
                                                            return (
                                                                <tr
                                                                    key={`${branchRow.branch}-${airline.name}`}
                                                                    className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS, aIdx === 0 ? 'border-t border-t-gray-300' : '')}
                                                                >
                                                                    <td className={cn("py-1.5 px-1.5 font-bold text-gray-800 border-r whitespace-nowrap border-l", OS_BORDER_CLASS)}>
                                                                        {aIdx === 0 ? branchRow.branch : ''}
                                                                    </td>
                                                                    <td className={cn("py-1.5 px-1.5 text-gray-700 whitespace-nowrap border-r", OS_BORDER_CLASS)}>{airline.name}</td>
                                                                    <td className={cn("py-1.5 px-1.5 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: tC.bg, color: tC.fg }}>
                                                                        {airline.terminal || '-'}
                                                                    </td>
                                                                    <td className={cn("py-1.5 px-1.5 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: aC.bg, color: aC.fg }}>
                                                                        {airline.apron || '-'}
                                                                    </td>
                                                                    <td className={cn("py-1.5 px-1.5 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: gC.bg, color: gC.fg }}>
                                                                        {airline.general || '-'}
                                                                    </td>
                                                                    <td className={cn("py-1.5 px-1.5 text-center font-bold border-r", OS_BORDER_CLASS)} style={{ backgroundColor: totC.bg, color: totC.fg }}>
                                                                        {airline.total}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                    <table className="w-full text-xs min-w-[320px] border-t-2 border-gray-300">
                                        <tbody>
                                            <tr className="bg-gray-100 font-bold">
                                                <td className={cn("py-1.5 px-1.5 text-gray-800 border", OS_BORDER_CLASS)} colSpan={2}>Grand total</td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {caseReportByAreaData.reduce((s, b) => s + b.totalTerminal, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {caseReportByAreaData.reduce((s, b) => s + b.totalApron, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {caseReportByAreaData.reduce((s, b) => s + b.totalGeneral, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {caseReportByAreaData.reduce((s, b) => s + b.grandTotal, 0)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6 opacity-70">Terminal Area Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={terminalAreaCategoryData} color="#08ad6f" />
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6 opacity-70">Apron Area Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={apronAreaCategoryData} color="#0f86c1" />
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6 opacity-70">General Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={generalCategoryData} color="#e49418" />
                        </div>
                    </div>
                </div>
            </PresentationSlide>
        </div>
    );
}
