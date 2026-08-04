'use client';

import { Report } from '@/types';

export interface AirlineOverview {
  airline: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  complaintRate: number;
  complimentRate: number;
  netSentiment: number;
  riskIndex: number;
  rank: number;
  contribution: number;
  dominantCategory: string;
  momGrowth: number;
}

export interface CategoryCompositionData {
  airline: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface BranchDistributionData {
  airline: string;
  branch: string;
  count: number;
}

export interface AreaBreakdownData {
  airline: string;
  area: string;
  count: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface RootCauseData {
  rootCause: string;
  count: number;
  category: string;
}

export interface AirlineIntelReportRecord {
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

const INVALID_CAUSE_VALUES = ['#n/a', 'unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', 'tidak ada', 'belum diketahui'];
const INVALID_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidValue(value: string | undefined | null): value is string {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_VALUES.includes(normalized);
}

function isValidRootCause(value: string | undefined | null): value is string {
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

export async function fetchAirlineOverview(filters: BaseFilters = {}): Promise<AirlineOverview[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const airlineMap = new Map<string, {
    total: number;
    irregularity: number;
    complaint: number;
    compliment: number;
    monthCounts: Map<string, number>;
  }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!isValidValue(airline)) return;

    if (!airlineMap.has(airline)) {
      airlineMap.set(airline, { total: 0, irregularity: 0, complaint: 0, compliment: 0, monthCounts: new Map() });
    }

    const data = airlineMap.get(airline)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;

    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (monthKey) {
      data.monthCounts.set(monthKey, (data.monthCounts.get(monthKey) || 0) + 1);
    }
  });

  const totalReports = Array.from(airlineMap.values()).reduce((sum, a) => sum + a.total, 0);

  return Array.from(airlineMap.entries())
    .map(([airline, data]) => {
      const total = data.total;

      const sortedMonths = Array.from(data.monthCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      let momGrowth = 0;
      if (sortedMonths.length >= 2) {
        const lastMonth = sortedMonths[sortedMonths.length - 1][1];
        const prevMonth = sortedMonths[sortedMonths.length - 2][1];
        momGrowth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
      }

      const cats = [
        { name: 'Irregularity', count: data.irregularity },
        { name: 'Complaint', count: data.complaint },
        { name: 'Compliment', count: data.compliment },
      ];
      const dominantCategory = cats.sort((a, b) => b.count - a.count)[0].name;

      return {
        airline,
        total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
        complaintRate: total > 0 ? (data.complaint / total) * 100 : 0,
        complimentRate: total > 0 ? (data.compliment / total) * 100 : 0,
        netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
        riskIndex: (data.irregularity * 2) + data.complaint,
        rank: 0,
        contribution: totalReports > 0 ? (total / totalReports) * 100 : 0,
        dominantCategory,
        momGrowth,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export async function fetchCategoryCompositionByAirline(filters: BaseFilters = {}): Promise<CategoryCompositionData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!isValidValue(airline)) return;

    if (!map.has(airline)) {
      map.set(airline, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const cat = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
    const d = map.get(airline)!;

    if (cat === 'Irregularity') d.Irregularity++;
    else if (cat === 'Complaint') d.Complaint++;
    else if (cat === 'Compliment') d.Compliment++;
  });

  return Array.from(map.entries())
    .map(([airline, data]) => ({ airline, ...data }))
    .sort((a, b) => (b.Irregularity + b.Complaint) - (a.Irregularity + a.Complaint));
}

export async function fetchBranchDistributionByAirline(filters: BaseFilters = {}): Promise<BranchDistributionData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { airline: string; branch: string; count: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    const branch = report.branch || report.reporting_branch || report.station_code;

    if (!isValidValue(airline) || !isValidValue(branch)) return;

    const key = `${airline}-${branch}`;
    if (!map.has(key)) {
      map.set(key, { airline, branch, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function fetchAreaBreakdownByAirline(filters: BaseFilters = {}): Promise<AreaBreakdownData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { airline: string; area: string; count: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    const area = report.area || report.terminal_area_category || report.apron_area_category || report.general_category;

    if (!isValidValue(airline) || !isValidValue(area)) return;

    const key = `${airline}-${area}`;
    if (!map.has(key)) {
      map.set(key, { airline, area, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function fetchMonthlyTrendByAirline(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
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
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

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

export async function fetchRootCauseByAirline(filters: BaseFilters = {}): Promise<RootCauseData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { count: number; category: string }>();

  filtered.forEach(report => {
    const rootCause = report.root_caused || report.root_cause;
    if (!isValidRootCause(rootCause)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || 'Other';

    if (!causeMap.has(rootCause)) {
      causeMap.set(rootCause, { count: 0, category });
    }
    causeMap.get(rootCause)!.count++;
  });

  return Array.from(causeMap.entries())
    .map(([rootCause, data]) => ({ rootCause, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchAllAirlineIntelReports(filters: BaseFilters = {}): Promise<AirlineIntelReportRecord[]> {
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
      Airline: report.airlines || report.airline || '-',
      Branch: report.branch || report.reporting_branch || report.station_code || '-',
      Category: normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || '-',
      Area: report.area || '-',
      'Root Cause': report.root_caused || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}
