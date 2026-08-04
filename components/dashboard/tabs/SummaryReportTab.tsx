'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Report } from '@/types';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { SectionAiSummaryInsightButton } from '@/components/dashboard/ai/SectionAiSummaryInsightButton';
import { YearCard } from '@/components/dashboard/year-context';
import {
  isCargoReport,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
} from '@/lib/report-normalization';

interface SummaryReportTabProps {
  reports: Report[];
  selectedYear?: number;
}

type MonthColumn = {
  key: string;
  label: string;
  monthIndex: number;
  year: number;
};

type PivotRow = {
  id: string;
  primary: string;
  secondary?: string;
  values: Record<string, number>;
  total: number;
};

type YearlyCategoryMonthRow = {
  id: string;
  monthIndex: number;
  monthLabel: string;
  irregularity: number;
  complaint: number;
  compliment: number;
  occurrence: number;
  accidentIncident: number;
  total: number;
};

type YearComparisonRow = {
  id: SummaryMetricId;
  label: string;
  current: number;
  previous: number;
  deltaPct: number;
  direction: 'improvement' | 'decline' | 'flat' | 'no-baseline';
};

type SummaryMetricId =
  | 'irregularity'
  | 'complaint'
  | 'compliment'
  | 'occurrence'
  | 'accidentIncident'
  | 'total';

type SummaryCategoryMetric = {
  id: Exclude<SummaryMetricId, 'total'>;
  label: string;
  chartLabel: string;
  color: string;
  positiveTrend: TrendDirection;
};

type TrendPoint = {
  payload?: {
    monthIndex?: unknown;
  };
};

type TrendDotProps = TrendPoint & {
  cx?: unknown;
  cy?: unknown;
};

type TrendTooltipPayload = {
  payload?: Record<string, unknown>;
};

type TrendTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly TrendTooltipPayload[];
};

type AiFeatureHint =
  | 'forecasting'
  | 'seasonality'
  | 'subcategory'
  | 'rootCause'
  | 'riskScoring'
  | 'summarization'
  | 'similaritySearch'
  | 'actionRecommendation';

function summaryReportFeatureHints(title: string): AiFeatureHint[] {
  const normalized = title.toLowerCase();
  if (normalized.includes('summary category') || normalized.includes('mom') || normalized.includes('yoy')) {
    return ['forecasting', 'seasonality', 'summarization'];
  }
  if (normalized.includes('summary station') || normalized.includes('summary airlines')) {
    return ['riskScoring', 'seasonality', 'summarization'];
  }
  if (normalized.includes('case classification')) {
    return ['subcategory', 'riskScoring', 'similaritySearch', 'actionRecommendation'];
  }
  if (normalized.includes('identification of root')) {
    return ['rootCause', 'riskScoring', 'similaritySearch', 'actionRecommendation'];
  }
  return ['summarization'];
}

function compactRows<T>(rows: Array<T | null | undefined>): T[] {
  return rows.filter((row): row is T => Boolean(row));
}

const CATEGORY_ORDER: string[] = [];

function normalizeText(value: unknown, fallback = '-') {
  const normalized = String(value || '').trim();
  return normalized ? normalized : fallback;
}

type SourceBreakdown = { landside: number; airside: number; general: number; gse: number };

function computeBreakdownFromReports(reports: Report[]): SourceBreakdown {
  const acc: SourceBreakdown = { landside: 0, airside: 0, general: 0, gse: 0 };
  for (const r of reports) {
    const src = classifySourceArea(r);
    if (src === 'landside' || src === 'airside' || src === 'general' || src === 'gse') acc[src] += 1;
  }
  return acc;
}

function resolveBranchLabel(report: Report) {
  return normalizeText(resolveReportBranch(report), 'Unknown').toUpperCase();
}

function resolveAirlineLabel(report: Report) {
  return normalizeText(resolveReportAirline(report), 'Non Airline Case');
}

type SourceFilter = 'all' | 'landside' | 'airside' | 'general' | 'gse';

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'landside', label: 'Landside' },
  { value: 'airside', label: 'Airside' },
  { value: 'general', label: 'General' },
  { value: 'gse', label: 'GSE' },
];
const AIRSIDE_SOURCE_OPTIONS = SOURCE_OPTIONS.filter((opt) => opt.value === 'all' || opt.value === 'airside' || opt.value === 'gse');

function classifySourceArea(report: Report): 'landside' | 'airside' | 'general' | 'gse' | 'other' {
  const area = String(report.area || '').trim().toLowerCase();
  const apron = String(report.apron_area_category || '').trim().toLowerCase();
  const general = String(report.general_category || '').trim().toLowerCase();
  const categoryCaseGse = String(report.category_case_gse || '').trim().toLowerCase();

  if ([area, apron, categoryCaseGse].some((value) => value.includes('gse'))) return 'gse';
  if (area === 'general' || general) return 'general';
  if (area === 'terminal area' || area.includes('terminal') || area.includes('landside')) return 'landside';
  if (area === 'apron area' || area.includes('apron') || area.includes('airside')) return 'airside';
  return 'other';
}

function applySourceFilter(reports: Report[], source: SourceFilter): Report[] {
  if (source === 'all') return reports;
  return reports.filter((r) => classifySourceArea(r) === source);
}

function resolveAirsideApronCategory(report: Report) {

  return normalizeText(report.apron_area_category || report.category_case_gse || report.gse_available_requirement, '');
}

function airsideCategoryHeader(source: SourceFilter) {
  if (source === 'gse') return 'GSE Category';
  if (source === 'airside') return 'Apron Area Category';
  return 'Airside / GSE Category';
}

function keepAirsideGseReports(reports: Report[], source: SourceFilter) {
  if (source !== 'all') return reports;
  return reports.filter((report) => {
    const sourceArea = classifySourceArea(report);
    return sourceArea === 'airside' || sourceArea === 'gse';
  });
}

function SourceCard({
  reports, children, options = SOURCE_OPTIONS,
}: {
  reports: Report[];
  options?: typeof SOURCE_OPTIONS;
  children: (args: { filtered: Report[]; toggle: React.ReactNode; source: SourceFilter }) => React.ReactNode;
}) {
  const [source, setSource] = useState<SourceFilter>('all');
  const filtered = useMemo(() => applySourceFilter(reports, source), [reports, source]);
  const toggle = (
    <div className="inline-flex h-11 items-center gap-0.5 rounded-full border border-[color:var(--sr-border)] bg-white p-1">
      {options.map((opt) => {
        const active = opt.value === source;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSource(opt.value)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] leading-none transition ${
              active
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_2px_0_#064e3b]'
                : 'text-[color:var(--sr-text-3)] hover:text-[color:var(--sr-text)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
  return <>{children({ filtered, toggle, source })}</>;
}

function YearSourceHeader({
  year,
  yearToggle,
  sourceToggle,
}: {
  year: number;
  yearToggle: ReactNode;
  sourceToggle: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="rounded-full border border-[color:var(--sr-border)] bg-[color:var(--sr-sunken)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--sr-text-2)]">
        Showing {year}
      </span>
      {yearToggle}
      {sourceToggle}
    </div>
  );
}

function YearOnlyHeader({
  year,
  yearToggle,
}: {
  year: number;
  yearToggle: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="rounded-full border border-[color:var(--sr-border)] bg-[color:var(--sr-sunken)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--sr-text-2)]">
        Showing {year}
      </span>
      {yearToggle}
    </div>
  );
}

function hasMeaningfulValue(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized !== '' &&
    normalized !== '-' &&
    normalized !== '#n/a' &&
    normalized !== 'null' &&
    normalized !== 'undefined' &&
    normalized !== 'nil';
}

function resolveCategory(report: Report) {
  return normalizeText(resolveReportCategory(report), 'Uncategorized');
}

function parseReportDate(report: Report): Date | null {
  const source = report.date_of_event || report.created_at;
  if (!source) return null;

  let parsed: Date;
  if (typeof source === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const [year, month, day] = source.split('-').map(Number);
    parsed = new Date(year, month - 1, day);
  } else {
    parsed = new Date(source);
  }

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateToISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function extractMonthColumn(report: Report): MonthColumn | null {
  const parsed = parseReportDate(report);
  if (!parsed) return null;

  const year = parsed.getFullYear();
  const monthIndex = parsed.getMonth();

  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    label: parsed.toLocaleString('en-US', { month: 'long' }),
    monthIndex,
    year,
  };
}

function buildMonthColumns(reports: Report[]) {
  const buckets = new Map<string, MonthColumn>();

  reports.forEach((report) => {
    const month = extractMonthColumn(report);
    if (!month) return;
    buckets.set(month.key, month);
  });

  return Array.from(buckets.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthIndex - b.monthIndex;
  });
}

function buildCategorySummaryRows(reports: Report[], monthColumns: MonthColumn[]) {
  const categorySet = new Set<string>();
  const monthCategoryCounts = new Map<string, Record<string, number>>();
  const monthTotals = new Map<string, number>();
  const validMonthKeys = new Set(monthColumns.map((m) => m.key));

  reports.forEach((report) => {
    const month = extractMonthColumn(report);
    if (!month || !validMonthKeys.has(month.key)) return;

    const category = resolveCategory(report);
    categorySet.add(category);

    if (!monthCategoryCounts.has(month.key)) monthCategoryCounts.set(month.key, {});
    const bucket = monthCategoryCounts.get(month.key)!;
    bucket[category] = (bucket[category] || 0) + 1;
    monthTotals.set(month.key, (monthTotals.get(month.key) || 0) + 1);
  });

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((item) => categorySet.has(item)),
    ...Array.from(categorySet).filter((item) => !CATEGORY_ORDER.includes(item)).sort(),
  ];

  const rows = monthColumns.map((month) => {
    const values: Record<string, number> = {};
    orderedCategories.forEach((category) => {
      values[category] = monthCategoryCounts.get(month.key)?.[category] || 0;
    });

    return {
      id: month.key,
      label: month.label,
      values,
      total: monthTotals.get(month.key) || 0,
    };
  });

  const columnTotals = orderedCategories.reduce<Record<string, number>>((acc, category) => {
    acc[category] = rows.reduce((sum, row) => sum + (row.values[category] || 0), 0);
    return acc;
  }, {});

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    categories: orderedCategories,
    rows,
    columnTotals,
    grandTotal,
  };
}

function buildHierarchicalRows(
  reports: Report[],
  monthColumns: MonthColumn[],
  primaryLabel: (report: Report) => string,
  secondaryLabel: (report: Report) => string
) {
  const buckets = new Map<string, PivotRow>();
  const validMonthKeys = new Set(monthColumns.map((m) => m.key));

  reports.forEach((report) => {
    const month = extractMonthColumn(report);
    if (!month || !validMonthKeys.has(month.key)) return;

    const primary = normalizeText(primaryLabel(report), '-');
    const secondary = normalizeText(secondaryLabel(report), '-');
    const key = `${primary}::${secondary}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key,
        primary,
        secondary,
        values: {},
        total: 0,
      });
    }

    const row = buckets.get(key)!;
    row.values[month.key] = (row.values[month.key] || 0) + 1;
    row.total += 1;
  });

  const rows = Array.from(buckets.values()).sort((a, b) => {
    if (a.primary !== b.primary) return a.primary.localeCompare(b.primary);
    if (b.total !== a.total) return b.total - a.total;
    return (a.secondary || '').localeCompare(b.secondary || '');
  });

  const monthTotals = monthColumns.reduce<Record<string, number>>((acc, month) => {
    acc[month.key] = rows.reduce((sum, row) => sum + (row.values[month.key] || 0), 0);
    return acc;
  }, {});

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return { rows, monthTotals, grandTotal };
}

function buildSingleDimensionRows(
  reports: Report[],
  monthColumns: MonthColumn[],
  label: (report: Report) => string
) {
  const buckets = new Map<string, PivotRow>();
  const validMonthKeys = new Set(monthColumns.map((m) => m.key));

  reports.forEach((report) => {
    const month = extractMonthColumn(report);
    if (!month || !validMonthKeys.has(month.key)) return;

    const primary = normalizeText(label(report), '-');
    if (!hasMeaningfulValue(primary)) return;

    if (!buckets.has(primary)) {
      buckets.set(primary, {
        id: primary,
        primary,
        values: {},
        total: 0,
      });
    }

    const row = buckets.get(primary)!;
    row.values[month.key] = (row.values[month.key] || 0) + 1;
    row.total += 1;
  });

  const rows = Array.from(buckets.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.primary.localeCompare(b.primary);
  });

  const monthTotals = monthColumns.reduce<Record<string, number>>((acc, month) => {
    acc[month.key] = rows.reduce((sum, row) => sum + (row.values[month.key] || 0), 0);
    return acc;
  }, {});

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return { rows, monthTotals, grandTotal };
}

function heatBucket(value: number, maxValue: number): number {
  if (!value || !maxValue) return 0;
  const ratio = value / maxValue;
  if (ratio >= 0.90) return 5;
  if (ratio >= 0.70) return 4;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.22) return 2;
  if (ratio >= 0.06) return 1;
  return 0;
}
function heatClass(value: number, maxValue: number): string {
  const b = heatBucket(value, maxValue);
  return b === 0 ? '' : `sr-heat-${b}`;
}

type TrendDirection = 'down' | 'up' | 'auto';

const SUMMARY_CATEGORY_METRICS: SummaryCategoryMetric[] = [
  {
    id: 'irregularity',
    label: 'Irregularity',
    chartLabel: 'Irregularity',
    color: '#00796B',
    positiveTrend: 'down',
  },
  {
    id: 'complaint',
    label: 'Complaint',
    chartLabel: 'Complaint',
    color: '#3367D6',
    positiveTrend: 'down',
  },
  {
    id: 'compliment',
    label: 'Compliment',
    chartLabel: 'Compliment',
    color: '#F9AB00',
    positiveTrend: 'up',
  },
  {
    id: 'occurrence',
    label: 'Occurrence',
    chartLabel: 'Occurrence',
    color: '#E8710A',
    positiveTrend: 'down',
  },
  {
    id: 'accidentIncident',
    label: 'Accident / Incident',
    chartLabel: 'Accident/Incident',
    color: '#C5221F',
    positiveTrend: 'down',
  },
];

const SUMMARY_METRIC_BY_ID = SUMMARY_CATEGORY_METRICS.reduce<Record<string, SummaryCategoryMetric>>((acc, metric) => {
  acc[metric.id] = metric;
  return acc;
}, {});

function resolveSummaryMetricId(report: Report): Exclude<SummaryMetricId, 'total'> | null {
  const raw = normalizeText(resolveReportCategory(report), '');
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!normalized) return null;
  if (normalized.includes('accident') || normalized.includes('incident')) return 'accidentIncident';
  if (normalized.includes('occurrence') || normalized.includes('occurence')) return 'occurrence';
  if (normalized.includes('compliment')) return 'compliment';
  if (normalized.includes('complaint') || normalized.includes('complain')) return 'complaint';
  if (normalized.includes('irregular')) return 'irregularity';
  return null;
}

function matchesSummaryMetric(report: Report, metricId: SummaryMetricId) {
  if (metricId === 'total') return true;
  return resolveSummaryMetricId(report) === metricId;
}

function renderMonthlyTrendTooltip(
  { active, label, payload }: TrendTooltipProps,
  visibleMetrics: SummaryCategoryMetric[],
  previousYear: number,
  currentYear: number
) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};

  return (
    <div className="min-w-[260px] rounded-xl border border-[color:var(--sr-border)] bg-white p-3 shadow-[0_18px_45px_-20px_rgba(15,23,42,0.45)]">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[color:var(--sr-accent-dark)]">{label}</p>
        <p className="text-[11px] font-bold text-slate-500">{previousYear} vs {currentYear}</p>
      </div>
      <div className="space-y-1.5">
        {visibleMetrics.map((metric) => {
          const previousValue = Number(row[`${metric.id}-${previousYear}`] || 0);
          const currentValue = Number(row[`${metric.id}-${currentYear}`] || 0);
          const delta = currentValue - previousValue;
          const favorableDelta = metric.positiveTrend === 'up' ? delta > 0 : delta < 0;
          const unfavorableDelta = metric.positiveTrend === 'up' ? delta < 0 : delta > 0;

          return (
            <div key={metric.id} className="grid grid-cols-[minmax(90px,1fr)_56px_56px_52px] items-center gap-2 text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                <span className="truncate font-bold text-slate-700">{metric.chartLabel}</span>
              </div>
              <span className="text-right font-semibold tabular-nums text-slate-500">{previousValue}</span>
              <span className="text-right font-black tabular-nums text-slate-900">{currentValue}</span>
              <span
                className={`text-right font-black tabular-nums ${
                  unfavorableDelta ? 'text-red-600' : favorableDelta ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(90px,1fr)_56px_56px_52px] gap-2 border-t border-slate-100 pt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        <span>Category</span>
        <span className="text-right">{previousYear}</span>
        <span className="text-right">{currentYear}</span>
        <span className="text-right">Delta</span>
      </div>
    </div>
  );
}

function computeDeltaPct(current: number, previous: number) {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round((Math.abs(current - previous) / previous) * 100);
}

function computeRowTrend(
  row: { values: Record<string, number> },
  monthColumns: MonthColumn[]
): { current: number; previous: number; deltaPct: number } | null {
  if (monthColumns.length < 2) return null;

  const lastMonth = monthColumns[monthColumns.length - 1];
  const prevMonth = monthColumns[monthColumns.length - 2];
  const current = row.values[lastMonth.key] || 0;
  const previous = row.values[prevMonth.key] || 0;
  const deltaPct = computeDeltaPct(current, previous);

  if (deltaPct === null) return null;
  return { current, previous, deltaPct };
}

function isPositiveTrendForLabel(label: string): boolean | null {
  const lower = label.toLowerCase();
  if (lower.includes('compliment')) return true;
  if (lower.includes('irregular') || lower.includes('complaint') || lower.includes('complain')) return false;
  return null;
}

function TrendBadge({
  trend,
  positiveTrend,
  rowLabel,
}: {
  trend: { current: number; previous: number; deltaPct: number } | null;
  positiveTrend: TrendDirection;
  rowLabel?: string;
}) {
  if (!trend) return <span className="text-[13px] font-medium text-[color:var(--sr-text-3)]">–</span>;

  const { current, previous, deltaPct } = trend;
  if (current === previous) return <span className="text-[13px] font-medium text-[color:var(--sr-text-3)]">→ 0%</span>;

  const isDown = current < previous;
  const isUp = current > previous;
  let isGood: boolean;

  if (positiveTrend === 'down') {
    isGood = isDown;
  } else if (positiveTrend === 'up') {
    isGood = isUp;
  } else {
    const labelResult = rowLabel ? isPositiveTrendForLabel(rowLabel) : null;
    if (labelResult === true) isGood = isUp;
    else if (labelResult === false) isGood = isDown;
    else isGood = isDown;
  }

  const pillClass = isGood ? 'sr-pill sr-pill-pos' : 'sr-pill sr-pill-neg';
  const arrow = isDown ? '↓' : '↑';

  return <span className={pillClass}><span aria-hidden="true">{arrow}</span>{deltaPct}%</span>;
}

function buildYearlyMonthRows(
  reports: Report[],
  year: number
) {
  const monthRows: YearlyCategoryMonthRow[] = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthLabel = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const values = {
      irregularity: 0,
      complaint: 0,
      compliment: 0,
      occurrence: 0,
      accidentIncident: 0,
      total: 0,
    };

    reports.forEach((report) => {
      const month = extractMonthColumn(report);
      if (!month || month.year !== year || month.monthIndex !== monthIndex) return;

      const metricId = resolveSummaryMetricId(report);
      values.total += 1;
      if (metricId) values[metricId] += 1;
    });

    return {
      id: `${year}-${monthIndex}`,
      monthIndex,
      monthLabel,
      ...values,
    };
  });

  const totals = monthRows.reduce(
    (acc, row) => ({
      irregularity: acc.irregularity + row.irregularity,
      complaint: acc.complaint + row.complaint,
      compliment: acc.compliment + row.compliment,
      occurrence: acc.occurrence + row.occurrence,
      accidentIncident: acc.accidentIncident + row.accidentIncident,
      total: acc.total + row.total,
    }),
    { irregularity: 0, complaint: 0, compliment: 0, occurrence: 0, accidentIncident: 0, total: 0 }
  );

  return { rows: monthRows, totals };
}

function buildYearComparisonRows(
  previousYearTotals: {
    irregularity: number;
    complaint: number;
    compliment: number;
    occurrence: number;
    accidentIncident: number;
    total: number;
  },
  currentYearTotals: {
    irregularity: number;
    complaint: number;
    compliment: number;
    occurrence: number;
    accidentIncident: number;
    total: number;
  }
) {
  const metrics = [
    ...SUMMARY_CATEGORY_METRICS.map((metric) => ({ id: metric.id, label: metric.label })),
    { id: 'total', label: 'Total' },
  ] as const;

  return metrics.map((metric) => {
    const previous = previousYearTotals[metric.id];
    const current = currentYearTotals[metric.id];
    const deltaPct = previous === 0 ? 0 : (Math.abs(current - previous) / previous) * 100;

    let direction: YearComparisonRow['direction'] = 'flat';
    if (previous === 0) direction = 'no-baseline';
    else if (current === previous) direction = 'flat';
    else {
      direction = current > previous ? 'improvement' : 'decline';
    }

    return {
      id: metric.id,
      label: metric.label,
      current,
      previous,
      deltaPct,
      direction,
    };
  });
}

export function SummaryReportTab({ reports: rawReports, selectedYear }: SummaryReportTabProps) {

  const reports = useMemo(() => rawReports.filter((r) => !isCargoReport(r)), [rawReports]);

  const fallbackYear = useMemo(() => {
    const years = reports.map((r) => extractMonthColumn(r)?.year).filter((y): y is number => Boolean(y));
    return years.length ? Math.max(...years) : new Date().getFullYear();
  }, [reports]);
  const activeYear = selectedYear ?? fallbackYear;
  const [selectedSummaryBranch, setSelectedSummaryBranch] = useState('all');
  const [selectedSummaryAirline, setSelectedSummaryAirline] = useState('all');
  const [showLandsideAirlines, setShowLandsideAirlines] = useState(false);
  const [showAirsideAirlines, setShowAirsideAirlines] = useState(false);
  const [showGeneralAirlines, setShowGeneralAirlines] = useState(false);

  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  const currentYearReports = useMemo(
    () => reports.filter((report) => {
      const month = extractMonthColumn(report);
      return month?.year === activeYear;
    }),
    [reports, activeYear]
  );
  const currentYearMonthColumns = useMemo(
    () => buildMonthColumns(currentYearReports),
    [currentYearReports]
  );
  const summaryBranchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reports
            .map((report) => resolveBranchLabel(report))
            .filter((value) => hasMeaningfulValue(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reports]
  );
  const summaryAirlineOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reports
            .map((report) => resolveAirlineLabel(report))
            .filter((value) => hasMeaningfulValue(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [reports]
  );
  const filteredSummaryReports = useMemo(
    () =>
      reports.filter((report) => {
        const matchesBranch =
          selectedSummaryBranch === 'all' || resolveBranchLabel(report) === selectedSummaryBranch;
        const matchesAirline =
          selectedSummaryAirline === 'all' || resolveAirlineLabel(report) === selectedSummaryAirline;
        return matchesBranch && matchesAirline;
      }),
    [reports, selectedSummaryBranch, selectedSummaryAirline]
  );
  const filteredSummaryMonthColumns = useMemo(
    () => buildMonthColumns(filteredSummaryReports),
    [filteredSummaryReports]
  );

  const summaryYears = useMemo(() => {
    const years = Array.from(new Set(filteredSummaryMonthColumns.map((month) => month.year))).sort((a, b) => a - b);
    if (years.includes(activeYear) && years.includes(activeYear - 1)) return [activeYear - 1, activeYear];
    return years.slice(-2);
  }, [filteredSummaryMonthColumns, activeYear]);
  const hasComparableSummaryYears = summaryYears.length >= 2;
  const previousYear = summaryYears[0] ?? null;
  const comparisonCurrentYear = summaryYears[summaryYears.length - 1] ?? null;

  const categorySummary = useMemo(
    () => buildCategorySummaryRows(currentYearReports, currentYearMonthColumns),
    [currentYearReports, currentYearMonthColumns]
  );

  const stationSummary = useMemo(
    () =>
      buildHierarchicalRows(
        currentYearReports,
        currentYearMonthColumns,
        (report) => resolveBranchLabel(report),
        (report) => resolveCategory(report)
      ),
    [currentYearReports, currentYearMonthColumns]
  );

  const airlineSummary = useMemo(
    () =>
      buildHierarchicalRows(
        currentYearReports,
        currentYearMonthColumns,
        (report) => resolveAirlineLabel(report),
        (report) => resolveCategory(report)
      ),
    [currentYearReports, currentYearMonthColumns]
  );

  const previousYearSummary = useMemo(
    () => (previousYear !== null ? buildYearlyMonthRows(filteredSummaryReports, previousYear) : null),
    [filteredSummaryReports, previousYear]
  );

  const currentYearSummary = useMemo(
    () => (comparisonCurrentYear !== null ? buildYearlyMonthRows(filteredSummaryReports, comparisonCurrentYear) : null),
    [filteredSummaryReports, comparisonCurrentYear]
  );

  const yearComparisonRows = useMemo(
    () =>
      previousYearSummary && currentYearSummary
        ? buildYearComparisonRows(
            previousYearSummary.totals,
            currentYearSummary.totals
          )
        : [],
    [previousYearSummary, currentYearSummary]
  );

  const sectionAiContext = useMemo(() => ({
    section: 'Summary Report',
    title: 'Summary Report',
    chartType: 'section_summary_report',
    // Named datasets keep incomparable numbers apart (months ≠ stations ≠ YoY).
    datasets: [
      {
        id: 'monthly',
        name: 'Cases per Month',
        unit: 'kasus',
        kind: 'timeseries',
        description: 'Jumlah laporan per bulan tahun berjalan; breakdown = jumlah per kategori kasus pada bulan tersebut.',
        rows: categorySummary.rows.map((row) => ({ label: row.label, value: row.total, breakdown: row.values })),
      },
      {
        id: 'stations',
        name: 'Stasiun & Jenis Kasus',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per kombinasi stasiun (kode bandara) dan jenis kasus.',
        rows: stationSummary.rows.slice(0, 12).map((row) => ({
          label: `${row.primary} — ${row.secondary || 'Lainnya'}`,
          value: row.total,
        })),
      },
      {
        id: 'airlines',
        name: 'Maskapai & Jenis Kasus',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per kombinasi maskapai dan jenis kasus.',
        rows: airlineSummary.rows.slice(0, 12).map((row) => ({
          label: `${row.primary} — ${row.secondary || 'Lainnya'}`,
          value: row.total,
        })),
      },
      {
        id: 'yoy',
        name: 'This Year vs Last Year',
        unit: 'kasus',
        kind: 'comparison',
        description: 'value = jumlah tahun berjalan per kategori; delta = perubahan % dibanding tahun sebelumnya.',
        rows: yearComparisonRows.map((row) => ({
          label: row.label,
          value: row.current,
          delta: row.previous > 0 ? Math.round(((row.current - row.previous) / row.previous) * 100) : undefined,
          note: row.previous > 0
            ? `tahun lalu ${row.previous}`
            : 'tidak ada baseline tahun lalu',
        })),
      },
    ],
    featureHints: ['forecasting', 'seasonality', 'riskScoring', 'summarization', 'actionRecommendation'],
  }), [airlineSummary.rows, categorySummary.rows, stationSummary.rows, yearComparisonRows]);

  return (
    <div className="sr-scope space-y-10 bg-[color:var(--sr-canvas)] px-4 py-6 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              Summary Report
              <span className="block text-[clamp(16px,1.5vw,22px)] font-semibold text-[color:var(--sr-text-2)]">Landside &amp; Airside</span>
            </h1>
            <p className="mt-2 flex items-start gap-1.5 rounded-md border border-[color:var(--sr-gold)] bg-[color:var(--sr-gold-soft)] px-2.5 py-1.5 text-[12.5px] font-semibold leading-relaxed text-[color:var(--sr-gold-strong)] sm:inline-flex">
              <span className="font-black uppercase tracking-[0.08em]">Shown data:</span>
              Non-CGO operational reports covering Landside, Airside/Apron, General Service, and GSE-classified records
            </p>
          </div>
        </div>
        <SectionAiSummaryInsightButton context={sectionAiContext} />
      </div>

      <section>
        {hasComparableSummaryYears && previousYear !== null && comparisonCurrentYear !== null ? (
          <SourceCard reports={filteredSummaryReports}>{({ filtered, toggle: sourceToggle }) => {
            const previous = buildYearlyMonthRows(filtered, previousYear);
            const current = buildYearlyMonthRows(filtered, comparisonCurrentYear);
            const comparison = buildYearComparisonRows(previous.totals, current.totals);
            const onMonthClick = (targetYear: number, monthIndex: number, metricId: SummaryMetricId) => {
              const drilldownReports = filtered.filter((report) => {
                const month = extractMonthColumn(report);
                return Boolean(month && month.year === targetYear && month.monthIndex === monthIndex && matchesSummaryMetric(report, metricId));
              });
              if (drilldownReports.length) {
                const monthLabel = new Date(targetYear, monthIndex, 1).toLocaleString('en-US', { month: 'long' });
                const metricLabel = metricId === 'total' ? 'Total Reports' : SUMMARY_METRIC_BY_ID[metricId]?.label || metricId;
                openDrilldown(drilldownReports, `${monthLabel} ${targetYear} - ${metricLabel}`);
              }
            };
            const onComparisonClick = (metricId: SummaryMetricId) => {
              const drilldownReports = filtered.filter((report) => {
                const month = extractMonthColumn(report);
                return Boolean(month && (month.year === previousYear || month.year === comparisonCurrentYear) && matchesSummaryMetric(report, metricId));
              });
              if (drilldownReports.length) {
                const metricLabel = metricId === 'total' ? 'Total Reports' : SUMMARY_METRIC_BY_ID[metricId]?.label || metricId;
                openDrilldown(drilldownReports, `${previousYear} vs ${comparisonCurrentYear} - ${metricLabel}`);
              }
            };
            return (
              <AnnualReportSummary
                previousYear={previousYear}
                currentYear={comparisonCurrentYear}
                allReports={filtered}
                previousRows={previous.rows}
                currentRows={current.rows}
                comparisonRows={comparison}
                branchOptions={summaryBranchOptions}
                airlineOptions={summaryAirlineOptions}
                selectedBranch={selectedSummaryBranch}
                selectedAirline={selectedSummaryAirline}
                onBranchChange={setSelectedSummaryBranch}
                onAirlineChange={setSelectedSummaryAirline}
                onMonthCategoryClick={onMonthClick}
                onYearComparisonClick={onComparisonClick}
                openDrilldown={openDrilldown}
                headerExtra={sourceToggle}
              />
            );
          }}</SourceCard>
        ) : selectedSummaryBranch !== 'all' || selectedSummaryAirline !== 'all' ? (
          <div className="border border-[color:color-mix(in_oklch,var(--sr-border)_60%,transparent)] bg-white px-4 py-3 text-sm font-medium text-[color:var(--sr-text)]">
            The current filter doesn&apos;t have enough data to compare two years.
          </div>
        ) : null}
      </section>

      <SummarySection title="Summary Report Overview by Station & Airlines">
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
          <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => (
            <SourceCard reports={yearReports}>{({ filtered, toggle: sourceToggle }) => {
              const monthColumns = buildMonthColumns(yearReports);
              const data = buildHierarchicalRows(filtered, monthColumns, resolveBranchLabel, resolveCategory);
              return (
                <HierarchicalMonthPivotTable
                  title="Summary Station"
                  primaryHeader="Station"
                  secondaryHeader="Report Category"
                  monthColumns={monthColumns}
                  rows={data.rows}
                  monthTotals={data.monthTotals}
                  grandTotal={data.grandTotal}
                  scrollable
                  freezeRightCols
                  headerExtra={<YearSourceHeader year={year} yearToggle={yearToggle} sourceToggle={sourceToggle} />}
                  onCellClick={(monthKey, primaryValue, secondaryValue) => {
                    const drilldownReports = filtered.filter((report) => {
                      const month = extractMonthColumn(report);
                      return month?.key === monthKey && resolveBranchLabel(report) === primaryValue && resolveCategory(report) === secondaryValue;
                    });
                    if (drilldownReports.length) {
                      const month = monthColumns.find((m) => m.key === monthKey);
                      openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue} / ${secondaryValue}`);
                    }
                  }}
                />
              );
            }}</SourceCard>
          )}</YearCard>
          <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => (
            <SourceCard reports={yearReports}>{({ filtered, toggle: sourceToggle }) => {
              const monthColumns = buildMonthColumns(yearReports);
              const data = buildHierarchicalRows(filtered, monthColumns, resolveAirlineLabel, resolveCategory);
              return (
                <HierarchicalMonthPivotTable
                  title="Summary Airlines"
                  primaryHeader="Airlines"
                  secondaryHeader="Report Category"
                  monthColumns={monthColumns}
                  rows={data.rows}
                  monthTotals={data.monthTotals}
                  grandTotal={data.grandTotal}
                  scrollable
                  freezeRightCols
                  headerExtra={<YearSourceHeader year={year} yearToggle={yearToggle} sourceToggle={sourceToggle} />}
                  onCellClick={(monthKey, primaryValue, secondaryValue) => {
                    const drilldownReports = filtered.filter((report) => {
                      const month = extractMonthColumn(report);
                      return month?.key === monthKey && resolveAirlineLabel(report) === primaryValue && resolveCategory(report) === secondaryValue;
                    });
                    if (drilldownReports.length) {
                      const month = monthColumns.find((m) => m.key === monthKey);
                      openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue} / ${secondaryValue}`);
                    }
                  }}
                />
              );
            }}</SourceCard>
          )}</YearCard>
        </div>
      </SummarySection>

      <SummarySection title="Summary Report Landside Area Category">
        <div className="grid grid-cols-1 items-stretch gap-4">
          <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => {
              const monthColumns = buildMonthColumns(yearReports);
              const landsideRows = yearReports.filter((report) => hasMeaningfulValue(report.terminal_area_category));
              const data = buildSingleDimensionRows(landsideRows, monthColumns, (report) => normalizeText(report.terminal_area_category));
              return (
                <SingleDimensionMonthPivotTable
                  title="Report Landside Category Area"
                  primaryHeader="Terminal Area Category"
                  monthColumns={monthColumns}
                  rows={data.rows}
                  monthTotals={data.monthTotals}
                  grandTotal={data.grandTotal}
                  compact
                  scrollable
                  unbounded
                  headerExtra={<YearOnlyHeader year={year} yearToggle={yearToggle} />}
                  onCellClick={(monthKey, primaryValue) => {
                    const drilldownReports = landsideRows.filter((report) => {
                      const month = extractMonthColumn(report);
                      return month?.key === monthKey && normalizeText(report.terminal_area_category, '-') === primaryValue;
                    });
                    if (drilldownReports.length) {
                      const month = monthColumns.find((m) => m.key === monthKey);
                      openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue}`);
                    }
                  }}
                />
              );
          }}</YearCard>
          <ExpandableReportBlock
            open={showLandsideAirlines}
            onToggle={() => setShowLandsideAirlines((value) => !value)}
            buttonLabel="Show Landside Area By Airlines Report"
          >
            <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => {
                const landsideRows = yearReports.filter((report) => hasMeaningfulValue(report.terminal_area_category));
                const monthColumns = buildMonthColumns(yearReports);
                const data = buildHierarchicalRows(landsideRows, monthColumns, resolveAirlineLabel, (report) => normalizeText(report.terminal_area_category));
                return (
                  <HierarchicalMonthPivotTable
                    title="Landside Area by Airlines Report"
                    primaryHeader="Airlines"
                    secondaryHeader="Terminal Area Category"
                    monthColumns={monthColumns}
                    rows={data.rows}
                    monthTotals={data.monthTotals}
                    grandTotal={data.grandTotal}
                    compact
                    scrollable
                    unbounded
                    freezeRightCols
                    headerExtra={<YearOnlyHeader year={year} yearToggle={yearToggle} />}
                    onCellClick={(monthKey, primaryValue, secondaryValue) => {
                      const drilldownReports = landsideRows.filter((report) => {
                        const month = extractMonthColumn(report);
                        return month?.key === monthKey &&
                          resolveAirlineLabel(report) === primaryValue &&
                          normalizeText(report.terminal_area_category, '-') === secondaryValue;
                      });
                      if (drilldownReports.length) {
                        const month = monthColumns.find((m) => m.key === monthKey);
                        openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue} / ${secondaryValue}`);
                      }
                    }}
                  />
                );
            }}</YearCard>
          </ExpandableReportBlock>
        </div>
      </SummarySection>

      <SummarySection title="Summary Report Airside/Apron Area Category">
        <div className="grid grid-cols-1 items-stretch gap-4">
          <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => (
            <SourceCard reports={yearReports} options={AIRSIDE_SOURCE_OPTIONS}>{({ filtered, toggle: sourceToggle, source }) => {
              const monthColumns = buildMonthColumns(yearReports);
              const visible = keepAirsideGseReports(filtered, source);
              const data = buildSingleDimensionRows(visible, monthColumns, resolveAirsideApronCategory);
              const categoryHeader = airsideCategoryHeader(source);
              return (
                <SingleDimensionMonthPivotTable
                  title="Report Airside / GSE Category Area"
                  primaryHeader={categoryHeader}
                  monthColumns={monthColumns}
                  rows={data.rows}
                  monthTotals={data.monthTotals}
                  grandTotal={data.grandTotal}
                  compact
                  scrollable
                  unbounded
                  headerExtra={<YearSourceHeader year={year} yearToggle={yearToggle} sourceToggle={sourceToggle} />}
                  onCellClick={(monthKey, primaryValue) => {
                    const drilldownReports = visible.filter((report) => {
                      const month = extractMonthColumn(report);
                      return month?.key === monthKey && normalizeText(resolveAirsideApronCategory(report), '-') === primaryValue;
                    });
                    if (drilldownReports.length) {
                      const month = monthColumns.find((m) => m.key === monthKey);
                      openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue}`);
                    }
                  }}
                />
              );
            }}</SourceCard>
          )}</YearCard>
          <ExpandableReportBlock
            open={showAirsideAirlines}
            onToggle={() => setShowAirsideAirlines((value) => !value)}
            buttonLabel="Show Airside Area By Airlines Report"
          >
            <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => (
              <SourceCard reports={yearReports} options={AIRSIDE_SOURCE_OPTIONS}>{({ filtered, toggle: sourceToggle, source }) => {
                const monthColumns = buildMonthColumns(yearReports);
                const visible = keepAirsideGseReports(filtered, source);
                const data = buildHierarchicalRows(visible, monthColumns, resolveAirlineLabel, resolveAirsideApronCategory);
                const categoryHeader = airsideCategoryHeader(source);
                return (
                  <HierarchicalMonthPivotTable
                    title="Airside / GSE Area by Airlines Report"
                    primaryHeader="Airlines"
                    secondaryHeader={categoryHeader}
                    monthColumns={monthColumns}
                    rows={data.rows}
                    monthTotals={data.monthTotals}
                    grandTotal={data.grandTotal}
                    compact
                    scrollable
                    unbounded
                    freezeRightCols
                    headerExtra={<YearSourceHeader year={year} yearToggle={yearToggle} sourceToggle={sourceToggle} />}
                    onCellClick={(monthKey, primaryValue, secondaryValue) => {
                      const drilldownReports = visible.filter((report) => {
                        const month = extractMonthColumn(report);
                        return month?.key === monthKey &&
                          resolveAirlineLabel(report) === primaryValue &&
                          normalizeText(resolveAirsideApronCategory(report), '-') === secondaryValue;
                      });
                      if (drilldownReports.length) {
                        const month = monthColumns.find((m) => m.key === monthKey);
                        openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue} / ${secondaryValue}`);
                      }
                    }}
                  />
                );
              }}</SourceCard>
            )}</YearCard>
          </ExpandableReportBlock>
        </div>
      </SummarySection>

      <SummarySection title="Summary Report General Service Category">
        <div className="grid grid-cols-1 items-stretch gap-4">
          <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => {
            const generalRows = yearReports.filter((report) => hasMeaningfulValue(report.general_category));
            const monthColumns = buildMonthColumns(yearReports);
            const data = buildSingleDimensionRows(generalRows, monthColumns, (report) => normalizeText(report.general_category));
            return (
              <SingleDimensionMonthPivotTable
                title="Report General Service"
                primaryHeader="General Category"
                monthColumns={monthColumns}
                rows={data.rows}
                monthTotals={data.monthTotals}
                grandTotal={data.grandTotal}
                compact
                scrollable
                unbounded
                headerExtra={<YearOnlyHeader year={year} yearToggle={yearToggle} />}
                onCellClick={(monthKey, primaryValue) => {
                  const drilldownReports = generalRows.filter((report) => {
                    const month = extractMonthColumn(report);
                    return month?.key === monthKey && normalizeText(report.general_category, '-') === primaryValue;
                  });
                  if (drilldownReports.length) {
                    const month = monthColumns.find((m) => m.key === monthKey);
                    openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue}`);
                  }
                }}
              />
            );
          }}</YearCard>
          <ExpandableReportBlock
            open={showGeneralAirlines}
            onToggle={() => setShowGeneralAirlines((value) => !value)}
            buttonLabel="Show General Service By Airlines Report"
          >
            <YearCard reports={reports}>{({ filtered: yearReports, toggle: yearToggle, year }) => {
              const generalRows = yearReports.filter((report) => hasMeaningfulValue(report.general_category));
              const monthColumns = buildMonthColumns(yearReports);
              const data = buildHierarchicalRows(generalRows, monthColumns, resolveAirlineLabel, (report) => normalizeText(report.general_category));
              return (
                <HierarchicalMonthPivotTable
                  title="General Service by Airlines Report"
                  primaryHeader="Airlines"
                  secondaryHeader="General Category"
                  monthColumns={monthColumns}
                  rows={data.rows}
                  monthTotals={data.monthTotals}
                  grandTotal={data.grandTotal}
                  compact
                  scrollable
                  unbounded
                  freezeRightCols
                  headerExtra={<YearOnlyHeader year={year} yearToggle={yearToggle} />}
                  onCellClick={(monthKey, primaryValue, secondaryValue) => {
                    const drilldownReports = generalRows.filter((report) => {
                      const month = extractMonthColumn(report);
                      return month?.key === monthKey &&
                        resolveAirlineLabel(report) === primaryValue &&
                        normalizeText(report.general_category, '-') === secondaryValue;
                    });
                    if (drilldownReports.length) {
                      const month = monthColumns.find((m) => m.key === monthKey);
                      openDrilldown(drilldownReports, `${month ? `${month.label} ${month.year}` : monthKey} - ${primaryValue} / ${secondaryValue}`);
                    }
                  }}
                />
              );
            }}</YearCard>
          </ExpandableReportBlock>
        </div>
      </SummarySection>

      {}
      <DrilldownRenderer />
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="sr-section-h">
        <span className="sr-section-rule" aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExpandableReportBlock({
  open,
  onToggle,
  buttonLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  buttonLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all duration-150 active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        style={{
          background: open
            ? 'linear-gradient(to bottom, #ef4444, #b91c1c)'
            : 'linear-gradient(to bottom, #10b981, #047857)',
          boxShadow: open
            ? '0 3px 0 #991b1b, 0 4px 12px rgba(185,28,28,0.32)'
            : '0 3px 0 #064e3b, 0 4px 12px rgba(4,120,87,0.32)',
        }}
        aria-expanded={open}
      >
        {open ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
            Hide Report
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            {buttonLabel}
          </>
        )}
      </button>
      {open ? children : null}
    </div>
  );
}

type DateRange = { from: string; to: string };

const EMPTY_RANGE: DateRange = { from: '', to: '' };

function filterReportsForHeroCard(reports: Report[], year: number, range: DateRange): Report[] {
  return reports.filter((report) => {
    const date = parseReportDate(report);
    if (!date) return false;
    if (range.from || range.to) {
      const iso = dateToISO(date);
      if (range.from && iso < range.from) return false;
      if (range.to && iso > range.to) return false;
      return true;
    }
    return date.getFullYear() === year;
  });
}

function heroCardLabel(year: number, range: DateRange): string {
  return range.from || range.to ? `${range.from || '…'} to ${range.to || '…'}` : String(year);
}

function HeroDateRangePicker({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <input
        type="date"
        value={range.from}
        onChange={(event) => onChange({ ...range, from: event.target.value })}
        className="sr-date-input"
        aria-label="From date"
      />
      <span className="text-[10px] text-[color:var(--sr-text-3)]">–</span>
      <input
        type="date"
        value={range.to}
        onChange={(event) => onChange({ ...range, to: event.target.value })}
        className="sr-date-input"
        aria-label="To date"
      />
      {range.from || range.to ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_RANGE)}
          className="text-[10px] font-black uppercase text-[color:var(--sr-text-3)] hover:text-[color:var(--sr-neg)]"
          title="Clear date range"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

const SOURCE_BADGES = [
  ['landside', 'Landside'],
  ['airside', 'Airside'],
  ['general', 'General'],
  ['gse', 'GSE'],
] as const;

function HeroCard({
  label,
  reports,
  range,
  onRangeChange,
  onTotalClick,
  onSourceClick,
  primary,
}: {
  label: string;
  reports: Report[];
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onTotalClick: () => void;
  onSourceClick: (source: 'landside' | 'airside' | 'general' | 'gse') => void;
  primary?: boolean;
}) {
  const breakdown = computeBreakdownFromReports(reports);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`sr-card-hero relative flex min-w-0 flex-col justify-between gap-6 p-8 sm:p-10 text-left cursor-pointer hover:brightness-[0.97] transition-all ${primary ? 'sr-card-hero-primary' : ''}`}
      onClick={onTotalClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') onTotalClick();
      }}
      title={`View ${label} reports`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-accent-dark)]">Total Reports {label}</span>
        <HeroDateRangePicker range={range} onChange={onRangeChange} />
      </div>
      <div>
        <div className="sr-hero-value">{reports.length.toLocaleString()}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-2)]">
          {SOURCE_BADGES.map(([source, sourceLabel]) => (
            <button
              key={source}
              type="button"
              disabled={breakdown[source] === 0}
              onClick={(event) => {
                event.stopPropagation();
                onSourceClick(source);
              }}
              className="hover:text-[color:var(--sr-accent-dark)] disabled:cursor-default disabled:opacity-50 disabled:hover:text-[color:var(--sr-text-2)]"
            >
              <span className="text-[color:var(--sr-text-3)]">{sourceLabel}</span> · <span className="font-mono text-[color:var(--sr-text)]">{breakdown[source].toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnualMetricStrip({
  previousYear,
  currentYear,
  allReports,
  openDrilldown,
}: {
  previousYear: number;
  currentYear: number;
  allReports: Report[];
  openDrilldown: (reports: Report[], title: string) => void;
}) {
  const [previousRange, setPreviousRange] = useState<DateRange>(EMPTY_RANGE);
  const [currentRange, setCurrentRange] = useState<DateRange>(EMPTY_RANGE);

  const previousReports = useMemo(
    () => filterReportsForHeroCard(allReports, previousYear, previousRange),
    [allReports, previousYear, previousRange]
  );
  const currentReports = useMemo(
    () => filterReportsForHeroCard(allReports, currentYear, currentRange),
    [allReports, currentYear, currentRange]
  );

  const sourceLabelByValue: Record<string, string> = { landside: 'Landside', airside: 'Airside', general: 'General', gse: 'GSE' };

  const handleSourceClick = (
    reports: Report[],
    label: string,
    source: 'landside' | 'airside' | 'general' | 'gse'
  ) => {
    const matched = reports.filter((report) => classifySourceArea(report) === source);
    if (matched.length) openDrilldown(matched, `${label} - ${sourceLabelByValue[source]}`);
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <HeroCard
        label={heroCardLabel(previousYear, previousRange)}
        reports={previousReports}
        range={previousRange}
        onRangeChange={setPreviousRange}
        onTotalClick={() => {
          if (previousReports.length) openDrilldown(previousReports, `${heroCardLabel(previousYear, previousRange)} - Total Reports`);
        }}
        onSourceClick={(source) => handleSourceClick(previousReports, heroCardLabel(previousYear, previousRange), source)}
      />
      <HeroCard
        primary
        label={heroCardLabel(currentYear, currentRange)}
        reports={currentReports}
        range={currentRange}
        onRangeChange={setCurrentRange}
        onTotalClick={() => {
          if (currentReports.length) openDrilldown(currentReports, `${heroCardLabel(currentYear, currentRange)} - Total Reports`);
        }}
        onSourceClick={(source) => handleSourceClick(currentReports, heroCardLabel(currentYear, currentRange), source)}
      />
    </div>
  );
}

function YearTrendChartPanel({
  previousYear,
  currentYear,
  previousRows,
  currentRows,
  onMonthCategoryClick,
}: {
  previousYear: number;
  currentYear: number;
  previousRows: YearlyCategoryMonthRow[];
  currentRows: YearlyCategoryMonthRow[];
  onMonthCategoryClick?: (year: number, monthIndex: number, metricId: SummaryMetricId) => void;
}) {
  const [visibleMetricIds, setVisibleMetricIds] = useState<Array<SummaryCategoryMetric['id']>>(
    () => SUMMARY_CATEGORY_METRICS.map((metric) => metric.id)
  );

  const chartData = currentRows.map((row, index) => ({
    month: row.monthLabel,
    monthIndex: row.monthIndex,
    ...SUMMARY_CATEGORY_METRICS.reduce<Record<string, number>>((acc, metric) => {
      acc[`${metric.id}-${previousYear}`] = previousRows[index]?.[metric.id] || 0;
      acc[`${metric.id}-${currentYear}`] = row[metric.id] || 0;
      return acc;
    }, {}),
  }));

  const visibleMetrics = SUMMARY_CATEGORY_METRICS.filter((metric) => visibleMetricIds.includes(metric.id));

  const toggleMetric = (metricId: SummaryCategoryMetric['id']) => {
    setVisibleMetricIds((current) => {
      if (current.includes(metricId)) {
        return current.length === 1 ? current : current.filter((item) => item !== metricId);
      }
      return [...current, metricId];
    });
  };

  const renderTrendDot = (
    year: number,
    metricId: SummaryCategoryMetric['id'],
    fill: string,
    radius: number,
    opacity = 1
  ) => {
    function TrendDotRenderer(props: TrendDotProps) {
      const { cx, cy, payload } = props;
      if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
      const monthIndex = payload?.monthIndex;
      const canOpen = typeof monthIndex === 'number' && Boolean(onMonthCategoryClick);

      return (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill}
          fillOpacity={opacity}
          stroke="#ffffff"
          strokeOpacity={opacity}
          strokeWidth={2}
          className={canOpen ? 'cursor-pointer' : undefined}
          onClick={() => {
            if (typeof monthIndex === 'number') onMonthCategoryClick?.(year, monthIndex, metricId);
          }}
        />
      );
    }

    return TrendDotRenderer;
  };

  return (
    <div className="sr-card relative flex min-h-[36rem] min-w-0 flex-col overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-[4px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-block h-9 w-[5px] shrink-0 rounded bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-accent-dark)]">Monthly trend</span>
            <h3 className="font-display text-[18px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--sr-text)]">{previousYear} vs {currentYear}</h3>
            <span className="text-[11px] font-semibold text-slate-500">Sqrt scale keeps low-volume categories visible while preserving zero.</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChartAiAnalysisButton
            context={{
              section: 'Summary Report',
              chartTitle: `Monthly Trend ${previousYear} vs ${currentYear}`,
              chartType: 'monthly_trend_combo_chart',
              chartData,
              featureHints: summaryReportFeatureHints(`Monthly Trend ${previousYear} vs ${currentYear}`),
            }}
          />
        </div>
      </div>
      <div className="mb-4 grid shrink-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Categories</span>
            <span className="text-[10px] font-bold text-slate-400">{visibleMetricIds.length} of {SUMMARY_CATEGORY_METRICS.length} active</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SUMMARY_CATEGORY_METRICS.map((metric) => {
              const active = visibleMetricIds.includes(metric.id);
              return (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => toggleMetric(metric.id)}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    borderColor: active ? metric.color : '#d8d4c8',
                    backgroundColor: active ? `${metric.color}14` : '#ffffff',
                    color: active ? metric.color : '#667174',
                    boxShadow: active ? `0 8px 20px -18px ${metric.color}` : 'none',
                  }}
                  aria-pressed={active}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                  {metric.chartLabel}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setVisibleMetricIds(SUMMARY_CATEGORY_METRICS.map((metric) => metric.id))}
              disabled={visibleMetricIds.length === SUMMARY_CATEGORY_METRICS.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--sr-accent-soft-2)] bg-white px-3 py-2 text-xs font-bold text-[color:var(--sr-accent-dark)] transition hover:bg-[color:var(--sr-accent-tint)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={() => setVisibleMetricIds([])}
              disabled={visibleMetricIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--sr-border)] bg-white px-3 py-2 text-xs font-bold text-[color:var(--sr-text-3)] transition hover:bg-[color:var(--sr-neg-soft)] hover:text-[color:var(--sr-neg)] hover:border-[color:var(--sr-neg-soft)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[color:var(--sr-text-3)]"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Year key</span>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <span className="h-0 w-8 border-t-2 border-dashed border-[#94a3b8]" />
            {previousYear} (prior)
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-black text-slate-800">
            <span className="h-0 w-8 border-t-[3px] border-slate-800" />
            {currentYear}
          </span>
        </div>
      </div>
      <div className="sr-only">
        Monthly category trend chart comparing {previousYear} and {currentYear}.
      </div>
      <div className="min-h-[300px] flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 12, right: 16, bottom: 8, left: -4 }}
            role="img"
            aria-label={`Monthly category trend comparing ${previousYear} and ${currentYear}`}
          >
            <CartesianGrid stroke="#e6e0d2" strokeDasharray="2 8" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#38484b', fontSize: 12, fontWeight: 800 }}
              axisLine={{ stroke: '#d8d4c8' }}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              allowDecimals={false}
              scale="sqrt"
              domain={[0, 'dataMax']}
              tick={{ fill: '#607174', fontSize: 12, fontWeight: 800 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickMargin={8}
            />
            <Tooltip
              cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4', strokeWidth: 1 }}
              content={(props) => renderMonthlyTrendTooltip(props as TrendTooltipProps, visibleMetrics, previousYear, currentYear)}
            />
            {}
            {visibleMetrics.flatMap((metric) => [
              <Line
                key={`${metric.id}-${previousYear}`}
                type="monotone"
                dataKey={`${metric.id}-${previousYear}`}
                name={`${metric.chartLabel} ${previousYear}`}
                stroke="#94a3b8"
                strokeOpacity={0.85}
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={renderTrendDot(previousYear, metric.id, '#94a3b8', 2.5, 0.7)}
                activeDot={renderTrendDot(previousYear, metric.id, '#94a3b8', 5.5, 1)}
                onClick={(point: unknown) => {
                  const monthIndex = (point as TrendPoint)?.payload?.monthIndex;
                  if (typeof monthIndex === 'number') onMonthCategoryClick?.(previousYear, monthIndex, metric.id);
                }}
              />,
              <Line
                key={`${metric.id}-${currentYear}`}
                type="monotone"
                dataKey={`${metric.id}-${currentYear}`}
                name={`${metric.chartLabel} ${currentYear}`}
                stroke={metric.color}
                strokeWidth={3.2}
                dot={renderTrendDot(currentYear, metric.id, metric.color, 3.8)}
                activeDot={renderTrendDot(currentYear, metric.id, metric.color, 7)}
                onClick={(point: unknown) => {
                  const monthIndex = (point as TrendPoint)?.payload?.monthIndex;
                  if (typeof monthIndex === 'number') onMonthCategoryClick?.(currentYear, monthIndex, metric.id);
                }}
              />,
            ])}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnnualReportSummary({
  previousYear,
  currentYear,
  allReports,
  previousRows,
  currentRows,
  comparisonRows,
  branchOptions,
  airlineOptions,
  selectedBranch,
  selectedAirline,
  onBranchChange,
  onAirlineChange,
  onMonthCategoryClick,
  onYearComparisonClick,
  openDrilldown,
  headerExtra,
}: {
  previousYear: number;
  currentYear: number;
  allReports: Report[];
  previousRows: YearlyCategoryMonthRow[];
  currentRows: YearlyCategoryMonthRow[];
  comparisonRows: YearComparisonRow[];
  branchOptions: string[];
  airlineOptions: string[];
  selectedBranch: string;
  selectedAirline: string;
  onBranchChange: (value: string) => void;
  onAirlineChange: (value: string) => void;
  onMonthCategoryClick?: (year: number, monthIndex: number, metricId: SummaryMetricId) => void;
  onYearComparisonClick?: (metricId: SummaryMetricId) => void;
  openDrilldown: (reports: Report[], title: string) => void;
  headerExtra?: ReactNode;
}) {
  return (
    <div className="sr-card relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
      <div className="space-y-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-block h-11 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-accent-dark)]">
              Period · {previousYear} &amp; {currentYear}
            </span>
            <h2 className="font-display text-[clamp(22px,2vw,28px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              Report Summary
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-start gap-4 xl:justify-end">
          {headerExtra ? (
            <div className="flex min-w-[210px] flex-col gap-1.5">
              <span className="sr-eyebrow">Category</span>
              {headerExtra}
            </div>
          ) : null}
          <label className="flex min-w-[160px] flex-col gap-1.5">
            <span className="sr-eyebrow">Station</span>
            <select
              value={selectedBranch}
              onChange={(event) => onBranchChange(event.target.value)}
              className="sr-select"
            >
              <option value="all">All Station</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[200px] flex-col gap-1.5">
            <span className="sr-eyebrow">Airlines</span>
            <select
              value={selectedAirline}
              onChange={(event) => onAirlineChange(event.target.value)}
              className="sr-select"
            >
              <option value="all">All Airlines</option>
              {airlineOptions.map((airline) => (
                <option key={airline} value={airline}>
                  {airline}
                </option>
              ))}
            </select>
          </label>
          {(selectedBranch !== 'all' || selectedAirline !== 'all') ? (
            <button
              type="button"
              onClick={() => {
                onBranchChange('all');
                onAirlineChange('all');
              }}
              className="sr-btn sr-btn-ghost"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      <AnnualMetricStrip
        previousYear={previousYear}
        currentYear={currentYear}
        allReports={allReports}
        openDrilldown={openDrilldown}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <YearCategorySummaryTable
          year={previousYear}
          rows={previousRows}
          onCellClick={onMonthCategoryClick}
        />
        <YearCategorySummaryTable
          year={currentYear}
          rows={currentRows}
          onCellClick={onMonthCategoryClick}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <YearImprovementSummaryTable
          previousYear={previousYear}
          currentYear={currentYear}
          rows={comparisonRows}
          onRowClick={onYearComparisonClick}
        />
        <YearTrendChartPanel
          previousYear={previousYear}
          currentYear={currentYear}
          previousRows={previousRows}
          currentRows={currentRows}
          onMonthCategoryClick={onMonthCategoryClick}
        />
      </div>
      </div>
    </div>
  );
}

function YearCategorySummaryTable({
  year,
  rows,
  onCellClick,
}: {
  year: number;
  rows: YearlyCategoryMonthRow[];
  onCellClick?: (year: number, monthIndex: number, metricId: SummaryMetricId) => void;
}) {
  const yearTotal = rows.reduce((s, r) => s + r.total, 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const now = new Date();
  const isCurrentCalendarYear = year === now.getFullYear();
  const lastOccurredMonthIndex = isCurrentCalendarYear ? now.getMonth() : 11;

  const displayRows = [...rows]
    .filter((row) => row.monthIndex <= lastOccurredMonthIndex)
    .sort((a, b) => a.monthIndex - b.monthIndex);
  return (
    <div className="sr-table-card flex h-[28rem] min-w-0 flex-col">
      <div className="sr-table-caption">
        <div className="sr-table-caption-title">
          <span className="sr-marker" aria-hidden="true" />
          <h4>{year}</h4>
        </div>
        <ChartAiAnalysisButton
          context={{
            section: 'Summary Report',
            chartTitle: `${year}`,
            chartType: 'year_month_category_table',
            chartData: rows,
            featureHints: summaryReportFeatureHints(`MoM ${year}`),
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="sr-table sr-table-mom">
          <thead>
            <tr>
              <th className="sr-sticky-col-1" title="Month">Month</th>
              {SUMMARY_CATEGORY_METRICS.map((metric) => (
                <th key={metric.id} className="sr-num" style={{ minWidth: 56 }}>{metric.label}</th>
              ))}
              <th className="sr-num sr-sticky-col-right-2">Total</th>
              <th className="sr-center sr-sticky-col-right-1">vs prev mo</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const origIndex = rows.findIndex(r => r.id === row.id);
              const previous = origIndex > 0 ? rows[origIndex - 1].total : 0;
              const deltaPct = origIndex > 0 ? computeDeltaPct(row.total, previous) : null;
              const trend = deltaPct === null ? null : { current: row.total, previous, deltaPct };
              return (
                <tr key={row.id}>
                  <td className="sr-label sr-sticky-col-1">
                    <span className="font-bold">{row.monthLabel}</span>
                    <span className="ml-1 text-[color:var(--sr-text-3)] text-[10px]">{year}</span>
                  </td>
                  {SUMMARY_CATEGORY_METRICS.map((metric) => {
                    const value = row[metric.id];
                    const isClickable = Boolean(onCellClick && value > 0);
                    return (
                      <td
                        key={metric.id}
                        className={`sr-num ${isClickable ? 'sr-cell-click cursor-pointer' : ''}`}
                        onClick={() => isClickable && onCellClick(year, row.monthIndex, metric.id)}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={(event) => {
                          if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            onCellClick?.(year, row.monthIndex, metric.id);
                          }
                        }}
                      >
                        {value > 0 ? <span className="sr-cell-value">{value}</span> : <span className="text-[color:var(--sr-text-3)]">–</span>}
                      </td>
                    );
                  })}
                  <td
                    className={`sr-num sr-sticky-col-right-2 ${heatClass(row.total, maxTotal)} ${onCellClick && row.total > 0 ? 'sr-cell-click cursor-pointer' : ''}`}
                    onClick={() => row.total > 0 && onCellClick?.(year, row.monthIndex, 'total')}
                    role={onCellClick && row.total > 0 ? 'button' : undefined}
                    tabIndex={onCellClick && row.total > 0 ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (onCellClick && row.total > 0 && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        onCellClick(year, row.monthIndex, 'total');
                      }
                    }}
                  >
                    {row.total > 0 ? row.total : <span className="text-[color:var(--sr-text-3)]">–</span>}
                  </td>
                  <td className="sr-center sr-sticky-col-right-1">
                    <TrendBadge trend={trend} positiveTrend="down" rowLabel="total" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sr-label-foot sr-sticky-col-1">Total</td>
              {SUMMARY_CATEGORY_METRICS.map((metric) => (
                <td key={metric.id}>{rows.reduce((s, r) => s + r[metric.id], 0).toLocaleString()}</td>
              ))}
              <td className="sr-sticky-col-right-2">{yearTotal.toLocaleString()}</td>
              <td className="sr-sticky-col-right-1"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function YearImprovementSummaryTable({
  previousYear,
  currentYear,
  rows,
  onRowClick,
}: {
  previousYear: number;
  currentYear: number;
  rows: YearComparisonRow[];
  onRowClick?: (metricId: SummaryMetricId) => void;
}) {
  return (
    <div className="sr-table-card flex h-[28rem] min-w-0 flex-col">
      <div className="sr-table-caption">
        <div className="sr-table-caption-title">
          <span className="sr-marker" aria-hidden="true" />
          <h3>Full-Year Comparison</h3>
        </div>
        <ChartAiAnalysisButton
          context={{
            section: 'Summary Report',
            chartTitle: `YoY ${previousYear} vs ${currentYear}`,
            chartType: 'year_comparison_table',
            chartData: rows,
            featureHints: summaryReportFeatureHints(`YoY ${previousYear} vs ${currentYear}`),
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="sr-table">
          <thead>
            <tr>
              <th className="sr-sticky-col-1" title="Category">Category</th>
              <th className="sr-num">{previousYear}</th>
              <th className="sr-num">{currentYear}</th>
              <th className="sr-center">YoY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPositiveMetric = row.id === 'compliment';
              const isIncrease = row.current > row.previous;

              let pillKind: 'pos' | 'neg' | 'neutral';
              let icon: string;

              if (row.direction === 'flat' || row.direction === 'no-baseline') {
                pillKind = 'neutral';
                icon = '→';
              } else {

                const isGood = isPositiveMetric ? isIncrease : !isIncrease;
                pillKind = isGood ? 'pos' : 'neg';
                icon = isIncrease ? '↑' : '↓';
              }

              const isTotal = row.label.toLowerCase() === 'total';
              return (
                <tr
                  key={row.id}
                  className={`${isTotal ? 'font-semibold' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row.id)}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onRowClick(row.id);
                    }
                  }}
                >
                  <td className="sr-label sr-sticky-col-1" title={row.label}>{row.label}</td>
                  <td className="sr-num">{row.previous.toLocaleString()}</td>
                  <td className="sr-num">{row.current.toLocaleString()}</td>
                  <td className="sr-center">
                    <span className={`sr-pill sr-pill-${pillKind}`}>
                      <span aria-hidden="true">{icon}</span>
                      <span>{row.direction === 'no-baseline' ? 'N/A' : `${Math.round(row.deltaPct)}%`}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SingleDimensionMonthPivotTable({
  title,
  primaryHeader,
  monthColumns,
  rows,
  monthTotals,
  grandTotal,
  compact = false,
  onCellClick,
  scrollable = false,
  unbounded = false,
  headerExtra,
}: {
  title: string;
  primaryHeader: string;
  monthColumns: MonthColumn[];
  rows: PivotRow[];
  monthTotals: Record<string, number>;
  grandTotal: number;
  compact?: boolean;
  onCellClick?: (monthKey: string, primaryValue: string) => void;
  scrollable?: boolean;
  unbounded?: boolean;
  headerExtra?: ReactNode;
}) {
  const safeRows = compactRows(rows).sort((a, b) => b.total - a.total);

  const displayMonths = [...monthColumns].sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex));
  const maxValue = Math.max(1, ...safeRows.flatMap((row) => displayMonths.map((month) => row.values[month.key] || 0)));

  return (
    <TableShell
      title={title}
      scrollable={scrollable}
      unbounded={unbounded}
      headerExtra={headerExtra}
      aiContext={{
        section: 'Summary Report',
        chartTitle: title,
        chartType: 'month_pivot',
        chartData: safeRows.map((row) => ({ name: row.primary, value: row.total, values: row.values })),
        featureHints: summaryReportFeatureHints(title),
      }}
    >
      {safeRows.length === 0 ? (
        <EmptyTableState label={title} />
      ) : (
        <table className={`sr-table ${compact ? 'text-[14px]' : ''}`}>
          <thead>
            <tr>
              <th className="sr-sticky-col-1" title={primaryHeader}>{primaryHeader}</th>
              {displayMonths.map((month) => (
                <th key={month.key} className="sr-num" style={{ minWidth: 60 }}>
                  <span className="block">{month.label.slice(0, 3)}</span>
                  <span className="block text-[10px] font-normal opacity-80">{month.year}</span>
                </th>
              ))}
              <th className="sr-num sr-sticky-col-right-2">Total</th>
              <th className="sr-center sr-sticky-col-right-1">vs prev mo</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row) => {
              const trend = computeRowTrend(row, monthColumns);
              return (
                <tr key={row.id}>
                  <td className="sr-label sr-sticky-col-1" title={row.primary}>{row.primary}</td>
                  {displayMonths.map((month) => {
                    const value = row.values[month.key] || 0;
                    const isClickable = onCellClick && value > 0;
                    const heatCls = heatClass(value, maxValue);
                    return (
                      <td
                        key={`${row.id}-${month.key}`}
                        className={`sr-num ${heatCls} ${isClickable ? 'sr-cell-click cursor-pointer' : ''}`}
                        onClick={() => isClickable && onCellClick(month.key, row.primary)}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onCellClick(month.key, row.primary);
                          }
                        }}
                        title={`${row.primary} – ${month.label} ${month.year}: ${value} records`}
                      >
                        {value > 0 ? <span className="sr-cell-value">{value}</span> : <span className="text-[color:var(--sr-text-3)]">–</span>}
                      </td>
                    );
                  })}
                  <td className="sr-num font-semibold sr-sticky-col-right-2">{row.total > 0 ? row.total.toLocaleString() : <span className="text-[color:var(--sr-text-3)]">–</span>}</td>
                  <td className="sr-center sr-sticky-col-right-1">
                    <TrendBadge trend={trend} positiveTrend="auto" rowLabel={row.primary} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sr-label-foot sr-sticky-col-1">Grand total</td>
              {displayMonths.map((month) => (
                <td key={month.key}>{monthTotals[month.key] ? monthTotals[month.key].toLocaleString() : '–'}</td>
              ))}
              <td className="sr-sticky-col-right-2">{grandTotal.toLocaleString()}</td>
              <td className="sr-sticky-col-right-1"></td>
            </tr>
          </tfoot>
        </table>
      )}
    </TableShell>
  );
}

function TableShell({
  title,
  children,
  scrollable,
  unbounded,
  aiContext,
  headerExtra,
}: {
  title: string;
  children: ReactNode;
  scrollable?: boolean;
  unbounded?: boolean;
  aiContext?: ChartAiContext;
  headerExtra?: ReactNode;
}) {
  return (
    <div className={`sr-table-card flex min-w-0 flex-col ${unbounded ? 'h-auto' : 'h-[28rem]'}`}>
      <div className="sr-table-caption">
        <div className="sr-table-caption-title">
          <span className="sr-marker" aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
        </div>
      </div>
      <div
        className={
          unbounded
            ? 'relative min-h-0 overflow-x-auto overflow-y-visible'
            : scrollable
              ? 'relative min-h-0 flex-1 overflow-auto'
              : 'min-h-0 flex-1 overflow-auto'
        }
      >
        {children}
      </div>
    </div>
  );
}

function EmptyTableState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 border-t border-[color:var(--sr-border)] bg-[color:var(--sr-canvas)] px-6 text-center">
      <span className="sr-eyebrow text-[color:var(--sr-text-3)]">Empty</span>
      <p className="text-[15px] font-medium text-[color:var(--sr-text-2)]">No {label} data</p>
    </div>
  );
}

function HierarchicalMonthPivotTable({
  title,
  primaryHeader,
  secondaryHeader,
  monthColumns,
  rows,
  monthTotals,
  grandTotal,
  compact = false,
  onCellClick,
  scrollable = false,
  maxRows,
  freezeRightCols = false,
  unbounded = false,
  headerExtra,
}: {
  title: string;
  primaryHeader: string;
  secondaryHeader: string;
  monthColumns: MonthColumn[];
  rows: PivotRow[];
  monthTotals: Record<string, number>;
  grandTotal: number;
  compact?: boolean;
  onCellClick?: (monthKey: string, primaryValue: string, secondaryValue: string) => void;
  scrollable?: boolean;
  maxRows?: number;
  freezeRightCols?: boolean;
  unbounded?: boolean;
  headerExtra?: ReactNode;
}) {
  const groupedRows = (() => {
    const groupTotals = new Map<string, number>();
    compactRows(rows).forEach((row) => {
      groupTotals.set(row.primary, (groupTotals.get(row.primary) || 0) + row.total);
    });
    return compactRows(rows).slice().sort((a, b) => {
      const groupDelta = (groupTotals.get(b.primary) || 0) - (groupTotals.get(a.primary) || 0);
      if (groupDelta !== 0) return groupDelta;
      if (a.primary !== b.primary) return a.primary.localeCompare(b.primary);
      return b.total - a.total;
    });
  })();
  const safeRows = groupedRows;
  const visibleRows = !unbounded && typeof maxRows === 'number' ? safeRows.slice(0, maxRows) : safeRows;

  const displayMonths = [...monthColumns].sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex));
  const maxValue = Math.max(1, ...visibleRows.flatMap((row) => displayMonths.map((month) => row.values[month.key] || 0)));

  function getPrimaryRowSpan(rowIndex: number) {
    const primary = visibleRows[rowIndex]?.primary;
    if (!primary) return 1;

    let span = 1;
    for (let nextIndex = rowIndex + 1; nextIndex < visibleRows.length; nextIndex += 1) {
      if (visibleRows[nextIndex].primary !== primary) break;
      span += 1;
    }

    return span;
  }

  const rightTotal = freezeRightCols ? 'sr-sticky-col-right-2' : '';
  const rightPrev = freezeRightCols ? 'sr-sticky-col-right-1' : '';

  return (
    <TableShell
      title={title}
      scrollable={scrollable}
      unbounded={unbounded}
      headerExtra={headerExtra}
      aiContext={{
        section: 'Summary Report',
        chartTitle: title,
        chartType: 'hierarchical_month_pivot',
        chartData: safeRows.map((row) => ({
          name: `${row.primary} / ${row.secondary || '-'}`,
          value: row.total,
          primary: row.primary,
          secondary: row.secondary,
          values: row.values,
        })),
        featureHints: summaryReportFeatureHints(title),
      }}
    >
      {visibleRows.length === 0 ? (
        <EmptyTableState label={title} />
      ) : (
        <table className={`sr-table ${freezeRightCols ? 'sr-table-hierarchy-compact' : ''} ${compact ? 'text-[14px]' : ''}`}>
          <thead>
            <tr>
              <th className="sr-sticky-col-1" title={primaryHeader}>{primaryHeader}</th>
              <th className="sr-sticky-col-2" title={secondaryHeader}>{secondaryHeader}</th>
              {displayMonths.map((month) => (
                <th key={month.key} className="sr-num" style={{ minWidth: 60 }}>
                  <span className="block">{month.label.slice(0, 3)}</span>
                  <span className="block text-[10px] font-normal opacity-80">{month.year}</span>
                </th>
              ))}
              <th className={`sr-num ${rightTotal}`}>Total</th>
              <th className={`sr-center ${rightPrev}`}>vs prev mo</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const showPrimary = index === 0 || visibleRows[index - 1].primary !== row.primary;
              const primaryRowSpan = showPrimary ? getPrimaryRowSpan(index) : 0;
              const trend = computeRowTrend(row, monthColumns);
              return (
                <tr key={row.id}>
                  {showPrimary ? (
                    <td rowSpan={primaryRowSpan} className="sr-label sr-sticky-col-1 align-top" title={row.primary}>
                      {row.primary}
                    </td>
                  ) : null}
                  <td className="sr-sticky-col-2 align-top" title={row.secondary}>{row.secondary}</td>
                  {displayMonths.map((month) => {
                    const value = row.values[month.key] || 0;
                    const isClickable = onCellClick && value > 0;
                    const heatCls = heatClass(value, maxValue);
                    return (
                      <td
                        key={`${row.id}-${month.key}`}
                        className={`sr-num ${heatCls} ${isClickable ? 'sr-cell-click cursor-pointer' : ''}`}
                        onClick={() => isClickable && onCellClick(month.key, row.primary, row.secondary || '')}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onCellClick(month.key, row.primary, row.secondary || '');
                          }
                        }}
                        title={`${row.primary} / ${row.secondary} – ${month.label} ${month.year}: ${value} records`}
                      >
                        {value > 0 ? <span className="sr-cell-value">{value}</span> : <span className="text-[color:var(--sr-text-3)]">–</span>}
                      </td>
                    );
                  })}
                  <td className={`sr-num font-semibold ${rightTotal}`}>{row.total > 0 ? row.total.toLocaleString() : <span className="text-[color:var(--sr-text-3)]">–</span>}</td>
                  <td className={`sr-center ${rightPrev}`}>
                    <TrendBadge trend={trend} positiveTrend="auto" rowLabel={row.secondary} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sr-label-foot sr-sticky-col-1">Grand total</td>
              <td className="sr-label-foot sr-sticky-col-2"></td>
              {displayMonths.map((month) => (
                <td key={month.key}>{monthTotals[month.key] ? monthTotals[month.key].toLocaleString() : '–'}</td>
              ))}
              <td className={rightTotal}>{grandTotal.toLocaleString()}</td>
              <td className={rightPrev}></td>
            </tr>
          </tfoot>
        </table>
      )}
    </TableShell>
  );
}
