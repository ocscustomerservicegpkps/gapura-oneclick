import "server-only";
import { reportsService, parseReportSyncFields, type ReportQueryFilters } from '@/lib/services/reports-service';
import type { QueryDefinition, QueryFilter } from '@/types/builder';
import type { Report } from '@/types';
import { processQuery } from '@/lib/engine/query-processor';

interface QueryContext {
  canViewAll: boolean;
  userStationCode: string | null;
  preloadedReports?: Report[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

const DATE_FIELDS = new Set(['date_of_event', 'created_at', 'incident_date']);
const EXACT_FILTER_FIELD_MAP: Record<string, keyof ReportQueryFilters> = {
  hub: 'hub',
  area: 'area',
  airlines: 'airlines',
  airline: 'airlines',
  source_sheet: 'sourceSheet',
  status: 'status',
};
const BRANCH_LIKE_FIELDS = new Set(['branch', 'station_code', 'reporting_branch']);

/**
 * Best-effort translation of a QueryDefinition's filters into the DB-pushdown
 * shape reportsService.getReports() understands. This is purely an I/O
 * optimization — processQuery() still re-applies every original filter
 * against whatever rows come back, so a pushdown filter only needs to be a
 * safe superset of the true condition (never narrower), and any filter this
 * function can't confidently map is simply left for processQuery to handle
 * against an unfiltered fetch.
 */
function buildPushdownFilters(query: QueryDefinition): ReportQueryFilters | undefined {
  // An OR anywhere in the filter list means a single AND-ed DB predicate could
  // wrongly exclude rows the OR should have kept — bail out entirely rather
  // than risk dropping data.
  if (query.filters.some((filter: QueryFilter) => filter.conjunction === 'OR')) return undefined;

  const filters: ReportQueryFilters = {};

  for (const filter of query.filters) {
    if (DATE_FIELDS.has(filter.field) && typeof filter.value === 'string') {
      if (filter.operator === 'gte' || filter.operator === 'gt') {
        filters.dateFrom = filter.value;
        continue;
      }
      if (filter.operator === 'lte' || filter.operator === 'lt') {
        filters.dateTo = filter.value;
        continue;
      }
    }

    if (BRANCH_LIKE_FIELDS.has(filter.field)) {
      if (filter.operator === 'eq' && typeof filter.value === 'string') {
        filters.branch = filter.value;
        continue;
      }
      if (filter.operator === 'in' && Array.isArray(filter.value)) {
        filters.branchIn = filter.value.map(String);
        continue;
      }
    }

    if (filter.operator === 'eq' && typeof filter.value === 'string') {
      const mapped = EXACT_FILTER_FIELD_MAP[filter.field];
      if (mapped) {
        (filters as Record<string, unknown>)[mapped] = filter.value;
      }
    }
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Narrows the Postgres select() to only the columns this query definition
 * actually references. Falls back to an unrestricted fetch (undefined) if any
 * referenced field isn't a recognized report column — e.g. a computed/alias
 * dimension — since a bad column name in select() fails the whole query.
 *
 * `branch` is always kept even if the query itself never references it: the
 * station-scoping access check below reads `r.branch`, and a narrowed
 * projection that dropped it would make every row's branch undefined —
 * silently returning zero rows to every station-restricted user.
 */
function buildProjectionFields(query: QueryDefinition, requireBranch: boolean) {
  const referenced = new Set<string>();
  query.dimensions.forEach((d) => referenced.add(d.field));
  query.measures.forEach((m) => referenced.add(m.field));
  query.filters.forEach((f) => referenced.add(f.field));
  query.sorts.forEach((s) => referenced.add(s.field));
  if (requireBranch) referenced.add('branch');

  if (referenced.size === 0) return undefined;

  const { fields, invalid } = parseReportSyncFields(Array.from(referenced));
  return invalid.length === 0 && fields.length > 0 ? fields : undefined;
}

export async function executeQuery(query: QueryDefinition, context: QueryContext): Promise<QueryResult> {
  const source = (query.source || 'reports').toLowerCase();
  const startTime = Date.now();

  if (source === 'reports') {
    const isStationScoped = !context.canViewAll && Boolean(context.userStationCode);

    const pushdownFilters = buildPushdownFilters(query);
    // Push the station scope down to Postgres too when it applies — on top of
    // (not instead of) the client-side re-check below, matching the
    // defense-in-depth pattern used elsewhere (e.g. getDashboardOverview).
    const filters = isStationScoped
      ? { ...pushdownFilters, branch: context.userStationCode! }
      : pushdownFilters;

    const reports = context.preloadedReports || await reportsService.getReports({
      filters,
      fields: buildProjectionFields(query, isStationScoped),
    });

    let accessibleReports = reports;
    if (!context.canViewAll) {
      if (context.userStationCode) {
        accessibleReports = reports.filter(r => r.branch === context.userStationCode);
      } else {
        accessibleReports = [];
      }
    }

    const result = processQuery(query, accessibleReports);

    return {
      ...result,
      executionTimeMs: Date.now() - startTime
    };
  }

  throw new Error(`Source '${source}' is not supported with Google Sheets backend.`);
}
