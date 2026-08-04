'use client';

import { Report } from '@/types';
import {
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
  resolveRootCause,
} from '@/lib/report-normalization';

const INVALID_CAUSE_VALUES = ['#n/a', 'unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', 'tidak ada', 'belum diketahui'];
const INVALID_BRANCH_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidBranch(value: string | undefined | null): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_BRANCH_VALUES.includes(normalized);
}

function isValidRootCause(value: string | undefined | null): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_CAUSE_VALUES.includes(normalized);
}

function getCategory(report: Report): string | null {
  return resolveReportCategory(report) || null;
}

function emptyCategoryCounts() {
  return { Irregularity: 0, Complaint: 0, Compliment: 0, Occurrence: 0, 'Accident / Incident': 0 };
}

function bumpCategory(data: Record<string, number>, category: string | null): void {
  if (!category || !(category in data)) return;
  data[category]++;
}

export interface CategoryData {
  name: string;
  count: number;
  percentage: number;
  growth: number;
}

export interface TrendDataPoint {
  month: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
  Occurrence: number;
  'Accident / Incident': number;
}

export interface BranchCategoryData {
  branch: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
  Occurrence: number;
  'Accident / Incident': number;
}

export interface AirlineCategoryData {
  airline: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
  Occurrence: number;
  'Accident / Incident': number;
  total: number;
}

export interface RootCauseData {
  cause: string;
  category: string;
  count: number;
}

export interface ReportRecord {
  [key: string]: unknown;
}

interface BaseFilters {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

const CORE_FIELDS = [
  'id', 'date_of_event', 'created_at', 'incident_date', 'hub', 'branch', 'reporting_branch', 'station_code',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'airlines', 'airline', 'main_category', 'category', 'irregularity_complain_category',
  'root_caused', 'action_taken', 'evidence_url', 'evidence_urls', 'source_sheet', 'station_id'
];

export interface AggregatedCaseCategoryData {
  categoryData: CategoryData[];
  trendData: TrendDataPoint[];
  branchData: BranchCategoryData[];
  airlineData: AirlineCategoryData[];
  kpis: CategoryKPIs;
}

async function fetchReportsFromSheets(filters: BaseFilters = {}): Promise<Report[]> {
  const query = new URLSearchParams();
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') query.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
  if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);

  query.append('fields', CORE_FIELDS.join(','));

  const response = await fetch(`/api/reports/analytics?${query.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reports: ' + response.status);
  }

  const data = await response.json();
  return data.reports || [];
}

export async function fetchAggregatedCaseCategory(filters: BaseFilters = {}, signal?: AbortSignal): Promise<AggregatedCaseCategoryData> {
  const query = new URLSearchParams();
  query.append('view', 'case-category');
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') query.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
  if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);

  const response = await fetch(`/api/reports/analytics/aggregated?${query.toString()}`, {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch aggregated data');
  }

  const { data } = await response.json();
  return data;
}

function filterReports(reports: Report[], filters: BaseFilters): Report[] {
  return reports.filter(report => {

    const sheet = filters.sourceSheet || 'NON CARGO';
    if (report.source_sheet && report.source_sheet !== sheet) return false;

    if (filters.hub && filters.hub !== 'all' && report.hub !== filters.hub) {
      return false;
    }
    if (filters.branch && filters.branch !== 'all' && report.branch !== filters.branch) {
      return false;
    }
    if (filters.airlines && filters.airlines !== 'all' && report.airlines !== filters.airlines) {
      return false;
    }
    if (filters.area && filters.area !== 'all' && report.area !== filters.area) {
      return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      const reportDate = report.date_of_event || report.created_at || report.incident_date;
      if (reportDate) {
        const date = new Date(reportDate);
        if (!isNaN(date.getTime())) {
          if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            if (date < fromDate) return false;
          }
          if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);

            toDate.setHours(23, 59, 59, 999);
            if (date > toDate) return false;
          }
        }
      }
    }

    return true;
  });
}

function getMonthKey(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

export async function fetchCategoryBreakdown(filters: BaseFilters = {}): Promise<CategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const categoryMap = new Map<string, { count: number; prevCount: number }>();

  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthKey = getPreviousMonthKey(currentMonthKey);

  ['Irregularity', 'Complaint', 'Compliment', 'Occurrence', 'Accident / Incident'].forEach(cat => {
    categoryMap.set(cat, { count: 0, prevCount: 0 });
  });

  filtered.forEach(report => {
    const category = getCategory(report);

    if (category && categoryMap.has(category)) {
      const current = categoryMap.get(category)!;
      current.count++;
    }
  });

  filtered.forEach(report => {
    const dateStr = report.date_of_event || report.created_at || report.incident_date;
    const monthKey = getMonthKey(dateStr);
    const category = getCategory(report);

    if (monthKey === prevMonthKey && category && categoryMap.has(category)) {
      const current = categoryMap.get(category)!;
      current.prevCount++;
    }
  });

  const total = Array.from(categoryMap.values()).reduce((sum, v) => sum + v.count, 0);

  return Array.from(categoryMap.entries()).map(([name, { count, prevCount }]) => {
    const growth = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : (count > 0 ? 100 : 0);
    return {
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      growth,
    };
  }).sort((a, b) => b.count - a.count);
}

export async function fetchMonthlyTrend(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const monthMap = new Map<string, ReturnType<typeof emptyCategoryCounts>>();

  filtered.forEach(report => {
    const dateStr = report.date_of_event || report.created_at || report.incident_date;
    const monthKey = getMonthKey(dateStr);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, emptyCategoryCounts());
    }

    const category = getCategory(report);

    if (!category) return;

    const data = monthMap.get(monthKey)!;

    bumpCategory(data, category);
  });

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = `${year} ${months[month - 1]}`;
      return {
        month: monthLabel,
        ...data,
      };
    });
}

export async function fetchCategoryByBranch(filters: BaseFilters = {}): Promise<BranchCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, ReturnType<typeof emptyCategoryCounts>>();

  filtered.forEach(report => {
    const branch = resolveReportBranch(report);
    if (!isValidBranch(branch)) return;
    const branchName = branch as string;

    if (!branchMap.has(branchName)) {
      branchMap.set(branchName, emptyCategoryCounts());
    }

    const category = getCategory(report);
    if (!category) return;

    const data = branchMap.get(branchName);
    if (!data) return;

    bumpCategory(data, category);
  });

  return Array.from(branchMap.entries())
    .map(([branch, data]) => ({ branch, ...data }))
    .sort((a, b) => (b.Irregularity || 0) - (a.Irregularity || 0));
}

export async function fetchCategoryByAirline(filters: BaseFilters = {}): Promise<AirlineCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const airlineMap = new Map<string, ReturnType<typeof emptyCategoryCounts>>();

  filtered.forEach(report => {
    const airline = resolveReportAirline(report);
    if (!isValidBranch(airline)) return;
    const airlineName = airline as string;

    if (!airlineMap.has(airlineName)) {
      airlineMap.set(airlineName, emptyCategoryCounts());
    }

    const category = getCategory(report);
    if (!category) return;

    const data = airlineMap.get(airlineName);
    if (!data) return;

    bumpCategory(data, category);
  });

  return Array.from(airlineMap.entries())
    .map(([airline, data]) => ({
      airline,
      ...data,
      total: Object.values(data).reduce((sum, count) => sum + count, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export async function fetchRootCauses(filters: BaseFilters = {}): Promise<RootCauseData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { category: string; count: number }>();

  filtered.forEach(report => {
    const category = getCategory(report) || 'Other';

    const rootCause = resolveRootCause(report);

    if (!isValidRootCause(rootCause)) return;

    const key = `${rootCause}-${category}`;
    if (!causeMap.has(key)) {
      causeMap.set(key, { category, count: 0 });
    }
    causeMap.get(key)!.count++;
  });

  return Array.from(causeMap.entries())
    .map(([key, { category, count }]) => ({
      cause: key.split('-')[0],
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchAllReports(filters: BaseFilters = {}): Promise<ReportRecord[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  return filtered.map(report => ({
    Date: (() => {
      const dateVal = report.date_of_event || report.created_at;
      if (!dateVal) return '-';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';

      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');

      return `${day} ${month} ${year} ${hour}:${minute}`;
    })(),
    Category: getCategory(report) || '-',
    Branch: resolveReportBranch(report) || report.station_id || '-',
    Airline: resolveReportAirline(report) || '-',
    Area: report.area || '-',
    'Root Cause': resolveRootCause(report) || '-',
    'Action Taken': report.action_taken || '-',
    Evidence: report.evidence_url || report.evidence_urls || '-',
  }));
}

export interface CategoryKPIs {
  totalReports: number;
  mostAffectedBranch: { name: string; count: number };
  topAirline: { name: string; count: number };
  avgResolutionTime: number;
}

export async function fetchCategoryKPIs(filters: BaseFilters = {}): Promise<CategoryKPIs> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const totalReports = filtered.length;

  const branchCounts = new Map<string, number>();
  filtered.forEach((r) => {
    const branch = r.branch || r.reporting_branch || r.station_code || 'Unknown';
    if (isValidBranch(branch)) {
      const branchName = branch as string;
      branchCounts.set(branchName, (branchCounts.get(branchName) || 0) + 1);
    }
  });
  const branchEntries = Array.from(branchCounts.entries()).sort((a, b) => b[1] - a[1]);
  const mostAffectedBranch = branchEntries.length > 0
    ? { name: branchEntries[0][0], count: branchEntries[0][1] }
    : { name: 'None', count: 0 };

  const airlineCounts = new Map<string, number>();
  filtered.forEach((r) => {
    const airline = r.airline || r.airlines || 'Unknown';
    if (isValidBranch(airline)) {
      const airlineName = airline as string;
      airlineCounts.set(airlineName, (airlineCounts.get(airlineName) || 0) + 1);
    }
  });
  const airlineEntries = Array.from(airlineCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topAirline = airlineEntries.length > 0
    ? { name: airlineEntries[0][0], count: airlineEntries[0][1] }
    : { name: 'None', count: 0 };

  const avgResolutionTime = 0;

  return {
    totalReports,
    mostAffectedBranch,
    topAirline,
    avgResolutionTime,
  };
}

export type { SeverityDistribution } from "../shared-types";
