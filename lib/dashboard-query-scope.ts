
import type { QueryDefinition, QueryFilter } from '@/types/builder';

export interface DashboardScopeFilters {

  hub?: string;

  branch?: string;

  maskapai?: string;

  airline?: string;

  main_category?: string;

  area?: string;

  severity?: string;

  status?: string;
}

export const DASHBOARD_FILTER_FIELDS = [
  { key: 'hub', table: 'reports', field: 'hub' },
  { key: 'branch', table: 'reports', field: 'branch' },
  { key: 'maskapai', table: 'reports', field: 'jenis_maskapai' },
  { key: 'airline', table: 'reports', field: 'airlines' },
  { key: 'main_category', table: 'reports', field: 'category' },
  { key: 'area', table: 'reports', field: 'area' },
  { key: 'severity', table: 'reports', field: 'severity' },
  { key: 'status', table: 'reports', field: 'status' },
] as const;

export function normalizeDashboardScope(filters: DashboardScopeFilters, dateFrom?: string, dateTo?: string) {
  return {
    filters: Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value && value !== 'all')
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  };
}

export function applyDashboardScopeToQuery(
  queryConfig: QueryDefinition,
  options: {
    filters?: DashboardScopeFilters;
    dateFrom?: string;
    dateTo?: string;
    activePage?: number;
  },
): QueryDefinition {
  const { filters = {}, dateFrom, dateTo, activePage } = options;

  const extraFilters = Object.entries(filters)
    .filter(([, value]) => value && value !== 'all')
    .map(([key, value]) => {
      const filterField = DASHBOARD_FILTER_FIELDS.find((entry) => entry.key === key);
      if (!filterField) {
        return null;
      }

      return {
        table: filterField.table,
        field: filterField.field,
        operator: 'eq',
        value,
        conjunction: 'AND',
      } as QueryFilter;
    })
    .filter((value): value is QueryFilter => Boolean(value));

  const dateFilters: QueryFilter[] = [];
  if (dateFrom) {
    dateFilters.push({
      table: 'reports',
      field: 'created_at',
      operator: 'gte',
      value: dateFrom,
      conjunction: 'AND',
    });
  }
  if (dateTo) {
    dateFilters.push({
      table: 'reports',
      field: 'created_at',
      operator: 'lte',
      value: dateTo,
      conjunction: 'AND',
    });
  }

  const cgoFilters: QueryFilter[] = [3, 4].includes(activePage ?? -1)
    ? [{
        table: 'reports',
        field: 'source_sheet',
        operator: 'eq',
        value: 'CGO',
        conjunction: 'AND',
      }]
    : [];

  return {
    ...queryConfig,
    joins: queryConfig.joins || [],
    dimensions: queryConfig.dimensions || [],
    measures: queryConfig.measures || [],
    sorts: queryConfig.sorts || [],
    filters: [
      ...(queryConfig.filters || []),
      ...extraFilters,
      ...dateFilters,
      ...cgoFilters,
    ],
  };
}
