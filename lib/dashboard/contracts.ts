import type { Report } from '@/types';

export type DashboardSourceKey = 'ground_handling' | 'joumpa';

export type DashboardTabKey =
  | 'summary'
  | 'sqi'
  | 'joumpa'
  | 'gse'
  | 'cgo_cargo'
  | 'delay'
  | 'status_details';

export interface DashboardStats {
  total: number;
  resolved: number;
  pending: number;
  highSeverity: number;
  resolutionRate: number;
  years: number[];
}

export interface DashboardFilterOptions {
  hubs: string[];
  branches: string[];
  airlines: string[];
  categories: string[];
}

export interface DashboardOverview {
  source: 'ground_handling';
  sourceCounts: Record<string, number>;
  uniquePopulationCount: number;
  filteredCount: number;
  summary: DashboardStats;
  filterOptions: DashboardFilterOptions;
  tabPopulations: Partial<Record<DashboardTabKey, number>>;
  generatedAt: string;
  completeness: 'complete';
}

export interface DashboardInitialData {
  overview: DashboardOverview;
  latestReports: Report[];
}

export interface CompleteDashboardReportsResponse {
  reports: Report[];
  source: 'ground_handling';
  eligibleCount: number;
  returnedCount: number;
  generatedAt: string;
  completeness: 'complete';
}
