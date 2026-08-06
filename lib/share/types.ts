// Shared types + validation for published dashboard links (presentation mode).
// Used by the API routes, the public /share page, and the share dialog.

export const ALL_TABS = '*';

// Tabs each dashboard key may publish. '*' (whole dashboard) is always valid.
// analyst/os/divisions: AnalystCharts tab set (7 tabs, no delay).
// op: OPAnalystCharts adds the delay tab.
// ocs: OCSRecordsTabs tab set.
export const SHARE_TAB_SETS: Record<string, readonly string[]> = {
  analyst: ['summary', 'sqi', 'joumpa', 'gse', 'cgo_cargo', 'status_details'],
  os: ['summary', 'sqi', 'joumpa', 'gse', 'cgo_cargo', 'status_details'],
  ht: ['summary', 'sqi', 'joumpa', 'gse', 'cgo_cargo', 'status_details'],
  op: ['summary', 'sqi', 'joumpa', 'gse', 'cgo_cargo', 'delay', 'status_details'],
  ocs: ['weekly_report', 'monthly_report', 'survey_report', 'reminder', 'joumpa', 'joumpa_uplifting', 'rca'],
};

export const DEFAULT_SHARE_TABS: readonly string[] = SHARE_TAB_SETS.analyst;

// Human labels for share dialog + public page titles.
export const SHARE_TAB_LABELS: Record<string, string> = {
  summary: 'Summary Report',
  sqi: 'Landside & Airside Detail Report',
  joumpa: 'Joumpa Service',
  gse: 'GSE Performance Detail Report',
  cgo_cargo: 'CGO Cargo Report',
  delay: 'Delay Code Report',
  status_details: 'Reports Status Details',
  weekly_report: 'Weekly Report',
  monthly_report: 'Monthly Report',
  survey_report: 'Survey Report',
  reminder: 'Reminder Series',
  joumpa_uplifting: 'Joumpa Service Uplifting',
  rca: 'Root Cause Analysis (RCA)',
};

export function isValidShareTab(dashboardKey: string, tab: string): boolean {
  if (tab === ALL_TABS) return true;
  return (SHARE_TAB_SETS[dashboardKey] ?? DEFAULT_SHARE_TABS).includes(tab);
}

// Filter scope captured at publish time and applied to live data on every
// public page load. Mirrors the authenticated global filter semantics.
export interface ShareScope {
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
  hubs: string[];
  stations: string[];
  airlines: string[];
  categories: string[];
}

export function sanitizeScope(raw: unknown): ShareScope {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const strArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0).slice(0, 100)
      : [];
  const optionalStr = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value.slice(0, 32) : undefined;

  return {
    dateRange: optionalStr(source.dateRange),
    dateFrom: optionalStr(source.dateFrom),
    dateTo: optionalStr(source.dateTo),
    hubs: strArray(source.hubs),
    stations: strArray(source.stations),
    airlines: strArray(source.airlines),
    categories: strArray(source.categories),
  };
}

export interface PublishedDashboardRecord {
  id: string;
  slug: string;
  dashboardKey: string;
  tab: string;
  name: string | null;
  config: { scope: ShareScope };
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export const SHARE_SLUG_LENGTH = 12;

export function generateShareSlug(): string {
  // crypto.randomUUID() includes dashes; strip them for a clean URL segment.
  return crypto.randomUUID().replaceAll('-', '').slice(0, SHARE_SLUG_LENGTH);
}
