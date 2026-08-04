'use client';

import { Report } from '@/types';
import { toLocalYMD, wibYearMonth } from '@/lib/utils/wib-date';

export interface MonthlySummary {
  month: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
  irregularityRate: number;
  netSentiment: number;
  momGrowth: number;
  yoyGrowth: number | undefined;
  prevMonthTotal: number;
  prevYearTotal: number;
}

export interface DailyDataPoint {
  date: string;
  total: number;
  Irregularity: number;
  Complaint: number;
}

export interface BranchByMonthData {
  branch: string;
  month: string;
  count: number;
}

export interface AirlineByMonthData {
  airline: string;
  month: string;
  count: number;
}

export interface RootCauseByMonthData {
  rootCause: string;
  month: string;
  count: number;
  category: string;
}

export interface RollingAveragePoint {
  month: string;
  actual: number;
  rollingAvg3: number;
  rollingAvg6: number;
}

export interface PeakDayInfo {
  date: string;
  count: number;
  dayOfWeek: string;
}

export interface DominantInfo {
  name: string;
  count: number;
  percent: number;
}

export interface MonthlyReportRecord {
  [key: string]: unknown;
}

export interface MonthlyKPIs {
  currentMonthTotal: number;
  previousMonthTotal: number;
  momChange: number;
  highestPeakMonth: { month: string; count: number };
}

export interface MonthlyTrendData {
  month: string;
  total: number;
  irregularity: number;
  complaint: number;
  compliment: number;
}

interface BaseFilters {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  month?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

const CORE_FIELDS = [
  'id', 'date_of_event', 'created_at', 'hub', 'branch', 'reporting_branch', 'station_code',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'airlines', 'airline', 'main_category', 'category', 'irregularity_complain_category',
  'root_caused', 'action_taken', 'evidence_url', 'evidence_urls', 'source_sheet',
  'remarks_gapura_kps'
];

export type { SeverityDistribution } from "../shared-types";

function normalizeCategory(category: string | undefined): string | null {
  if (!category) return null;
  const normalized = category.toLowerCase();
  if (normalized.includes('irregular')) return 'Irregularity';
  if (normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('compliment')) return 'Compliment';
  return null;
}

// Both helpers derive their calendar boundary from the same WIB (UTC+7)
// wall-clock shift (see lib/utils/wib-date.ts) so a report timestamp near a
// month boundary always lands in the same month for getMonthKey() as it does
// for getDateKey() — previously getMonthKey() used host-local Date getters
// while getDateKey() used raw UTC via toISOString(), which could disagree by
// a day (and therefore a month) depending on the server's timezone.
function getMonthKey(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const { year, month } = wibYearMonth(date);
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function getDateKey(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return toLocalYMD(date);
  } catch {
    return '';
  }
}

export interface AggregatedMonthlyData {
  summary: MonthlySummary[];
  trend: MonthlySummary[];
  kpis: MonthlyKPIs;
  rollingData: RollingAveragePoint[];
  dailyData: DailyDataPoint[];
  peakDay: PeakDayInfo;
  dominantBranch: DominantInfo;
  dominantAirline: DominantInfo;
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

export async function fetchAggregatedMonthlyReport(filters: BaseFilters, signal?: AbortSignal): Promise<AggregatedMonthlyData> {
  const params = new URLSearchParams();
  params.append('view', 'monthly');
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
    throw new Error('Failed to fetch aggregated monthly data');
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
    if (filters.month && filters.month !== 'all') {
      const reportMonth = getMonthKey(report.date_of_event || report.created_at);
      if (reportMonth !== filters.month) return false;
    }
    return true;
  });
}

export async function fetchMonthlySummary(filters: BaseFilters = {}): Promise<MonthlySummary[]> {
  const reports = await fetchReportsFromSheets(filters);

  const monthFilter = filters.month;
  const filtered = filterReports(reports, { ...filters, month: undefined });

  const monthMap = new Map<string, { 
    total: number; 
    irregularity: number; 
    complaint: number; 
    compliment: number;
  }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const data = monthMap.get(monthKey)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });

  const sortedMonths = Array.from(monthMap.keys()).sort();

  const result = sortedMonths.map((month) => {
    const data = monthMap.get(month)!;
    const total = data.total;

    const [year, monthNum] = month.split('-').map(Number);
    const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
    const prevYear = monthNum === 1 ? year - 1 : year;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const prevYearKey = `${year - 1}-${String(monthNum).padStart(2, '0')}`;

    const prevMonthData = monthMap.get(prevMonthKey);
    const prevYearData = monthMap.get(prevYearKey);

    const prevMonthTotal = prevMonthData?.total || 0;
    const prevYearTotal = prevYearData?.total || 0;

    const momGrowth = prevMonthTotal > 0 ? ((total - prevMonthTotal) / prevMonthTotal) * 100 : total > 0 ? 100 : 0;

    const yoyGrowth = prevYearTotal > 0 ? ((total - prevYearTotal) / prevYearTotal) * 100 : undefined;

    return {
      month,
      total,
      irregularity: data.irregularity,
      complaint: data.complaint,
      compliment: data.compliment,
      irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
      netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
      momGrowth,
      yoyGrowth,
      prevMonthTotal,
      prevYearTotal,
    };
  });

  if (monthFilter && monthFilter !== 'all') {
    return result.filter(r => r.month === monthFilter);
  }

  return result;
}

export async function fetchDailyTrend(filters: BaseFilters = {}): Promise<DailyDataPoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const dateMap = new Map<string, { total: number; Irregularity: number; Complaint: number }>();

  filtered.forEach(report => {
    const dateKey = getDateKey(report.date_of_event || report.created_at);
    if (!dateKey) return;

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { total: 0, Irregularity: 0, Complaint: 0 });
    }

    const data = dateMap.get(dateKey)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    data.total++;
    if (category === 'Irregularity') data.Irregularity++;
    else if (category === 'Complaint') data.Complaint++;
  });

  return Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-60)
    .map(([date, data]) => ({ date, ...data }));
}

export function fetchBranchByMonth(reports: Report[], filters: BaseFilters = {}): BranchByMonthData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { branch: string; month: string; count: number }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    const branch = report.branch || report.reporting_branch || report.station_code;

    if (!monthKey || !branch) return;

    const key = `${branch}-${monthKey}`;
    if (!map.has(key)) {
      map.set(key, { branch, month: monthKey, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export function fetchAirlineByMonth(reports: Report[], filters: BaseFilters = {}): AirlineByMonthData[] {
  const filtered = filterReports(reports, filters);

  const map = new Map<string, { airline: string; month: string; count: number }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    const airline = report.airlines || report.airline;

    if (!monthKey || !airline) return;

    const key = `${airline}-${monthKey}`;
    if (!map.has(key)) {
      map.set(key, { airline, month: monthKey, count: 0 });
    }
    map.get(key)!.count++;
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function fetchRollingAverage(filters: BaseFilters = {}): Promise<RollingAveragePoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, { ...filters, month: undefined });

  const monthMap = new Map<string, number>();
  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
  });

  const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const result: RollingAveragePoint[] = [];

  sorted.forEach(([month, actual], idx) => {
    const prev3 = sorted.slice(Math.max(0, idx - 2), idx + 1).map(([, v]) => v);
    const prev6 = sorted.slice(Math.max(0, idx - 5), idx + 1).map(([, v]) => v);

    result.push({
      month,
      actual,
      rollingAvg3: prev3.reduce((s, v) => s + v, 0) / prev3.length,
      rollingAvg6: prev6.reduce((s, v) => s + v, 0) / prev6.length,
    });
  });

  return result.slice(-14);
}

export async function fetchPeakDay(filters: BaseFilters = {}): Promise<PeakDayInfo> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const dayMap = new Map<string, number>();
  filtered.forEach(report => {
    const dateKey = getDateKey(report.date_of_event || report.created_at);
    if (!dateKey) return;
    dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
  });

  let peakDate = '';
  let peakCount = 0;
  dayMap.forEach((count, date) => {
    if (count > peakCount) {
      peakCount = count;
      peakDate = date;
    }
  });

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = peakDate ? days[new Date(peakDate).getDay()] : '-';

  return { date: peakDate || '-', count: peakCount, dayOfWeek };
}

export async function fetchDominantBranch(filters: BaseFilters = {}): Promise<DominantInfo> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();
  filtered.forEach(report => {
    const branch = report.branch || report.reporting_branch || report.station_code;
    if (!branch) return;
    map.set(branch, (map.get(branch) || 0) + 1);
  });

  let topName = '-';
  let topCount = 0;
  map.forEach((count, name) => {
    if (count > topCount) { topCount = count; topName = name; }
  });

  return { name: topName, count: topCount, percent: filtered.length > 0 ? (topCount / filtered.length) * 100 : 0 };
}

export async function fetchDominantAirline(filters: BaseFilters = {}): Promise<DominantInfo> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const map = new Map<string, number>();
  filtered.forEach(report => {
    const airline = report.airlines || report.airline;
    if (!airline) return;
    map.set(airline, (map.get(airline) || 0) + 1);
  });

  let topName = '-';
  let topCount = 0;
  map.forEach((count, name) => {
    if (count > topCount) { topCount = count; topName = name; }
  });

  return { name: topName, count: topCount, percent: filtered.length > 0 ? (topCount / filtered.length) * 100 : 0 };
}

export function fetchAllMonthlyReports(reports: Report[], filters: BaseFilters = {}): MonthlyReportRecord[] {
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
      Month: getMonthKey(report.date_of_event || report.created_at),
      Branch: report.branch || report.reporting_branch || report.station_code || '-',
      Airline: report.airlines || report.airline || '-',
      Category: normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || '-',
      Area: report.area || '-',
      Complimentary: String(report.remarks_gapura_kps || '-'),
      RootCause: String(report.root_caused || '-'),
      ActionTaken: String(report.action_taken || '-'),
      'Evidence': evidenceLink,
    };
  });
}

export async function fetchMonthlyKPIs(filters: BaseFilters = {}): Promise<MonthlyKPIs> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const monthCounts = new Map<string, number>();
  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
  });

  const sortedMonths = Array.from(monthCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const currentMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
  const previousMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

  const currentMonthTotal = currentMonth?.[1] || 0;
  const previousMonthTotal = previousMonth?.[1] || 0;
  const momChange = previousMonthTotal > 0
    ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
    : 0;

  const sortedByCount = [...sortedMonths].sort((a, b) => b[1] - a[1]);
  const highestPeak = sortedByCount.length > 0 ? sortedByCount[0] : null;

  return {
    currentMonthTotal,
    previousMonthTotal,
    momChange: Math.round(momChange),
    highestPeakMonth: {
      month: highestPeak?.[0] || 'N/A',
      count: highestPeak?.[1] || 0
    },
  };
}

export async function fetchMonthlyTrendByCategory(filters: BaseFilters = {}): Promise<MonthlyTrendData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);

  const monthMap = new Map<string, { total: number; irregularity: number; complaint: number; compliment: number }>();

  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    }

    const counts = monthMap.get(monthKey)!;
    counts.total++;
    if (category === 'Irregularity') counts.irregularity++;
    else if (category === 'Complaint') counts.complaint++;
    else if (category === 'Compliment') counts.compliment++;
  });

  return Array.from(monthMap.entries())
    .map(([month, counts]) => ({ month, ...counts }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
