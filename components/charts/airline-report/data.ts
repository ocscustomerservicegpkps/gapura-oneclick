'use client';

import { Report } from '@/types';

export interface AirlineSummary {
  airline: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  netSentiment: number;
  riskIndex: number;
  rank: number;
  contribution: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface BranchByAirlineData {
  branch: string;
  airline: string;
  count: number;
}

export interface RootCauseByAirlineData {
  rootCause: string;
  airline: string;
  count: number;
  category: string;
}

export interface AirlineCategoryData {
  airline: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface AreaByAirlineData {
  area: string;
  count: number;
}

export interface RootCauseParetoData {
  rootCause: string;
  count: number;
  category: string;
  cumPercent: number;
}

export interface AirlineReportRecord {
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
const INVALID_AIRLINE_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidAirline(value: string | undefined | null): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_AIRLINE_VALUES.includes(normalized);
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

export interface AggregatedAirlineData {
  airlineData: AirlineSummary[];
  trendData: TrendDataPoint[];
  categoryBreakdown: AirlineCategoryBreakdown[];
  categoryData: AirlineCategoryData[];
  kpis: AirlineKPIs;
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

  const response = await fetch(`/api/reports/analytics?${query.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reports: ' + response.status);
  }

  const data = await response.json();
  return data.reports || [];
}

export async function fetchAggregatedAirlineReport(filters: BaseFilters, signal?: AbortSignal): Promise<AggregatedAirlineData> {
  const params = new URLSearchParams();
  params.append('view', 'airline-report');
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') params.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') params.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') params.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') params.append('airlines', filters.airlines);
  if (filters.sourceSheet) params.append('sourceSheet', filters.sourceSheet);

  const response = await fetch(`/api/reports/analytics/aggregated?${params.toString()}`, {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch aggregated airline data');
  }

  const { data } = await response.json();
  return data;
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

export async function fetchAirlineSummary(filters: BaseFilters = {}): Promise<AirlineSummary[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const airlineMap = new Map<string, {
    total: number;
    irregularity: number;
    complaint: number;
    compliment: number;
  }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!airline || !isValidAirline(airline)) return;

    if (!airlineMap.has(airline)) {
      airlineMap.set(airline, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = airlineMap.get(airline)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });

  const totalReports = Array.from(airlineMap.values()).reduce((sum, a) => sum + a.total, 0);

  return Array.from(airlineMap.entries())
    .map(([airline, data]) => {
      const total = data.total;
      return {
        airline,
        total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
        netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
        riskIndex: (data.irregularity * 2) + data.complaint,
        rank: 0,
        contribution: totalReports > 0 ? (total / totalReports) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
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

export function fetchBranchByAirline(reports: Report[], filters: BaseFilters = {}): BranchByAirlineData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { branch: string; airline: string; count: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    const branch = report.branch || report.reporting_branch || report.station_code;

    if (!airline || !isValidAirline(airline) || !branch) return;

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

export function fetchRootCauseByAirline(reports: Report[], filters: BaseFilters = {}): RootCauseByAirlineData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { rootCause: string; airline: string; count: number; category: string }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    const rootCause = report.root_caused;

    if (!airline || !isValidAirline(airline) || !rootCause || !isValidRootCause(rootCause)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || 'Other';
    const key = `${rootCause}-${airline}`;

    if (!map.has(key)) {
      map.set(key, { rootCause, airline, count: 0, category });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchCategoryByAirline(filters: BaseFilters = {}): Promise<AirlineCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!airline || !isValidAirline(airline)) return;

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

export function fetchAreaByAirline(reports: Report[], filters: BaseFilters = {}): AreaByAirlineData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();

  filtered.forEach(report => {
    const area = report.area || report.terminal_area_category || report.apron_area_category || report.general_category;
    if (!area || INVALID_AIRLINE_VALUES.includes(area.toLowerCase().trim())) return;
    map.set(area, (map.get(area) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

export function fetchRootCausePareto(reports: Report[], filters: BaseFilters = {}): RootCauseParetoData[] {
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { count: number; category: string }>();

  filtered.forEach(report => {
    const rootCause = report.root_caused;
    if (!rootCause || !isValidRootCause(rootCause)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || 'Other';

    if (!causeMap.has(rootCause)) {
      causeMap.set(rootCause, { count: 0, category });
    }
    causeMap.get(rootCause)!.count++;
  });

  const sorted = Array.from(causeMap.entries())
    .map(([rootCause, data]) => ({ rootCause, ...data, cumPercent: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const total = sorted.reduce((s, d) => s + d.count, 0);
  let cumulative = 0;
  sorted.forEach(d => {
    cumulative += d.count;
    d.cumPercent = total > 0 ? (cumulative / total) * 100 : 0;
  });

  return sorted;
}

export function fetchAllAirlineReports(reports: Report[], filters: BaseFilters = {}): AirlineReportRecord[] {
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

export interface AirlineKPIs {
  totalAirlines: number;
  topAirline: { name: string; count: number };
  bestPerformer: { name: string; count: number };
  avgReportsPerAirline: number;
  complimentRatio: number;
}

export async function fetchAirlineKPIs(filters: BaseFilters = {}): Promise<AirlineKPIs> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const airlineCounts = new Map<string, { total: number; compliments: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!airline || !isValidAirline(airline)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    if (!airlineCounts.has(airline)) {
      airlineCounts.set(airline, { total: 0, compliments: 0 });
    }

    const counts = airlineCounts.get(airline)!;
    counts.total++;
    if (category === 'Compliment') counts.compliments++;
  });

  const airlineEntries = Array.from(airlineCounts.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total);

  const totalAirlines = airlineEntries.length;

  const topAirline = airlineEntries.length > 0
    ? { name: airlineEntries[0].name, count: airlineEntries[0].total }
    : { name: 'None', count: 0 };

  const bestPerformerEntries = [...airlineEntries].sort((a, b) => a.total - b.total);
  const bestPerformer = bestPerformerEntries.length > 0
    ? { name: bestPerformerEntries[0].name, count: bestPerformerEntries[0].total }
    : { name: 'None', count: 0 };

  const avgReportsPerAirline = totalAirlines > 0 ? filtered.length / totalAirlines : 0;
  const totalCompliments = airlineEntries.reduce((sum, a) => sum + a.compliments, 0);
  const complimentRatio = filtered.length > 0 ? (totalCompliments / filtered.length) * 100 : 0;

  return {
    totalAirlines,
    topAirline,
    bestPerformer,
    avgReportsPerAirline: Math.round(avgReportsPerAirline),
    complimentRatio: Math.round(complimentRatio),
  };
}

export interface AirlineCategoryBreakdown {
  airline: string;
  irregularity: number;
  complaint: number;
  compliment: number;
}

export async function fetchAirlineCategoryBreakdown(filters: BaseFilters = {}): Promise<AirlineCategoryBreakdown[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const airlineMap = new Map<string, { irregularity: number; complaint: number; compliment: number }>();

  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!airline || !isValidAirline(airline)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    if (!airlineMap.has(airline)) {
      airlineMap.set(airline, { irregularity: 0, complaint: 0, compliment: 0 });
    }

    const counts = airlineMap.get(airline)!;
    if (category === 'Irregularity') counts.irregularity++;
    else if (category === 'Complaint') counts.complaint++;
    else if (category === 'Compliment') counts.compliment++;
  });

  return Array.from(airlineMap.entries())
    .map(([airline, counts]) => ({ airline, ...counts }))
    .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment))
    .slice(0, 10);
}
