
'use client';

import { useMemo } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar, Cell, LabelList
} from 'recharts';
import { BarChart3, MapPin } from 'lucide-react';
import type { Report } from '@/types';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { cn } from '@/lib/utils';
import {
    REFERENCE_COLORS,
    CHART_PALETTE,
    ResponsiveContainer,
    WrappedYAxisTick,
    CustomTooltip,
    heatColor,
    DetailReportTable,
    OS_CARD_CLASS,
    OS_TABLE_HEADER_CLASS,
    OS_BORDER_CLASS,
} from './os-chart-utils';
import {
    type CaseReportByAreaAirlineItem,
    type CaseReportByAreaBranchItem,
} from './os-chart-types';

const CategoryBarList = ({ data, color = '#08ad6f' }: { data: readonly { name: string; value: number }[]; color?: string }) => {
    const maxValue = data[0]?.value || 1;
    return (
        <div className="space-y-2">
            {data.slice(0, 5).map((item) => (
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
    );
};

interface OsCgoSectionProps {
    readonly filteredReports: readonly Report[];
    readonly openDrawer: (title: string, data: Report[]) => void;
}

export function OsCgoSection({
    filteredReports,
    openDrawer,
}: OsCgoSectionProps) {

    const cgoReports = useMemo(() =>
        filteredReports.filter(r => r.source_sheet === 'CGO'),
    [filteredReports]);

    const cgoCaseCategoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        cgoReports.forEach(r => {
            const cat = r.category || r.main_category || 'Unknown';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        const colorMap: Record<string, string> = {
            Complaint: '#0f86c1',
            Irregularity: '#08ad6f',
            Compliment: '#e49418',
        };
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value, color: colorMap[name] || '#8a8a8a' }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    const cgoBranchData = useMemo(() => {
        const counts: Record<string, number> = {};
        cgoReports.forEach(r => {
            const branch = r.stations?.code || r.branch || r.station_code || 'Unknown';
            counts[branch] = (counts[branch] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([branch, count]) => ({ branch, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [cgoReports]);

    const cgoAirlinesData = useMemo(() => {
        const counts: Record<string, number> = {};
        cgoReports.forEach(r => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const airline = (r.airlines || (r as any).airline || 'Unknown').trim() || 'Unknown';
            counts[airline] = (counts[airline] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([airline, count]) => ({ airline, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [cgoReports]);

    const cgoMonthlyData = useMemo(() => {
        const counts: Record<string, { count: number; date: Date }> = {};
        cgoReports.forEach(r => {
            const raw = r.date_of_event || r.event_date || r.created_at;
            if (!raw) return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!counts[key]) counts[key] = { count: 0, date: d };
            counts[key].count++;
        });
        return Object.entries(counts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([, v]) => ({
                month: v.date.toLocaleString('en-US', { month: 'long' }),
                count: v.count,
            }));
    }, [cgoReports]);

    const cgoCategoryByAreaData = useMemo(() => {
        const counts: Record<string, number> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deriveArea = (r: any): 'Terminal Area' | 'Apron Area' | 'General' | null => {
            if (r?.terminal_area_category && String(r.terminal_area_category).trim()) return 'Terminal Area';
            if (r?.apron_area_category && String(r.apron_area_category).trim()) return 'Apron Area';
            if (r?.general_category && String(r.general_category).trim()) return 'General';
            const raw = (r.area || '').toString().trim().toLowerCase();
            if (raw.includes('terminal')) return 'Terminal Area';
            if (raw.includes('apron')) return 'Apron Area';
            if (raw.includes('general')) return 'General';
            return null;
        };
        cgoReports.forEach(r => {
            const area = deriveArea(r);
            if (area) counts[area] = (counts[area] || 0) + 1;
        });
        const colorMap: Record<string, string> = {
            'Apron Area': '#0f86c1',
            'Terminal Area': '#08ad6f',
            'General': '#e49418',
        };
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value, color: colorMap[name] || '#8a8a8a' }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    const cgoPivotByBranch = useMemo(() => {
        const map: Record<string, { complaint: number; irregularity: number; compliment: number }> = {};
        cgoReports.forEach(r => {
            const branch = r.stations?.code || r.branch || r.station_code || 'Unknown';
            if (!map[branch]) map[branch] = { complaint: 0, irregularity: 0, compliment: 0 };
            const cat = (r.category || r.main_category || '').toLowerCase();
            if (cat === 'complaint') map[branch].complaint++;
            else if (cat === 'irregularity') map[branch].irregularity++;
            else if (cat === 'compliment') map[branch].compliment++;
        });
        return Object.entries(map)
            .map(([branch, d]) => ({ branch, ...d, total: d.complaint + d.irregularity + d.compliment }))
            .sort((a, b) => b.total - a.total);
    }, [cgoReports]);

    const cgoPivotByAirlines = useMemo(() => {
        const map: Record<string, { complaint: number; irregularity: number; compliment: number }> = {};
        cgoReports.forEach(r => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const airline = ((r.airlines || (r as any).airline || 'Unknown') as string).trim() || 'Unknown';
            if (!map[airline]) map[airline] = { complaint: 0, irregularity: 0, compliment: 0 };
            const cat = (r.category || r.main_category || '').toLowerCase();
            if (cat === 'complaint') map[airline].complaint++;
            else if (cat === 'irregularity') map[airline].irregularity++;
            else if (cat === 'compliment') map[airline].compliment++;
        });
        return Object.entries(map)
            .map(([airline, d]) => ({ airline, ...d, total: d.complaint + d.irregularity + d.compliment }))
            .sort((a, b) => b.total - a.total);
    }, [cgoReports]);

    const cgoCaseReportByArea = useMemo((): CaseReportByAreaBranchItem[] => {
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
        cgoReports.forEach((r) => {
            const branch = getBranch(r);
            const airline = getAirline(r);
            const k = getAreaKey(r);
            if (!branchMap[branch]) branchMap[branch] = {};
            if (!branchMap[branch][airline]) branchMap[branch][airline] = { terminal: 0, apron: 0, general: 0 };
            if (k) branchMap[branch][airline][k]++;
        });
        return Object.entries(branchMap)
            .map(([branch, airlineData]) => {
                const airlines: CaseReportByAreaAirlineItem[] = Object.entries(airlineData)
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
    }, [cgoReports]);

    const cgoTerminalAreaCategoryData = useMemo(() => {
        const map: Record<string, number> = {};
        cgoReports.forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = ((r as any).terminal_area_category || '').trim();
            if (cat) map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    const cgoApronAreaCategoryData = useMemo(() => {
        const map: Record<string, number> = {};
        cgoReports.forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = ((r as any).apron_area_category || '').trim();
            if (cat) map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    const cgoGeneralCategoryData = useMemo(() => {
        const map: Record<string, number> = {};
        cgoReports.forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cat = ((r as any).general_category || '').trim();
            if (cat) map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    const cgoHubData = useMemo(() => {
        const map: Record<string, number> = {};
        cgoReports.forEach((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hub = ((r as any).hub || '').trim();
            if (hub) map[hub] = (map[hub] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [cgoReports]);

    if (cgoReports.length === 0) {
        return (
            <div className={cn("flex items-center justify-center py-16 text-gray-400 text-sm", OS_CARD_CLASS)}>
                No CGO data for this period
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PresentationSlide
                title="CGO - Case Category"
                subtitle="Reports from CGO Sheet"
                icon={BarChart3}
            >
                <div className="grid grid-cols-1 gap-4">
                    {}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                          <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Report by Case Category</h3>
                            <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                <div style={{ height: Math.max(200, cgoCaseCategoryData.length * 50) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={cgoCaseCategoryData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 40, left: 40, bottom: 4 }}
                                            barCategoryGap="30%"
                                        >
                                            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis 
                                                type="category" 
                                                dataKey="name" 
                                                tick={<WrappedYAxisTick />} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                width={110} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                                {cgoCaseCategoryData.map((entry, idx) => (
                                                    <Cell key={`cgo-cat-${idx}`} fill={entry.color} />
                                                ))}
                                                <LabelList dataKey="value" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                         <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Station Reporting</h3>
                            <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                <div style={{ height: Math.max(200, cgoBranchData.length * 50) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={cgoBranchData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 40, left: 20, bottom: 4 }}
                                            barCategoryGap="30%"
                                        >
                                            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis 
                                                type="category" 
                                                dataKey="branch" 
                                                tick={<WrappedYAxisTick />} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                width={100} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" name="Report" fill={REFERENCE_COLORS.irregularity} radius={[0, 4, 4, 0]} maxBarSize={20}>
                                                <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                         <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Airlines Report</h3>
                            <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                <div style={{ height: Math.max(200, cgoAirlinesData.length * 50) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={cgoAirlinesData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 40, left: 20, bottom: 4 }}
                                            barCategoryGap="30%"
                                        >
                                            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis 
                                                type="category" 
                                                dataKey="airline" 
                                                tick={<WrappedYAxisTick />} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                width={100} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" name="Report" fill={REFERENCE_COLORS.complaint} radius={[0, 4, 4, 0]} maxBarSize={16}>
                                                <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                         <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Monthly Report</h3>
                            <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                <div style={{ height: Math.max(200, cgoMonthlyData.length * 50) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={cgoMonthlyData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 40, left: 20, bottom: 4 }}
                                            barCategoryGap="30%"
                                        >
                                            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis 
                                                type="category" 
                                                dataKey="month" 
                                                tick={<WrappedYAxisTick />} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                width={100} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" name="Report" fill={CHART_PALETTE[2]} radius={[0, 4, 4, 0]} maxBarSize={16}>
                                                <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                                    <div className={cn(OS_CARD_CLASS, "p-5 flex flex-col")}>
                            <h3 className="font-semibold text-[13px] tracking-tight text-slate-900 mb-3">Category by Area</h3>
                            <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                <div style={{ height: Math.max(220, cgoCategoryByAreaData.length * 50) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={cgoCategoryByAreaData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 40, left: 40, bottom: 4 }}
                                            barCategoryGap="30%"
                                        >
                                            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis 
                                                type="category" 
                                                dataKey="name" 
                                                tick={<WrappedYAxisTick />} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                width={110} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                                {cgoCategoryByAreaData.map((entry, idx) => (
                                                    <Cell key={`cgo-area-${idx}`} fill={entry.color} />
                                                ))}
                                                <LabelList dataKey="value" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">Case Category by Station</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Report Category / Record Count</p>
                            {(() => {
                                const maxC = Math.max(...cgoPivotByBranch.map(r => r.complaint), 1);
                                const maxI = Math.max(...cgoPivotByBranch.map(r => r.irregularity), 1);
                                const maxCo = Math.max(...cgoPivotByBranch.map(r => r.compliment), 1);
                                const maxTot = Math.max(...cgoPivotByBranch.map(r => r.total), 1);
                                return (
                                    <div className="overflow-x-auto">
                                        <div className="max-h-[188px] overflow-y-auto">
                                            <table className="w-full text-xs min-w-[320px] border-collapse">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className={OS_TABLE_HEADER_CLASS}>
                                                        <th className={cn("text-left py-2 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Reporting Br...</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Complaint</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Irregularity</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Compliment</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Grand total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cgoPivotByBranch.map(row => {
                                                        const cC = heatColor(row.complaint, maxC);
                                                        const iC = heatColor(row.irregularity, maxI);
                                                        const coC = heatColor(row.compliment, maxCo);
                                                        const tC = heatColor(row.total, maxTot);
                                                        return (
                                                            <tr key={row.branch} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                                <td className={cn("py-1.5 px-2 font-medium text-gray-800 border-l border-r", OS_BORDER_CLASS)}>{row.branch}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: cC.bg, color: cC.fg }}>{row.complaint || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: iC.bg, color: iC.fg }}>{row.irregularity || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: coC.bg, color: coC.fg }}>{row.compliment || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-bold border-r", OS_BORDER_CLASS)} style={{ backgroundColor: tC.bg, color: tC.fg }}>{row.total}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <table className="w-full text-xs min-w-[320px] border-t-2 border-gray-300">
                                            <tbody>
                                                <tr className="bg-gray-100 font-bold">
                                                    <td className={cn("py-1.5 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByBranch.reduce((s, r) => s + r.complaint, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByBranch.reduce((s, r) => s + r.irregularity, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByBranch.reduce((s, r) => s + r.compliment, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByBranch.reduce((s, r) => s + r.total, 0)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">Case Category by Airlines</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Report Category / Record Count</p>
                            {(() => {
                                const maxC = Math.max(...cgoPivotByAirlines.map(r => r.complaint), 1);
                                const maxI = Math.max(...cgoPivotByAirlines.map(r => r.irregularity), 1);
                                const maxCo = Math.max(...cgoPivotByAirlines.map(r => r.compliment), 1);
                                const maxTot = Math.max(...cgoPivotByAirlines.map(r => r.total), 1);
                                return (
                                    <div className="overflow-x-auto">
                                        <div className="max-h-[188px] overflow-y-auto">
                                            <table className="w-full text-xs min-w-[340px] border-collapse">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className={OS_TABLE_HEADER_CLASS}>
                                                        <th className={cn("text-left py-2 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Airlines</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Complaint</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Irregularity</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Compliment</th>
                                                        <th className={cn("text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] border", OS_BORDER_CLASS)}>Grand total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cgoPivotByAirlines.map(row => {
                                                        const cC = heatColor(row.complaint, maxC);
                                                        const iC = heatColor(row.irregularity, maxI);
                                                        const coC = heatColor(row.compliment, maxCo);
                                                        const tC = heatColor(row.total, maxTot);
                                                        return (
                                                            <tr key={row.airline} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                                <td className={cn("py-1.5 px-2 font-medium text-gray-800 border-l border-r whitespace-nowrap", OS_BORDER_CLASS)}>{row.airline}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: cC.bg, color: cC.fg }}>{row.complaint || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: iC.bg, color: iC.fg }}>{row.irregularity || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-medium border-r", OS_BORDER_CLASS)} style={{ backgroundColor: coC.bg, color: coC.fg }}>{row.compliment || '-'}</td>
                                                                <td className={cn("py-1.5 px-2 text-center font-bold border-r", OS_BORDER_CLASS)} style={{ backgroundColor: tC.bg, color: tC.fg }}>{row.total}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <table className="w-full text-xs min-w-[340px] border-t-2 border-gray-300">
                                            <tbody>
                                                <tr className="bg-gray-100 font-bold">
                                                    <td className={cn("py-1.5 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByAirlines.reduce((s, r) => s + r.complaint, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByAirlines.reduce((s, r) => s + r.irregularity, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByAirlines.reduce((s, r) => s + r.compliment, 0)}</td>
                                                    <td className={cn("py-1.5 px-2 text-center text-gray-800 border", OS_BORDER_CLASS)}>{cgoPivotByAirlines.reduce((s, r) => s + r.total, 0)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </PresentationSlide>

            {}
            <PresentationSlide
                title="CGO - Detail Report"
                subtitle="CGO area and category report detail"
                icon={MapPin}
            >
                <div className="grid grid-cols-1 gap-4">
                    {}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">Case Report by Area</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Area Report / Station by Airlines</p>
                            {cgoCaseReportByArea.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No data</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="max-h-[188px] overflow-y-auto">
                                        <table className="w-full text-xs min-w-[320px] border-collapse">
                                            <thead className="sticky top-0 z-10">
                                                <tr className={OS_TABLE_HEADER_CLASS}>
                                                    <th className={cn("text-left py-2 px-2 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>Station</th>
                                                    <th className={cn("text-left py-2 px-2 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>Airlines</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>Terminal<br/>Area</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>Apron<br/>Area</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>General</th>
                                                    <th className={cn("text-center py-2 px-1 font-black uppercase tracking-widest text-[8px] border", OS_BORDER_CLASS)}>Grand<br/>total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const allRows = cgoCaseReportByArea.flatMap(b => b.airlines);
                                                    const maxT = Math.max(...allRows.map(a => a.terminal), 1);
                                                    const maxA = Math.max(...allRows.map(a => a.apron), 1);
                                                    const maxG = Math.max(...allRows.map(a => a.general), 1);
                                                    const maxTotal = Math.max(...allRows.map(a => a.total), 1);
                                                    return cgoCaseReportByArea.flatMap((branchRow) =>
                                                        branchRow.airlines.map((airline, aIdx) => {
                                                            const tC = heatColor(airline.terminal, maxT);
                                                            const aC = heatColor(airline.apron, maxA);
                                                            const gC = heatColor(airline.general, maxG);
                                                            const totC = heatColor(airline.total, maxTotal);

                                                            const handleCellClick = (area: string) => {
                                                                const branch = branchRow.branch;
                                                                const airlineName = airline.name;
                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                                    const rBranch = r.stations?.code || r.branch || r.reporting_branch || '';
                                                                    const rAirline = r.airlines || r.airline || '';
                                                                    const rArea = r.area || '';
                                                                    if (area === 'all') return rBranch === branch && rAirline === airlineName;
                                                                    return rBranch === branch && rAirline === airlineName && rArea === area;
                                                                });
                                                                openDrawer(
                                                                    area === 'all'
                                                                        ? `${branch} — ${airlineName}`
                                                                        : `${branch} — ${airlineName} (${area})`,
                                                                    filtered
                                                                );
                                                            };

                                                            return (
                                                                <tr
                                                                    key={`${branchRow.branch}-${airline.name}`}
                                                                    className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS, aIdx === 0 ? 'border-t border-t-gray-300' : '')}
                                                                >
                                                                    <td className={cn("py-1.5 px-1.5 font-bold text-gray-800 border-r whitespace-nowrap border-l", OS_BORDER_CLASS)}>
                                                                        {aIdx === 0 ? branchRow.branch : ''}
                                                                    </td>
                                                                    <td className={cn("py-1.5 px-1.5 text-gray-700 whitespace-nowrap border-r", OS_BORDER_CLASS)}>{airline.name}</td>
                                                                    <td 
                                                                        className={cn("py-1.5 px-1.5 text-center font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border-r", OS_BORDER_CLASS)} 
                                                                        style={{ backgroundColor: tC.bg, color: tC.fg }}
                                                                        onClick={() => handleCellClick('Terminal Area')}
                                                                    >
                                                                        {airline.terminal || '-'}
                                                                    </td>
                                                                    <td 
                                                                        className={cn("py-1.5 px-1.5 text-center font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border-r", OS_BORDER_CLASS)} 
                                                                        style={{ backgroundColor: aC.bg, color: aC.fg }}
                                                                        onClick={() => handleCellClick('Apron Area')}
                                                                    >
                                                                        {airline.apron || '-'}
                                                                    </td>
                                                                    <td 
                                                                        className={cn("py-1.5 px-1.5 text-center font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border-r", OS_BORDER_CLASS)} 
                                                                        style={{ backgroundColor: gC.bg, color: gC.fg }}
                                                                        onClick={() => handleCellClick('General')}
                                                                    >
                                                                        {airline.general || '-'}
                                                                    </td>
                                                                    <td 
                                                                        className={cn("py-1.5 px-1.5 text-center font-bold cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border-r", OS_BORDER_CLASS)} 
                                                                        style={{ backgroundColor: totC.bg, color: totC.fg }}
                                                                        onClick={() => handleCellClick('all')}
                                                                    >
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
                                    {}
                                    <table className="w-full text-xs min-w-[320px] border-t-2 border-gray-300">
                                        <tbody>
                                            <tr className="bg-gray-100 font-bold">
                                                <td className={cn("py-1.5 px-1.5 text-gray-800 border", OS_BORDER_CLASS)} colSpan={2}>Grand total</td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {cgoCaseReportByArea.reduce((s, b) => s + b.totalTerminal, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {cgoCaseReportByArea.reduce((s, b) => s + b.totalApron, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {cgoCaseReportByArea.reduce((s, b) => s + b.totalGeneral, 0)}
                                                </td>
                                                <td className={cn("py-1.5 px-1.5 text-center text-gray-800 border", OS_BORDER_CLASS)}>
                                                    {cgoCaseReportByArea.reduce((s, b) => s + b.grandTotal, 0)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Terminal Area Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={cgoTerminalAreaCategoryData} color="#08ad6f" />
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">Apron Area Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={cgoApronAreaCategoryData} color="#0f86c1" />
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-6 opacity-70">General Category</h3>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Category</span>
                                <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">Total</span>
                            </div>
                            <CategoryBarList data={cgoGeneralCategoryData} color="#e49418" />
                        </div>
                    </div>

                    {}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                         <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col")}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">HUB Report</h3>
                            <p className="text-[10px] font-medium text-[var(--text-muted)] mb-6">Report distribution by HUB</p>
                            {cgoHubData.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No hub data</p>
                            ) : (
                                <div className="h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                                    <div style={{ height: Math.max(220, cgoHubData.length * 50) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={cgoHubData}
                                                layout="vertical"
                                                margin={{ top: 4, right: 40, left: 40, bottom: 4 }}
                                                barCategoryGap="30%"
                                            >
                                                <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="#dfe7dd" />
                                                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                                <YAxis 
                                                    type="category" 
                                                    dataKey="name" 
                                                    tick={<WrappedYAxisTick />} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    width={110} 
                                                    interval={0}
                                                />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="value" name="Count" fill="#007073" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                                    <LabelList dataKey="value" position="right" style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "flex h-[34rem] min-h-0 flex-col p-6 group transition-all duration-500 hover:shadow-2xl")}>
                            <h3 className="shrink-0 text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-1 opacity-70">Detail Report CGO</h3>
                            <p className="shrink-0 text-[10px] font-medium text-[var(--text-muted)] mb-4">CGO report data sorted by date</p>
                            <DetailReportTable
                                data={[...cgoReports].sort((a, b) => {
                                    const dA = a.date_of_event ? new Date(a.date_of_event).getTime() : 0;
                                    const dB = b.date_of_event ? new Date(b.date_of_event).getTime() : 0;
                                    return dB - dA;
                                })}
                            />
                        </div>
                    </div>
                </div>
            </PresentationSlide>
        </div>
    );
}
