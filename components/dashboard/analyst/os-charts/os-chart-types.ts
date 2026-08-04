
import type { Report } from '@/types';

export interface CaseCategoryItem {
    name: string;
    value: number;
    fill: string;
}

export interface BranchReportItem {
    station: string;
    count: number;
}

export interface MonthlyReportItem {
    month: string;
    irregularity: number;
    complaint: number;
    compliment: number;
}

export interface CategoryByAreaItem {
    name: string;
    value: number;
    fill: string;
}

export interface CategoryByBranchItem {
    branch: string;
    irregularity: number;
    complaint: number;
    compliment: number;
}

export interface CategoryByAirlinesItem {
    airline: string;
    irregularity: number;
    complaint: number;
    compliment: number;
}

export interface MonthlyComparisonItem {
    month: string;
    masuk: number;
    selesai: number;
    rate: number;
}

export interface HubDistributionItem {
    hub: string;
    count: number;
}

export interface ResolutionByBranchItem {
    branch: string;
    total: number;
    resolved: number;
    rate: number;
}

export interface AreaSubCategoryItem {
    area: string;
    [key: string]: string | number;
}

export interface CaseReportByAreaAirlineItem {
    name: string;
    terminal: number;
    apron: number;
    general: number;
    total: number;
}

export interface CaseReportByAreaBranchItem {
    branch: string;
    airlines: CaseReportByAreaAirlineItem[];
    totalTerminal: number;
    totalApron: number;
    totalGeneral: number;
    grandTotal: number;
}

export interface CategoryCountItem {
    name: string;
    value: number;
}

export interface AnalyticsData {
    summary: {
        totalReports: number;
        resolvedReports: number;
        pendingReports: number;
        highSeverity: number;
        avgResolutionRate: number;
        slaBreachCount?: number;
    };
    stationData: Array<{ station: string; total: number; resolved: number }>;
    statusData: Array<{ name: string; value: number; color: string }>;
    trendData: Array<{ month: string; total: number; resolved: number }>;
    divisionData?: Array<{ division: string; count: number }>;
    categoryData?: Array<{ category: string; count: number }>;
}

export interface OSAnalystChartsProps {
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
    readonly filteredReports: readonly Report[];
    readonly caseReportByAreaData: readonly CaseReportByAreaBranchItem[];
    readonly terminalAreaCategoryData: readonly CategoryCountItem[];
    readonly apronAreaCategoryData: readonly CategoryCountItem[];
    readonly generalCategoryData: readonly CategoryCountItem[];
    readonly caseClassificationData?: readonly CategoryCountItem[];
    readonly comparisonData?: import('@/types').ComparisonData;
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
}

export type { ComparisonData, ComparisonMetric } from '@/types';
