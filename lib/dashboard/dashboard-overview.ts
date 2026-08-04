import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import type { Report } from '@/types';
import type {
  DashboardFilterOptions,
  DashboardOverview,
  DashboardStats,
} from './contracts';

function sortedUnique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
}

function reportBranch(report: Partial<Report>): string {
  return String(report.station_code || report.branch || report.reporting_branch || '').trim();
}

// Date-only values (YYYY-MM-DD) parse as UTC midnight, but timestamps parse
// with a local-time Date object — getFullYear() reads that back in the host
// timezone, which can shift the year for reports near a UTC year boundary.
// Extract the date-only year directly and use UTC semantics for timestamps.
function extractYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const dateOnlyMatch = /^(\d{4})-\d{2}-\d{2}/.exec(value);
  if (dateOnlyMatch) return Number(dateOnlyMatch[1]);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

function isGseReport(report: Partial<Report>): boolean {
  if (report.category_case_gse || report.gse_available_requirement || report.gse_requirement) return true;
  const text = [
    report.main_category,
    report.category,
    report.report,
    report.description,
    report.title,
    report.primary_tag,
  ].filter(Boolean).join(' ').toLowerCase();
  return /(^|[^a-z0-9])gse([^a-z0-9]|$)|ground support equipment/.test(text);
}

function isCgoReport(report: Partial<Report>): boolean {
  return String(report.primary_tag || '').trim().toUpperCase() === 'CGO'
    || String(report.source_sheet || '').trim().toUpperCase() === 'CGO'
    || Boolean(report.category_case_cargo || report.case_cgo);
}

function buildOverviewFromReports(reports: Report[]): DashboardOverview {
  const resolved = reports.filter((report) => String(report.status || '').trim().toUpperCase() === 'CLOSED').length;
  const pending = reports.filter((report) => String(report.status || '').trim().toUpperCase() === 'OPEN').length;
  const highSeverity = reports.filter((report) => [
    'TOP RISK', 'HIGH RISK', 'HIGH', 'CRITICAL',
  ].includes(String(report.severity || report.severity_level || '').trim().toUpperCase())).length;
  const years = Array.from(new Set(reports.map((report) => {
    const value = report.date_of_event || report.created_at;
    return extractYear(value as string | null | undefined);
  }).filter((year): year is number => year !== null))).sort((a, b) => a - b);
  const total = reports.length;
  const summary: DashboardStats = {
    total,
    resolved,
    pending,
    highSeverity,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    years,
  };
  const filterOptions: DashboardFilterOptions = {
    hubs: sortedUnique(reports.map((report) => report.hub || report.kode_hub)),
    branches: sortedUnique(reports.map(reportBranch)),
    airlines: sortedUnique(reports.map((report) => report.airlines || report.airline)),
    categories: sortedUnique(reports.map((report) => report.main_category || report.category)),
  };

  return {
    source: 'ground_handling',
    sourceCounts: { ground_handling: total },
    uniquePopulationCount: total,
    filteredCount: total,
    summary,
    filterOptions,
    tabPopulations: {
      summary: total,
      sqi: total,
      gse: reports.filter(isGseReport).length,
      cgo_cargo: reports.filter(isCgoReport).length,
      delay: total,
      status_details: total,
    },
    generatedAt: new Date().toISOString(),
    completeness: 'complete',
  };
}

function normalizeOverview(value: unknown): DashboardOverview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<DashboardOverview>;
  if (candidate.source !== 'ground_handling' || candidate.completeness !== 'complete') return null;
  if (!candidate.summary || typeof candidate.summary.total !== 'number') return null;
  if (!candidate.filterOptions || !candidate.tabPopulations || !candidate.generatedAt) return null;

  return {
    ...candidate,
    sourceCounts: candidate.sourceCounts || { ground_handling: candidate.summary.total },
    uniquePopulationCount: Number(candidate.uniquePopulationCount ?? candidate.summary.total),
    filteredCount: Number(candidate.filteredCount ?? candidate.summary.total),
    summary: {
      ...candidate.summary,
      years: Array.isArray(candidate.summary.years)
        ? candidate.summary.years.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
        : [],
    },
    filterOptions: {
      hubs: sortedUnique(Array.isArray(candidate.filterOptions.hubs) ? candidate.filterOptions.hubs : []),
      branches: sortedUnique(Array.isArray(candidate.filterOptions.branches) ? candidate.filterOptions.branches : []),
      airlines: sortedUnique(Array.isArray(candidate.filterOptions.airlines) ? candidate.filterOptions.airlines : []),
      categories: sortedUnique(Array.isArray(candidate.filterOptions.categories) ? candidate.filterOptions.categories : []),
    },
  } as DashboardOverview;
}

export async function getDashboardOverview(stationCodes?: readonly string[]): Promise<DashboardOverview> {
  const normalizedStations = sortedUnique(Array.from(stationCodes || []).map((code) => code.toUpperCase()));
  const { data, error } = await supabaseAdmin.rpc('dashboard_ground_overview', {
    p_station_codes: normalizedStations.length > 0 ? normalizedStations : null,
  });
  const overview = !error ? normalizeOverview(data) : null;
  if (overview) return overview;

  // Safe rollout fallback while the migration and application are deployed in
  // either order. This is still complete and server-only; it never falls back
  // to the first display page.
  const reports = await reportsService.getReports({
    projection: 'list',
    filters: normalizedStations.length > 0 ? { branchIn: normalizedStations } : undefined,
  }) as Report[];
  const scopedReports = normalizedStations.length === 0
    ? reports
    : reports.filter((report) => normalizedStations.includes(reportBranch(report).toUpperCase()));
  return buildOverviewFromReports(scopedReports);
}
