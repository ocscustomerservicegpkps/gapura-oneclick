'use client';

import { Fragment, useDeferredValue, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus } from 'lucide-react';
import type { Report } from '@/types';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { SectionAiSummaryInsightButton } from '@/components/dashboard/ai/SectionAiSummaryInsightButton';
import { YearCard } from '@/components/dashboard/year-context';
import {
  isCargoReport,
  isGseServiceReport,
  isJoumpaServiceReport,
  resolveAreaType,
  resolveCaseClassification,
  resolveEvidenceLinks,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
  resolveRootCause,
} from '@/lib/report-normalization';

interface ServiceQualityImprovementTabProps {
  reports: Report[];
}

type CountRow = { id: string; label: string; total: number };
type MatrixCell = { total: number; reports: Report[] };

const PANEL_FRAME = 'sr-table-card flex min-h-0 min-w-0 flex-col';
const DONUT_COLORS = ['var(--sr-accent)', 'var(--sr-gold)', 'var(--sr-chart-3)', 'var(--sr-chart-4)', 'var(--sr-chart-5)', 'var(--sr-neg)'];

const REPORT_CATEGORIES = ['Irregularity', 'Complaint', 'Compliment', 'Occurrence', 'Accident / Incident'] as const;
const AREA_LABELS: Record<string, string> = {
  TERMINAL: 'Terminal Area',
  APRON: 'Apron Area',
  CARGO: 'Cargo Area',
  GENERAL: 'General',
  GSE: 'GSE Availability',
};

function val(v: unknown): string {
  return String(v ?? '').trim();
}

function hasValue(v: unknown): boolean {
  const t = val(v).toLowerCase();
  return t !== '' && t !== '-' && t !== '#n/a' && t !== 'n/a' && t !== 'null' && t !== 'undefined' && t !== 'nil' && t !== 'unknown';
}

function getReportDate(r: Report): Date | null {
  const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getMonthKey(r: Report): string {
  const d = getReportDate(r);
  if (!d) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCategory(r: Report): string {
  return resolveReportCategory(r) || 'Irregularity';
}

function getArea(r: Report): string {
  const raw = (resolveAreaType(r) || 'General').toUpperCase();
  return AREA_LABELS[raw] || raw;
}

function getBranch(r: Report): string {
  return resolveReportBranch(r) || val(r.branch) || val(r.station_code) || 'Unknown';
}

function getAirline(r: Report): string {
  return resolveReportAirline(r) || val(r.airlines) || val(r.airline) || 'Unknown';
}

function getCaseClass(r: Report): string {
  return val(resolveCaseClassification(r));
}

function getRoot(r: Report): string {
  return val(resolveRootCause(r));
}

function getStatus(r: Report): string {
  const raw = val(r.status).toUpperCase();
  return raw === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function isLandsideReport(r: Report) {
  const area = val(r.area).toLowerCase();
  return hasValue(r.terminal_area_category) || area.includes('terminal') || area.includes('landside');
}

function isAirsideReport(r: Report) {
  const area = val(r.area).toLowerCase();
  return hasValue(r.apron_area_category) || area.includes('apron') || area.includes('airside');
}

function isGeneralAreaReport(r: Report) {
  return resolveAreaType(r) === 'General';
}

function normalizeSeverity(value: unknown): string {
  const t = val(value).toUpperCase();
  if (!t) return '-';
  if (t.includes('TOP RISK') || t === 'CRITICAL' || t === 'URGENT') return 'TOP RISK';
  if (t.includes('HIGH RISK')) return 'HIGH RISK';
  if (t === 'HIGH') return 'HIGH RISK';
  if (t === 'MEDIUM') return 'MEDIUM';
  if (t === 'LOW') return 'LOW';
  return t;
}

function getSeverity(r: Report): string {
  return normalizeSeverity(r.severity_level || r.severity);
}

function aggregate(reports: Report[], getValue: (r: Report) => string): CountRow[] {
  const buckets = new Map<string, CountRow>();
  reports.forEach((r) => {
    const raw = getValue(r);
    if (!hasValue(raw)) return;
    const key = raw.toLowerCase();
    const existing = buckets.get(key);
    if (existing) existing.total += 1;
    else buckets.set(key, { id: key, label: raw, total: 1 });
  });
  return Array.from(buckets.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function computeCaseClassByMonth(reports: Report[]) {
  const monthSet = new Set<string>();
  const buckets = new Map<string, Map<string, number>>();
  reports.forEach((r) => {
    if (getCategory(r).toLowerCase().includes('compliment')) return;
    const cc = getCaseClass(r);
    const mk = getMonthKey(r);
    if (!hasValue(cc) || !mk) return;
    monthSet.add(mk);
    const inner = buckets.get(cc) || new Map<string, number>();
    inner.set(mk, (inner.get(mk) || 0) + 1);
    buckets.set(cc, inner);
  });
  const monthKeys = Array.from(monthSet).sort();
  const monthLabel = (mk: string) => {
    const [y, m] = mk.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  };
  const rows = Array.from(buckets.entries()).map(([cc, inner]) => {
    const values = monthKeys.map((mk) => inner.get(mk) || 0);
    return { caseClass: cc, values, total: values.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => b.total - a.total);
  const monthTotals = monthKeys.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0);
  return { monthKeys, monthLabel, rows, monthTotals, grandTotal };
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

type ChronicRow = {
  branch: string;
  subCategory: string;
  caseClass: string;
  area: string;
  monthsCount: number;
  total: number;
  firstSeen: string;
  lastSeen: string;
  trend: 'up' | 'down' | 'flat';
  trendDelta: number;
  topRootCause: string;
  topSeverity: string;
  openCount: number;
  closedCount: number;
  openPct: number;
  reports: Report[];
};

function computeChronicIssues(reports: Report[]): ChronicRow[] {
  const subCategoryOf = (r: Report) => val(r.terminal_area_category) || val(r.apron_area_category) || val(r.general_category) || '';
  const areaOf = (r: Report) => {
    if (hasValue(r.terminal_area_category)) return 'Terminal';
    if (hasValue(r.apron_area_category)) return 'Apron';
    if (hasValue(r.general_category)) return 'General';
    return (resolveAreaType(r) || 'General');
  };
  const buckets = new Map<string, { branch: string; subCategory: string; area: string; months: Map<string, number>; reports: Report[] }>();
  reports
    .filter((r) => !getCategory(r).toLowerCase().includes('compliment'))
    .forEach((r) => {
      const branch = (resolveReportBranch(r) || val(r.branch) || val(r.station_code) || 'Unknown');
      const sub = subCategoryOf(r);
      const monthKey = getMonthKey(r);
      if (!hasValue(branch) || !hasValue(sub) || !monthKey) return;
      const key = `${branch.toLowerCase()}::${sub.toLowerCase()}`;
      const bucket = buckets.get(key) || { branch, subCategory: sub, area: areaOf(r), months: new Map<string, number>(), reports: [] };
      bucket.months.set(monthKey, (bucket.months.get(monthKey) || 0) + 1);
      bucket.reports.push(r);
      buckets.set(key, bucket);
    });
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  };
  const shiftMonthKey = (key: string, delta: number): string => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(Date.UTC(y, (m || 1) - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const topOf = (rs: Report[], fn: (r: Report) => string): string => {
    const c: Record<string, number> = {};
    rs.forEach((r) => { const v = fn(r); if (hasValue(v)) c[v] = (c[v] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  };
  return Array.from(buckets.values())
    .filter((b) => b.months.size >= 3)
    .map((b) => {
      const sortedKeys = Array.from(b.months.keys()).sort();
      // Trend requires a genuine 6-consecutive-calendar-month window (3
      // recent + 3 prior). b.months only has entries for months with data,
      // so a gap (e.g. Jan, Feb, <skip>, May, Jun, Jul) must not be treated
      // as if May/Jun/Jul followed Jan/Feb — that isn't a real prior window.
      const lastKey = sortedKeys[sortedKeys.length - 1];
      const last6Consecutive = Array.from({ length: 6 }, (_, i) => shiftMonthKey(lastKey, -(5 - i)));
      const hasFullSixMonthWindow = last6Consecutive.every((k) => b.months.has(k));
      const recent = last6Consecutive.slice(-3).reduce((s, k) => s + (b.months.get(k) || 0), 0);
      const prior = last6Consecutive.slice(0, 3).reduce((s, k) => s + (b.months.get(k) || 0), 0);
      const trendDelta = hasFullSixMonthWindow ? recent - prior : 0;
      const trend: 'up' | 'down' | 'flat' = !hasFullSixMonthWindow
        ? 'flat'
        : trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat';
      const openCount = b.reports.filter((r) => getStatus(r) !== 'CLOSED').length;
      const closedCount = b.reports.length - openCount;
      return {
        branch: b.branch,
        subCategory: b.subCategory,
        caseClass: topOf(b.reports, getCaseClass),
        area: b.area,
        monthsCount: b.months.size,
        total: b.reports.length,
        firstSeen: monthLabel(sortedKeys[0]),
        lastSeen: monthLabel(sortedKeys[sortedKeys.length - 1]),
        trend,
        trendDelta,
        topRootCause: topOf(b.reports, getRoot),
        topSeverity: topOf(b.reports, getSeverity),
        openCount,
        closedCount,
        openPct: Math.round((openCount / b.reports.length) * 100),
        reports: b.reports,
      };
    })
    .sort((a, b) => b.monthsCount - a.monthsCount || b.total - a.total);
}

function buildMatrix(
  reports: Report[],
  getRow: (r: Report) => string,
  getCol: (r: Report) => string
): Record<string, Record<string, MatrixCell>> {
  const cells: Record<string, Record<string, MatrixCell>> = {};
  reports.forEach((r) => {
    const rowKey = getRow(r);
    const colKey = getCol(r);
    if (!hasValue(rowKey)) return;
    const rk = rowKey.toLowerCase();
    if (!cells[rk]) cells[rk] = {};
    if (!cells[rk][colKey]) cells[rk][colKey] = { total: 0, reports: [] };
    cells[rk][colKey].total += 1;
    cells[rk][colKey].reports.push(r);
  });
  return cells;
}

// ponytail: cross-dimensional category matrices should only ever show the
// canonical classifications (drops stray "Test" data entries) and always
// include Occurrence / Accident-Incident columns even at zero count.
function isCanonicalCategory(r: Report): boolean {
  return (REPORT_CATEGORIES as readonly string[]).includes(getCategory(r));
}

function categoryColumnRows(reports: Report[]): CountRow[] {
  const counts = aggregate(reports.filter(isCanonicalCategory), getCategory);
  return REPORT_CATEGORIES.map((name) => ({
    id: name.toLowerCase(),
    label: name,
    total: counts.find((c) => c.label === name)?.total || 0,
  }));
}

function sqiAiContext(chartTitle: string, chartType: string, chartData: unknown): ChartAiContext {
  return {
    section: 'Service Quality Improvement',
    chartTitle,
    chartType,
    chartData,
    featureHints: chartTitle.toLowerCase().includes('root') || chartTitle.toLowerCase().includes('classification')
      ? ['rootCause', 'riskScoring', 'similaritySearch', 'actionRecommendation']
      : ['summarization', 'riskScoring'],
  };
}

function Panel({
  title,
  subtitle,
  total,
  className = '',
  bodyClassName = '',
  aiContext,
  headerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  className?: string;
  bodyClassName?: string;
  aiContext?: ChartAiContext;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${PANEL_FRAME} ${className}`}>
      <div className="sr-table-caption !grid !grid-cols-1 !items-start gap-3">
        <div className="sr-table-caption-title min-w-0 !flex-nowrap !items-start">
          <span className="mt-[5px] h-[19px] w-1 shrink-0 bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="max-w-full text-[15px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {headerExtra}
          {typeof total === 'number' ? (
            <span className="inline-flex items-baseline gap-1 rounded-md bg-[color:var(--sr-accent-soft)] px-2 py-0.5 text-[color:var(--sr-accent-dark)]">
              <span className="font-mono text-[13px] font-bold tabular-nums">{total}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]">cases</span>
            </span>
          ) : null}
          {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function KpiTile({ label, value, helper, tone = 'accent' }: { label: string; value: ReactNode; helper?: string; tone?: 'accent' | 'gold' | 'neutral' | 'neg' }) {
  const valueColor =
    tone === 'gold' ? 'var(--sr-gold-strong)' :
    tone === 'neg' ? 'var(--sr-neg-strong)' :
    tone === 'neutral' ? 'var(--sr-text)' :
    'var(--sr-accent-dark)';
  return (
    <div className="sr-table-card flex h-full min-h-[88px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-text-3)]">
        <span className="mt-0.5 h-3 w-1 shrink-0 rounded-sm bg-[color:var(--sr-gold)]" aria-hidden="true" />
        <span className="break-words leading-tight">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: valueColor }}>{value}</span>
        {helper ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">{helper}</span> : null}
      </div>
    </div>
  );
}

type AreaScope = 'all' | 'landside' | 'airside' | 'general';
const AREA_SCOPE_OPTIONS: { value: AreaScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'landside', label: 'Landside' },
  { value: 'airside', label: 'Airside' },
  { value: 'general', label: 'General' },
];

function AreaCard({
  reports,
  children,
}: {
  reports: Report[];
  children: (args: { filtered: Report[]; toggle: ReactNode; area: AreaScope }) => ReactNode;
}) {
  const [area, setArea] = useState<AreaScope>('all');
  const filtered = useMemo(() => {
    if (area === 'landside') return reports.filter(isLandsideReport);
    if (area === 'airside') return reports.filter((r) => !isLandsideReport(r) && isAirsideReport(r));
    if (area === 'general') return reports.filter((r) => !isLandsideReport(r) && !isAirsideReport(r) && isGeneralAreaReport(r));
    return reports;
  }, [area, reports]);
  const toggle = (
    <div className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-[color:var(--sr-border)] bg-white p-0.5">
      {AREA_SCOPE_OPTIONS.map((opt) => {
        const active = opt.value === area;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setArea(opt.value)}
            aria-pressed={active}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.03em] leading-none transition ${
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
  return <>{children({ filtered, toggle, area })}</>;
}

function ChartFilterHeader({ yearToggle, areaToggle }: { yearToggle: ReactNode; areaToggle: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{yearToggle}{areaToggle}</div>;
}

function BarList({
  rows,
  emptyLabel,
  onOpen,
  limit,
}: {
  rows: CountRow[];
  emptyLabel: string;
  onOpen: (row: CountRow) => void;
  limit?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[7rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        {emptyLabel}
      </div>
    );
  }
  const visibleRows = limit ? rows.slice(0, limit) : rows;
  const max = rows[0]?.total || 1;
  const totalValue = rows.reduce((s, r) => s + r.total, 0) || 1;

  return (
    <ol className="flex h-full flex-col gap-1.5 overflow-y-auto p-2.5">
      {visibleRows.map((row) => {
        const barPct = Math.max(4, (row.total / max) * 100);
        const sharePct = (row.total / totalValue) * 100;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="group flex w-full items-center gap-2 rounded-md border border-[color:var(--sr-border)] bg-white p-2 text-left transition-all hover:-translate-y-0.5 hover:border-[color:var(--sr-accent)] hover:shadow-[0_6px_18px_-12px_rgba(6,78,59,0.3)]"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-[12px] font-semibold leading-snug text-[color:var(--sr-text)]">{row.label}</p>
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--sr-sunken)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--sr-accent)] transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-[color:var(--sr-text-3)]">
                    {sharePct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-mono text-[15px] font-bold tabular-nums leading-none text-[color:var(--sr-text)]">
                {row.total}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function HBarChart({
  rows,
  emptyLabel,
  onOpen,
  limit,
  scrollable = false,
  rowHeight = 28,
  color = 'var(--sr-accent)',
}: {
  rows: CountRow[];
  emptyLabel: string;
  onOpen: (row: CountRow) => void;
  limit?: number;
  scrollable?: boolean;
  rowHeight?: number;
  color?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[10rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        {emptyLabel}
      </div>
    );
  }
  const data = limit ? rows.slice(0, limit) : rows;
  const longest = data.reduce((m, r) => Math.max(m, r.label.length), 0);
  const yAxisWidth = Math.min(140, Math.max(60, longest * 6));
  const chartHeight = scrollable ? Math.max(data.length * rowHeight + 40, 200) : '100%';
  const outerClass = scrollable ? 'h-full overflow-y-auto overflow-x-hidden p-2.5' : 'h-full min-h-[10rem] p-2.5';

  return (
    <div className={outerClass}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="var(--sr-border)" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }} />
          <YAxis type="category" dataKey="label" width={yAxisWidth} interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text)' }} />
          <Tooltip cursor={{ fill: 'var(--sr-accent-tint)' }} contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }} />
          <Bar
            dataKey="total"
            fill={color}
            radius={[0, 4, 4, 0]}
            barSize={16}
            cursor="pointer"
            onClick={(value: unknown) => {
              const payload = (value as { payload?: CountRow } | undefined)?.payload;
              if (payload) onOpen(payload);
            }}
          >
            <LabelList dataKey="total" position="right" style={{ fill: 'var(--sr-text)', fontSize: 10, fontWeight: 800 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ rows, onOpen }: { rows: CountRow[]; onOpen: (row: CountRow) => void }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        No data available
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-[1fr_minmax(0,1.1fr)] items-stretch gap-2 p-2.5">
      <div className="relative flex min-h-0 items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minHeight={120}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={rows}
              dataKey="total"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="92%"
              stroke="var(--sr-raised)"
              strokeWidth={2}
              cursor="pointer"
              onClick={(value: unknown) => {
                const payload = (value as { payload?: CountRow } | undefined)?.payload;
                if (payload) onOpen(payload);
              }}
            >
              {rows.map((row, idx) => (
                <Cell key={row.id} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[18px] font-bold leading-none tabular-nums text-[color:var(--sr-text)]">{total}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">Total</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {rows.map((row, idx) => (
          <li key={row.id} className="flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="flex min-w-0 items-center gap-1.5 text-left hover:text-[color:var(--sr-accent-dark)]"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
              <span className="truncate font-semibold text-[color:var(--sr-text-2)]">{row.label}</span>
            </button>
            <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-[color:var(--sr-text)]">{row.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeatMatrix({
  rowKeys,
  rowLabel,
  colKeys,
  cells,
  onOpen,
}: {
  rowKeys: { id: string; label: string }[];
  rowLabel: string;
  colKeys: { id: string; label: string }[];
  cells: Record<string, Record<string, MatrixCell>>;
  onOpen: (reports: Report[], context: string) => void;
}) {
  if (rowKeys.length === 0) {
    return (
      <div className="flex min-h-[9rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        No data available
      </div>
    );
  }

  let max = 0;
  rowKeys.forEach((r) =>
    colKeys.forEach((c) => {
      max = Math.max(max, cells[r.id]?.[c.id]?.total || 0);
    })
  );

  const shade = (v: number) => {
    if (!v || !max) return 'transparent';
    const intensity = Math.min(0.95, 0.12 + (v / max) * 0.65);
    return `rgba(6, 78, 59, ${intensity.toFixed(3)})`;
  };

  const colTotals = colKeys.map((c) =>
    rowKeys.reduce((sum, r) => sum + (cells[r.id]?.[c.id]?.total || 0), 0)
  );

  return (
    <div className="h-full w-full overflow-auto touch-scroll">
      <table
        className="sr-table text-[11px]"
        style={{ width: '100%', minWidth: `${160 + (colKeys.length + 1) * 84}px`, tableLayout: 'auto' }}
      >
        <thead>
          <tr>
            <th className="!text-left" style={{ minWidth: 120, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{rowLabel}</th>
            {colKeys.map((c) => (
              <th key={c.id} className="sr-center" style={{ whiteSpace: 'nowrap' }}>{c.label}</th>
            ))}
            <th className="sr-center" style={{ whiteSpace: 'nowrap' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((r) => {
            const rowTotal = colKeys.reduce((sum, c) => sum + (cells[r.id]?.[c.id]?.total || 0), 0);
            return (
              <tr key={r.id}>
                <td
                  className="sr-label leading-tight !bg-[color:var(--sr-overlay)] font-bold"
                  style={{ minWidth: 120, verticalAlign: 'middle', paddingTop: 8, paddingBottom: 8, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}
                >
                  {r.label}
                </td>
                {colKeys.map((c) => {
                  const cell = cells[r.id]?.[c.id];
                  const v = cell?.total || 0;
                  const fg = v / Math.max(1, max) > 0.5 ? 'white' : 'var(--sr-text)';
                  return (
                    <td key={c.id} className="sr-center align-middle !p-0">
                      <button
                        type="button"
                        disabled={!v}
                        onClick={() => onOpen(cell?.reports || [], `${r.label} · ${c.label}`)}
                        className="h-full w-full px-2 py-2 font-mono text-[13px] font-bold tabular-nums transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-100"
                        style={{ backgroundColor: shade(v), color: v ? fg : 'var(--sr-text-3)' }}
                      >
                        {v || '–'}
                      </button>
                    </td>
                  );
                })}
                <td className="sr-center align-middle font-mono text-[13px] font-bold tabular-nums">{rowTotal}</td>
              </tr>
            );
          })}
          <tr>
            <td className="sr-label !bg-[color:var(--sr-overlay)] font-bold uppercase tracking-[0.06em]" style={{ verticalAlign: 'middle' }}>
              Grand Total
            </td>
            {colKeys.map((c, idx) => (
              <td key={c.id} className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
                {colTotals[idx]}
              </td>
            ))}
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
              {colTotals.reduce((s, v) => s + v, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type DetailRow = {
  id: string;
  ts: number;
  date: string;
  eventDate: string;
  branch: string;
  airline: string;
  flightNumber: string;
  route: string;
  location: string;
  aircraftReg: string;
  delayInfo: string;
  referenceNumber: string;
  serviceBusinessType: string;
  category: string;
  area: string;
  caseClass: string;
  subCategory: string;
  rootCause: string;
  actionTaken: string;
  preventive: string;
  severity: string;
  status: string;
  report: string;
  evidenceLinks: string[];
};

function buildDetailRow(r: Report): DetailRow {
  const d = getReportDate(r);
  return {
    id: r.id || r.original_id || `${r.row_number ?? Math.random()}`,
    ts: d ? d.getTime() : 0,
    date: d ? d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    eventDate: d ? d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    branch: getBranch(r),
    airline: getAirline(r),
    flightNumber: val(r.flight_number) || '—',
    route: val(r.route) || '—',
    location: val(r.specific_location) || val(r.location) || '—',
    aircraftReg: val(r.aircraft_reg) || '—',
    delayInfo: [val(r.delay_code), val(r.delay_duration)].filter(hasValue).join(' / ') || '—',
    referenceNumber: val(r.reference_number) || val(r.original_id) || '—',
    serviceBusinessType: val(r.service_business_type) || '—',
    category: getCategory(r),
    area: getArea(r),
    caseClass: getCaseClass(r) || '—',
    subCategory: val(r.terminal_area_category) || val(r.apron_area_category) || val(r.general_category) || '—',
    rootCause: getRoot(r) || '—',
    actionTaken: val(r.action_taken) || val(r.immediate_action) || val(r.gapura_kps_action_taken) || '—',
    preventive: val(r.preventive_action) || '—',
    severity: getSeverity(r),
    status: getStatus(r),
    report: val(r.report) || val(r.description) || '—',
    evidenceLinks: resolveEvidenceLinks(r),
  };
}

function SeverityChip({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    'TOP RISK': 'bg-[color:var(--sr-neg-soft)] text-[color:var(--sr-neg-strong)]',
    'HIGH RISK': 'bg-[color:var(--sr-gold-soft)] text-[color:var(--sr-gold-strong)]',
    'HIGH': 'bg-[color:var(--sr-gold-soft)] text-[color:var(--sr-gold-strong)]',
    'MEDIUM': 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]',
    'LOW': 'bg-[color:var(--sr-accent-soft)] text-[color:var(--sr-accent-dark)]',
    '-': 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-3)]',
  };
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${styles[severity] || styles['-']}`}>
      {severity}
    </span>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[7rem] rounded-lg border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-accent-dark)]">
        <span className="h-3 w-1 rounded-sm bg-[color:var(--sr-gold)]" aria-hidden="true" />
        {label}
      </div>
      <div className="whitespace-pre-wrap break-words text-[12px] font-medium leading-snug text-[color:var(--sr-text)]">
        {value || '–'}
      </div>
    </div>
  );
}

function formatEvidenceLabel(link: string, index: number) {
  try {
    const url = new URL(link);
    if (url.hostname.includes('sharepoint')) return `SharePoint ${index + 1}`;
    return `${url.hostname.replace(/^www\./, '')} ${index + 1}`;
  } catch {
    return `Evidence ${index + 1}`;
  }
}

function DetailRecordsPanel({
  filtered,
  yearToggle,
  areaToggle,
}: {
  filtered: Report[];
  yearToggle: ReactNode;
  areaToggle: ReactNode;
}) {
  const detailRows = useMemo(
    () => filtered.map(buildDetailRow).sort((a, b) => b.ts - a.ts),
    [filtered],
  );
  return (
    <Panel headerExtra={<ChartFilterHeader yearToggle={yearToggle} areaToggle={areaToggle} />} title="Quality Records" aiContext={sqiAiContext('Quality Records', 'detail_table', detailRows.slice(0, 20))}>
      <DetailTable rows={detailRows} />
    </Panel>
  );
}

const DETAIL_TABLE_PAGE_SIZE = 100;

function DetailTable({ rows }: { rows: DetailRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(DETAIL_TABLE_PAGE_SIZE);
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setVisibleCount(DETAIL_TABLE_PAGE_SIZE);
    setExpandedId(null);
  }

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);

  const tdStyle: CSSProperties = {
    whiteSpace: 'normal',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    padding: '8px 10px',
    verticalAlign: 'top',
    fontSize: 12,
  };

  return (
    <div>
    <div className="overflow-auto touch-scroll" style={{ height: '36rem' }}>
      <table className="sr-table text-[12px]" style={{ width: '100%', minWidth: 920, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '9.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Date</th>
              <th style={{ width: '6.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Station</th>
              <th style={{ width: '12%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Airlines</th>
              <th style={{ width: '7.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Flight</th>
              <th style={{ width: '10.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Category</th>
              <th style={{ width: '10%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Area</th>
              <th style={{ width: '18.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="!text-left">Case Classification</th>
              <th style={{ width: '8.5%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="sr-center">Severity</th>
              <th style={{ width: '8%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="sr-center">Status</th>
              <th style={{ width: '9%', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal' }} className="sr-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="!py-10 text-center text-[12px] font-medium text-[color:var(--sr-text-3)]">
                  No data
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isExpanded = expandedId === row.id;
                const statusClass = row.status === 'CLOSED'
                  ? 'bg-[color:var(--sr-accent-soft)] text-[color:var(--sr-accent-dark)]'
                  : 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]';
                return (
                  <Fragment key={row.id}>
                    <tr className={isExpanded ? '!bg-[color:var(--sr-accent-soft)]' : ''}>
                      <td className="font-mono tabular-nums" style={tdStyle}>{row.date}</td>
                      <td className="font-bold" style={tdStyle}>{row.branch}</td>
                      <td style={tdStyle}>{row.airline}</td>
                      <td className="font-mono font-semibold tabular-nums" style={tdStyle}>{row.flightNumber}</td>
                      <td style={tdStyle}>{row.category}</td>
                      <td style={tdStyle}>{row.area}</td>
                      <td style={tdStyle}>
                        <span className="block leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.caseClass}
                        </span>
                      </td>
                      <td className="sr-center" style={{ ...tdStyle, textAlign: 'center' }}>
                        <SeverityChip severity={row.severity} />
                      </td>
                      <td className="sr-center" style={{ ...tdStyle, textAlign: 'center' }}>
                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="sr-center" style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          className={`inline-flex h-6 items-center justify-center rounded-md px-2 text-[10px] font-bold uppercase tracking-[0.04em] transition-colors ${
                            isExpanded
                              ? 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)] hover:bg-[color:var(--sr-border)]'
                              : 'bg-[color:var(--sr-accent)] text-white hover:bg-[color:var(--sr-accent-strong)]'
                          }`}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={10} className="!bg-[color:var(--sr-sunken)] !p-0">
                          <div className="border-l-4 border-[color:var(--sr-accent)] p-5">
                            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                              <DetailBlock label="Report" value={row.report} />
                              <DetailBlock
                                label="Flight Operation"
                                value={[
                                  `Flight : ${row.flightNumber}`,
                                  `Route : ${row.route}`,
                                  `Airline : ${row.airline}`,
                                  `Aircraft : ${row.aircraftReg}`,
                                  `Station : ${row.branch}`,
                                  `Event : ${row.eventDate}`,
                                ].join('\n')}
                              />
                              <DetailBlock
                                label="Operational Context"
                                value={[
                                  `Location : ${row.location}`,
                                  `Area : ${row.area}`,
                                  `Sub-category : ${row.subCategory}`,
                                  `Service : ${row.serviceBusinessType}`,
                                  `Delay : ${row.delayInfo}`,
                                  `Reference : ${row.referenceNumber}`,
                                ].join('\n')}
                              />
                              <DetailBlock label="Root Cause" value={row.rootCause} />
                              <DetailBlock label="Action Taken" value={row.actionTaken} />
                              <DetailBlock label="Preventive Action" value={row.preventive} />
                              <DetailBlock label="Status / Severity" value={`${row.status} / ${row.severity}`} />
                              <DetailBlock label="Category / Area" value={`${row.category} / ${row.area}`} />
                            </div>
                            {row.evidenceLinks.length > 0 ? (
                              <div className="mt-4 rounded-lg border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] p-3">
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-accent-dark)]">
                                  <span className="h-3 w-1 rounded-sm bg-[color:var(--sr-gold)]" aria-hidden="true" />
                                  Evidence Links
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {row.evidenceLinks.map((link, i) => (
                                    <a
                                      key={`${row.id}-evidence-${i}`}
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex max-w-[15rem] items-center gap-1.5 truncate rounded-md border border-[color:var(--sr-accent)] bg-[color:var(--sr-accent)] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[color:var(--sr-accent-strong)]"
                                    >
                                      <ExternalLink size={12} />
                                      <span className="truncate">{formatEvidenceLabel(link, i)}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
    </div>
    {rows.length > visibleCount && (
      <div className="flex justify-center border-t border-[color:var(--sr-border)] py-3">
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + DETAIL_TABLE_PAGE_SIZE)}
          className="rounded-md border border-[color:var(--sr-border)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--sr-text-2)] transition-colors hover:bg-[color:var(--sr-sunken)]"
        >
          Show more ({rows.length - visibleCount} remaining)
        </button>
      </div>
    )}
    </div>
  );
}

export function ServiceQualityImprovementTab({ reports }: ServiceQualityImprovementTabProps) {
  const { openDrilldown, DrilldownRenderer } = useDrilldown();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // The parent already owns the report request. Reusing it removes a duplicate
  // fetch when this expensive chart tab becomes visible.
  const deferredReports = useDeferredValue(reports);

  const filteredSourceReports = useMemo(
    () => deferredReports.filter((r) => !isCargoReport(r) && !isGseServiceReport(r) && !isJoumpaServiceReport(r)),
    [deferredReports]
  );

  const scopedReports = useMemo(() => {
    if (!dateFrom && !dateTo) return filteredSourceReports;
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
    return filteredSourceReports.filter((r) => {
      const d = getReportDate(r);
      if (!d) return false;
      const t = d.getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [filteredSourceReports, dateFrom, dateTo]);

  const currentYear = new Date().getFullYear();
  const [monthlyYear] = useState<number>(currentYear);

  const monthlyRows = useMemo<CountRow[]>(() => {
    const counts = new Array(12).fill(0);
    scopedReports.forEach((r) => {
      const d = getReportDate(r);
      if (!d || d.getFullYear() !== monthlyYear) return;
      counts[d.getMonth()] += 1;
    });
    return counts.map((total, idx) => ({
      id: `${monthlyYear}-${String(idx + 1).padStart(2, '0')}`,
      label: new Date(Date.UTC(monthlyYear, idx, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      total,
    }));
  }, [scopedReports, monthlyYear]);

  const caseClassRows = useMemo<CountRow[]>(() => aggregate(scopedReports, getCaseClass), [scopedReports]);
  const branchRows = useMemo<CountRow[]>(() => aggregate(scopedReports, getBranch), [scopedReports]);
  const airlineRows = useMemo<CountRow[]>(() => aggregate(scopedReports, getAirline), [scopedReports]);
  const rootRows = useMemo<CountRow[]>(() => {

    const nonCompliment = scopedReports.filter((r) => !getCategory(r).toLowerCase().includes('compliment'));
    return aggregate(nonCompliment, getRoot);
  }, [scopedReports]);

  const closed = scopedReports.filter((r) => getStatus(r) === 'CLOSED').length;
  const open = scopedReports.length - closed;
  const resolutionPct = scopedReports.length > 0 ? ((closed / scopedReports.length) * 100).toFixed(1) : '0.0';
  const topRisk = scopedReports.filter((r) => {
    const s = getSeverity(r);
    return s === 'TOP RISK' || s === 'HIGH RISK' || s === 'HIGH';
  }).length;
  const formatAreaSplit = (rs: Report[]) => {
    const landside = rs.filter(isLandsideReport).length;
    const airside = rs.filter((r) => !isLandsideReport(r) && isAirsideReport(r)).length;
    return `Landside ${landside} · Airside ${airside}`;
  };
  const areaBreakdown = useMemo(() => {
    return formatAreaSplit(scopedReports);
  }, [scopedReports]);
  const closedOpenBreakdown = useMemo(
    () => formatAreaSplit(scopedReports.filter((r) => getStatus(r) === 'CLOSED')),
    [scopedReports]
  );
  const riskBreakdown = useMemo(
    () => formatAreaSplit(scopedReports.filter((r) => {
      const s = getSeverity(r);
      return s === 'TOP RISK' || s === 'HIGH RISK' || s === 'HIGH';
    })),
    [scopedReports]
  );
  const topBranch = branchRows[0]?.label || '—';
  const topBranchCount = branchRows[0]?.total || 0;
  const topBranchBreakdown = useMemo(
    () => formatAreaSplit(scopedReports.filter((r) => getBranch(r).toLowerCase() === (branchRows[0]?.id || ''))),
    [branchRows, scopedReports]
  );

  const sectionAiContext = useMemo(() => ({
    section: 'Service Quality Improvement',
    title: 'Service Quality Improvement',
    chartTitle: 'Service Quality Improvement',
    chartType: 'sqi_overview',
    datasets: [
      {
        id: 'monthly',
        name: 'Cases per Month',
        unit: 'kasus',
        kind: 'timeseries',
        description: 'Jumlah laporan kualitas layanan (landside & airside) per bulan, urut kronologis.',
        rows: monthlyRows.map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'case_classes',
        name: 'Jenis Kasus',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per klasifikasi jenis kasus.',
        rows: caseClassRows.slice(0, 10).map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'root_causes',
        name: 'Akar Masalah',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per akar masalah hasil investigasi.',
        rows: rootRows.slice(0, 10).map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'stations',
        name: 'Kasus per Stasiun',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per stasiun (kode bandara).',
        rows: branchRows.slice(0, 10).map((r) => ({ label: r.label, value: r.total })),
      },
    ],
    featureHints: ['rootCause', 'riskScoring', 'similaritySearch', 'actionRecommendation', 'summarization'],
  }), [monthlyRows, caseClassRows, rootRows, branchRows]);

  return (
    <div className="sr-scope space-y-6 bg-[color:var(--sr-canvas)] px-4 py-6 pb-10 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      {}
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              Landside &amp; Airside
              <span className="block text-[clamp(16px,1.5vw,22px)] font-semibold text-[color:var(--sr-text-2)]">Detail Report</span>
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              {scopedReports.length} reports · {caseClassRows.length} case types · {branchRows.length} branches · {airlineRows.length} airlines
            </p>
            <p className="mt-2 flex items-start gap-1.5 rounded-md border border-[color:var(--sr-gold)] bg-[color:var(--sr-gold-soft)] px-2.5 py-1.5 text-[12.5px] font-semibold leading-relaxed text-[color:var(--sr-gold-strong)] sm:inline-flex">
              <span className="font-black uppercase tracking-[0.08em]">Shown data:</span>
              Landside and Airside operational service-quality reports
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="sqi-date-from" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">From</label>
            <input id="sqi-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sqi-date-to" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">To</label>
            <input id="sqi-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none" />
          </div>
          {dateFrom || dateTo ? (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-sunken)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-2)] transition-colors hover:bg-[color:var(--sr-border)]"
            >
              Clear
            </button>
          ) : null}
          <SectionAiSummaryInsightButton context={sectionAiContext} />
        </div>
      </div>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Performance Summary</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Total Reports" value={scopedReports.length} helper={areaBreakdown} tone="neutral" />
          <KpiTile label="Resolution Rate" value={`${resolutionPct}%`} helper={`${closed} closed / ${open} open · ${closedOpenBreakdown}`} tone="accent" />
          <KpiTile label="High / Top Risk" value={topRisk} helper={`${scopedReports.length > 0 ? ((topRisk / scopedReports.length) * 100).toFixed(0) : 0}% of total · ${riskBreakdown}`} tone="neg" />
          <KpiTile label="Top Station" value={topBranch} helper={`${topBranchCount} reports · ${topBranchBreakdown}`} tone="gold" />
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Report Volume &amp; Composition</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle, year }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows: CountRow[] = (() => {
                const buckets = new Array(12).fill(0);
                filtered.forEach((r) => { const d = getReportDate(r); if (d) buckets[d.getMonth()] += 1; });
                return buckets.map((total, idx) => ({
                  id: `${year}-${String(idx + 1).padStart(2, '0')}`,
                  label: new Date(Date.UTC(year, idx, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
                  total,
                }));
              })();
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Monthly Report Volume" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[18rem]" aiContext={sqiAiContext('Monthly Report Volume', 'monthly_volume', rows)}>
                  <HBarChart rows={rows} emptyLabel="No monthly data" scrollable onOpen={(row) => openDrilldown(filtered.filter((r) => { const d = getReportDate(r); return d ? `${year}-${String(d.getMonth() + 1).padStart(2, '0')}` === row.id : false; }), `Month: ${row.label} ${year}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows = aggregate(filtered, getCaseClass);
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Top Case Classifications" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[18rem]" aiContext={sqiAiContext('Top Case Classifications', 'case_classification_bar', rows.slice(0, 10))}>
                  <BarList rows={rows} emptyLabel="No classification data" limit={10} onOpen={(row) => openDrilldown(filtered.filter((r) => getCaseClass(r).toLowerCase() === row.id), `Case: ${row.label}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows = aggregate(filtered, getCategory);
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Report Type Composition" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[18rem]" aiContext={sqiAiContext('Report Type Composition', 'category_donut', rows)}>
                  <Donut rows={rows} onOpen={(row) => openDrilldown(filtered.filter((r) => getCategory(r) === row.label), `Category: ${row.label}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows = aggregate(filtered, getArea);
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Operational Area Distribution" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[18rem]" aiContext={sqiAiContext('Operational Area Distribution', 'area_donut', rows)}>
                  <Donut rows={rows} onOpen={(row) => openDrilldown(filtered.filter((r) => getArea(r) === row.label), `Area: ${row.label}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Year-over-Year Monthly Trend</h2>
        </div>
        {}
        <YearCard reports={scopedReports}>{({ toggle, year: cy }) => (
          <AreaCard reports={scopedReports}>{({ filtered, toggle: areaToggle }) => {
            const py = cy - 1;
            const buckets = { current: new Array(12).fill(0), previous: new Array(12).fill(0) };
            filtered.forEach((r) => {
              const d = getReportDate(r); if (!d) return;
              if (d.getFullYear() === cy) buckets.current[d.getMonth()] += 1;
              else if (d.getFullYear() === py) buckets.previous[d.getMonth()] += 1;
            });
            const rows = Array.from({ length: 12 }, (_, i) => ({
              month: new Date(Date.UTC(cy, i, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
              current: buckets.current[i],
              previous: buckets.previous[i],
            }));
            return (
              <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title={`Monthly Report Volume — ${cy} vs ${py}`} subtitle="Tracks growth or decline in reported issues across comparable months" total={rows.reduce((s, r) => s + r.current + r.previous, 0)} className="h-[22rem]" aiContext={sqiAiContext('YoY Monthly Comparison', 'yoy_line', rows)}>
                <div className="h-full p-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="var(--sr-border)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }} />
                      <Tooltip contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Line type="monotone" dataKey="previous" name={`${py}`} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 5" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="current" name={`${cy}`} stroke="var(--sr-accent)" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            );
          }}</AreaCard>
        )}</YearCard>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Sub-Category Breakdown by Operational Area</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const rows = aggregate(filtered, (r) => val(r.terminal_area_category));
            return (
              <Panel headerExtra={toggle} title="Terminal Area Sub-Categories" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[22rem]" aiContext={sqiAiContext('Terminal Area Sub-Categories', 'sub_category_bar', rows.slice(0, 15))}>
                <BarList rows={rows} emptyLabel="No terminal sub-category data" limit={15} onOpen={(row) => openDrilldown(filtered.filter((r) => val(r.terminal_area_category).toLowerCase() === row.id), `Terminal · ${row.label}`)} />
              </Panel>
            );
          }}</YearCard>
          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const rows = aggregate(filtered, (r) => val(r.apron_area_category));
            return (
              <Panel headerExtra={toggle} title="Apron Area Sub-Categories" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[22rem]" aiContext={sqiAiContext('Apron Area Sub-Categories', 'sub_category_bar', rows.slice(0, 15))}>
                <BarList rows={rows} emptyLabel="No apron sub-category data" limit={15} onOpen={(row) => openDrilldown(filtered.filter((r) => val(r.apron_area_category).toLowerCase() === row.id), `Apron · ${row.label}`)} />
              </Panel>
            );
          }}</YearCard>
          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const rows = aggregate(filtered, (r) => val(r.general_category));
            return (
              <Panel headerExtra={toggle} title="General Category Breakdown" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[22rem]" aiContext={sqiAiContext('General Category Breakdown', 'sub_category_bar', rows.slice(0, 15))}>
                <BarList rows={rows} emptyLabel="No general category data" limit={15} onOpen={(row) => openDrilldown(filtered.filter((r) => val(r.general_category).toLowerCase() === row.id), `General · ${row.label}`)} />
              </Panel>
            );
          }}</YearCard>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Distribution by Station &amp; Airline</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows = aggregate(filtered, getBranch);
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Reports by Station" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[22rem]" aiContext={sqiAiContext('Reports by Station', 'station_bar', rows)}>
                  <HBarChart rows={rows} emptyLabel="No station data" scrollable limit={20} onOpen={(row) => openDrilldown(filtered.filter((r) => getBranch(r).toLowerCase() === row.id), `Station: ${row.label}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
            <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
              const rows = aggregate(filtered, getAirline);
              return (
                <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Reports by Airline" total={rows.reduce((s, r) => s + r.total, 0)} className="h-[22rem]" aiContext={sqiAiContext('Reports by Airline', 'airline_bar', rows)}>
                  <HBarChart rows={rows} emptyLabel="No airline data" scrollable limit={20} color="var(--sr-gold-strong)" onOpen={(row) => openDrilldown(filtered.filter((r) => getAirline(r).toLowerCase() === row.id), `Airline: ${row.label}`)} />
                </Panel>
              );
            }}</AreaCard>
          )}</YearCard>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Cross-Dimensional Analysis</h2>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const branchRowsLocal = aggregate(filtered, getBranch).slice(0, 12);
            const catRowsLocal = categoryColumnRows(filtered);
            const cells = buildMatrix(filtered.filter(isCanonicalCategory), getBranch, getCategory);
            return (
              <Panel headerExtra={toggle} title="Station Volume by Report Category" subtitle="Station hotspots across report types" className="h-[26rem]" aiContext={sqiAiContext('Station x Report Category', 'pivot_table', { keys: branchRowsLocal, cols: catRowsLocal })} bodyClassName="overflow-hidden">
                <HeatMatrix rowKeys={branchRowsLocal.map((r) => ({ id: r.id, label: r.label }))} rowLabel="Station" colKeys={catRowsLocal.map((r) => ({ id: r.label, label: r.label }))} cells={cells} onOpen={(rs, ctx) => openDrilldown(rs, ctx)} />
              </Panel>
            );
          }}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const airlineRowsLocal = aggregate(filtered, getAirline).slice(0, 12);
            const catRowsLocal = categoryColumnRows(filtered);
            const cells = buildMatrix(filtered.filter(isCanonicalCategory), getAirline, getCategory);
            return (
              <Panel headerExtra={toggle} title="Airline Volume by Report Category" subtitle="Which airlines drive which report types" className="h-[26rem]" aiContext={sqiAiContext('Airline x Report Category', 'pivot_table', { keys: airlineRowsLocal, cols: catRowsLocal })} bodyClassName="overflow-hidden">
                <HeatMatrix rowKeys={airlineRowsLocal.map((r) => ({ id: r.id, label: r.label }))} rowLabel="Airline" colKeys={catRowsLocal.map((r) => ({ id: r.label, label: r.label }))} cells={cells} onOpen={(rs, ctx) => openDrilldown(rs, ctx)} />
              </Panel>
            );
          }}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const branchRowsLocal = aggregate(filtered, getBranch).slice(0, 12);
            const areaRowsLocal = aggregate(filtered, getArea);
            const cells = buildMatrix(filtered, getBranch, getArea);
            return (
              <Panel headerExtra={toggle} title="Station Volume by Operational Area" subtitle="Station volume across operational areas" className="h-[26rem]" aiContext={sqiAiContext('Station x Operational Area', 'pivot_table', { keys: branchRowsLocal, cols: areaRowsLocal })} bodyClassName="overflow-hidden">
                <HeatMatrix rowKeys={branchRowsLocal.map((r) => ({ id: r.id, label: r.label }))} rowLabel="Station" colKeys={areaRowsLocal.map((r) => ({ id: r.label, label: r.label }))} cells={cells} onOpen={(rs, ctx) => openDrilldown(rs, ctx)} />
              </Panel>
            );
          }}</YearCard>

          <YearCard reports={scopedReports}>{({ filtered, toggle }) => {
            const airlineRowsLocal = aggregate(filtered, getAirline).slice(0, 12);
            const areaRowsLocal = aggregate(filtered, getArea);
            const cells = buildMatrix(filtered, getAirline, getArea);
            return (
              <Panel headerExtra={toggle} title="Airline Volume by Operational Area" subtitle="Airline volume across operational areas" className="h-[26rem]" aiContext={sqiAiContext('Airline x Operational Area', 'pivot_table', { keys: airlineRowsLocal, cols: areaRowsLocal })} bodyClassName="overflow-hidden">
                <HeatMatrix rowKeys={airlineRowsLocal.map((r) => ({ id: r.id, label: r.label }))} rowLabel="Airline" colKeys={areaRowsLocal.map((r) => ({ id: r.label, label: r.label }))} cells={cells} onOpen={(rs, ctx) => openDrilldown(rs, ctx)} />
              </Panel>
            );
          }}</YearCard>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Case Classification by Month</h2>
        </div>
        <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
          <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
            const data = computeCaseClassByMonth(filtered);
            const maxValue = Math.max(1, ...data.rows.flatMap((row) => row.values));
            return (
            <Panel headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />} title="Report Case Classification" subtitle="Compliments excluded. Click a cell to drill into matching reports." total={data.grandTotal} className="h-[28rem]" aiContext={sqiAiContext('Case Classification by Month', 'case_classification_month_pivot', data.rows.slice(0, 20))} bodyClassName="overflow-hidden">
              {data.rows.length === 0 ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                  No case classification data
                </div>
              ) : (
                <div className="h-full overflow-y-auto overflow-x-auto">
                  <table className="sr-table text-[11.5px]" style={{ width: '100%', minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '20%' }}>Case Classification</th>
                        {data.monthKeys.map((mk) => (
                          <th key={mk} className="sr-center" style={{ whiteSpace: 'nowrap' }}>{data.monthLabel(mk)}</th>
                        ))}
                        <th className="sr-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.caseClass}>
                          <td className="sr-label !bg-[color:var(--sr-overlay)] font-bold leading-tight" style={{ whiteSpace: 'normal' }}>{row.caseClass}</td>
                          {row.values.map((v, i) => {
                            const mk = data.monthKeys[i];
                            const clickable = v > 0;
                            const heatCls = heatClass(v, maxValue);
                            return (
                              <td key={mk} className={`sr-center align-middle font-mono tabular-nums ${heatCls} ${clickable ? 'cursor-pointer hover:bg-[color:var(--sr-overlay)]' : ''}`}
                                onClick={() => {
                                  if (!clickable) return;
                                  const matches = filtered.filter((r) => getCaseClass(r) === row.caseClass && getMonthKey(r) === mk && !getCategory(r).toLowerCase().includes('compliment'));
                                  openDrilldown(matches, `${row.caseClass} · ${data.monthLabel(mk)}`);
                                }}
                              >
                                {v > 0 ? <span className="sr-cell-value">{v}</span> : <span className="text-[color:var(--sr-text-3)]">–</span>}
                              </td>
                            );
                          })}
                          <td className="sr-center align-middle font-mono font-bold tabular-nums">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="sr-label-foot">Total</td>
                        {data.monthTotals.map((t, i) => (
                          <td key={data.monthKeys[i]} className="sr-center font-mono font-bold tabular-nums">{t}</td>
                        ))}
                        <td className="sr-center font-mono font-bold tabular-nums">{data.grandTotal}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Panel>
            );
          }}</AreaCard>
        )}</YearCard>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Recurring Issue Patterns</h2>
        </div>
        <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
          <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => {
            const chronicIssueRows = computeChronicIssues(filtered);
            return (
        <Panel
          headerExtra={<ChartFilterHeader yearToggle={toggle} areaToggle={areaToggle} />}
          title="Recurring Issues by Station & Sub-Category"
          subtitle="Station + sub-category combinations appearing in 3 or more distinct months — sorted by persistence. Click a row to drill into all related reports."
          total={chronicIssueRows.length}
          className="h-[34rem]"
          aiContext={sqiAiContext('Recurring Issue Patterns', 'chronic_issues_table', chronicIssueRows.slice(0, 20).map((r) => ({
            branch: r.branch,
            sub_category: r.subCategory,
            area: r.area,
            months: r.monthsCount,
            total: r.total,
            first_seen: r.firstSeen,
            last_seen: r.lastSeen,
            trend: r.trend,
            top_root_cause: r.topRootCause,
            top_severity: r.topSeverity,
            open_pct: r.openPct,
          })))}
          bodyClassName="overflow-hidden"
        >
          {chronicIssueRows.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
              No recurring patterns detected
            </div>
          ) : (
            <div className="h-full overflow-y-auto overflow-x-auto">
              <table className="sr-table text-[11.5px]" style={{ width: '100%', minWidth: 1080 }}>
                <thead>
                  <tr>
                    <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '10%' }}>Station</th>
                    <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '7%' }}>Area</th>
                    <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '17%' }}>Sub-Category</th>
                    <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '13%' }}>Case Classification</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '7%' }}>Reports</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '8%' }}>First Data</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '8%' }}>Last Data</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '8%' }}>Trend (3mo)</th>
                    <th className="!text-left" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '12%' }}>Root Cause</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '6%' }}>Top Severity</th>
                    <th className="sr-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '12%' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chronicIssueRows.map((row) => {
                    const TrendIcon = row.trend === 'up' ? ArrowUpRight : row.trend === 'down' ? ArrowDownRight : Minus;
                    const trendColor = row.trend === 'up' ? 'var(--sr-neg-strong)' : row.trend === 'down' ? 'var(--sr-accent-dark)' : 'var(--sr-text-3)';
                    const deltaSign = row.trendDelta > 0 ? '+' : '';
                    return (
                      <tr
                        key={`${row.branch}::${row.subCategory}`}
                        className="cursor-pointer transition-colors hover:bg-[color:var(--sr-overlay)]"
                        onClick={() => openDrilldown(row.reports, `${row.branch} · ${row.subCategory}`)}
                      >
                        <td className="sr-label !bg-[color:var(--sr-overlay)] font-bold leading-tight" style={{ verticalAlign: 'top', whiteSpace: 'normal' }}>
                          {row.branch}
                        </td>
                        <td className="leading-tight" style={{ verticalAlign: 'top', whiteSpace: 'normal' }}>{row.area}</td>
                        <td className="leading-tight" style={{ verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {row.subCategory}
                        </td>
                        <td className="leading-tight" style={{ verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {row.caseClass}
                        </td>
                        <td className="sr-center align-middle font-mono font-bold tabular-nums">{row.total}</td>
                        <td className="sr-center align-middle font-mono tabular-nums text-[color:var(--sr-text-2)]">{row.firstSeen}</td>
                        <td className="sr-center align-middle font-mono tabular-nums text-[color:var(--sr-text-2)]">{row.lastSeen}</td>
                        <td className="sr-center align-middle">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums" style={{ color: trendColor }}>
                            <TrendIcon size={12} />
                            {deltaSign}{row.trendDelta}
                          </span>
                        </td>
                        <td className="leading-tight" style={{ verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {row.topRootCause}
                        </td>
                        <td className="sr-center align-middle">
                          <SeverityChip severity={row.topSeverity} />
                        </td>
                        <td className="sr-center align-middle font-mono font-bold tabular-nums whitespace-nowrap">
                          <span style={{ color: row.openPct >= 50 ? 'var(--sr-neg-strong)' : row.openPct >= 25 ? 'var(--sr-gold-strong)' : 'var(--sr-text)' }}>
                            {row.openCount} OPEN
                          </span>
                          <span className="mx-1 text-[color:var(--sr-text-3)]">·</span>
                          <span className="text-[color:var(--sr-text-2)]">{row.closedCount} CLOSED</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
            );
          }}</AreaCard>
        )}</YearCard>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Detailed Report Records</h2>
        </div>
        <YearCard reports={scopedReports}>{({ filtered: yearReports, toggle }) => (
          <AreaCard reports={yearReports}>{({ filtered, toggle: areaToggle }) => (
            <DetailRecordsPanel filtered={filtered} yearToggle={toggle} areaToggle={areaToggle} />
          )}</AreaCard>
        )}</YearCard>
      </section>

      {DrilldownRenderer()}
    </div>
  );
}
