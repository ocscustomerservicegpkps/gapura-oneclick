import type { ProjectedReport } from '@/lib/services/reports-service';
import type { Report } from '@/types';

export const DEFAULT_REPORT_PAGE_LIMIT = 50;
export const MAX_REPORT_PAGE_LIMIT = 100;
export const REPORT_PAGE_CACHE_SCHEMA = 1;
export const REPORT_PAGE_FRESH_MS = 5 * 60 * 1000;
const REPORT_PAGE_MAX_STALE_MS = 24 * 60 * 60 * 1000;

export type ReportListItem = ProjectedReport<'list'> & {
  comments: NonNullable<Report['comments']>;
};

export interface ReportPage<TItem> {
  reports: readonly TItem[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
  meta: {
    generatedAt: string;
    source: 'fresh' | 'cache';
    durationMs?: number;
  };
}

export interface PersistedReportPage<TItem> {
  schema: typeof REPORT_PAGE_CACHE_SCHEMA;
  query: string;
  timestamp: number;
  page: ReportPage<TItem>;
}

type ReportPageAccess =
  | { kind: 'company' }
  | { kind: 'division'; division: string }
  | { kind: 'employee' }
  | { kind: 'manager' }
  | { kind: 'forbidden' };

export function resolveReportPageAccess(
  roleValue: unknown,
  scope: 'standard' | 'admin',
): ReportPageAccess {
  const role = String(roleValue || '').trim().toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'ANALYST') return { kind: 'company' };
  if (role === 'MANAGER_CABANG') return { kind: 'manager' };
  if (role === 'STAFF_CABANG' || role === 'CABANG' || role === 'EMPLOYEE') {
    return scope === 'admin' ? { kind: 'forbidden' } : { kind: 'employee' };
  }
  // Division/partner roles see all reports company-wide. Automatic scoping by
  // division was removed: the underlying data is unpopulated, so scoping emptied
  // every division dashboard.
  if (role.startsWith('DIVISI_') || role.startsWith('PARTNER_')) {
    return { kind: 'company' };
  }
  return { kind: 'forbidden' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseReportLimit(value: string | null | undefined): number {
  if (!value) return DEFAULT_REPORT_PAGE_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REPORT_PAGE_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_REPORT_PAGE_LIMIT);
}

function isReportPage<TItem = Report>(value: unknown): value is ReportPage<TItem> {
  if (!isRecord(value) || !Array.isArray(value.reports)) return false;
  if (!isRecord(value.pagination) || !isRecord(value.meta)) return false;

  return (
    typeof value.pagination.limit === 'number'
    && typeof value.pagination.hasMore === 'boolean'
    && (typeof value.pagination.nextCursor === 'string' || value.pagination.nextCursor === null)
    && typeof value.meta.generatedAt === 'string'
    && (value.meta.source === 'fresh' || value.meta.source === 'cache')
  );
}

export function normalizeReportPage<TItem = Report>(value: unknown): ReportPage<TItem> {
  if (isReportPage<TItem>(value)) return value;

  const reports = Array.isArray(value) ? value as TItem[] : [];
  return {
    reports,
    pagination: {
      limit: reports.length || DEFAULT_REPORT_PAGE_LIMIT,
      nextCursor: null,
      hasMore: false,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'fresh',
    },
  };
}

export function reportsFromPayload<TItem = Report>(value: unknown): TItem[] {
  return Array.from(normalizeReportPage<TItem>(value).reports);
}

export function withReportCursor(url: string, cursor: string | null, limit?: number): string {
  const [path, rawQuery = ''] = url.split('?', 2);
  const searchParams = new URLSearchParams(rawQuery);
  searchParams.set('limit', String(parseReportLimit(limit ? String(limit) : searchParams.get('limit'))));
  if (cursor) searchParams.set('cursor', cursor);
  else searchParams.delete('cursor');
  return `${path}?${searchParams.toString()}`;
}

export function isPersistedReportPage<TItem = Report>(
  value: unknown,
  query: string,
  now = Date.now(),
): value is PersistedReportPage<TItem> {
  if (!isRecord(value)) return false;
  if (value.schema !== REPORT_PAGE_CACHE_SCHEMA || value.query !== query) return false;
  if (typeof value.timestamp !== 'number' || now - value.timestamp > REPORT_PAGE_MAX_STALE_MS) return false;
  return isReportPage<TItem>(value.page);
}
