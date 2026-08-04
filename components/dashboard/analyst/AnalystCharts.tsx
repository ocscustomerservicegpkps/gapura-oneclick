'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Filter } from 'lucide-react';
import { PrismMultiSelect } from '@/components/ui/PrismMultiSelect';
import { cn } from '@/lib/utils';
import { useJoumpaReports } from '@/lib/hooks/useJoumpaReports';
import type { Report } from '@/types';
import type { ComparisonData } from '@/types';
import {
    type AnalyticsData,
    type CaseCategoryItem,
    type BranchReportItem,
    type MonthlyReportItem,
    type CategoryByAreaItem,
    type CategoryByBranchItem,
    type CategoryByAirlinesItem,
    type MonthlyComparisonItem,
    type HubDistributionItem,
    type ResolutionByBranchItem,
    type AreaSubCategoryItem,
    type CaseReportByAreaBranchItem,
    type CategoryCountItem,
} from './os-charts';

const tabLoadingFallback = (
    <div className="p-12 text-center text-[var(--text-muted)] border border-dashed rounded-2xl border-[oklch(1_0_0_/_0.2)] bg-[oklch(1_0_0_/_0.08)]">
        Loading analysis workspace...
    </div>
);

const SummaryReportTab = dynamic(
    () => import('@/components/dashboard/tabs/SummaryReportTab').then((mod) => mod.SummaryReportTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const ServiceQualityImprovementTab = dynamic(
    () => import('@/components/dashboard/tabs/ServiceQualityImprovementTab').then((mod) => mod.ServiceQualityImprovementTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const JoumpaServiceTab = dynamic(
    () => import('@/components/dashboard/tabs/JoumpaServiceTab').then((mod) => mod.JoumpaServiceTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const GsePerformanceTab = dynamic(
    () => import('@/components/dashboard/tabs/GsePerformanceTab').then((mod) => mod.GsePerformanceTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const CgoCargoReportTab = dynamic(
    () => import('@/components/dashboard/tabs/CgoCargoReportTab').then((mod) => mod.CgoCargoReportTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const DelayCodeReportTab = dynamic(
    () => import('@/components/dashboard/tabs/DelayCodeReportTab').then((mod) => mod.DelayCodeReportTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

const ReportsStatusTab = dynamic(
    () => import('@/components/dashboard/tabs/ReportsStatusTab').then((mod) => mod.ReportsStatusTab),
    { ssr: false, loading: () => tabLoadingFallback }
);

export interface AnalystChartsProps {
    readonly analytics: AnalyticsData | null;
    readonly caseCategoryData: readonly CaseCategoryItem[];
    readonly branchReportData: readonly BranchReportItem[];
    readonly monthlyReportData: readonly MonthlyReportItem[];
    readonly categoryByAreaData: readonly CategoryByAreaItem[];
    readonly categoryByBranchData: readonly CategoryByBranchItem[];
    readonly areaSubCategoryData: readonly AreaSubCategoryItem[];
    readonly categoryByAirlinesData: readonly CategoryByAirlinesItem[];

    readonly monthlyComparisonData: readonly MonthlyComparisonItem[];
    readonly hubDistributionData: readonly HubDistributionItem[];
    readonly resolutionByBranchData: readonly ResolutionByBranchItem[];
    readonly allReports: readonly Report[];
    readonly filteredReports: readonly Report[];
    readonly caseReportByAreaData: readonly CaseReportByAreaBranchItem[];
    readonly terminalAreaCategoryData: readonly CategoryCountItem[];
    readonly apronAreaCategoryData: readonly CategoryCountItem[];
    readonly generalCategoryData: readonly CategoryCountItem[];
    readonly caseClassificationData?: readonly CategoryCountItem[];
    readonly comparisonData?: ComparisonData;
    readonly onDrilldown: (url: string) => void;
    readonly drilldownUrl: (type: string, value: string) => string;
    readonly globalFilters: {
        hubs: string[];
        branches: string[];
        airlines: string[];
        categories: string[];
    };
    readonly setGlobalFilters: React.Dispatch<React.SetStateAction<{
        hubs: string[];
        branches: string[];
        airlines: string[];
        categories: string[];
    }>>;
    readonly availableOptions: {
        hubs: string[];
        branches: string[];
        airlines: string[];
        categories: string[];
    };
    readonly showDelayCodeTab?: boolean;
}

export default function AnalystCharts({
    filteredReports,
    globalFilters,
    setGlobalFilters,
    availableOptions,
    showDelayCodeTab = false,
}: AnalystChartsProps) {
    const BASE_TABS = ['summary', 'sqi', 'joumpa', 'gse', 'cgo_cargo', 'status_details'] as const;
    const TABS = (showDelayCodeTab
        ? [...BASE_TABS, 'delay'] as const
        : BASE_TABS) as readonly string[];
    const TAB_LABELS: Record<string, React.ReactNode> = {
        summary: (<><span className="block">Summary Report</span><span className="block">Landside &amp; Airside</span></>),
        sqi: (<><span className="block">Landside &amp; Airside</span><span className="block">Detail Report</span></>),
        joumpa: 'Joumpa Service',
        gse: (<><span className="block">GSE Performance</span><span className="block">Detail Report</span></>),
        cgo_cargo: 'CGO Cargo Report',
        delay: 'Delay Code Report',
        status_details: (<><span className="block">Reports Status</span><span className="block">Details</span></>),
    };
    const [activeTab, setActiveTab] = useState<string>('summary');
    const [isGlobalFilterCollapsed, setIsGlobalFilterCollapsed] = useState(true);
    // Paint the tab bar + filter shell FIRST, then mount the heavy active-tab
    // content on a later task. Rendering the whole tree in one commit produced
    // ~1.5s of blocking long-tasks, so the tab bar + charts appeared "all at
    // once" after a frozen gap. Deferring lets the shell show immediately with a
    // loading placeholder while the charts build.
    const [contentReady, setContentReady] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setContentReady(true), 0);
        return () => clearTimeout(id);
    }, []);
    const {
        reports: joumpaReports,
        error: joumpaError,
        isLoading: joumpaLoading,
    } = useJoumpaReports(activeTab === 'joumpa');
    const filteredJoumpaReports = joumpaReports.filter((report) => {
        if (globalFilters.hubs.length > 0 && !globalFilters.hubs.includes(report.hub || '')) return false;
        const branch = report.stations?.code || report.station_code || report.branch || '';
        if (globalFilters.branches.length > 0 && !globalFilters.branches.includes(branch)) return false;
        const airline = report.airlines || report.airline || '';
        if (globalFilters.airlines.length > 0 && !globalFilters.airlines.includes(airline)) return false;
        const category = report.main_category || report.category || '';
        return globalFilters.categories.length === 0 || globalFilters.categories.includes(category);
    });

    return (
        <div className="space-y-6">
            {}
            <div className="relative z-50 bg-[oklch(1_0_0_/_0.4)] backdrop-blur-2xl border border-[oklch(1_0_0_/_0.1)] shadow-inner-rim rounded-2xl mb-4 sm:mb-6">
                <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-[oklch(1_0_0_/_0.05)]">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                        <Filter size={14} className="text-[var(--brand-emerald-500)] sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Global Dashboard Filter</span>
                        <span className="sm:hidden">Filters</span>
                    </h3>
                    <button
                        onClick={() => setIsGlobalFilterCollapsed(!isGlobalFilterCollapsed)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--surface-3)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors text-xs font-bold text-[var(--text-secondary)]"
                    >
                        <span>{isGlobalFilterCollapsed ? 'Show' : 'Hide'}</span>
                        <motion.svg 
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            animate={{ rotate: isGlobalFilterCollapsed ? 0 : 180 }}
                            transition={{ duration: 0.2 }}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </motion.svg>
                    </button>
                </div>

                <AnimatePresence>
                    {!isGlobalFilterCollapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 bg-[var(--surface-0)]/30 rounded-b-2xl">
                                <PrismMultiSelect
                                    label="Hub"
                                    placeholder="All Hubs..."
                                    options={availableOptions.hubs.map(h => ({ label: h, value: h }))}
                                    values={globalFilters.hubs}
                                    onChange={(vals) => setGlobalFilters(prev => ({ ...prev, hubs: vals }))}
                                />
                                <PrismMultiSelect
                                    label="Station"
                                    placeholder="All Stations..."
                                    options={availableOptions.branches.map(b => ({ label: b, value: b }))}
                                    values={globalFilters.branches}
                                    onChange={(vals) => setGlobalFilters(prev => ({ ...prev, branches: vals }))}
                                />
                                <PrismMultiSelect
                                    label="Airline"
                                    placeholder="All Airlines..."
                                    options={availableOptions.airlines.map(a => ({ label: a, value: a }))}
                                    values={globalFilters.airlines}
                                    onChange={(vals) => setGlobalFilters(prev => ({ ...prev, airlines: vals }))}
                                />
                                <PrismMultiSelect
                                    label="Category"
                                    placeholder="All Categories..."
                                    options={availableOptions.categories.map(c => ({ label: c, value: c }))}
                                    values={globalFilters.categories}
                                    onChange={(vals) => setGlobalFilters(prev => ({ ...prev, categories: vals }))}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {}
            <div className="flex justify-center sticky top-0 z-40 py-1 sm:py-2">
                <div className="flex p-1 sm:p-1.5 rounded-2xl bg-[oklch(1_0_0_/_0.4)] backdrop-blur-2xl border border-[oklch(1_0_0_/_0.1)] shadow-inner-rim max-w-full overflow-x-auto no-scrollbar">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                'px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all duration-300 whitespace-nowrap relative flex items-center gap-1 sm:gap-2',
                                activeTab === tab
                                    ? 'text-white translate-y-[-1px]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[oklch(1_0_0_/_0.1)]'
                            )}
                        >
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 rounded-xl"
                                    style={{
                                        background: 'linear-gradient(to bottom, #10b981, #047857)',
                                        boxShadow: '0 4px 0 #064e3b, 0 6px 16px rgba(4,120,87,0.40), inset 0 1px 0 rgba(255,255,255,0.18)',
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 whitespace-nowrap text-center leading-tight">{TAB_LABELS[tab]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {}
            {!contentReady && tabLoadingFallback}
            {contentReady && activeTab === 'summary' && <SummaryReportTab reports={filteredReports as Report[]} />}
            {contentReady && activeTab === 'sqi' && <ServiceQualityImprovementTab reports={filteredReports as Report[]} />}
            {contentReady && activeTab === 'joumpa' && (
                joumpaLoading ? tabLoadingFallback : joumpaError ? (
                    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
                        JOUMPA data could not be loaded. No partial totals are shown.
                    </div>
                ) : (
                    <JoumpaServiceTab
                        allReports={joumpaReports as Report[]}
                        reports={filteredJoumpaReports as Report[]}
                    />
                )
            )}
            {activeTab === 'gse' && <GsePerformanceTab reports={filteredReports as Report[]} />}
            {activeTab === 'cgo_cargo' && <CgoCargoReportTab reports={filteredReports as Report[]} />}
            {activeTab === 'delay' && <DelayCodeReportTab reports={filteredReports as Report[]} />}
            {activeTab === 'status_details' && <ReportsStatusTab reports={filteredReports as Report[]} />}
        </div>
    );
}
