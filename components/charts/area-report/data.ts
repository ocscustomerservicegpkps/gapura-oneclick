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
  growth: number;
}

export interface TrendDataPoint {
  month: string;
  total: number;
  Irregularity: number;
  Complaint: number;
}

export interface AreaCategoryData {
  area: string;
  Irregularity: number;
  Complaint: number;
  Compliment: number;
}

export interface BranchByAreaData {
  branch: string;
  area: string;
  count: number;
}

export interface AirlineByAreaData {
  airline: string;
  area: string;
  count: number;
}

export interface RootCauseByAreaData {
  rootCause: string;
  area: string;
  count: number;
  category: string;
}

export interface AreaReportRecord {
  [key: string]: unknown;
}

export interface CellIntelligence {
  title: string;
  total: number;
  count: number;
  branchTotal: number;
  systemTotal: number;
  branchShare: number;
  systemShare: number;
  rank: number;
  totalCombinations: number;
  irregularityCount: number;
  complaintCount: number;
  complimentCount: number;
  irregularityRate: number;
  complaintRate: number;
  complimentRate: number;
  contribution: number;
  severityScore: number;
  momGrowth: number;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface BranchAreaPareto {
  branch: string;
  count: number;
  cumulativePercent: number;
}

export type { SeverityDistribution } from "../shared-types";

export interface AggregatedAreaData {
  areaData: AreaSummary[];
  trendData: TrendDataPoint[];
  categoryData: AreaCategoryData[];
  kpis: {
    totalReports: number;
    areasTracked: number;
    overallIrregRate: number;
  };
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

const INVALID_CAUSE_VALUES = ['#n/a', 'unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', 'tidak ada', 'belum diketahui'];
const INVALID_BRANCH_VALUES = ['unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', '#n/a'];

const CORE_FIELDS = [
  'id', 'date_of_event', 'created_at', 'hub', 'branch', 'reporting_branch', 'station_code',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'airlines', 'airline', 'main_category', 'category', 'irregularity_complain_category',
  'root_caused', 'action_taken', 'evidence_url', 'evidence_urls', 'source_sheet'
];

function isValidValue(value: string | undefined | null): boolean {
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

function getArea(report: Report): string {
  return report.area || report.terminal_area_category || report.apron_area_category || report.general_category || '';
}

function filterReports(reports: Report[], filters: BaseFilters): Report[] {
  return reports.filter(report => {
    const sheet = filters.sourceSheet || 'NON CARGO';
    if (report.source_sheet && report.source_sheet !== sheet) return false;

    if (filters.dateFrom || filters.dateTo) {
      const reportDate = new Date(report.date_of_event || report.created_at);
      if (isNaN(reportDate.getTime())) return false;
      if (filters.dateFrom && reportDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (reportDate > toDate) return false;
      }
    }

    if (filters.hub && filters.hub !== 'all' && report.hub !== filters.hub) return false;
    if (filters.branch && filters.branch !== 'all') {
      const reportBranch = report.branch || report.reporting_branch || report.station_code;
      if (reportBranch !== filters.branch) return false;
    }
    if (filters.area && filters.area !== 'all') {
      const reportArea = getArea(report);
      const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
      const isCategoryFilter = ['Irregularity', 'Complaint', 'Compliment'].includes(filters.area);
      if (isCategoryFilter) {
        if (reportArea !== filters.area && category !== filters.area) return false;
      } else {
        if (reportArea !== filters.area) return false;
      }
    }
    if (filters.airlines && filters.airlines !== 'all' && report.airlines !== filters.airlines) return false;
    return true;
  });
}

export async function fetchReportsFromSheets(filters: BaseFilters): Promise<Report[]> {
  const query = new URLSearchParams();
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') query.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
  if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);
  query.append('fields', CORE_FIELDS.join(','));

  const response = await fetch(`/api/reports/analytics?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch reports');
  const data = await response.json();
  return data.reports || [];
}

export async function fetchAreaSummary(filters: BaseFilters = {}): Promise<AreaSummary[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);
  const areaMap = new Map<string, { total: number; irregularity: number; complaint: number; compliment: number }>();
  filtered.forEach(report => {
    const area = getArea(report);
    if (!isValidValue(area)) return;
    if (!areaMap.has(area)) areaMap.set(area, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
    const data = areaMap.get(area)!;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
    data.total++;
    if (category === 'Irregularity') data.irregularity++;
    else if (category === 'Complaint') data.complaint++;
    else if (category === 'Compliment') data.compliment++;
  });
  const totalReports = Array.from(areaMap.values()).reduce((sum, b) => sum + b.total, 0);
  return Array.from(areaMap.entries()).map(([area, data]) => ({
    area,
    total: data.total,
    irregularity: data.irregularity,
    complaint: data.complaint,
    compliment: data.compliment,
    irregularityRate: data.total > 0 ? (data.irregularity / data.total) * 100 : 0,
    netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
    riskIndex: (data.irregularity * 2) + data.complaint,
    rank: 0,
    contribution: totalReports > 0 ? (data.total / totalReports) * 100 : 0,
    growth: 0,
  })).sort((a, b) => b.total - a.total).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export async function fetchMonthlyTrendByArea(filters: BaseFilters = {}): Promise<TrendDataPoint[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);
  const monthMap = new Map<string, { total: number; Irregularity: number; Complaint: number }>();
  filtered.forEach(report => {
    const monthKey = getMonthKey(report.date_of_event || report.created_at);
    if (!monthKey) return;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, Irregularity: 0, Complaint: 0 });
    const data = monthMap.get(monthKey)!;
    data.total++;
    const cat = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
    if (cat === 'Irregularity') data.Irregularity++;
    else if (cat === 'Complaint') data.Complaint++;
  });
  return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([month, data]) => ({ month, ...data }));
}

export async function fetchCategoryByArea(filters: BaseFilters = {}): Promise<AreaCategoryData[]> {
  const reports = await fetchReportsFromSheets(filters);
  const filtered = filterReports(reports, filters);
  const areaMap = new Map<string, { Irregularity: number; Complaint: number; Compliment: number }>();
  filtered.forEach(report => {
    const area = getArea(report);
    if (!isValidValue(area)) return;
    if (!areaMap.has(area)) areaMap.set(area, { Irregularity: 0, Complaint: 0, Compliment: 0 });
    const cat = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category);
    if (cat === 'Irregularity') areaMap.get(area)!.Irregularity++;
    else if (cat === 'Complaint') areaMap.get(area)!.Complaint++;
    else if (cat === 'Compliment') areaMap.get(area)!.Compliment++;
  });
  return Array.from(areaMap.entries()).map(([area, data]) => ({ area, ...data })).sort((a, b) => (b.Irregularity + b.Complaint) - (a.Irregularity + a.Complaint));
}

export function fetchBranchByArea(reports: Report[], filters: BaseFilters = {}): BranchByAreaData[] {
  const filtered = filterReports(reports, filters);
  const map = new Map<string, { branch: string; area: string; count: number }>();
  filtered.forEach(report => {
    const area = getArea(report);
    const branch = String(report.branch || report.reporting_branch || report.station_code || 'Unknown');
    if (!isValidValue(area) || !isValidValue(branch)) return;
    const key = `${branch}-${area}`;
    if (!map.has(key)) map.set(key, { branch, area, count: 0 });
    map.get(key)!.count++;
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 30);
}

export function fetchAirlineByArea(reports: Report[], filters: BaseFilters = {}): AirlineByAreaData[] {
  const filtered = filterReports(reports, filters);
  const map = new Map<string, { airline: string; area: string; count: number }>();
  filtered.forEach(report => {
    const area = getArea(report);
    const airline = String(report.airlines || report.airline || 'Unknown');
    if (!isValidValue(area) || !isValidValue(airline)) return;
    const key = `${airline}-${area}`;
    if (!map.has(key)) map.set(key, { airline, area, count: 0 });
    map.get(key)!.count++;
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 30);
}

export function fetchRootCauseByArea(reports: Report[], filters: BaseFilters = {}): RootCauseByAreaData[] {
  const filtered = filterReports(reports, filters);
  const map = new Map<string, { area: string; count: number; category: string }>();
  filtered.forEach(report => {
    const area = getArea(report);
    const rootCause = report.root_caused || 'Unknown';
    if (!isValidValue(area) || !isValidRootCause(rootCause)) return;
    const category = normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || 'Other';
    const key = `${rootCause}-${area}`;
    if (!map.has(key)) map.set(key, { area, count: 0, category });
    map.get(key)!.count++;
  });
  return Array.from(map.entries()).map(([key, data]) => ({ rootCause: key.split('-')[0], ...data })).sort((a, b) => b.count - a.count).slice(0, 30);
}

export function fetchAllAreaReports(reports: Report[], filters: BaseFilters = {}): AreaReportRecord[] {
  const filtered = filterReports(reports, filters);
  return filtered.map(report => {
    const evidenceUrls = report.evidence_url || report.evidence_urls;
    let evidenceLink = '-';
    if (evidenceUrls) {
      if (Array.isArray(evidenceUrls)) {
        evidenceLink = evidenceUrls.slice(0, 3).map((url, i) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Link ${i + 1}</a>`).join(' ');
        if (evidenceUrls.length > 3) evidenceLink += ` +${evidenceUrls.length - 3} more`;
      } else if (typeof evidenceUrls === 'string' && evidenceUrls.startsWith('http')) {
        evidenceLink = `<a href="${evidenceUrls}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Link</a>`;
      }
    }
    return {
      Date: (report.date_of_event || report.created_at) ? new Date(report.date_of_event || report.created_at || '').toLocaleDateString('id-ID') : '-',
      Area: getArea(report) || '-',
      Branch: report.branch || report.reporting_branch || report.station_code || '-',
      Category: normalizeCategory(report.main_category || report.category || report.irregularity_complain_category) || '-',
      Airline: report.airlines || report.airline || '-',
      'Root Cause': report.root_caused || '-',
      'Action Taken': report.action_taken || '-',
      'Evidence': evidenceLink,
    };
  });
}

export async function fetchAggregatedAreaReport(filters: BaseFilters = {}, signal?: AbortSignal): Promise<AggregatedAreaData> {
  const query = new URLSearchParams();
  query.append('view', 'area-report');
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
  if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
  if (filters.area && filters.area !== 'all') query.append('area', filters.area);
  if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
  if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);

  const response = await fetch(`/api/reports/analytics/aggregated?${query.toString()}`, { credentials: 'include', signal });
  if (!response.ok) throw new Error('Failed to fetch aggregated area data');
  const { data } = await response.json();
  return data;
}

export async function fetchCellIntelligence(branch: string, area: string, filters: BaseFilters = {}, signal?: AbortSignal): Promise<CellIntelligence | null> {
  const params = new URLSearchParams();
  params.append('branch', branch);
  params.append('area', area);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.sourceSheet) params.append('sourceSheet', filters.sourceSheet);
  const response = await fetch(`/api/reports/analytics/cell-intelligence?${params.toString()}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch cell intelligence');
  const result = await response.json();
  return result.data;
}

export async function fetchBranchAreaPareto(filters: BaseFilters = {}, signal?: AbortSignal): Promise<BranchAreaPareto[]> {
  const params = new URLSearchParams();
  if (filters.hub) params.append('hub', filters.hub);
  if (filters.branch) params.append('branch', filters.branch);
  if (filters.area) params.append('area', filters.area);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.sourceSheet) params.append('sourceSheet', filters.sourceSheet);
  const response = await fetch(`/api/reports/analytics/branch-area-pareto?${params.toString()}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch pareto data');
  const result = await response.json();
  return result.data;
}
