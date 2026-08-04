'use client';

import { Report } from '@/types';

export interface PivotCell {
  row: string;
  col: string;
  value: number;
}

export interface PivotMatrix {
  rows: string[];
  cols: string[];
  cells: Map<string, number>;
  rowTotals: Map<string, number>;
  colTotals: Map<string, number>;
  grandTotal: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
}

export interface DimensionBreakdown {
  label: string;
  count: number;
}

export interface PivotReportRecord {
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

const INVALID_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

function isValidValue(value: string | undefined | null): boolean {
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

function getFieldValue(report: Report, field: string): string {
  switch (field) {
    case 'branch':
      return report.branch || report.reporting_branch || report.station_code || '';
    case 'airlines':
    case 'airline':
      return report.airlines || report.airline || '';
    case 'area':
      return report.area || report.terminal_area_category || report.apron_area_category || report.general_category || '';
    case 'category':
    case 'case_category':
      return normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || '';
    case 'hub':
      return report.hub || '';
    case 'root_cause':
      return report.root_caused || report.root_cause || '';
    default:
      return String((report as unknown as Record<string, unknown>)[field] || '');
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

export function inferDimensions(title: string): { rowField: string; colField: string } {
  const lower = title.toLowerCase();

  const byMatch = lower.match(/(.+?)\s+by\s+(.+)/);
  if (byMatch) {
    const left = byMatch[1].trim();
    const right = byMatch[2].trim();
    return {
      rowField: mapDimensionName(right),
      colField: mapDimensionName(left),
    };
  }

  return { rowField: 'branch', colField: 'category' };
}

function mapDimensionName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('branch')) return 'branch';
  if (lower.includes('airline') || lower.includes('maskapai')) return 'airlines';
  if (lower.includes('area')) return 'area';
  if (lower.includes('categor') || lower.includes('case')) return 'category';
  if (lower.includes('hub')) return 'hub';
  if (lower.includes('root') || lower.includes('cause')) return 'root_cause';
  return 'branch';
}

export async function fetchPivotData(filters: BaseFilters = {}): Promise<Report[]> {
  const reports = await fetchReportsFromSheets(filters);
  return filterReports(reports, filters);
}

export function buildPivotMatrix(reports: Report[], rowField: string, colField: string): PivotMatrix {
  const cells = new Map<string, number>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grandTotal = 0;

  reports.forEach(report => {
    const rowVal = getFieldValue(report, rowField);
    const colVal = getFieldValue(report, colField);

    if (!isValidValue(rowVal) || !isValidValue(colVal)) return;

    rowSet.add(rowVal);
    colSet.add(colVal);

    const key = `${rowVal}|||${colVal}`;
    cells.set(key, (cells.get(key) || 0) + 1);
    rowTotals.set(rowVal, (rowTotals.get(rowVal) || 0) + 1);
    colTotals.set(colVal, (colTotals.get(colVal) || 0) + 1);
    grandTotal++;
  });

  const rows = Array.from(rowSet).sort((a, b) => (rowTotals.get(b) || 0) - (rowTotals.get(a) || 0));
  const cols = Array.from(colSet).sort((a, b) => (colTotals.get(b) || 0) - (colTotals.get(a) || 0));

  return { rows, cols, cells, rowTotals, colTotals, grandTotal };
}

export function fetchDimensionBreakdown(reports: Report[], field: string): DimensionBreakdown[] {
  const map = new Map<string, number>();

  reports.forEach(report => {
    const val = getFieldValue(report, field);
    if (!isValidValue(val)) return;
    map.set(val, (map.get(val) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchMonthlyTrend(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
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

export async function fetchAllPivotReports(filters: BaseFilters = {}): Promise<PivotReportRecord[]> {
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
      Branch: report.branch || report.reporting_branch || report.station_code || '-',
      Category: normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || '-',
      Airline: report.airlines || report.airline || '-',
      Area: report.area || '-',
      Hub: report.hub || '-',
      'Root Cause': report.root_caused || report.root_cause || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}
