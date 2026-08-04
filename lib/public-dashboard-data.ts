import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import { processQuery } from '@/lib/engine/query-processor';
import type { QueryDefinition, QueryResult } from '@/types/builder';
import { applyDashboardScopeToQuery, normalizeDashboardScope, type DashboardScopeFilters } from '@/lib/dashboard-query-scope';
import { getSyncState } from '@/lib/sync-state';
import { hashCacheKey, readDashboardSnapshot, writeDashboardSnapshot } from '@/lib/dashboard-cache';
import { toLocalYMD } from '@/lib/utils/wib-date';

interface DashboardChartRow {
  id: string;
  title: string;
  chart_type: string;
  data_field: string;
  width: string;
  position: number;
  query_config?: QueryDefinition | null;
  visualization_config?: Record<string, unknown> | null;
  layout?: Record<string, unknown> | null;
  page_name?: string | null;
}

interface DashboardRow {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  config: {
    dateRange?: string;
    autoRefresh?: boolean;
    dateFrom?: string;
    dateTo?: string;
    subtitle?: string;
    filters?: string[];
    pages?: string[];
    hideControls?: boolean;
  } | null;
  dashboard_charts: DashboardChartRow[];
}

interface AggregatedItem {
  name: string;
  count: number;
  percentage: number;
}

interface LegacyStatsPayload {
  type: string;
  range: string;
  totalCount: number;
  distribution: AggregatedItem[];
  trendData: { date: string; count: number }[];
}

interface PublicDashboardChartResult {
  type: 'legacy' | 'query';
  stats?: LegacyStatsPayload;
  queryResult?: QueryResult;
}

interface PublicDashboardPagePayload {
  dashboard: DashboardRow;
  chartResults: Record<string, PublicDashboardChartResult>;
  investigativeResult?: QueryResult;
  syncVersion: number;
  sourceSyncAt: string | null;
}

function buildPages(dashboard: DashboardRow) {
  const charts = dashboard.dashboard_charts || [];
  const hasPages = charts.some((chart) => chart.page_name && chart.page_name !== 'Ringkasan Umum');
  const configPages = dashboard.config?.pages;

  if (hasPages || (configPages && configPages.length > 1)) {
    const pageMap = new Map<string, DashboardChartRow[]>();
    for (const pageName of configPages || []) {
      pageMap.set(pageName, []);
    }

    for (const chart of charts) {
      const pageName = chart.page_name || 'Ringkasan Umum';
      if (!pageMap.has(pageName)) {
        pageMap.set(pageName, []);
      }
      pageMap.get(pageName)!.push(chart);
    }

    return Array.from(pageMap.entries())
      .filter(([, tiles]) => tiles.length > 0)
      .map(([name, tiles]) => ({
        name,
        tiles: tiles.sort((a, b) => a.position - b.position),
      }));
  }

  return [{
    name: 'Ringkasan Umum',
    tiles: [...charts].sort((a, b) => a.position - b.position),
  }];
}

function aggregateByField(reports: Record<string, unknown>[], field: string): AggregatedItem[] {
  const counts = new Map<string, number>();
  for (const report of reports) {
    const raw = report[field];
    const key = String(raw || 'Unknown');
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const total = reports.length || 1;
  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildTrendData(reports: Record<string, unknown>[], rangeDays: number): { date: string; count: number }[] {
  const dateMap = new Map<string, number>();
  // Anchor "today" on the WIB calendar day, then step by whole days using UTC-midnight
  // arithmetic so no further timezone shift is introduced when building the bucket keys.
  const [ty, tm, td] = toLocalYMD(new Date()).split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const value = new Date(todayUtc - i * 86400000);
    dateMap.set(value.toISOString().split('T')[0], 0);
  }

  for (const report of reports) {
    const createdAtRaw = report.created_at;
    if (!createdAtRaw) continue;
    const createdAt = new Date(String(createdAtRaw));
    if (Number.isNaN(createdAt.getTime())) continue;
    const dateKey = toLocalYMD(createdAt);
    if (dateMap.has(dateKey)) {
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildLegacyStats(
  reports: Record<string, unknown>[],
  dataField: string,
  range: string,
): LegacyStatsPayload {
  const fieldMap: Record<string, string> = {
    airline: 'airline',
    category: 'main_category',
    status: 'status',
    severity: 'severity',
    area: 'area',
    station: 'station_code',
  };
  const rangeDays = range === '30d' ? 30 : 7;
  const field = fieldMap[dataField] || 'airline';

  return {
    type: dataField,
    range,
    totalCount: reports.length,
    distribution: aggregateByField(reports, field),
    trendData: buildTrendData(reports, rangeDays),
  };
}

function buildInvestigativeQuery(): QueryDefinition {
  return {
    source: 'reports',
    dimensions: [
      { table: 'reports', field: 'date_of_event', alias: 'Date' },
      { table: 'reports', field: 'main_category', alias: 'Category' },
      { table: 'reports', field: 'branch', alias: 'Branch' },
      { table: 'reports', field: 'airlines', alias: 'Airlines' },
      { table: 'reports', field: 'flight_number', alias: 'Flight' },
      { table: 'reports', field: 'report', alias: 'Report' },
      { table: 'reports', field: 'root_caused', alias: 'Root Caused' },
      { table: 'reports', field: 'action_taken', alias: 'Action Taken' },
      { table: 'reports', field: 'preventive_action', alias: 'Preventive Action' },
      { table: 'reports', field: 'status', alias: 'Status' },
      { table: 'reports', field: 'evidence_url', alias: 'Evidence Link' },
    ],
    measures: [],
    filters: [],
    joins: [],
    sorts: [{ field: 'created_at', direction: 'desc' }],
    limit: 1000,
  };
}

function filterReportsForScope(
  reports: Record<string, unknown>[],
  options: {
    filters?: DashboardScopeFilters;
    dateFrom?: string;
    dateTo?: string;
    activePage?: number;
  },
) {
  const scopedQuery = applyDashboardScopeToQuery({
    source: 'reports',
    dimensions: [],
    measures: [],
    filters: [],
    joins: [],
    sorts: [],
    limit: reports.length,
  }, options);

  return processQuery(scopedQuery, reports).rows as Record<string, unknown>[];
}

// holds the in-flight promise (not the resolved value) so concurrent callers
// from a parallel chart loop share one fetch instead of racing duplicate ones
function loadReportsOnce(reportsRef: { current: Promise<Record<string, unknown>[]> | null }) {
  if (!reportsRef.current) {
    reportsRef.current = reportsService.getReports() as unknown as Promise<Record<string, unknown>[]>;
  }
  return reportsRef.current;
}

export async function getPublicDashboardPageData(options: {
  slug: string;
  pageIndex: number;
  range: string;
  filters?: DashboardScopeFilters;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PublicDashboardPagePayload> {
  const {
    slug,
    pageIndex,
    range,
    filters = {},
    dateFrom,
    dateTo,
  } = options;

  const { data: dashboard, error } = await supabaseAdmin
    .from('custom_dashboards')
    .select(`
      id,
      name,
      description,
      slug,
      config,
      dashboard_charts (
        id,
        title,
        chart_type,
        data_field,
        position,
        width,
        query_config,
        visualization_config,
        layout,
        page_name
      )
    `)
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error || !dashboard) {
    throw error || new Error('Dashboard not found');
  }

  const typedDashboard = dashboard as DashboardRow;
  const pages = buildPages(typedDashboard);
  const currentPage = pages[pageIndex] || pages[0];
  if (!currentPage) {
    return {
      dashboard: typedDashboard,
      chartResults: {},
      syncVersion: 0,
      sourceSyncAt: null,
    };
  }

  const isCustomerFeedbackDashboard =
    typedDashboard.name.toLowerCase().includes('customer feedback') ||
    slug.toLowerCase().includes('customer-feedback');

  let chartsToFetch = [...currentPage.tiles];
  if (isCustomerFeedbackDashboard && [0, 1, 2, 3, 4].includes(pageIndex)) {
    const kpiSourcePageIndex = pageIndex === 0 ? 1 : pageIndex === 3 ? 4 : pageIndex;
    const extraKpis = (pages[kpiSourcePageIndex]?.tiles || []).filter((tile) => {
      const chartType = String(tile.visualization_config?.chartType || tile.chart_type || '');
      return chartType === 'kpi';
    });
    chartsToFetch = [...chartsToFetch, ...extraKpis];
  }

  const syncState = await getSyncState('reports');
  const syncVersion = Number(syncState.sync_version || 0);
  const sourceSyncAt = syncState.last_sync_at || null;
  const scope = normalizeDashboardScope(filters, dateFrom, dateTo);
  const scopeKey = hashCacheKey({
    slug,
    range,
    pageIndex,
    scope,
  });

  const reportsRef: { current: Promise<Record<string, unknown>[]> | null } = { current: null };
  const chartResults: Record<string, PublicDashboardChartResult> = {};

  let investigativeResult: QueryResult | undefined;
  const investigativeCacheKey = isCustomerFeedbackDashboard && [1, 4].includes(pageIndex)
    ? hashCacheKey({ kind: 'investigative', dashboardSlug: slug, pageIndex, range, scope, syncVersion })
    : null;

  const investigativeTask = investigativeCacheKey
    ? (async () => {
        try {
          const cached = await readDashboardSnapshot<QueryResult>(investigativeCacheKey, syncVersion);
          if (cached?.payload) {
            investigativeResult = cached.payload;
            return;
          }
          const reports = await loadReportsOnce(reportsRef);
          investigativeResult = processQuery(
            applyDashboardScopeToQuery(buildInvestigativeQuery(), { filters, dateFrom, dateTo, activePage: pageIndex }),
            reports,
          );
          await writeDashboardSnapshot({
            cacheKey: investigativeCacheKey,
            scopeKey,
            dashboardSlug: slug,
            tileId: null,
            payload: investigativeResult,
            syncVersion,
            ttlSeconds: 300,
          });
        } catch (investigativeError) {
          console.error(`[Dashboard] Error processing investigative query for "${slug}":`, investigativeError);
          investigativeResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
        }
      })()
    : Promise.resolve();

  // each chart's cache read/write is its own Supabase round trip — running
  // them sequentially with a for-loop stacked up 8-12 round trips per page
  // switch (the 5s+ delay); Promise.all runs them concurrently instead
  await Promise.all([investigativeTask, ...chartsToFetch.map(async (chart) => {
    try {
      const cacheKey = hashCacheKey({
        kind: 'tile',
        dashboardSlug: slug,
        tileId: chart.id,
        chartType: chart.chart_type,
        query: chart.query_config || null,
        range,
        pageIndex,
        scope,
        syncVersion,
      });

      const cached = await readDashboardSnapshot<PublicDashboardChartResult>(cacheKey, syncVersion);
      if (cached?.payload) {
        chartResults[chart.id] = cached.payload;
        return;
      }

      const reports = await loadReportsOnce(reportsRef);
      let payload: PublicDashboardChartResult;
      if (chart.query_config) {
        const scopedQuery = applyDashboardScopeToQuery(chart.query_config, {
          filters,
          dateFrom,
          dateTo,
          activePage: pageIndex,
        });
        payload = {
          type: 'query',
          queryResult: processQuery(scopedQuery, reports),
        };
      } else {
        payload = {
          type: 'legacy',
          stats: buildLegacyStats(
            filterReportsForScope(reports, {
              filters,
              dateFrom,
              dateTo,
              activePage: pageIndex,
            }),
            chart.data_field,
            range,
          ),
        };
      }

      chartResults[chart.id] = payload;
      await writeDashboardSnapshot({
        cacheKey,
        scopeKey,
        dashboardSlug: slug,
        tileId: chart.id,
        payload,
        syncVersion,
        ttlSeconds: 300,
      });
    } catch (chartError) {
      console.error(`[Dashboard] Error processing chart "${chart.title}" (${chart.id}):`, chartError);
      chartResults[chart.id] = {
        type: 'query',
        queryResult: { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 },
      };
    }
  })]);

  return {
    dashboard: typedDashboard,
    chartResults,
    investigativeResult,
    syncVersion,
    sourceSyncAt,
  };
}
