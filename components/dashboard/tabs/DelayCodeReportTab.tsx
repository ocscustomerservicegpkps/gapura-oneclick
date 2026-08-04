'use client';

import { Fragment, useDeferredValue, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import type { Report } from '@/types';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { SectionAiSummaryInsightButton } from '@/components/dashboard/ai/SectionAiSummaryInsightButton';
import {
  resolveCaseClassification as resolveNormalizedCaseClassification,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
} from '@/lib/report-normalization';

const MISSING_VALUES = new Set(['', '-', '#n/a', 'n/a', 'null', 'undefined', 'nil']);

function normalizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeValue(item);
      if (normalized) return normalized;
    }
    return '';
  }
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (MISSING_VALUES.has(normalized.toLowerCase())) return '';
  return normalized;
}

function readMappedValue(report: Report, keys: string[], fallback = '-'): string {
  for (const key of keys) {
    const mapped = normalizeValue((report as Record<string, unknown>)[key]);
    if (mapped) return mapped;
  }
  return fallback;
}

const NOISY_DELAY_CODES = new Set([
  'no delay', 'no delays', 'tidak ada delay', 'tidak delay',
  'none', 'na', 'tba', 'tbd', '0', '00', '000',
]);

function isNoisyDelayCode(raw: string): boolean {
  if (!raw || raw === '-') return true;
  const lower = raw.toLowerCase().trim();
  if (NOISY_DELAY_CODES.has(lower)) return true;
  const stripped = lower.replace(/[^a-z0-9]/g, '');
  if (!stripped) return true;
  if (NOISY_DELAY_CODES.has(stripped)) return true;
  return false;
}

function resolveDelayCode(report: Report): string {
  const code = readMappedValue(report, ['delay_code', 'Delay Code', 'Delay_Code', 'kode_delay']);
  return isNoisyDelayCode(code) ? '-' : code;
}

function resolveDelayDuration(report: Report): string {
  return readMappedValue(report, ['delay_duration', 'Delay Duration', 'Delay_Duration']);
}

function resolveBranch(report: Report): string {
  return resolveReportBranch(report) || readMappedValue(report, ['branch', 'reporting_branch', 'station_code'], report.stations?.code || 'Unknown');
}

function resolveAirline(report: Report): string {
  return resolveReportAirline(report) || readMappedValue(report, ['airlines', 'airline', 'Airlines'], 'Unknown');
}

function resolveCategory(report: Report): string {
  return resolveReportCategory(report) || 'Uncategorized';
}

function resolveCaseClassification(report: Report): string {
  return resolveNormalizedCaseClassification(report) || readMappedValue(report, ['case_classification', 'Case Classification', 'Case_Classification']);
}

function resolveRootCauseText(report: Report): string {
  return readMappedValue(report, ['root_caused', 'root_cause', 'Root Caused']);
}

function normalizeSeverityLevel(value: string): string {
  const normalized = normalizeValue(value).toUpperCase();
  if (!normalized) return '-';
  if (normalized.includes('TOP RISK') || normalized === 'CRITICAL' || normalized === 'URGENT') return 'TOP RISK';
  if (normalized.includes('HIGH RISK')) return 'HIGH RISK';
  if (normalized === 'HIGH') return 'HIGH RISK';
  if (normalized === 'MEDIUM') return 'MEDIUM';
  if (normalized === 'LOW') return 'LOW';
  return normalized;
}

function resolveSeverityLevel(report: Report): string {
  const raw = readMappedValue(report, ['severity_level', 'Severity Level', 'Severity_Level', 'severity', 'Severity'], '-');
  return normalizeSeverityLevel(raw);
}

function resolveStatus(report: Report): string {
  const raw = normalizeValue(report.status).toUpperCase();
  return raw === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function resolveEventDate(report: Report): Date | null {
  const source = report.date_of_event || report.event_date || report.incident_date || report.created_at;
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDurationMinutes(value: string): number | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  const numeric = normalized.match(/\d+(?:\.\d+)?/);
  if (!numeric) return null;
  const parsed = Number(numeric[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

interface DelayCodeReportTabProps {
  reports: Report[];
}

type CountRow = { id: string; label: string; total: number };
type MatrixCell = { total: number; reports: Report[] };

const PANEL_FRAME = 'sr-table-card flex min-h-0 min-w-0 flex-col';
const DONUT_COLORS = ['var(--sr-accent)', 'var(--sr-gold)', 'var(--sr-chart-3)', 'var(--sr-chart-4)', 'var(--sr-chart-5)', 'var(--sr-neg)'];

const REPORT_CATEGORIES = ['Irregularity', 'Complaint', 'Compliment', 'Occurrence', 'Accident / Incident'] as const;
const SEVERITY_ORDER = ['TOP RISK', 'HIGH RISK', 'MEDIUM', 'LOW', '-'] as const;
const STATUSES = ['CLOSED', 'OPEN'] as const;

function delayAiContext(chartTitle: string, chartType: string, chartData: unknown): ChartAiContext {
  return {
    section: 'Delay Code Report',
    chartTitle,
    chartType,
    chartData,
    featureHints: chartTitle.toLowerCase().includes('severity')
      ? ['riskScoring', 'summarization', 'actionRecommendation']
      : ['rootCause', 'riskScoring', 'summarization'],
  };
}

function Panel({
  title,
  subtitle,
  total,
  className = '',
  bodyClassName = '',
  aiContext,
  children,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  className?: string;
  bodyClassName?: string;
  aiContext?: ChartAiContext;
  children: ReactNode;
}) {
  return (
    <div className={`${PANEL_FRAME} ${className}`}>
      <div className="sr-table-caption">
        <div className="sr-table-caption-title min-w-0">
          <span className="h-6 w-1 bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
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

function KpiTile({ label, value, helper, tone = 'accent', onClick }: { label: string; value: ReactNode; helper?: string; tone?: 'accent' | 'gold' | 'neutral'; onClick?: () => void }) {
  const valueColor =
    tone === 'gold' ? 'var(--sr-gold-strong)' :
    tone === 'neutral' ? 'var(--sr-text)' :
    'var(--sr-accent-dark)';
  return (
    <button type="button" onClick={onClick} className="sr-table-card flex h-full min-h-[88px] flex-col justify-between gap-2 p-4 text-left transition-opacity hover:opacity-80 active:opacity-60">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-text-3)]">
        <span className="h-3 w-1 rounded-sm bg-[color:var(--sr-gold)]" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: valueColor }}>{value}</span>
        {helper ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">{helper}</span> : null}
      </div>
    </button>
  );
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
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisWidth}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--sr-accent-tint)' }}
            contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }}
          />
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
      <table className="sr-table text-[11px]" style={{ width: '100%', minWidth: `${150 + (colKeys.length + 1) * 84}px`, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th className="!text-left" style={{ minWidth: 130, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{rowLabel}</th>
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
                  style={{ minWidth: 130, verticalAlign: 'middle', paddingTop: 8, paddingBottom: 8, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}
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
  branch: string;
  airline: string;
  delayCode: string;
  duration: string;
  category: string;
  severity: string;
  status: string;
  report: string;
  rootCaused: string;
  actionTaken: string;
  caseClassification: string;
  evidenceLinks: string[];
};

function buildDetailRow(r: Report): DetailRow {
  const eventDate = resolveEventDate(r);
  const links = Array.from(new Set([
    ...((r.evidence_urls || []).filter(Boolean) as string[]),
    ...(r.evidence_url ? [r.evidence_url] : []),
  ].map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)));
  return {
    id: r.id || r.original_id || `${r.row_number ?? Math.random()}`,
    ts: eventDate ? eventDate.getTime() : 0,
    date: eventDate ? eventDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    branch: resolveBranch(r),
    airline: resolveAirline(r),
    delayCode: resolveDelayCode(r),
    duration: resolveDelayDuration(r),
    category: resolveCategory(r),
    severity: resolveSeverityLevel(r),
    status: resolveStatus(r),
    report: readMappedValue(r, ['report', 'description'], '—'),
    rootCaused: resolveRootCauseText(r) || '—',
    actionTaken: readMappedValue(r, ['action_taken'], '—'),
    caseClassification: resolveCaseClassification(r) || '—',
    evidenceLinks: links,
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
        <table className="sr-table text-[12px]" style={{ width: '100%', minWidth: 900, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }} className="!text-left">Date</th>
              <th style={{ width: '6%', whiteSpace: 'nowrap' }} className="!text-left">Station</th>
              <th style={{ width: '13%', whiteSpace: 'nowrap' }} className="!text-left">Airlines</th>
              <th style={{ width: '15%', whiteSpace: 'nowrap' }} className="!text-left">Delay Code</th>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }} className="!text-left">Category</th>
              <th style={{ whiteSpace: 'nowrap' }} className="!text-left">Report</th>
              <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="sr-center">Severity</th>
              <th style={{ width: '8%', whiteSpace: 'nowrap' }} className="sr-center">Status</th>
              <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="sr-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="!py-10 text-center text-[12px] font-medium text-[color:var(--sr-text-3)]">
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
                      <td style={tdStyle}>
                        <span className="block leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.delayCode}
                        </span>
                      </td>
                      <td style={tdStyle}>{row.category}</td>
                      <td style={tdStyle}>
                        <span className="block leading-snug text-[color:var(--sr-text-2)]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.report}
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
                          aria-label={isExpanded ? 'Hide details' : 'Show details'}
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
                        <td colSpan={9} className="!bg-[color:var(--sr-sunken)] !p-0">
                          <div className="border-l-4 border-[color:var(--sr-accent)] p-5">
                            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                              <DetailBlock label="Report" value={row.report} />
                              <DetailBlock label="Root Caused" value={row.rootCaused} />
                              <DetailBlock label="Action Taken" value={row.actionTaken} />
                              <DetailBlock label="Delay Code / Duration" value={`${row.delayCode} / ${row.duration || '-'}`} />
                              <DetailBlock label="Case Classification" value={row.caseClassification} />
                              <DetailBlock label="Status / Severity" value={`${row.status} / ${row.severity}`} />
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

export function DelayCodeReportTab({ reports }: DelayCodeReportTabProps) {
  const deferredReports = useDeferredValue(reports);
  const { openDrilldown, DrilldownRenderer } = useDrilldown();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const scopedReports = useMemo(() => {
    if (!dateFrom && !dateTo) return deferredReports;
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
    return deferredReports.filter((r) => {
      const d = resolveEventDate(r);
      if (!d) return false;
      const t = d.getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [deferredReports, dateFrom, dateTo]);

  const delayCodeReports = useMemo(
    () => scopedReports.filter((r) => resolveDelayCode(r) !== '-'),
    [scopedReports]
  );

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const [monthlyYear, setMonthlyYear] = useState<number>(currentYear);

  const monthlyRows = useMemo<CountRow[]>(() => {
    const counts = new Array(12).fill(0);
    delayCodeReports.forEach((r) => {
      const d = resolveEventDate(r);
      if (!d) return;
      if (d.getFullYear() !== monthlyYear) return;
      counts[d.getMonth()] += 1;
    });
    return counts.map((total, idx) => ({
      id: `${monthlyYear}-${String(idx + 1).padStart(2, '0')}`,
      label: new Date(Date.UTC(monthlyYear, idx, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      total,
    }));
  }, [delayCodeReports, monthlyYear]);

  function aggregate(records: Report[], getValue: (r: Report) => string): CountRow[] {
    const buckets = new Map<string, CountRow>();
    records.forEach((r) => {
      const raw = getValue(r);
      if (!raw || raw === '-' || raw === 'Unknown') return;
      const key = raw.toLowerCase();
      const existing = buckets.get(key);
      if (existing) existing.total += 1;
      else buckets.set(key, { id: key, label: raw, total: 1 });
    });
    return Array.from(buckets.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }

  const topDelayCodes = useMemo(() => aggregate(delayCodeReports, resolveDelayCode), [delayCodeReports]);
  const branchRows = useMemo(() => aggregate(delayCodeReports, resolveBranch), [delayCodeReports]);
  const airlineRows = useMemo(() => aggregate(delayCodeReports, resolveAirline), [delayCodeReports]);

  const reportCategoryRows = useMemo<CountRow[]>(() => {
    const bucket: Record<string, number> = {};
    delayCodeReports.forEach((r) => {
      const cat = resolveCategory(r);
      if (!cat || cat === 'Uncategorized') return;
      bucket[cat] = (bucket[cat] || 0) + 1;
    });
    return REPORT_CATEGORIES
      .map((name) => ({ id: name.toLowerCase(), label: name, total: bucket[name] || 0 }))
      .filter((r) => r.total > 0);
  }, [delayCodeReports]);

  const severityRows = useMemo<CountRow[]>(() => {
    const bucket: Record<string, number> = {};
    delayCodeReports.forEach((r) => {
      const sev = resolveSeverityLevel(r);
      if (!sev || sev === '-') return;
      bucket[sev] = (bucket[sev] || 0) + 1;
    });
    return SEVERITY_ORDER
      .map((name) => ({ id: name.toLowerCase(), label: name, total: bucket[name] || 0 }))
      .filter((r) => r.total > 0);
  }, [delayCodeReports]);

  const durationStats = useMemo(() => {
    let total = 0;
    let count = 0;
    let maxValue = 0;
    delayCodeReports.forEach((r) => {
      const d = parseDurationMinutes(resolveDelayDuration(r));
      if (d === null) return;
      total += d;
      count += 1;
      if (d > maxValue) maxValue = d;
    });
    return {
      avg: count > 0 ? Math.round(total / count) : 0,
      max: maxValue,
      withDuration: count,
    };
  }, [delayCodeReports]);

  const delayCodeByCategory = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    delayCodeReports.forEach((r) => {
      const code = resolveDelayCode(r);
      const cat = resolveCategory(r);
      if (code === '-' || cat === 'Uncategorized') return;
      const ck = code.toLowerCase();
      if (!cells[ck]) cells[ck] = {};
      if (!cells[ck][cat]) cells[ck][cat] = { total: 0, reports: [] };
      cells[ck][cat].total += 1;
      cells[ck][cat].reports.push(r);
    });
    return cells;
  }, [delayCodeReports]);

  const branchByStatus = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    delayCodeReports.forEach((r) => {
      const branch = resolveBranch(r);
      const status = resolveStatus(r);
      if (!branch || branch === 'Unknown') return;
      const bk = branch.toLowerCase();
      if (!cells[bk]) cells[bk] = {};
      if (!cells[bk][status]) cells[bk][status] = { total: 0, reports: [] };
      cells[bk][status].total += 1;
      cells[bk][status].reports.push(r);
    });
    return cells;
  }, [delayCodeReports]);

  const topDelayCodeKeys = useMemo(
    () => topDelayCodes.map((r) => ({ id: r.id, label: r.label })),
    [topDelayCodes]
  );
  const presentCategoryCols = useMemo(
    () => reportCategoryRows.map((r) => ({ id: r.label, label: r.label })),
    [reportCategoryRows]
  );
  const branchKeys = useMemo(
    () => branchRows.slice(0, 12).map((r) => ({ id: r.id, label: r.label })),
    [branchRows]
  );
  const statusCols = useMemo(() => STATUSES.map((s) => ({ id: s, label: s })), []);

  const detailRows = useMemo(
    () => delayCodeReports.map(buildDetailRow).sort((a, b) => b.ts - a.ts),
    [delayCodeReports]
  );

  const topBranch = branchRows[0]?.label || '—';
  const topBranchCount = branchRows[0]?.total || 0;
  const coverage = scopedReports.length > 0
    ? ((delayCodeReports.length / scopedReports.length) * 100).toFixed(1)
    : '0.0';

  const sectionAiContext = useMemo(() => ({
    section: 'Delay Code Report',
    title: 'Delay Code Report',
    chartTitle: 'Delay Code Report',
    chartType: 'delay_overview',
    datasets: [
      {
        id: 'monthly',
        name: 'Delay Cases per Month',
        unit: 'kasus',
        kind: 'timeseries',
        description: 'Jumlah laporan delay per bulan, urut kronologis.',
        rows: monthlyRows.map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'delay_codes',
        name: 'Kode Delay Terbanyak',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah kejadian per kode delay IATA.',
        rows: topDelayCodes.slice(0, 10).map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'stations',
        name: 'Kasus per Stasiun',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan delay per stasiun (kode bandara).',
        rows: branchRows.slice(0, 10).map((r) => ({ label: r.label, value: r.total })),
      },
      {
        id: 'severity',
        name: 'Tingkat Keparahan',
        unit: 'kasus',
        kind: 'ranking',
        description: 'Jumlah laporan per tingkat keparahan delay.',
        rows: severityRows.map((r) => ({ label: r.label, value: r.total })),
      },
    ],
    featureHints: ['forecasting', 'seasonality', 'riskScoring', 'summarization', 'actionRecommendation'],
  }), [monthlyRows, topDelayCodes, branchRows, severityRows]);

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
        <p className="text-sm font-medium text-[var(--text-muted)]">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="sr-scope space-y-6 bg-[color:var(--sr-canvas)] px-4 py-6 pb-10 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      {}
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              Delay Code Report
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              {delayCodeReports.length} delays · {topDelayCodes.length} codes · {branchRows.length} branches · {airlineRows.length} airlines
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="delay-date-from" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">From</label>
            <input
              id="delay-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="delay-date-to" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">To</label>
            <input
              id="delay-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none"
            />
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
          <h2>Key Metrics</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Total Reports" value={scopedReports.length} helper="in scope" tone="neutral" onClick={() => openDrilldown(scopedReports as Report[], 'Total Reports')} />
          <KpiTile label="With Delay Code" value={delayCodeReports.length} helper={`${coverage}% coverage`} tone="accent" onClick={() => openDrilldown(delayCodeReports as Report[], 'With Delay Code')} />
          <KpiTile label="Avg Duration" value={durationStats.avg} helper={`min · max ${durationStats.max || 0}`} tone="gold" onClick={() => openDrilldown(delayCodeReports as Report[], 'Avg Duration')} />
          <KpiTile label="Top Station" value={topBranch} helper={`${topBranchCount} delays`} tone="accent" onClick={() => openDrilldown(delayCodeReports.filter((r) => resolveBranch(r) === topBranch) as Report[], `Top Station · ${topBranch}`)} />
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Volume Overview</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Panel
            title="Monthly Trend"
            total={monthlyRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={delayAiContext('Monthly Trend', 'monthly_volume', monthlyRows)}
          >
            <div className="mb-2 flex justify-center gap-1">
              {[previousYear, currentYear].map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setMonthlyYear(y)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                    monthlyYear === y
                      ? 'bg-[color:var(--sr-accent)] text-white'
                      : 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)] hover:bg-[color:var(--sr-border)]'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <HBarChart
              rows={monthlyRows}
              emptyLabel="No monthly data"
              scrollable
              onOpen={(row) =>
                openDrilldown(
                  delayCodeReports.filter((r) => {
                    const d = resolveEventDate(r);
                    if (!d || d.getFullYear() !== monthlyYear) return false;
                    return `${monthlyYear}-${String(d.getMonth() + 1).padStart(2, '0')}` === row.id;
                  }),
                  `Month: ${row.label} ${monthlyYear}`
                )
              }
            />
          </Panel>

          <Panel
            title="Top Delay Codes"
            total={topDelayCodes.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={delayAiContext('Top Delay Codes', 'bar_list', topDelayCodes.slice(0, 10))}
          >
            <BarList
              rows={topDelayCodes}
              emptyLabel="No delay codes"
              limit={10}
              onOpen={(row) =>
                openDrilldown(
                  delayCodeReports.filter((r) => resolveDelayCode(r).toLowerCase() === row.id),
                  `Delay Code: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Report Category"
            total={reportCategoryRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={delayAiContext('Report Category Distribution', 'category_donut', reportCategoryRows)}
          >
            <Donut
              rows={reportCategoryRows}
              onOpen={(row) =>
                openDrilldown(
                  delayCodeReports.filter((r) => resolveCategory(r) === row.label),
                  `Report Category: ${row.label}`
                )
              }
            />
          </Panel>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Where &amp; Who</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel
            title="Delay by Station"
            total={branchRows.reduce((s, r) => s + r.total, 0)}
            className="h-[22rem]"
            aiContext={delayAiContext('Delay by Station', 'branch_bar', branchRows)}
          >
            <HBarChart
              rows={branchRows}
              emptyLabel="No station data"
              scrollable
              limit={15}
              onOpen={(row) =>
                openDrilldown(
                  delayCodeReports.filter((r) => resolveBranch(r).toLowerCase() === row.id),
                  `Station: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Delay by Airlines"
            total={airlineRows.reduce((s, r) => s + r.total, 0)}
            className="h-[22rem]"
            aiContext={delayAiContext('Delay by Airlines', 'airline_bar', airlineRows)}
          >
            <HBarChart
              rows={airlineRows}
              emptyLabel="No airline data"
              scrollable
              limit={15}
              color="var(--sr-gold-strong)"
              onOpen={(row) =>
                openDrilldown(
                  delayCodeReports.filter((r) => resolveAirline(r).toLowerCase() === row.id),
                  `Airline: ${row.label}`
                )
              }
            />
          </Panel>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Cross-Tab Analysis</h2>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <Panel
            title="Delay Code × Report Category"
            className="h-[26rem]"
            aiContext={delayAiContext('Delay Code x Report Category', 'pivot_table', { keys: topDelayCodeKeys, cols: presentCategoryCols })}
            bodyClassName="overflow-hidden"
          >
            <HeatMatrix
              rowKeys={topDelayCodeKeys}
              rowLabel="Delay Code"
              colKeys={presentCategoryCols}
              cells={delayCodeByCategory}
              onOpen={(rs, ctx) => openDrilldown(rs, ctx)}
            />
          </Panel>

          <Panel
            title="Station × Status"
            className="h-[26rem]"
            aiContext={delayAiContext('Station x Status', 'pivot_table', { keys: branchKeys, cols: statusCols })}
            bodyClassName="overflow-hidden"
          >
            <HeatMatrix
              rowKeys={branchKeys}
              rowLabel="Station"
              colKeys={statusCols.map((s) => ({ id: s.id, label: s.label }))}
              cells={branchByStatus}
              onOpen={(rs, ctx) => openDrilldown(rs, ctx)}
            />
          </Panel>
        </div>
      </section>

      {}
      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Detail Report Landside &amp; Airside</h2>
        </div>
        <Panel
          title="Delay Code Records"
          className="h-[40rem]"
          aiContext={delayAiContext('Delay Code Records', 'detail_table', detailRows.slice(0, 20))}
          bodyClassName="overflow-hidden"
        >
          <DetailTable rows={detailRows} />
        </Panel>
      </section>

      {DrilldownRenderer()}
    </div>
  );
}
