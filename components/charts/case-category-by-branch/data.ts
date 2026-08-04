'use client';

import { Report } from '@/types';

export interface BranchOverview {
  branch: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  complaintRate: number;
  netSentiment: number;
  riskIndex: number;
  rank: number;
  contribution: number;
  dominantCategory: string;
  momGrowth: number;
}

export interface CategoryCompositionData {
  branch: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
  irregularityPct: number;
  complaintPct: number;
  complimentPct: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface AreaBreakdownData {
  area: string;
  branch: string;
  count: number;
}

export interface AirlineContributionData {
  airline: string;
  count: number;
}

export interface RootCauseData {
  rootCause: string;
  count: number;
  category: string;
}

export interface BranchIntelRecord {
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

const reportsCache: Record<string, { data: Report[], ts: number }> = {};
const inflightRequests: Record<string, Promise<Report[]>> = {};
const CACHE_DURATION = 1000 * 60 * 5;

const CORE_FIELDS = [
  'id', 'date_of_event', 'created_at', 'hub', 'branch', 'reporting_branch', 'station_code',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'airlines', 'airline', 'main_category', 'category', 'irregularity_complain_category',
  'root_caused', 'root_cause', 'action_taken', 'evidence_url', 'evidence_urls', 'source_sheet',
  'station_id'
];

const INVALID_VALUES = ['#n/a', 'unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', 'tidak ada', 'belum diketahui'];
const INVALID_BRANCH_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidBranch(value: string | undefined | null): value is string {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_BRANCH_VALUES.includes(normalized);
}

function isValidValue(value: string | undefined | null): value is string {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_VALUES.includes(normalized);
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

  const cacheKey = query.toString() || 'default';
  const now = Date.now();

  const cached = reportsCache[cacheKey];
  if (cached && (now - cached.ts) < CACHE_DURATION) {
    return cached.data;
  }

  if (inflightRequests[cacheKey]) {
    return inflightRequests[cacheKey];
  }

  inflightRequests[cacheKey] = (async () => {
    try {
      const response = await fetch(`/api/reports/analytics?${query.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports: ' + response.status);
      }

      const data = await response.json();
      const reports = data.reports || [];
      reportsCache[cacheKey] = { data: reports, ts: now };
      return reports;
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    } finally {
      delete inflightRequests[cacheKey];
    }
  })();

  return inflightRequests[cacheKey];
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

function getBranch(report: Report): string {
  return report.branch || report.reporting_branch || report.station_code || '';
}

function getCategory(report: Report): string | null {
  return normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
}

function computeMoMGrowth(reports: Report[], branch: string): number {
  const monthMap = new Map<string, number>();

  reports.forEach(report => {
    const b = getBranch(report);
    if (b !== branch) return;
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
  });

  const months = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (months.length < 2) return 0;

  const lastMonth = months[months.length - 1][1];
  const prevMonth = months[months.length - 2][1];
  return prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
}

export async function fetchBranchOverview(filters: BaseFilters = {}): Promise<BranchOverview[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, {
    total: number;
    irregularity: number;
    complaint: number;
    compliment: number;
  }>();

  filtered.forEach(report => {
    const branch = getBranch(report);
    if (!isValidBranch(branch)) return;

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = branchMap.get(branch)!;
    const category = getCategory(report);

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });

  const totalReports = Array.from(branchMap.values()).reduce((sum, b) => sum + b.total, 0);

  return Array.from(branchMap.entries())
    .map(([branch, data]) => {
      const total = data.total;
      const irregularityRate = total > 0 ? (data.irregularity / total) * 100 : 0;
      const complaintRate = total > 0 ? (data.complaint / total) * 100 : 0;
      const netSentiment = (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0;
      const riskIndex = (data.irregularity * 2) + data.complaint;

      const cats = [
        { name: 'Irregularity', count: data.irregularity },
        { name: 'Complaint', count: data.complaint },
        { name: 'Compliment', count: data.compliment },
      ];
      const dominant = cats.sort((a, b) => b.count - a.count)[0];

      return {
        branch,
        total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        irregularityRate,
        complaintRate,
        netSentiment,
        riskIndex,
        rank: 0,
        contribution: totalReports > 0 ? (total / totalReports) * 100 : 0,
        dominantCategory: dominant.name,
        momGrowth: computeMoMGrowth(filtered, branch),
      };
    })
    .sort((a, b) => b.riskIndex - a.riskIndex)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export async function fetchCategoryCompositionByBranch(filters: BaseFilters = {}): Promise<CategoryCompositionData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const branchMap = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const branch = getBranch(report);
    if (!isValidBranch(branch)) return;

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const cat = getCategory(report);
    const d = branchMap.get(branch)!;

    if (cat === 'Irregularity') d.Irregularity++;
    else if (cat === 'Complaint') d.Complaint++;
    else if (cat === 'Compliment') d.Compliment++;
  });

  return Array.from(branchMap.entries())
    .map(([branch, data]) => {
      const total = data.Irregularity + data.Complaint + data.Compliment;
      return {
        branch,
        ...data,
        irregularityPct: total > 0 ? (data.Irregularity / total) * 100 : 0,
        complaintPct: total > 0 ? (data.Complaint / total) * 100 : 0,
        complimentPct: total > 0 ? (data.Compliment / total) * 100 : 0,
      };
    })
    .sort((a, b) => (b.Irregularity + b.Complaint) - (a.Irregularity + a.Complaint));
}

export async function fetchMonthlyTrendByBranch(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const monthMap = new Map<string, { total: number; Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const data = monthMap.get(monthKey)!;
    const category = getCategory(report);

    data.total++;
    if (category === 'Irregularity') data.Irregularity++;
    else if (category === 'Complaint') data.Complaint++;
    else if (category === 'Compliment') data.Compliment++;
  });

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([month, data]) => ({ month, ...data }));
}

export async function fetchAreaBreakdownByBranch(filters: BaseFilters = {}): Promise<AreaBreakdownData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { area: string; branch: string; count: number }>();

  filtered.forEach(report => {
    const branch = getBranch(report);
    const area = report.area || report.terminal_area_category || report.apron_area_category || report.general_category;

    if (!isValidBranch(branch) || !isValidValue(area)) return;

    const key = `${area}-${branch}`;
    if (!map.has(key)) {
      map.set(key, { area: area!, branch, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function fetchAirlineContributionByBranch(filters: BaseFilters = {}): Promise<AirlineContributionData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!isValidValue(airline)) return;

    map.set(airline!, (map.get(airline!) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([airline, count]) => ({ airline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchRootCauseByBranch(filters: BaseFilters = {}): Promise<RootCauseData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { count: number; category: string }>();

  filtered.forEach(report => {
    const rootCause = report.root_caused || report.root_cause;
    if (!isValidValue(rootCause)) return;

    const category = getCategory(report) || 'Other';

    if (!causeMap.has(rootCause!)) {
      causeMap.set(rootCause!, { count: 0, category });
    }
    causeMap.get(rootCause!)!.count++;
  });

  return Array.from(causeMap.entries())
    .map(([rootCause, data]) => ({ rootCause, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchAllBranchIntelReports(filters: BaseFilters = {}): Promise<BranchIntelRecord[]> {
  const reports = await fetchReportsFromSheets(filters);
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
      Branch: getBranch(report) || '-',
      Category: getCategory(report) || '-',
      Airline: report.airlines || report.airline || '-',
      Area: report.area || '-',
      'Root Cause': report.root_caused || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}
