import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { enrichReportsWithComments } from '@/lib/server/report-comments';
import {
  buildReportCursorFilter,
  decodeReportCursor,
  encodeReportCursor,
  quoteReportFilterValue,
  sanitizeReportSearch,
} from '@/lib/report-page-cursor';
import {
  parseReportLimit,
  resolveReportPageAccess,
  type ReportListItem,
  type ReportPage,
} from '@/lib/report-page';
import type { Report, SessionPayload } from '@/types';

interface ReportPageFilters {
  status?: string | null;
  station?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  severity?: string | null;
  hub?: string | null;
  category?: string | null;
  airline?: string | null;
  area?: string | null;
  sourceSheet?: string | null;
}

interface QueryReportPageOptions {
  session: SessionPayload;
  scope?: 'standard' | 'admin';
  limit?: number;
  cursor?: string | null;
  filters?: ReportPageFilters;
  projection?: 'list' | 'detail';
  includeComments?: boolean;
}

export class ReportPageQueryError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message);
    this.name = 'ReportPageQueryError';
  }
}

// Dashboards read a wide, evolving set of fields (cargo category, airline type,
// evidence fallbacks, …). A hand-maintained projection silently drops any field
// a chart later starts reading, producing empty tiles. The table is small
// (~1.2k rows, ~3KB/row, no heavy/blob columns), so selecting every column is
// cheap and removes that whole class of bug. REPORT_PROJECTIONS.list is kept for
// leaner API consumers that opt into a narrow shape.
const REPORT_LIST_SELECT = '*';
const REPORT_STATION_FIELDS = [
  'station_id',
  'station_code',
  'branch',
  'reporting_branch',
  'kode_cabang',
] as const;

function parseDateFilter(value: string | null | undefined, endOfDay = false): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ReportPageQueryError('Invalid report date filter', 400);
  }
  return date.toISOString();
}

function buildColumnValueOrFilter(columns: readonly string[], values: readonly string[]): string {
  return columns.flatMap((column) => values.map(
    (value) => `${column}.eq.${quoteReportFilterValue(value)}`,
  )).join(',');
}

async function resolveManagerStationValues(session: SessionPayload): Promise<string[]> {
  const stationId = String(session.station_id || '').trim();
  if (!stationId) return [];

  const { data } = await supabaseAdmin
    .from('stations')
    .select('id,code,name')
    .eq('id', stationId)
    .maybeSingle();

  return Array.from(new Set([
    stationId,
    String(data?.id || '').trim(),
    String(data?.code || '').trim(),
    String(data?.name || '').trim(),
  ].filter(Boolean)));
}

function normalizeReportRows(rows: readonly Record<string, unknown>[]): Report[] {
  return rows.map((row) => ({
    ...row,
    id: String(row.id || ''),
    title: String(row.title || row.report || 'Untitled report'),
    status: row.status || 'OPEN',
    severity: row.severity || 'LOW',
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  })) as Report[];
}

export async function queryReportPage(
  options: QueryReportPageOptions,
): Promise<ReportPage<ReportListItem | Report>> {
  const startedAt = performance.now();
  const scope = options.scope ?? 'standard';
  const access = resolveReportPageAccess(options.session.role, scope);
  const limit = parseReportLimit(String(options.limit || ''));
  const cursor = decodeReportCursor(options.cursor);
  if (options.cursor && !cursor) {
    throw new ReportPageQueryError('Invalid report cursor', 400);
  }

  if (access.kind === 'forbidden') {
    throw new ReportPageQueryError('Forbidden', 403);
  }

  const managerStationValues = access.kind === 'manager'
    ? await resolveManagerStationValues(options.session)
    : [];
  if (access.kind === 'manager' && managerStationValues.length === 0) {
    return {
      reports: [],
      pagination: { limit, nextCursor: null, hasMore: false },
      meta: { generatedAt: new Date().toISOString(), source: 'fresh', durationMs: Math.round(performance.now() - startedAt) },
    };
  }

  const select = options.projection === 'detail' ? '*' : REPORT_LIST_SELECT;
  let query = supabaseAdmin
    .from('ground_handling_irregularity_report')
    .select(select)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (access.kind === 'employee') {
    const identityFilters = [
      options.session.id ? `user_id.eq.${quoteReportFilterValue(String(options.session.id))}` : null,
      options.session.email ? `reporter_email.eq.${quoteReportFilterValue(String(options.session.email).trim().toLowerCase())}` : null,
      options.session.full_name ? `reporter_name.eq.${quoteReportFilterValue(String(options.session.full_name).trim())}` : null,
    ].filter((value): value is string => value !== null);
    query = identityFilters.length > 0
      ? query.or(identityFilters.join(','))
      : query.eq('id', '__no_match__');
  } else if (access.kind === 'manager') {
    query = query.or(buildColumnValueOrFilter(REPORT_STATION_FIELDS, managerStationValues));
  } else if (access.kind === 'division') {
    // This access kind is no longer produced by resolveReportPageAccess; if it
    // ever is, division users see the full company set, like the dashboards.
  }

  const filters = options.filters;
  const status = String(filters?.status || '').trim();
  if (status && status.toLowerCase() !== 'all') query = query.eq('status', status);

  const severity = String(filters?.severity || '').trim();
  if (severity && severity.toLowerCase() !== 'all') {
    const severityGroup = severity.toLowerCase();
    if (severityGroup === 'high') {
      query = query.in('severity', ['TOP RISK', 'HIGH RISK', 'HIGH', 'CRITICAL']);
    } else if (severityGroup === 'medium') {
      query = query.in('severity', ['MEDIUM', 'Medium', 'medium']);
    } else if (severityGroup === 'low') {
      query = query.in('severity', ['LOW', 'Low', 'low']);
    } else {
      query = query.eq('severity', severity);
    }
  }

  const station = String(filters?.station || '').trim();
  if (station && station.toLowerCase() !== 'all') {
    query = query.or(buildColumnValueOrFilter(REPORT_STATION_FIELDS, [station]));
  }

  const hub = String(filters?.hub || '').trim();
  if (hub && hub.toLowerCase() !== 'all') query = query.eq('hub', hub);

  const category = String(filters?.category || '').trim();
  if (category && category.toLowerCase() !== 'all') {
    query = query.or(buildColumnValueOrFilter(
      ['main_category', 'category', 'irregularity_complain_category'],
      [category],
    ));
  }

  const airline = String(filters?.airline || '').trim();
  if (airline && airline.toLowerCase() !== 'all') {
    query = query.or(buildColumnValueOrFilter(['airlines', 'airline'], [airline]));
  }

  const area = String(filters?.area || '').trim();
  if (area && area.toLowerCase() !== 'all') query = query.eq('area', area);

  const from = parseDateFilter(filters?.from);
  const to = parseDateFilter(filters?.to, true);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const sourceSheet = String(filters?.sourceSheet || '').trim();
  if (sourceSheet && sourceSheet.toLowerCase() !== 'all') query = query.eq('source_sheet', sourceSheet);

  const search = sanitizeReportSearch(filters?.search);
  if (search) {
    const pattern = quoteReportFilterValue(`*${search}*`);
    const searchFilters = [
      `title.ilike.${pattern}`,
      `report.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `reference_number.ilike.${pattern}`,
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)) {
      searchFilters.push(`id.eq.${quoteReportFilterValue(search)}`);
    }
    query = query.or(searchFilters.join(','));
  }

  if (cursor) query = query.or(buildReportCursorFilter(cursor));

  const { data, error } = await query.limit(limit + 1);
  if (error) throw error;

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const reports = normalizeReportRows(visibleRows);
  const enriched = options.includeComments === false
    ? reports
    : await enrichReportsWithComments(reports);
  const reportsWithComments = enriched.map((report) => ({
    ...report,
    comments: report.comments || [],
  }));

  const last = visibleRows.at(-1);
  const nextCursor = hasMore && last?.created_at && last?.id
    ? encodeReportCursor({ createdAt: String(last.created_at), id: String(last.id) })
    : null;

  return {
    reports: reportsWithComments,
    pagination: { limit, nextCursor, hasMore },
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'fresh',
      durationMs: Math.round(performance.now() - startedAt),
    },
  };
}
