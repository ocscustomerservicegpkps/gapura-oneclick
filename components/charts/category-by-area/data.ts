'use client';

import { Report } from '@/types';

export interface AreaSummary {
  area: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  netSentiment: number;
  riskIndex: number;
  rank: number;
  contribution: number;
  momGrowth: number;
  percentOfSystem: number;
}

export interface AreaCategoryBreakdown {
  area: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface BranchWithinAreaData {
  branch: string;
  count: number;
}

export interface AirlineWithinAreaData {
  airline: string;
  count: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface RootCauseParetoData {
  rootCause: string;
  count: number;
  category: string;
  cumPercent: number;
}

export interface HeatmapMatrix {
  rows: string[];
  cols: string[];
  cells: Map<string, number>;
  rowTotals: Map<string, number>;
  colTotals: Map<string, number>;
  grandTotal: number;
}

export interface AreaReportRecord {
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

function getArea(report: Report): string | undefined {
  const rawArea = (report.area || report.terminal_area_category || report.apron_area_category || report.general_category || '').toString().trim().toLowerCase();

  if (!rawArea || rawArea === 'null' || rawArea === 'undefined') return undefined;

  if (rawArea.includes('terminal')) return 'Terminal Area';
  if (rawArea.includes('apron')) return 'Apron Area';
  if (rawArea.includes('general')) return 'General';

  return undefined;
}

function getBranch(report: Report): string | undefined {
  return report.branch || report.reporting_branch || report.station_code;
}

function getAirline(report: Report): string | undefined {
  return report.airlines || report.airline;
}

function getRootCause(report: Report): string | undefined {
  return report.root_caused;
}

function getCategory(report: Report): string | null {
  return normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
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

export async function fetchAreaOverview(filters: BaseFilters = {}): Promise<AreaSummary[]> {
  const reports = await fetchReportsFromSheets(filters);
  const allFiltered = filterReports(reports, filters);
  const totalSystem = allFiltered.length;

  const areaMap = new Map<string, {
    total: number;
    irregularity: number;
    complaint: number;
    compliment: number;
  }>();

  const areaMonthMap = new Map<string, Map<string, number>>();

  allFiltered.forEach(report => {
    const area = getArea(report);
    if (!isValidValue(area)) return;
    const areaKey = area!;

    if (!areaMap.has(areaKey)) {
      areaMap.set(areaKey, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = areaMap.get(areaKey)!;
    const category = getCategory(report);

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;

    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (monthKey) {
      if (!areaMonthMap.has(areaKey)) {
        areaMonthMap.set(areaKey, new Map());
      }
      const monthData = areaMonthMap.get(areaKey)!;
      monthData.set(monthKey, (monthData.get(monthKey) || 0) + 1);
    }
  });

  const totalAreaReports = Array.from(areaMap.values()).reduce((sum, a) => sum + a.total, 0);

  return Array.from(areaMap.entries())
    .map(([area, data]) => {
      const total = data.total;

      const monthData = areaMonthMap.get(area);
      let momGrowth = 0;
      if (monthData) {
        const months = Array.from(monthData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        if (months.length >= 2) {
          const lastMonth = months[months.length - 1][1];
          const prevMonth = months[months.length - 2][1];
          momGrowth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
        }
      }

      return {
        area,
        total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
        netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
        riskIndex: (data.irregularity * 2) + data.complaint,
        rank: 0,
        contribution: totalAreaReports > 0 ? (total / totalAreaReports) * 100 : 0,
        momGrowth,
        percentOfSystem: totalSystem > 0 ? (total / totalSystem) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export async function fetchCategoryBreakdownByArea(filters: BaseFilters = {}): Promise<AreaCategoryBreakdown[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();

  filtered.forEach(report => {
    const area = getArea(report);
    if (!isValidValue(area)) return;

    if (!map.has(area!)) {
      map.set(area!, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    }

    const cat = getCategory(report);
    const d = map.get(area!)!;

    if (cat === 'Irregularity') d.Irregularity++;
    else if (cat === 'Complaint') d.Complaint++;
    else if (cat === 'Compliment') d.Compliment++;
  });

  return Array.from(map.entries())
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => (b.Irregularity + b.Complaint + b.Compliment) - (a.Irregularity + a.Complaint + a.Compliment));
}

export async function fetchBranchWithinArea(filters: BaseFilters = {}): Promise<BranchWithinAreaData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();

  filtered.forEach(report => {
    const branch = getBranch(report);
    if (!isValidValue(branch)) return;
    map.set(branch!, (map.get(branch!) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchAirlineWithinArea(filters: BaseFilters = {}): Promise<AirlineWithinAreaData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();

  filtered.forEach(report => {
    const airline = getAirline(report);
    if (!isValidValue(airline)) return;
    map.set(airline!, (map.get(airline!) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([airline, count]) => ({ airline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function fetchMonthlyTrendForArea(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
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

export async function fetchRootCauseForArea(filters: BaseFilters = {}): Promise<RootCauseParetoData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const causeMap = new Map<string, { count: number; category: string }>();

  filtered.forEach(report => {
    const rootCause = getRootCause(report);
    if (!isValidValue(rootCause)) return;

    const category = getCategory(report) || 'Other';

    if (!causeMap.has(rootCause!)) {
      causeMap.set(rootCause!, { count: 0, category });
    }
    causeMap.get(rootCause!)!.count++;
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

export async function fetchBranchCategoryHeatmap(filters: BaseFilters = {}): Promise<HeatmapMatrix> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const cells = new Map<string, number>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grandTotal = 0;

  filtered.forEach(report => {
    const branch = getBranch(report);
    if (!isValidValue(branch)) return;

    const category = getCategory(report);
    if (!category) return;

    const row = branch!;
    const col = category;

    rowSet.add(row);
    colSet.add(col);

    const key = `${row}|||${col}`;
    cells.set(key, (cells.get(key) || 0) + 1);
    rowTotals.set(row, (rowTotals.get(row) || 0) + 1);
    colTotals.set(col, (colTotals.get(col) || 0) + 1);
    grandTotal++;
  });

  const rows = Array.from(rowSet).sort((a, b) => (rowTotals.get(b) || 0) - (rowTotals.get(a) || 0));
  const cols = ['Irregularity', 'Complaint', 'Compliment'].filter(c => colSet.has(c));

  return { rows, cols, cells, rowTotals, colTotals, grandTotal };
}

export async function fetchAllAreaIntelReports(filters: BaseFilters = {}): Promise<AreaReportRecord[]> {
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
      Area: getArea(report) || '-',
      Branch: getBranch(report) || '-',
      Category: getCategory(report) || '-',
      Airline: getAirline(report) || '-',
      'Root Cause': getRootCause(report) || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}
