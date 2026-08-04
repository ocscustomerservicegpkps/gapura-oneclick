'use client';

import { Report } from '@/types';

export interface HubSummary {
  hub: string;
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

export interface HubCategoryData {
  hub: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface AirlineByHubData {
  airline: string;
  hub: string;
  count: number;
}

export interface AreaByHubData {
  area: string;
  hub: string;
  count: number;
}

export interface RootCauseByHubData {
  rootCause: string;
  hub: string;
  count: number;
  category: string;
}

export interface HubReportRecord {
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
const INVALID_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !INVALID_VALUES.includes(normalized);
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

export interface AggregatedHubData {
  hubData: HubSummary[];
  trendData: TrendDataPoint[];
  categoryDistribution: HubCategoryDistribution[];
  kpis: HubKPIs;
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

export async function fetchAggregatedHubReport(filters: BaseFilters, signal?: AbortSignal): Promise<AggregatedHubData> {
  const params = new URLSearchParams();
  params.append('view', 'hub-report');
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
      throw new Error('Failed to fetch aggregated hub report: ' + response.status);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching aggregated hub report:', error);
    return {
      hubData: [],
      trendData: [],
      categoryDistribution: [],
      kpis: {
        totalHubs: 0,
        topPerformer: { name: '-', count: 0 },
        worstPerformer: { name: '-', count: 0 },
        avgReportsPerHub: 0,
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

export async function fetchHubSummary(filters: BaseFilters = {}): Promise<HubSummary[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const hubMap = new Map<string, { 
    total: number; 
    irregularity: number; 
    complaint: number; 
    compliment: number;
  }>();

  filtered.forEach(report => {
    const hub = report.hub;
    if (!hub || !isValidValue(hub)) return;

    if (!hubMap.has(hub)) {
      hubMap.set(hub, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = hubMap.get(hub)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });

  const totalReports = Array.from(hubMap.values()).reduce((sum, b) => sum + b.total, 0);

  return Array.from(hubMap.entries())
    .map(([hub, data]) => {
      const total = data.total;
      return {
        hub,
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

export async function fetchMonthlyTrendByHub(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
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

export async function fetchCategoryByHub(filters: BaseFilters = {}): Promise<HubCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const hubMap = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const hub = report.hub;
    if (!hub || !isValidValue(hub)) return;

    if (!hubMap.has(hub)) {
      hubMap.set(hub, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');
    const data = hubMap.get(hub)!;

    if (category === 'Irregularity') data.Irregularity++;
    else if (category === 'Complaint') data.Complaint++;
    else if (category === 'Compliment') data.Compliment++;
  });

  return Array.from(hubMap.entries())
    .map(([hub, data]) => ({ hub, ...data }))
    .sort((a, b) => (b.Irregularity + b.Complaint) - (a.Irregularity + a.Complaint));
}

export function fetchRootCauseByHub(reports: Report[], filters: BaseFilters = {}): RootCauseByHubData[] {
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { hub: string; count: number; category: string }>();

  filtered.forEach(report => {
    const hub = report.hub;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootCause = report.root_caused || (report as any).root_cause;

    if (!isValidValue(hub) || !isValidRootCause(rootCause)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '') || 'Other';
    const key = `${rootCause || 'Unknown'}-${hub || 'Unknown'}`;

    if (!causeMap.has(key)) {
      causeMap.set(key, { hub: hub || 'Unknown', count: 0, category });
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

export function fetchAirlineByHub(reports: Report[], filters: BaseFilters = {}): AirlineByHubData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { airline: string; hub: string; count: number }>();

  filtered.forEach(report => {
    const hub = report.hub;
    const airline = report.airlines || report.airline;

    if (!hub || !airline || !isValidValue(hub) || !isValidValue(airline)) return;

    const key = `${airline}-${hub}`;
    if (!map.has(key)) {
      map.set(key, { airline, hub, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export function fetchAreaByHub(reports: Report[], filters: BaseFilters = {}): AreaByHubData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { area: string; hub: string; count: number }>();

  filtered.forEach(report => {
    const hub = report.hub;
    const area = report.area || report.terminal_area_category || report.apron_area_category || report.general_category;

    if (!isValidValue(hub) || !isValidValue(area)) return;

    const key = `${area || 'Unknown'}-${hub || 'Unknown'}`;
    if (!map.has(key)) {
      map.set(key, { area: area || 'Unknown', hub: hub || 'Unknown', count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.entries())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, data]) => data)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toSafeHttpUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function buildEvidenceLinkHtml(evidenceUrls: unknown): string {
  if (!evidenceUrls) return '-';

  const rawCandidates: string[] = Array.isArray(evidenceUrls)
    ? evidenceUrls.map(String)
    : typeof evidenceUrls === 'string'
      ? (() => {
          const trimmed = evidenceUrls.trim();
          if (!trimmed) return [];
          // A single URL can legitimately contain commas (query strings, path
          // segments) — only split on delimiters when the whole value isn't
          // already one valid URL by itself. Comma is deliberately excluded
          // from the delimiter set once we do split.
          if (toSafeHttpUrl(trimmed)) return [trimmed];
          return trimmed.split(/[;\s]+/).filter(Boolean);
        })()
      : [];

  const urls = rawCandidates
    .map((candidate) => toSafeHttpUrl(candidate.trim()))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) return '-';

  return urls
    .map((url, i) => `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Evidence ${i + 1}</a>`)
    .join(', ');
}

export function fetchAllHubReports(reports: Report[], filters: BaseFilters = {}): HubReportRecord[] {
  const filtered = filterReports(reports, filters);

  return filtered.map(report => {
    const evidenceUrls = report.evidence_url || report.evidence_urls;
    const evidenceLink = buildEvidenceLinkHtml(evidenceUrls);

    return {
      Date: (report.date_of_event || report.created_at) ? new Date(report.date_of_event || report.created_at || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      Hub: report.hub || '-',
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

export interface HubKPIs {
  totalHubs: number;
  topPerformer: { name: string; count: number };
  worstPerformer: { name: string; count: number };
  avgReportsPerHub: number;
  momChange: number;
}

export async function fetchHubKPIs(filters: BaseFilters = {}): Promise<HubKPIs> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const hubCounts = new Map<string, number>();
  filtered.forEach(report => {
    const hub = report.hub;
    if (!hub || !isValidValue(hub)) return;
    hubCounts.set(hub, (hubCounts.get(hub) || 0) + 1);
  });

  const hubEntries = Array.from(hubCounts.entries()).sort((a, b) => a[1] - b[1]);
  const totalHubs = hubEntries.length;
  const topPerformer = hubEntries.length > 0
    ? { name: hubEntries[0][0], count: hubEntries[0][1] }
    : { name: 'None', count: 0 };
  const worstPerformer = hubEntries.length > 0
    ? { name: hubEntries[hubEntries.length - 1][0], count: hubEntries[hubEntries.length - 1][1] }
    : { name: 'None', count: 0 };
  const avgReportsPerHub = totalHubs > 0 ? filtered.length / totalHubs : 0;

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
    totalHubs,
    topPerformer,
    worstPerformer,
    avgReportsPerHub: Math.round(avgReportsPerHub),
    momChange: Math.round(momChange * 10) / 10,
  };
}

export interface HubCategoryDistribution {
  hub: string;
  irregularity: number;
  complaint: number;
  compliment: number;
}

export async function fetchHubCategoryDistribution(filters: BaseFilters = {}): Promise<HubCategoryDistribution[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const hubMap = new Map<string, { irregularity: number; complaint: number; compliment: number }>();

  filtered.forEach(report => {
    const hub = report.hub;
    if (!hub || !isValidValue(hub)) return;

    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category || '');

    if (!hubMap.has(hub)) {
      hubMap.set(hub, { irregularity: 0, complaint: 0, compliment: 0 });
    }

    const counts = hubMap.get(hub)!;
    if (category === 'Irregularity') counts.irregularity++;
    else if (category === 'Complaint') counts.complaint++;
    else if (category === 'Compliment') counts.compliment++;
  });

  return Array.from(hubMap.entries())
    .map(([hub, counts]) => ({ hub, ...counts }))
    .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment));
}
