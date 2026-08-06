import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import { enrichReportsWithComments } from '@/lib/server/report-comments';
import { rowToReport, type JoumpaSyncRow } from '@/lib/joumpa/sync-mapping';
import { getActivePublishedDashboard } from './service';
import { ALL_TABS, type ShareScope } from './types';
import type { Report } from '@/types';

// Mirrors the date-range semantics of DivisionAnalystDashboard
// (filterReportsByDateRange): 'all' | 'week' | 'month' | { from, to }.
function applyDateRange(reports: Report[], scope: ShareScope): Report[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let cutoffDate: Date;
  let explicitEndDate: Date | null = null;

  if (scope.dateFrom && scope.dateTo) {
    cutoffDate = new Date(scope.dateFrom);
    cutoffDate.setHours(0, 0, 0, 0);
    explicitEndDate = new Date(scope.dateTo);
    explicitEndDate.setHours(23, 59, 59, 999);
  } else if (scope.dateRange === 'week') {
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (scope.dateRange === 'month') {
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  } else {
    cutoffDate = new Date(0); // 'all' (default)
  }

  const endDate = explicitEndDate || today;
  return reports.filter((r) => {
    const dateStr = r.date_of_event || r.created_at;
    if (!dateStr) return false;
    let d: Date;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, day] = dateStr.split('-').map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(dateStr);
    }
    return d >= cutoffDate && d <= endDate;
  });
}

// Same filter semantics as DivisionAnalystDashboard's global filters:
// hub, station (stations?.code || branch), airline (airlines || airline),
// category (main_category). Scope values are treated as exact matches.
function applyScopeFilters(reports: Report[], scope: ShareScope): Report[] {
  let result = applyDateRange(reports, scope);

  if (scope.hubs.length > 0) {
    result = result.filter((r) => scope.hubs.includes(r.hub || ''));
  }
  if (scope.stations.length > 0) {
    result = result.filter((r) => {
      const branchCode = r.stations?.code || r.branch || '';
      return scope.stations.includes(branchCode);
    });
  }
  if (scope.airlines.length > 0) {
    result = result.filter((r) => scope.airlines.includes(r.airlines || r.airline || ''));
  }
  if (scope.categories.length > 0) {
    result = result.filter((r) => scope.categories.includes(r.main_category || ''));
  }
  return result;
}

function sortedUnique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
}

function deriveAvailableOptions(reports: Report[]) {
  return {
    hubs: sortedUnique(reports.map((r) => r.hub)),
    branches: sortedUnique(reports.map((r) => r.stations?.code || r.branch)),
    airlines: sortedUnique(reports.map((r) => r.airlines || r.airline)),
    categories: sortedUnique(reports.map((r) => r.main_category)),
  };
}

// Safety cap on the joumpa sync select — mirrors /api/joumpa's DEFAULT_SYNC_LIMIT.
const JOUMPA_SYNC_LIMIT = 5000;

export interface OcsRecordRow {
  id: string;
  tab: string;
  [key: string]: string | null | undefined;
}

// Only the published tab's rows are needed; a whole-dashboard link (tab === '*')
// still pulls every tab.
async function fetchOcsRecords(tab: string): Promise<OcsRecordRow[]> {
  let query = supabaseAdmin
    .from('ocs_tab_records')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(0, 1999);

  if (tab !== ALL_TABS) {
    query = query.eq('tab', tab);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as OcsRecordRow[];
}

// Comment enrichment fans out one query per 100 report ids, so it runs on the
// scope-filtered subset rather than the full sync table.
async function fetchJoumpaReports(scope: ShareScope): Promise<Report[]> {
  const { data, error } = await supabaseAdmin
    .from('joumpa_reports_sync')
    .select('*')
    .order('date_of_event', { ascending: false, nullsFirst: false })
    .order('row_number', { ascending: false })
    .range(0, JOUMPA_SYNC_LIMIT - 1);

  if (error) throw error;
  const rows = (data || []) as JoumpaSyncRow[];
  return enrichReportsWithComments(applyScopeFilters(rows.map(rowToReport), scope));
}

export interface PublicShareData {
  dashboardKey: string;
  tab: string;
  name: string | null;
  scope: ShareScope;
  reports: Report[];
  joumpaReports: Report[];
  ocsRecords: OcsRecordRow[];
  availableOptions: {
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  };
}

// Server-side fetch for the public /share/[slug] page. Resolves the active
// link, pulls the same session-free service data the authenticated tabs use,
// and applies the publish-time scope. Throws when the link is missing/revoked.
export async function getPublicShareData(slug: string): Promise<PublicShareData> {
  const record = await getActivePublishedDashboard(slug);
  if (!record) {
    throw new Error('SHARE_NOT_FOUND');
  }
  const scope = record.config.scope ?? { hubs: [], stations: [], airlines: [], categories: [] };

  // Fetch only what the published dashboard actually renders. An OCS link never
  // touches the reports/joumpa tables, and a report link only pulls joumpa when
  // that tab is part of the publish scope.
  const isOcs = record.dashboardKey === 'ocs';
  const needsJoumpa = !isOcs && (record.tab === ALL_TABS || record.tab === 'joumpa');

  const [allReports, joumpa, ocsRecords] = await Promise.all([
    isOcs ? Promise.resolve([]) : (reportsService.getReports({ source: 'sync' }) as Promise<Report[]>),
    needsJoumpa ? fetchJoumpaReports(scope) : Promise.resolve([]),
    isOcs ? fetchOcsRecords(record.tab) : Promise.resolve([]),
  ]);

  const reports = applyScopeFilters(allReports, scope);

  return {
    dashboardKey: record.dashboardKey,
    tab: record.tab,
    name: record.name,
    scope,
    reports,
    joumpaReports: joumpa,
    ocsRecords,
    availableOptions: deriveAvailableOptions(reports),
  };
}
