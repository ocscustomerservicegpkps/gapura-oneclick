
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useCallback } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    BarChart, Bar, LabelList
} from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';
import type { Report } from '@/types';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { cn } from '@/lib/utils';
import {
    REFERENCE_COLORS,
    CHART_PALETTE,
    ResponsiveContainer,
    WrappedXAxisTick,
    CustomTooltip,
    heatColor,
    OS_CARD_CLASS,
    OS_TABLE_HEADER_CLASS,
    OS_BORDER_CLASS,
} from './os-chart-utils';
import {
    type BranchReportItem,
    type CategoryByBranchItem,
    type CategoryByAirlinesItem,
} from './os-chart-types';

interface OsStationAirlineSectionProps {
    readonly filteredReports: readonly Report[];
    readonly branchReportData: readonly BranchReportItem[];
    readonly categoryByBranchData: readonly CategoryByBranchItem[];
    readonly categoryByAirlinesData: readonly CategoryByAirlinesItem[];
    readonly openDrawer: (title: string, data: Report[]) => void;
}

export function OsStationAirlineSection({
    filteredReports,
    branchReportData,
    categoryByBranchData,
    categoryByAirlinesData,
    openDrawer,
}: OsStationAirlineSectionProps) {

    const drilldownByBranchCategory = (branch: string, category: string, area?: string) => {
         
        const filtered = (filteredReports as Report[]).filter((r: any) => {
            const code = r.stations?.code || r.branch || r.reporting_branch || '';
            const cat = (r.terminal_area_category || r.apron_area_category || r.general_category || '').trim();
            if (code !== branch) return false;
            if (area) {
                const rArea = (r.area || '').toLowerCase();
                if (area === 'Terminal Area' && rArea !== 'terminal area') return false;
                if (area === 'Apron Area' && rArea !== 'apron area') return false;
                if (area === 'General' && rArea !== 'general') return false;
            }
            if (category && cat !== category) return false;
            return true;
        });
        const label = area
            ? `${branch} — ${category} (${area})`
            : `${branch} — ${category}`;
        openDrawer(label, filtered);
    };

    const drilldownByAirlineCategory = (airline: string, category: string, area?: string) => {
         
        const filtered = (filteredReports as Report[]).filter((r: any) => {
            const rAirline = r.airlines || r.airline || '';
            const cat = (r.terminal_area_category || r.apron_area_category || r.general_category || '').trim();
            if (rAirline !== airline) return false;
            if (area) {
                const rArea = (r.area || '').toLowerCase();
                if (area === 'Terminal Area' && rArea !== 'terminal area') return false;
                if (area === 'Apron Area' && rArea !== 'apron area') return false;
                if (area === 'General' && rArea !== 'general') return false;
            }
            if (category && cat !== category) return false;
            return true;
        });
        const label = area
            ? `${airline} — ${category} (${area})`
            : `${airline} — ${category}`;
        openDrawer(label, filtered);
    };

    const computePivotData = useCallback((categoryField: string) => {

        const categoryBranchCounts: Record<string, Record<string, number>> = {};
        const branchTotals: Record<string, number> = {};
         
        const areaGuard = (report: any) => {
            const area = String(report.area || '').toLowerCase();
             
            if (categoryField === 'terminal_area_category') return area.includes('terminal') || !!(report as any).terminal_area_category;
             
            if (categoryField === 'apron_area_category') return area.includes('apron') || !!(report as any).apron_area_category;
             
            if (categoryField === 'general_category') return area.includes('general') || !!(report as any).general_category;
            return true;
        };
        filteredReports.forEach(report => {
            if (!areaGuard(report)) return;
             
            const raw = (report as any)[categoryField];
            if (!raw || String(raw).trim() === '') return;
            const category = String(raw).trim();
            const branch = report.stations?.code || report.branch || report.station_code || 'Unknown';
            if (!categoryBranchCounts[category]) {
                categoryBranchCounts[category] = {};
            }
            if (!categoryBranchCounts[category][branch]) {
                categoryBranchCounts[category][branch] = 0;
            }
            categoryBranchCounts[category][branch]++;
            branchTotals[branch] = (branchTotals[branch] || 0) + 1;
        });

        const topBranches = Object.entries(branchTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([branch]) => branch);

        const categoryTotals = Object.entries(categoryBranchCounts).map(([category, branches]) => ({
            category,
            total: Object.values(branches).reduce((sum, count) => sum + count, 0),
            branches
        })).sort((a, b) => b.total - a.total).slice(0, 30);

        const grandTotal: Record<string, number> = { total: 0 };
        topBranches.forEach(branch => {
            grandTotal[branch] = 0;
        });

        categoryTotals.forEach(cat => {
            grandTotal.total += cat.total;
            topBranches.forEach(branch => {
                grandTotal[branch] += cat.branches[branch] || 0;
            });
        });

        const maxValues: Record<string, number> = {};
        topBranches.forEach(branch => {
            maxValues[branch] = Math.max(...categoryTotals.map(cat => cat.branches[branch] || 0), 1);
        });

        return {
            rows: categoryTotals,
            branches: topBranches,
            grandTotal,
            maxValues
        };
    }, [filteredReports]);

    const terminalAreaByBranch = useMemo(() => {
        return computePivotData('terminal_area_category');
    }, [computePivotData]);

    const apronAreaByBranch = useMemo(() => {
        return computePivotData('apron_area_category');
    }, [computePivotData]);

    const generalCategoryByBranch = useMemo(() => {
        return computePivotData('general_category');
    }, [computePivotData]);

    const computeAirlinePivotData = useCallback((categoryField: string) => {

        const categoryAirlineCounts: Record<string, Record<string, number>> = {};
        const airlineTotals: Record<string, number> = {};
         
        const areaGuard = (report: any) => {
            const area = String(report.area || '').toLowerCase();
             
            if (categoryField === 'terminal_area_category') return area.includes('terminal') || !!(report as any).terminal_area_category;
             
            if (categoryField === 'apron_area_category') return area.includes('apron') || !!(report as any).apron_area_category;
             
            if (categoryField === 'general_category') return area.includes('general') || !!(report as any).general_category;
            return true;
        };
        filteredReports.forEach(report => {
            if (!areaGuard(report)) return;
             
            const raw = (report as any)[categoryField];
            if (!raw || String(raw).trim() === '') return;
            const category = String(raw).trim();
            const airline = (report.airline || report.airlines || 'Unknown').toString().trim() || 'Unknown';
            if (!categoryAirlineCounts[category]) {
                categoryAirlineCounts[category] = {};
            }
            if (!categoryAirlineCounts[category][airline]) {
                categoryAirlineCounts[category][airline] = 0;
            }
            categoryAirlineCounts[category][airline]++;
            airlineTotals[airline] = (airlineTotals[airline] || 0) + 1;
        });

        const allAirlines = Object.entries(airlineTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([airline]) => airline);

        const categoryTotals = Object.entries(categoryAirlineCounts).map(([category, airlines]) => ({
            category,
            total: Object.values(airlines).reduce((sum, count) => sum + count, 0),
            airlines
        })).sort((a, b) => b.total - a.total);

        const grandTotal: Record<string, number> = { total: 0 };
        allAirlines.forEach(airline => {
            grandTotal[airline] = 0;
        });

        categoryTotals.forEach(cat => {
            grandTotal.total += cat.total;
            allAirlines.forEach(airline => {
                grandTotal[airline] += cat.airlines[airline] || 0;
            });
        });

        const maxValues: Record<string, number> = {};
        allAirlines.forEach(airline => {
            maxValues[airline] = Math.max(...categoryTotals.map(cat => cat.airlines[airline] || 0), 1);
        });

        return {
            rows: categoryTotals,
            airlines: allAirlines,
            grandTotal,
            maxValues
        };
    }, [filteredReports]);

    const terminalAreaByAirline = useMemo(() => {
        return computeAirlinePivotData('terminal_area_category');
    }, [computeAirlinePivotData]);

    const apronAreaByAirline = useMemo(() => {
        return computeAirlinePivotData('apron_area_category');
    }, [computeAirlinePivotData]);

    const generalCategoryByAirline = useMemo(() => {
        return computeAirlinePivotData('general_category');
    }, [computeAirlinePivotData]);

    const airlinesTotalData = useMemo(() => {
        return categoryByAirlinesData.map(item => ({
            airline: item.airline,
            total: item.irregularity + item.complaint + item.compliment
        })).sort((a, b) => b.total - a.total);
    }, [categoryByAirlinesData]);

    return (
        <div className="space-y-6">
            {}
            <PresentationSlide
                title="Landside & Airside + CGO Station Analysis"
                subtitle="Performance and report categories per branch"
                icon={Building2}
                hint="Click a bar to filter per station"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">Total Reports per Station</h3>
                                <p className="text-[10px] font-medium text-[var(--text-muted)]">Top 10 stations by volume</p>
                            </div>
                        </div>
                        <div className="h-[250px] sm:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={branchReportData as BranchReportItem[]} margin={{ top: 10, right: 10, left: -25, bottom: 10 }} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--surface-4)" />
                                    <XAxis dataKey="station" tick={<WrappedXAxisTick />} axisLine={false} tickLine={false} interval={0} height={80} />
                                    <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 10}} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="count"
                                        name="Report"
                                        fill={REFERENCE_COLORS.irregularity}
                                        radius={[4, 4, 0, 0]}
                                         
                                        onClick={(data: any) => {
                                            const station = data?.payload?.station;
                                            if (!station) {
                                                openDrawer('Station Reports', [...filteredReports] as Report[]);
                                                return;
                                            }
                                             
                                            const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                const code = r.stations?.code || r.branch || r.reporting_branch || '';
                                                return code === station;
                                            });
                                            openDrawer(`Station: ${station}`, filtered);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                        barSize={20}
                                    >
                                        <LabelList dataKey="count" position="top" fill="var(--text-secondary)" fontSize={9} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">Category per Station</h3>
                                <p className="text-[10px] font-medium text-[var(--text-muted)]">Report type breakdown per branch</p>
                            </div>
                        </div>
                        {}
                        <div className="overflow-x-auto">
                            <div style={{ width: Math.max(480, categoryByBranchData.length * 90), height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={categoryByBranchData as CategoryByBranchItem[]}
                                        margin={{ top: 16, right: 16, left: -10, bottom: 8 }}
                                        barCategoryGap="25%"
                                        barGap={3}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-4)" />
                                        <XAxis
                                            dataKey="branch"
                                            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                                            iconType="square"
                                            iconSize={10}
                                        />
                                        <Bar dataKey="irregularity" name="Irregularity" fill={REFERENCE_COLORS.irregularity} radius={[6, 6, 0, 0]} maxBarSize={28} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                            const branch = entry?.payload?.branch;
                                            if (!branch) return;
                                             
                                            const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                const code = r.stations?.code || r.branch || r.reporting_branch || '';
                                                const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                                return code === branch && cat === 'irregularity';
                                            });
                                            openDrawer(`${branch} — Irregularity`, filtered);
                                        }}>
                                            <LabelList dataKey="irregularity" position="top" style={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }} formatter={(v: any) => v > 0 ? v : ''} />
                                        </Bar>
                                        <Bar dataKey="complaint" name="Complaint" fill={REFERENCE_COLORS.complaint} radius={[6, 6, 0, 0]} maxBarSize={28} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                            const branch = entry?.payload?.branch;
                                            if (!branch) return;
                                             
                                            const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                const code = r.stations?.code || r.branch || r.reporting_branch || '';
                                                const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                                return code === branch && cat === 'complaint';
                                            });
                                            openDrawer(`${branch} — Complaint`, filtered);
                                        }}>
                                            <LabelList dataKey="complaint" position="top" style={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }} formatter={(v: any) => v > 0 ? v : ''} />
                                        </Bar>
                                        <Bar dataKey="compliment" name="Compliment" fill={REFERENCE_COLORS.compliment} radius={[6, 6, 0, 0]} maxBarSize={28} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                            const branch = entry?.payload?.branch;
                                            if (!branch) return;
                                             
                                            const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                const code = r.stations?.code || r.branch || r.reporting_branch || '';
                                                const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                                return code === branch && cat === 'compliment';
                                            });
                                            openDrawer(`${branch} — Compliment`, filtered);
                                        }}>
                                            <LabelList dataKey="compliment" position="top" style={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }} formatter={(v: any) => v > 0 ? v : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail Terminal Area by Station</h3>
                        <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                            <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                <table className="w-full text-xs" style={{ minWidth: '300px' }}>
                                    <thead className="sticky top-0 z-10">
                                        <tr className={OS_TABLE_HEADER_CLASS}>
                                            <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                            {terminalAreaByBranch.branches.map((branch: string) => (
                                                <th key={branch} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{branch}</th>
                                            ))}
                                            <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        { }
                                        {terminalAreaByBranch.rows.map((row: any, idx: number) => (
                                            <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                    {row.category}
                                                </td>
                                                {terminalAreaByBranch.branches.map((branch: string) => {
                                                    const val = row.branches[branch] || 0;
                                                    const cell = heatColor(val, terminalAreaByBranch.maxValues[branch]);
                                                    return (
                                                        <td 
                                                            key={branch}
                                                            className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                            style={{
                                                                backgroundColor: cell.bg,
                                                                color: cell.fg
                                                            }}
                                                            onClick={() => val > 0 && drilldownByBranchCategory(branch, row.category, 'Terminal Area')}
                                                        >
                                                            {val || '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {row.total}
                                                </td>
                                            </tr>
                                        ))}
                                        {}
                                        <tr className="bg-gray-100 font-bold">
                                            <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand Total</td>
                                            {terminalAreaByBranch.branches.map((branch: string) => (
                                                <td key={branch} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {terminalAreaByBranch.grandTotal[branch]}
                                                </td>
                                            ))}
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                {terminalAreaByBranch.grandTotal.total}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail Apron Area by Station</h3>
                        <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                            <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                <table className="w-full text-xs" style={{ minWidth: '300px' }}>
                                    <thead className="sticky top-0 z-10">
                                        <tr className={OS_TABLE_HEADER_CLASS}>
                                            <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                            {apronAreaByBranch.branches.map((branch: string) => (
                                                <th key={branch} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{branch}</th>
                                            ))}
                                            <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apronAreaByBranch.rows.map((row: any, idx: number) => (
                                            <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                    {row.category}
                                                </td>
                                                {apronAreaByBranch.branches.map((branch: string) => {
                                                    const val = row.branches[branch] || 0;
                                                    const cell = heatColor(val, apronAreaByBranch.maxValues[branch]);
                                                    return (
                                                        <td 
                                                            key={branch}
                                                            className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                            style={{
                                                                backgroundColor: cell.bg,
                                                                color: cell.fg
                                                            }}
                                                            onClick={() => val > 0 && drilldownByBranchCategory(branch, row.category, 'Apron Area')}
                                                        >
                                                            {val || '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {row.total}
                                                </td>
                                            </tr>
                                        ))}
                                        {}
                                        <tr className="bg-gray-100 font-bold">
                                            <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand Total</td>
                                            {apronAreaByBranch.branches.map((branch: string) => (
                                                <td key={branch} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {apronAreaByBranch.grandTotal[branch]}
                                                </td>
                                            ))}
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                {apronAreaByBranch.grandTotal.total}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail General Category by Station</h3>
                        <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                            <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                <table className="w-full text-xs" style={{ minWidth: '300px' }}>
                                    <thead className="sticky top-0 z-10">
                                        <tr className={OS_TABLE_HEADER_CLASS}>
                                            <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                            {generalCategoryByBranch.branches.map((branch: string) => (
                                                <th key={branch} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{branch}</th>
                                            ))}
                                            <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generalCategoryByBranch.rows.map((row: any, idx: number) => (
                                            <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                    {row.category}
                                                </td>
                                                {generalCategoryByBranch.branches.map((branch: string) => {
                                                    const val = row.branches[branch] || 0;
                                                    const cell = heatColor(val, generalCategoryByBranch.maxValues[branch]);
                                                    return (
                                                        <td 
                                                            key={branch}
                                                            className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                            style={{
                                                                backgroundColor: cell.bg,
                                                                color: cell.fg
                                                            }}
                                                            onClick={() => val > 0 && drilldownByBranchCategory(branch, row.category, 'General')}
                                                        >
                                                            {val || '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {row.total}
                                                </td>
                                            </tr>
                                        ))}
                                        {}
                                        <tr className="bg-gray-100 font-bold">
                                            <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand Total</td>
                                            {generalCategoryByBranch.branches.map((branch: string) => (
                                                <td key={branch} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {generalCategoryByBranch.grandTotal[branch]}
                                                </td>
                                            ))}
                                            <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                {generalCategoryByBranch.grandTotal.total}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </PresentationSlide>

            {}
            <PresentationSlide
                title="Analisis Maskapai"
                subtitle="Performance Metrics & Distribution"
                icon={TrendingUp}
                hint="Klik chart untuk filter per maskapai"
            >
                <div className="grid grid-cols-1 gap-6">
                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl")}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">Total Reports by Airline</h3>
                                <p className="text-[10px] font-medium text-[var(--text-muted)]">Top Maskapai dengan laporan terbanyak</p>
                            </div>
                        </div>
                        <div className="h-[280px] sm:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={airlinesTotalData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--surface-4)" />
                                    <XAxis dataKey="airline" tick={<WrappedXAxisTick />} axisLine={false} tickLine={false} interval={0} height={80} />
                                    <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 10}} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="total"
                                        name="Total"
                                        fill={CHART_PALETTE[1]}
                                        radius={[4, 4, 0, 0]}
                                         
                                        onClick={(data: any) => {
                                            const airline = data?.payload?.airline;
                                            if (!airline) {
                                                openDrawer('Airline Reports', [...filteredReports] as Report[]);
                                                return;
                                            }
                                             
                                            const filtered = (filteredReports as Report[]).filter((r: any) => {
                                                const rAirline = r.airlines || r.airline || '';
                                                return rAirline === airline;
                                            });
                                            openDrawer(`Airline: ${airline}`, filtered);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                        barSize={20}
                                    >
                                        <LabelList dataKey="total" position="top" fill="var(--text-secondary)" fontSize={9} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {}
                    <div className={cn(OS_CARD_CLASS, "p-6 group transition-all duration-500 hover:shadow-2xl overflow-hidden")}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1 opacity-70">Kategori per Maskapai</h3>
                                <p className="text-[10px] font-medium text-[var(--text-muted)]">Breakdown tipe laporan</p>
                            </div>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={categoryByAirlinesData as CategoryByAirlinesItem[]}
                                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                                    barCategoryGap="30%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--surface-4)" />
                                    <XAxis dataKey="airline" tick={<WrappedXAxisTick />} axisLine={false} tickLine={false} height={80} interval={0} />
                                    <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 10}} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="irregularity" name="Irregularity" fill={REFERENCE_COLORS.irregularity} radius={[6, 6, 0, 0]} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                        const airline = entry?.payload?.airline;
                                        if (!airline) return;
                                         
                                        const filtered = (filteredReports as Report[]).filter((r: any) => {
                                            const rAirline = r.airlines || r.airline || '';
                                            const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                            return rAirline === airline && cat === 'irregularity';
                                        });
                                        openDrawer(`${airline} — Irregularity`, filtered);
                                    }} />
                                    <Bar dataKey="complaint" name="Complaint" fill={REFERENCE_COLORS.complaint} radius={[6, 6, 0, 0]} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                        const airline = entry?.payload?.airline;
                                        if (!airline) return;
                                         
                                        const filtered = (filteredReports as Report[]).filter((r: any) => {
                                            const rAirline = r.airlines || r.airline || '';
                                            const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                            return rAirline === airline && cat === 'complaint';
                                        });
                                        openDrawer(`${airline} — Complaint`, filtered);
                                    }} />
                                    <Bar dataKey="compliment" name="Compliment" fill={REFERENCE_COLORS.compliment} radius={[6, 6, 0, 0]} style={{ cursor: 'pointer' }} onClick={(entry: any) => {
                                        const airline = entry?.payload?.airline;
                                        if (!airline) return;
                                         
                                        const filtered = (filteredReports as Report[]).filter((r: any) => {
                                            const rAirline = r.airlines || r.airline || '';
                                            const cat = (r.category || r.main_category || r.irregularity_complain_category || '').toLowerCase();
                                            return rAirline === airline && cat === 'compliment';
                                        });
                                        openDrawer(`${airline} — Compliment`, filtered);
                                    }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail Terminal Area by Airlines</h3>
                            <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                                <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                    <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                                        <thead className="sticky top-0 z-10">
                                            <tr className={OS_TABLE_HEADER_CLASS}>
                                                <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                                {terminalAreaByAirline.airlines.map((airline: string) => (
                                                    <th key={airline} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{airline}</th>
                                                ))}
                                                <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {terminalAreaByAirline.rows.map((row: any, idx: number) => (
                                                <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                    <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                        {row.category}
                                                    </td>
                                                    {terminalAreaByAirline.airlines.map((airline: string) => {
                                                        const val = row.airlines[airline] || 0;
                                                        const cell = heatColor(val, terminalAreaByAirline.maxValues[airline]);
                                                        return (
                                                            <td 
                                                                key={airline}
                                                                className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                                style={{
                                                                    backgroundColor: cell.bg,
                                                                    color: cell.fg
                                                                }}
                                                                onClick={() => val > 0 && drilldownByAirlineCategory(airline, row.category, 'Terminal Area')}
                                                            >
                                                                {val || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {row.total}
                                                    </td>
                                                </tr>
                                            ))}
                                            {}
                                            <tr className="bg-gray-100 font-bold">
                                                <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                                {terminalAreaByAirline.airlines.map((airline: string) => (
                                                    <td key={airline} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {terminalAreaByAirline.grandTotal[airline]}
                                                    </td>
                                                ))}
                                                <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {terminalAreaByAirline.grandTotal.total}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail Apron Area by Airlines</h3>
                            <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                                <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                    <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                                        <thead className="sticky top-0 z-10">
                                            <tr className={OS_TABLE_HEADER_CLASS}>
                                                <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                                {apronAreaByAirline.airlines.map((airline: string) => (
                                                    <th key={airline} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{airline}</th>
                                                ))}
                                                <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {apronAreaByAirline.rows.map((row: any, idx: number) => (
                                                <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                    <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                        {row.category}
                                                    </td>
                                                    {apronAreaByAirline.airlines.map((airline: string) => {
                                                        const val = row.airlines[airline] || 0;
                                                        const cell = heatColor(val, apronAreaByAirline.maxValues[airline]);
                                                        return (
                                                            <td 
                                                                key={airline}
                                                                className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                                style={{
                                                                    backgroundColor: cell.bg,
                                                                    color: cell.fg
                                                                }}
                                                                onClick={() => val > 0 && drilldownByAirlineCategory(airline, row.category, 'Apron Area')}
                                                            >
                                                                {val || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {row.total}
                                                    </td>
                                                </tr>
                                            ))}
                                            {}
                                            <tr className="bg-gray-100 font-bold">
                                                <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                                {apronAreaByAirline.airlines.map((airline: string) => (
                                                    <td key={airline} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {apronAreaByAirline.grandTotal[airline]}
                                                    </td>
                                                ))}
                                                <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {apronAreaByAirline.grandTotal.total}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {}
                        <div className={cn(OS_CARD_CLASS, "p-6 transition-all duration-500 hover:shadow-2xl flex flex-col")} style={{ height: '400px' }}>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#007073] mb-4 opacity-70">Detail General Category by Airlines</h3>
                            <div className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                                <div className={cn("overflow-auto border flex-1", OS_BORDER_CLASS)}>
                                    <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                                        <thead className="sticky top-0 z-10">
                                            <tr className={OS_TABLE_HEADER_CLASS}>
                                                <th className={cn("text-left py-2.5 px-3 font-black uppercase tracking-widest text-[9px] w-32 border", OS_BORDER_CLASS)}>Category</th>
                                                {generalCategoryByAirline.airlines.map((airline: string) => (
                                                    <th key={airline} className={cn("text-center py-2.5 px-1 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>{airline}</th>
                                                ))}
                                                <th className={cn("text-center py-2.5 px-3 font-black uppercase tracking-widest text-[9px] whitespace-nowrap border", OS_BORDER_CLASS)}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {generalCategoryByAirline.rows.map((row: any, idx: number) => (
                                                <tr key={idx} className={cn("border-b hover:bg-[#eef7ed]", OS_BORDER_CLASS)}>
                                                    <td className={cn("py-2 px-2 font-medium text-gray-800 truncate w-32 border", OS_BORDER_CLASS)} title={row.category}>
                                                        {row.category}
                                                    </td>
                                                    {generalCategoryByAirline.airlines.map((airline: string) => {
                                                        const val = row.airlines[airline] || 0;
                                                        const cell = heatColor(val, generalCategoryByAirline.maxValues[airline]);
                                                        return (
                                                            <td 
                                                                key={airline}
                                                                className={cn("py-2 px-1 text-center font-medium whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all border", OS_BORDER_CLASS)}
                                                                style={{
                                                                    backgroundColor: cell.bg,
                                                                    color: cell.fg
                                                                }}
                                                                onClick={() => val > 0 && drilldownByAirlineCategory(airline, row.category, 'General')}
                                                            >
                                                                {val || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={cn("py-2 px-2 text-center font-bold text-gray-800 bg-gray-50 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {row.total}
                                                    </td>
                                                </tr>
                                            ))}
                                            {}
                                            <tr className="bg-gray-100 font-bold">
                                                <td className={cn("py-2 px-2 text-gray-800 border", OS_BORDER_CLASS)}>Grand total</td>
                                                {generalCategoryByAirline.airlines.map((airline: string) => (
                                                    <td key={airline} className={cn("py-2 px-1 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                        {generalCategoryByAirline.grandTotal[airline]}
                                                    </td>
                                                ))}
                                                <td className={cn("py-2 px-2 text-center text-gray-800 border whitespace-nowrap", OS_BORDER_CLASS)}>
                                                    {generalCategoryByAirline.grandTotal.total}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </PresentationSlide>
        </div>
    );
}
