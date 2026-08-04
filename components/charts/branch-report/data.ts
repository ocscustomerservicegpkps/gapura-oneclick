'use client';

import { Report } from '@/types';

export interface BranchSummary {
  branch: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  netSentiment: number;
  riskIndex: number;
  rank: number;
  contribution: number;
  growth: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
}

export interface BranchCategoryData {
  branch: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface AirlineByBranchData {
  airline: string;
  branch: string;
  count: number;
}

export interface AreaByBranchData {
  area: string;
  branch: string;
  count: number;
}

export interface RootCauseByBranchData {
  rootCause: string;
  branch: string;
  count: number;
  category: string;
}

export interface BranchReportRecord {
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
  'id', 'date_of_event', 'created_at', 'hub', 'branch', 'reporting_branch', 'station_code',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'airlines', 'airline', 'main_category', 'category', 'irregularity_complain_category',
  'root_caused', 'action_taken', 'evidence_url', 'evidence_urls', 'source_sheet',
  'station_id'
];

export type { SeverityDistribution } from "../shared-types";

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

function normalizeCategory(category: string | undefined): string | null {
  if (!category) return null;
  const normalized = category.toLowerCase();
  if (normalized.includes('irregular')) return 'Irregularity';
  if (normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('compliment')) return 'Compliment';
  return null;
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

export interface AggregatedBranchData {
  branchData: BranchSummary[];
  trendData: TrendDataPoint[];
  categoryDistribution: BranchCategoryDistribution[];
  kpis: BranchKPIs;
}

export async function fetchReportsFromSheets(filters: BaseFilters = {}): Promise<Report[]> {
  const query = new URLSearchParams();
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') query.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
  if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);

  query.append('fields', CORE_FIELDS.join(','));

  try {
    const response = await fetch(`/api/reports/analytics?${query.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch reports: ' + response.status);
    }

    const data = await response.json();
    return data.reports || [];
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
}

export async function fetchAggregatedBranchReport(filters: BaseFilters, signal?: AbortSignal): Promise<AggregatedBranchData> {
  const params = new URLSearchParams();
  params.append('view', 'branch-report');
  if (filters.hub) params.append('hub', filters.hub);
  if (filters.branch) params.append('branch', filters.branch);
  if (filters.airlines) params.append('airlines', filters.airlines);
  if (filters.area) params.append('area', filters.area);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.sourceSheet) params.append('sourceSheet', filters.sourceSheet);

  try {
    const response = await fetch(`/api/reports/analytics/aggregated?${params.toString()}`, {
      signal,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch aggregated branch report: ' + response.status);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching aggregated branch report:', error);
    return {
      branchData: [],
      trendData: [],
      categoryDistribution: [],
      kpis: {
        totalBranches: 0,
        topPerformer: { name: '-', count: 0 },
        worstPerformer: { name: '-', count: 0 },
        avgReportsPerBranch: 0,
        momChange: 0,
      }
    };
  }
}

function filterReports(reports: Report[], filters: BaseFilters): Report[] {
  return reports.filter(report => {

    const sheet = filters.sourceSheet || 'NON CARGO';
    if (report.source_sheet && report.source_sheet !== sheet) return false;

    if (filters.hub && filters.hub !== 'all' && report.hub !== filters.hub) return false;
    if (filters.branch && filters.branch !== 'all' && report.branch !== filters.branch) return false;
    if (filters.airlines && filters.airlines !== 'all' && report.airlines !== filters.airlines) return false;
    if (filters.area && filters.area !== 'all' && report.area !== filters.area) return false;
    return true;
  });
}

export async function fetchBranchSummary(filters: BaseFilters = {}): Promise<BranchSummary[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, { 
    total: number; 
    irregularity: number; 
    complaint: number; 
    compliment: number;
  }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    if (!branch || !isValidBranch(branch)) return;

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = branchMap.get(branch)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });

  const totalReports = Array.from(branchMap.values()).reduce((sum, b) => sum + b.total, 0);

  return Array.from(branchMap.entries())
    .map(([branch, data]) => {
      const total = data.total;
      return {
        branch,
        total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
        netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
        riskIndex: (data.irregularity * 2) + data.complaint,
        rank: 0,
        contribution: totalReports > 0 ? (total / totalReports) * 100 : 0,
        growth: 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export async function fetchMonthlyTrendByBranch(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const monthMap = new Map<string, { total: number; Irregularity: number; Complaint: number }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, Irregularity: 0, Complaint: 0 });
    }

    const data = monthMap.get(monthKey)!;
    data.total++;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
    if (category === 'Irregularity') data.Irregularity++;
    else if (category === 'Complaint') data.Complaint++;
  });

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([month, data]) => ({ month, ...data }));
}

export async function fetchCategoryByBranch(filters: BaseFilters = {}): Promise<BranchCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    if (!branch || !isValidBranch(branch)) return;

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');
    const data = branchMap.get(branch)!;

    if (category === 'Irregularity') data.Irregularity++;
    else if (category === 'Complaint') data.Complaint++;
    else if (category === 'Compliment') data.Compliment++;
  });

  return Array.from(branchMap.entries())
    .map(([branch, data]) => ({ branch, ...data }))
    .sort((a, b) => (b.Irregularity + b.Complaint) - (a.Irregularity + a.Complaint));
}

export function fetchRootCauseByBranch(reports: Report[], filters: BaseFilters = {}): RootCauseByBranchData[] {
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { branch: string; count: number; category: string }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootCause = report.root_caused || (report as any).root_cause;

    if (!isValidBranch(branch) || !isValidRootCause(rootCause)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '') || 'Other';
    const key = `${rootCause || 'Unknown'}-${branch || 'Unknown'}`;

    if (!causeMap.has(key)) {
      causeMap.set(key, { branch: branch || 'Unknown', count: 0, category });
    }
    causeMap.get(key)!.count++;
  });

  return Array.from(causeMap.entries())
    .map(([key, data]) => ({
      rootCause: key.split('-')[0] || 'Unknown',
      ...data,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export function fetchAirlineByBranch(reports: Report[], filters: BaseFilters = {}): AirlineByBranchData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { airline: string; branch: string; count: number }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    const airline = report.airlines || report.airline;

    if (!branch || !airline || !isValidBranch(branch) || !isValidBranch(airline)) return;

    const key = `${airline}-${branch}`;
    if (!map.has(key)) {
      map.set(key, { airline, branch, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export function fetchAreaByBranch(reports: Report[], filters: BaseFilters = {}): AreaByBranchData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { area: string; branch: string; count: number }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    const area = report.area || report.terminal_area_category || report.apron_area_category || report.general_category;

    if (!isValidBranch(branch) || !isValidBranch(area)) return;

    const key = `${area || 'Unknown'}-${branch || 'Unknown'}`;
    if (!map.has(key)) {
      map.set(key, { area: area || 'Unknown', branch: branch || 'Unknown', count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export function fetchAllBranchReports(reports: Report[], filters: BaseFilters = {}): BranchReportRecord[] {
  const filtered = filterReports(reports, filters);

  return filtered.map(report => {
    const evidenceUrls = report.evidence_url || report.evidence_urls;
    let evidenceLink = '-';
    if (evidenceUrls) {
      if (Array.isArray(evidenceUrls)) {
        evidenceLink = evidenceUrls.slice(0, 3).map((url, i) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Link ${i + 1}</a>`
        ).join(' ');
        if (evidenceUrls.length > 3) {
          evidenceLink += ` +${evidenceUrls.length - 3} more`;
        }
      } else if (typeof evidenceUrls === 'string' && evidenceUrls.startsWith('http')) {
        evidenceLink = `<a href="${evidenceUrls}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Link</a>`;
      }
    }

    return {
      Date: (report.date_of_event || report.created_at) ? new Date(report.date_of_event || report.created_at || '').toLocaleDateString('id-ID') : '-',
      Branch: report.branch || report.reporting_branch || report.station_code || '-',
      Category: normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '') || '-',
      Airline: report.airlines || report.airline || '-',
      Area: report.area || '-',
      'Root Cause': report.root_caused || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}

export interface BranchKPIs {
  totalBranches: number;
  topPerformer: { name: string; count: number };
  worstPerformer: { name: string; count: number };
  avgReportsPerBranch: number;
  momChange: number;
}

export async function fetchBranchKPIs(filters: BaseFilters = {}): Promise<BranchKPIs> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchCounts = new Map<string, number>();
  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    if (!branch || !isValidBranch(branch)) return;
    branchCounts.set(branch, (branchCounts.get(branch) || 0) + 1);
  });

  const branchEntries = Array.from(branchCounts.entries()).sort((a, b) => a[1] - b[1]);
  const totalBranches = branchEntries.length;
  const topPerformer = branchEntries.length > 0
    ? { name: branchEntries[0][0], count: branchEntries[0][1] }
    : { name: 'None', count: 0 };
  const worstPerformer = branchEntries.length > 0
    ? { name: branchEntries[branchEntries.length - 1][0], count: branchEntries[branchEntries.length - 1][1] }
    : { name: 'None', count: 0 };
  const avgReportsPerBranch = totalBranches > 0 ? filtered.length / totalBranches : 0;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`;

  let currentMonthCount = 0;
  let lastMonthCount = 0;

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (monthKey === currentMonth) currentMonthCount++;
    if (monthKey === lastMonth) lastMonthCount++;
  });

  const momChange = lastMonthCount > 0
    ? ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100
    : 0;

  return {
    totalBranches,
    topPerformer,
    worstPerformer,
    avgReportsPerBranch: Math.round(avgReportsPerBranch),
    momChange: Math.round(momChange * 10) / 10,
  };
}

export interface BranchCategoryDistribution {
  branch: string;
  irregularity: number;
  complaint: number;
  compliment: number;
}

export async function fetchBranchCategoryDistribution(filters: BaseFilters = {}): Promise<BranchCategoryDistribution[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, { irregularity: number; complaint: number; compliment: number }>();

  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    if (!branch || !isValidBranch(branch)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { irregularity: 0, complaint: 0, compliment: 0 });
    }

    const counts = branchMap.get(branch)!;
    if (category === 'Irregularity') counts.irregularity++;
    else if (category === 'Complaint') counts.complaint++;
    else if (category === 'Compliment') counts.compliment++;
  });

  return Array.from(branchMap.entries())
    .map(([branch, counts]) => ({ branch, ...counts }))
    .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment));
}
