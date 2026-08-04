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
  ExternalLink,
} from 'lucide-react';
import type { Report } from '@/types';
import { AREA_CATEGORIES } from '@/lib/constants/incident-areas';
import { normalizeText } from './summary/summary-utils';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { SectionAiSummaryInsightButton } from '@/components/dashboard/ai/SectionAiSummaryInsightButton';
import {
  isCargoReport,
  resolveEvidenceLinks,
  resolveReportCategory,
  resolveReportStatus,
  resolveRootCause,
} from '@/lib/report-normalization';

function readHub(r: Report): string {
  return val(r.hub);
}
function readStation(r: Report): string {
  return val(r.station_code).toUpperCase();
}
function readAirline(r: Report): string {
  return val(r.airlines) || val(r.airline);
}
const NOISY_CARGO_VALUES = new Set(['unknown', '#n/a', 'n/a', '-', '_', '–', '—']);
// Historical CGO sheet stores its cargo category in the "Supporting Evidence"
// column using a coarse legacy taxonomy, while `AREA_CATEGORIES.CARGO` is the
// newer fine-grained taxonomy used by the public report form. Accept both so
// legacy CGO reports aren't silently dropped from the cargo category charts.
const LEGACY_CARGO_CATEGORIES = ['Cargo Problems', 'Operation', 'Baggage Handling', 'GSE'];
const VALID_CARGO_CATEGORIES = new Set(
  [...AREA_CATEGORIES.CARGO, ...LEGACY_CARGO_CATEGORIES].map((c) => c.toLowerCase())
);
function readCargoCategory(r: Report): string {
  const raw = val(r.category_case_cargo) || val(r.supporting_evidence);
  if (!raw || raw.length <= 1 || NOISY_CARGO_VALUES.has(raw.toLowerCase())) return '';
  if (!VALID_CARGO_CATEGORIES.has(raw.toLowerCase())) return '';
  return raw;
}

interface CgoCargoReportTabProps {
  reports: Report[];
}

type CountRow = { id: string; label: string; total: number };
type MatrixCell = { total: number; reports: Report[] };

type HeroDateRange = { from: string; to: string };
const EMPTY_HERO_RANGE: HeroDateRange = { from: '', to: '' };

function heroDateToISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function filterReportsForHeroCard(reports: Report[], year: number, range: HeroDateRange): Report[] {
  return reports.filter((report) => {
    const date = getReportDate(report);
    if (!date) return false;
    if (range.from || range.to) {
      const iso = heroDateToISO(date);
      if (range.from && iso < range.from) return false;
      if (range.to && iso > range.to) return false;
      return true;
    }
    return date.getFullYear() === year;
  });
}

function heroCardLabel(year: number, range: HeroDateRange): string {
  return range.from || range.to ? `${range.from || '…'} to ${range.to || '…'}` : String(year);
}

function HeroDateRangePicker({ range, onChange }: { range: HeroDateRange; onChange: (range: HeroDateRange) => void }) {
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
          onClick={() => onChange(EMPTY_HERO_RANGE)}
          className="text-[10px] font-black uppercase text-[color:var(--sr-text-3)] hover:text-[color:var(--sr-neg)]"
          title="Clear date range"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

function cgoCategoryBreakdown(reports: Report[]): Record<CategoryKey, number> {
  const acc = { Irregularity: 0, Complaint: 0, Compliment: 0, Occurrence: 0, 'Accident / Incident': 0 } as Record<CategoryKey, number>;
  reports.forEach((r) => {
    const cat = getCategory(r);
    if (cat) acc[cat] += 1;
  });
  return acc;
}

function CgoHeroCard({
  label,
  reports,
  range,
  onRangeChange,
  onTotalClick,
  onCategoryClick,
  primary,
}: {
  label: string;
  reports: Report[];
  range: HeroDateRange;
  onRangeChange: (range: HeroDateRange) => void;
  onTotalClick: () => void;
  onCategoryClick: (category: CategoryKey) => void;
  primary?: boolean;
}) {
  const breakdown = cgoCategoryBreakdown(reports);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`sr-card-hero relative flex min-w-0 flex-col justify-between gap-6 p-8 sm:p-10 text-left cursor-pointer hover:brightness-[0.97] transition-all ${primary ? 'sr-card-hero-primary' : ''}`}
      onClick={onTotalClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onTotalClick();
      }}
      title={`View ${label} cargo reports`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-accent-dark)]">Total Reports {label}</span>
        <HeroDateRangePicker range={range} onChange={onRangeChange} />
      </div>
      <div>
        <div className="sr-hero-value">{reports.length.toLocaleString()}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-2)]">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              disabled={breakdown[category] === 0}
              onClick={(event) => {
                event.stopPropagation();
                onCategoryClick(category);
              }}
              className="hover:text-[color:var(--sr-accent-dark)] disabled:cursor-default disabled:opacity-50 disabled:hover:text-[color:var(--sr-text-2)]"
            >
              <span className="text-[color:var(--sr-text-3)]">{category}</span> · <span className="font-mono text-[color:var(--sr-text)]">{breakdown[category].toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PANEL_FRAME = 'sr-table-card flex min-h-0 min-w-0 flex-col';
const DONUT_COLORS = ['var(--sr-accent)', 'var(--sr-gold)', 'var(--sr-chart-3)', 'var(--sr-chart-4)', 'var(--sr-chart-5)', 'var(--sr-neg)'];

const CATEGORIES = ['Irregularity', 'Complaint', 'Compliment', 'Occurrence', 'Accident / Incident'] as const;
type CategoryKey = (typeof CATEGORIES)[number];
const STATUSES = ['CLOSED', 'OPEN'] as const;
type StatusKey = (typeof STATUSES)[number];

function val(v: unknown): string {
  return normalizeText(typeof v === 'string' ? v : '', '').trim();
}

function aggregate(reports: Report[], getValue: (r: Report) => string): CountRow[] {
  const buckets = new Map<string, CountRow>();
  reports.forEach((r) => {
    const raw = getValue(r);
    if (!raw) return;
    const key = raw.toLowerCase();
    const existing = buckets.get(key);
    if (existing) existing.total += 1;
    else buckets.set(key, { id: key, label: raw, total: 1 });
  });
  return Array.from(buckets.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function getMonth(r: Report): { key: string; label: string; ts: number } | null {
  const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return {
    key: `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}`,
    label: utc.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    ts: utc.getTime(),
  };
}

function getAirlineType(r: Report): string {
  // keep original casing for display — aggregate() already groups
  // case-insensitively, so "Garuda Indonesia" stays readable in the chart
  return val(r.jenis_maskapai);
}

function getCategory(r: Report): CategoryKey | '' {
  const cat = resolveReportCategory(r);
  return (CATEGORIES as readonly string[]).includes(cat) ? (cat as CategoryKey) : '';
}

function getStatus(r: Report): StatusKey {
  const s = resolveReportStatus(r);
  return (STATUSES as readonly string[]).includes(s) ? (s as StatusKey) : 'OPEN';
}

function Panel({
  title,
  subtitle,
  total,
  totalLabel = 'cases',
  className = '',
  bodyClassName = '',
  aiContext,
  children,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  totalLabel?: string;
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
            <h3 className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)]">
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
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]">{totalLabel}</span>
            </span>
          ) : null}
          {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function BarList({
  rows,
  emptyLabel,
  onOpen,
  limit,
  scrollable = true,
}: {
  rows: CountRow[];
  emptyLabel: string;
  onOpen: (row: CountRow) => void;
  limit?: number;
  scrollable?: boolean;
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
    <ol className={`flex flex-col gap-1.5 p-2.5 ${scrollable ? 'h-full overflow-y-auto' : ''}`}>
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

function Donut({
  rows,
  onOpen,
}: {
  rows: CountRow[];
  onOpen: (row: CountRow) => void;
}) {
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
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
              <span className="truncate font-semibold text-[color:var(--sr-text-2)]">{row.label}</span>
            </span>
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
  rowLabel2,
  colKeys,
  cells,
  onOpen,
  groupByPrimary = false,
}: {
  rowKeys: { id: string; label: string; secondary?: string }[];
  rowLabel: string;
  rowLabel2?: string;
  colKeys: { id: string; label: string }[];
  cells: Record<string, Record<string, MatrixCell>>;
  onOpen: (reports: Report[], context: string) => void;
  groupByPrimary?: boolean;
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
  const grandTotal = colTotals.reduce((s, v) => s + v, 0);

  const primaryGroupSize: Record<number, number> = {};
  if (groupByPrimary && rowLabel2) {
    let i = 0;
    while (i < rowKeys.length) {
      let j = i + 1;
      while (j < rowKeys.length && rowKeys[j].label === rowKeys[i].label) j += 1;
      primaryGroupSize[i] = j - i;
      i = j;
    }
  }

  const primaryGroupTotals = new Map<string, number>();
  if (groupByPrimary && rowLabel2) {
    rowKeys.forEach((r) => {
      const subtotal = colKeys.reduce((sum, c) => sum + (cells[r.id]?.[c.id]?.total || 0), 0);
      primaryGroupTotals.set(r.label, (primaryGroupTotals.get(r.label) || 0) + subtotal);
    });
  }

  return (
    <div className="h-full w-full overflow-auto touch-scroll">
      <table
        className="sr-table text-[11px]"
        style={{ width: '100%', minWidth: `${(rowLabel2 ? 240 : 130) + (colKeys.length + 1) * 84}px`, tableLayout: 'auto' }}
      >
        <thead>
          <tr>
            <th
              className="!text-left"
              style={{ minWidth: 120, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}
            >
              {rowLabel}
            </th>
            {rowLabel2 ? (
              <th className="!text-left" style={{ minWidth: 110, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                {rowLabel2}
              </th>
            ) : null}
            {colKeys.map((c) => (
              <th key={c.id} className="sr-center" style={{ whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
            <th className="sr-center" style={{ whiteSpace: 'nowrap' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((r, idx) => {
            const rowTotal = colKeys.reduce((sum, c) => sum + (cells[r.id]?.[c.id]?.total || 0), 0);
            const groupSize = primaryGroupSize[idx];
            const showPrimary = !groupByPrimary || !rowLabel2 || groupSize !== undefined;
            const stationTotal = groupByPrimary && rowLabel2 ? primaryGroupTotals.get(r.label) || 0 : null;
            return (
              <tr key={r.id} className={groupByPrimary && rowLabel2 && groupSize !== undefined && idx > 0 ? 'border-t-2 border-[color:var(--sr-border-strong)]' : ''}>
                {showPrimary ? (
                  <td
                    rowSpan={groupByPrimary && rowLabel2 && groupSize ? groupSize : 1}
                    className="sr-label leading-tight !bg-[color:var(--sr-overlay)] font-bold"
                    style={{ minWidth: 120, verticalAlign: 'top', paddingTop: 10, paddingBottom: 10, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span>{r.label}</span>
                      {stationTotal !== null ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-3)]">
                          {stationTotal} cases
                        </span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
                {rowLabel2 ? (
                  <td
                    className="leading-tight"
                    style={{ minWidth: 100, verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}
                  >
                    {r.secondary || '—'}
                  </td>
                ) : null}
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
            <td
              colSpan={rowLabel2 ? 2 : 1}
              className="sr-label !bg-[color:var(--sr-overlay)] font-bold uppercase tracking-[0.06em]"
              style={{ verticalAlign: 'middle' }}
            >
              Grand Total
            </td>
            {colKeys.map((c, idx) => (
              <td key={c.id} className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
                {colTotals[idx]}
              </td>
            ))}
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
              {grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type DetailRow = {
  id: string;
  date: string;
  ts: number;
  serviceArea: string;
  category: string;
  station: string;
  airline: string;
  flight: string;
  report: string;
  rootCaused: string;
  actionTaken: string;
  preventive: string;
  finalRemarks: string;
  status: string;
  evidenceLinks: string[];
};

function buildDetailRow(r: Report): DetailRow {
  const dateRaw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  const d = dateRaw ? new Date(dateRaw) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return {
    id: r.id || r.original_id || `${r.row_number ?? Math.random()}`,
    date: valid ? d!.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    ts: valid ? d!.getTime() : 0,
    serviceArea: val(r.service_business_type) || 'Cargo (CGO)',
    category: val(resolveReportCategory(r)) || '—',
    station: readStation(r) || '—',
    airline: readAirline(r) || '—',
    flight: val(r.flight_number) || '—',
    report: val(r.description) || val(r.report) || '—',
    rootCaused: val(resolveRootCause(r)) || val(r.root_caused) || '—',
    actionTaken: val(r.action_taken) || '—',
    preventive: val(r.preventive_action) || '—',
    finalRemarks: val(r.final_remarks) || '—',
    status: val(resolveReportStatus(r)) || 'OPEN',
    evidenceLinks: resolveEvidenceLinks(r),
  };
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
        <table
          className="sr-table text-[12px]"
          style={{ width: '100%', minWidth: 880, tableLayout: 'fixed' }}
        >
          <thead>
            <tr>
              <th style={{ width: '10%', whiteSpace: 'nowrap' }} className="!text-left">Date</th>
              <th style={{ width: '11%', whiteSpace: 'nowrap' }} className="!text-left">Category</th>
              <th style={{ width: '6%', whiteSpace: 'nowrap' }} className="!text-left">Station</th>
              <th style={{ width: '14%', whiteSpace: 'nowrap' }} className="!text-left">Airlines</th>
              <th style={{ width: '8%', whiteSpace: 'nowrap' }} className="!text-left">Flight</th>
              <th style={{ whiteSpace: 'nowrap' }} className="!text-left">Report</th>
              <th style={{ width: '8%', whiteSpace: 'nowrap' }} className="sr-center">Status</th>
              <th style={{ width: '9%', whiteSpace: 'nowrap' }} className="sr-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="!py-10 text-center text-[12px] font-medium text-[color:var(--sr-text-3)]">
                  No data available
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isExpanded = expandedId === row.id;
                const statusClass =
                  row.status === 'CLOSED'
                    ? 'bg-[color:var(--sr-accent-soft)] text-[color:var(--sr-accent-dark)]'
                    : 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]';
                return (
                  <Fragment key={row.id}>
                    <tr className={isExpanded ? '!bg-[color:var(--sr-accent-soft)]' : ''}>
                      <td className="font-mono tabular-nums" style={tdStyle}>{row.date}</td>
                      <td style={tdStyle}>{row.category}</td>
                      <td style={tdStyle}>{row.station}</td>
                      <td style={tdStyle}>{row.airline}</td>
                      <td className="font-mono tabular-nums" style={tdStyle}>{row.flight}</td>
                      <td style={tdStyle}>
                        <span className="block leading-snug text-[color:var(--sr-text-2)]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.report}
                        </span>
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
                        <td colSpan={8} className="!bg-[color:var(--sr-sunken)] !p-0">
                          <div className="border-l-4 border-[color:var(--sr-accent)] p-5">
                            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                              <DetailBlock label="Root Caused" value={row.rootCaused} />
                              <DetailBlock label="Action Taken" value={row.actionTaken} />
                              <DetailBlock label="Preventive Action" value={row.preventive} />
                              <DetailBlock label="Final Remarks" value={row.finalRemarks} />
                            </div>
                            {row.evidenceLinks.length > 0 ? (
                              <div className="mt-4 rounded-lg border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] p-3">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-accent-dark)]">
                                  Evidence Links
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {row.evidenceLinks.map((link, i) => (
                                    <a
                                      key={`${row.id}-ev-${i}`}
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--sr-accent)] px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[color:var(--sr-accent-strong)]"
                                    >
                                      <ExternalLink size={12} />
                                      Evidence {i + 1}
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

function getReportDate(r: Report): Date | null {
  const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function CgoCargoReportTab({ reports }: CgoCargoReportTabProps) {
  const deferredReports = useDeferredValue(reports);
  const { openDrilldown, DrilldownRenderer } = useDrilldown();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allCgoReports = useMemo(
    () => deferredReports.filter(isCargoReport),
    [deferredReports]
  );

  const cgoReports = useMemo(() => {
    if (!dateFrom && !dateTo) return allCgoReports;
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
    return allCgoReports.filter((r) => {
      const d = getReportDate(r);
      if (!d) return false;
      const t = d.getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [allCgoReports, dateFrom, dateTo]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const [monthlyYear, setMonthlyYear] = useState<number>(currentYear);

  const [previousHeroRange, setPreviousHeroRange] = useState<HeroDateRange>(EMPTY_HERO_RANGE);
  const [currentHeroRange, setCurrentHeroRange] = useState<HeroDateRange>(EMPTY_HERO_RANGE);

  const previousHeroReports = useMemo(
    () => filterReportsForHeroCard(cgoReports, previousYear, previousHeroRange),
    [cgoReports, previousYear, previousHeroRange]
  );
  const currentHeroReports = useMemo(
    () => filterReportsForHeroCard(cgoReports, currentYear, currentHeroRange),
    [cgoReports, currentYear, currentHeroRange]
  );

  const monthlyRows = useMemo<CountRow[]>(() => {
    const counts = new Array(12).fill(0);
    cgoReports.forEach((r) => {
      const m = getMonth(r);
      if (!m) return;
      const year = Number(m.key.slice(0, 4));
      if (year !== monthlyYear) return;
      const monthIdx = Number(m.key.slice(5, 7)) - 1;
      counts[monthIdx] += 1;
    });
    return counts.map((total, idx) => {
      const key = `${monthlyYear}-${String(idx + 1).padStart(2, '0')}`;
      const label = new Date(Date.UTC(monthlyYear, idx, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      return { id: key, label, total };
    });
  }, [cgoReports, monthlyYear]);

  const hubRows = useMemo(() => aggregate(cgoReports, (r) => readHub(r)), [cgoReports]);
  const airlineTypeRows = useMemo(() => aggregate(cgoReports, getAirlineType), [cgoReports]);
  const stationRows = useMemo(() => aggregate(cgoReports, (r) => readStation(r)), [cgoReports]);
  const airlineRows = useMemo(() => aggregate(cgoReports, (r) => readAirline(r)), [cgoReports]);
  const reportCategoryRows = useMemo(() => aggregate(cgoReports, (r) => val(resolveReportCategory(r))), [cgoReports]);
  const cargoCategoryRows = useMemo(() => aggregate(cgoReports, (r) => readCargoCategory(r)), [cgoReports]);

  const stationByCategory = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    cgoReports.forEach((r) => {
      const station = readStation(r);
      const cat = getCategory(r);
      if (!station || !cat) return;
      const sKey = station.toLowerCase();
      if (!cells[sKey]) cells[sKey] = {};
      const cKey = cat;
      if (!cells[sKey][cKey]) cells[sKey][cKey] = { total: 0, reports: [] };
      cells[sKey][cKey].total += 1;
      cells[sKey][cKey].reports.push(r);
    });
    return cells;
  }, [cgoReports]);

  const airlineByCategory = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    cgoReports.forEach((r) => {
      if (val(r.jenis_maskapai).toLowerCase() === 'non airline case') return;
      const airline = readAirline(r);
      const cat = getCategory(r);
      if (!airline || !cat) return;
      const aKey = airline.toLowerCase();
      if (!cells[aKey]) cells[aKey] = {};
      if (!cells[aKey][cat]) cells[aKey][cat] = { total: 0, reports: [] };
      cells[aKey][cat].total += 1;
      cells[aKey][cat].reports.push(r);
    });
    return cells;
  }, [cgoReports]);

  const airlineKeysExclNonAirline = useMemo(() => {
    const seen = new Set<string>();
    return cgoReports
      .filter((r) => val(r.jenis_maskapai).toLowerCase() !== 'non airline case')
      .map((r) => readAirline(r))
      .filter((a) => {
        if (!a) return false;
        const k = a.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((label) => ({ id: label.toLowerCase(), label }))
      .sort((a, b) => {
        const aTot = Object.values(airlineByCategory[a.id] || {}).reduce((s, c) => s + c.total, 0);
        const bTot = Object.values(airlineByCategory[b.id] || {}).reduce((s, c) => s + c.total, 0);
        return bTot - aTot || a.label.localeCompare(b.label);
      });
  }, [airlineByCategory, cgoReports]);

  const cargoByCategory = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    cgoReports.forEach((r) => {
      const cargo = readCargoCategory(r);
      const cat = getCategory(r);
      if (!cargo || !cat) return;
      const k = cargo.toLowerCase();
      if (!cells[k]) cells[k] = {};
      if (!cells[k][cat]) cells[k][cat] = { total: 0, reports: [] };
      cells[k][cat].total += 1;
      cells[k][cat].reports.push(r);
    });
    return cells;
  }, [cgoReports]);

  const stationAirlineByStatus = useMemo(() => {
    const cells: Record<string, Record<string, MatrixCell>> = {};
    const labels = new Map<string, { station: string; airline: string; total: number }>();
    cgoReports.forEach((r) => {
      const station = readStation(r);
      const airline = readAirline(r);
      if (!station || !airline) return;
      const key = `${station.toLowerCase()}::${airline.toLowerCase()}`;
      const status = getStatus(r);
      if (!cells[key]) cells[key] = {};
      if (!cells[key][status]) cells[key][status] = { total: 0, reports: [] };
      cells[key][status].total += 1;
      cells[key][status].reports.push(r);
      const meta = labels.get(key) ?? { station, airline, total: 0 };
      meta.total += 1;
      labels.set(key, meta);
    });

    const stationTotals = new Map<string, number>();
    labels.forEach((meta) => {
      stationTotals.set(meta.station, (stationTotals.get(meta.station) || 0) + meta.total);
    });
    const rowKeys = Array.from(labels.entries())
      .sort((a, b) => {
        const aSt = stationTotals.get(a[1].station) || 0;
        const bSt = stationTotals.get(b[1].station) || 0;
        if (aSt !== bSt) return bSt - aSt;
        if (a[1].station !== b[1].station) return a[1].station.localeCompare(b[1].station);
        return b[1].total - a[1].total || a[1].airline.localeCompare(b[1].airline);
      })
      .map(([id, meta]) => ({ id, label: meta.station, secondary: meta.airline }));
    return { cells, rowKeys };
  }, [cgoReports]);

  const stationKeys = useMemo(
    () => stationRows.map((r) => ({ id: r.id, label: r.label })),
    [stationRows]
  );
  const airlineKeys = useMemo(
    () => airlineRows.map((r) => ({ id: r.id, label: r.label })),
    [airlineRows]
  );
  const cargoKeys = useMemo(
    () => cargoCategoryRows.map((r) => ({ id: r.id, label: r.label })),
    [cargoCategoryRows]
  );

  const presentCategoryCols = useMemo(() => {
    const present = new Set(
      reportCategoryRows.map((r) => r.label as CategoryKey).filter((k) => (CATEGORIES as readonly string[]).includes(k))
    );
    return CATEGORIES.filter((c) => present.has(c)).map((c) => ({ id: c, label: c }));
  }, [reportCategoryRows]);

  const statusCols = useMemo(() => STATUSES.map((s) => ({ id: s, label: s })), []);

  const detailRows = useMemo(
    () => cgoReports.map(buildDetailRow).sort((a, b) => b.ts - a.ts),
    [cgoReports]
  );

  const grandTotal = cgoReports.length;

  const sectionAiContext = useMemo(
    () => ({
      section: 'CGO Cargo Report',
      title: 'CGO Cargo Report',
      chartType: 'cgo_overview',
      datasets: [
        {
          id: 'monthly',
          name: 'Cargo Cases per Month',
          unit: 'kasus',
          kind: 'timeseries',
          description: 'Jumlah laporan kargo (CGO) per bulan, urut kronologis.',
          rows: monthlyRows.map((r) => ({ label: r.label, value: r.total })),
        },
        {
          id: 'stations',
          name: 'Kasus per Stasiun',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah laporan kargo per stasiun (kode bandara).',
          rows: stationRows.map((r) => ({ label: r.label, value: r.total })),
        },
        {
          id: 'airlines',
          name: 'Kasus per Maskapai',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah laporan kargo per maskapai.',
          rows: airlineRows.slice(0, 12).map((r) => ({ label: r.label, value: r.total })),
        },
        {
          id: 'cargo_categories',
          name: 'Kategori Masalah Kargo',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah laporan per kategori masalah penanganan kargo.',
          rows: cargoCategoryRows.map((r) => ({ label: r.label, value: r.total })),
        },
      ],
      featureHints: ['forecasting', 'seasonality', 'riskScoring', 'summarization', 'actionRecommendation'],
    }),
    [airlineRows, cargoCategoryRows, monthlyRows, stationRows]
  );

  return (
    <div className="sr-scope space-y-6 bg-[color:var(--sr-canvas)] px-4 py-6 pb-10 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              CGO Cargo Report
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              Cargo (CGO) · {grandTotal} cases · {stationKeys.length} stations · {airlineKeys.length} airlines
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="cgo-date-from" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
              From
            </label>
            <input
              id="cgo-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cgo-date-to" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
              To
            </label>
            <input
              id="cgo-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--sr-text)] focus:border-[color:var(--sr-accent)] focus:outline-none"
            />
          </div>
          {dateFrom || dateTo ? (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-sunken)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-2)] transition-colors hover:bg-[color:var(--sr-border)]"
            >
              Clear
            </button>
          ) : null}
          <SectionAiSummaryInsightButton context={sectionAiContext} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <CgoHeroCard
          label={heroCardLabel(previousYear, previousHeroRange)}
          reports={previousHeroReports}
          range={previousHeroRange}
          onRangeChange={setPreviousHeroRange}
          onTotalClick={() => openDrilldown(previousHeroReports, `${heroCardLabel(previousYear, previousHeroRange)} - Total Cargo Reports`)}
          onCategoryClick={(category) =>
            openDrilldown(
              previousHeroReports.filter((r) => getCategory(r) === category),
              `${heroCardLabel(previousYear, previousHeroRange)} - ${category}`
            )
          }
        />
        <CgoHeroCard
          primary
          label={heroCardLabel(currentYear, currentHeroRange)}
          reports={currentHeroReports}
          range={currentHeroRange}
          onRangeChange={setCurrentHeroRange}
          onTotalClick={() => openDrilldown(currentHeroReports, `${heroCardLabel(currentYear, currentHeroRange)} - Total Cargo Reports`)}
          onCategoryClick={(category) =>
            openDrilldown(
              currentHeroReports.filter((r) => getCategory(r) === category),
              `${heroCardLabel(currentYear, currentHeroRange)} - ${category}`
            )
          }
        />
      </div>

      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Volume Overview</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Panel
            title="Monthly"
            total={monthlyRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Monthly Report',
              chartType: 'monthly_volume',
              chartData: monthlyRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['forecasting', 'seasonality', 'summarization'],
            }}
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
                  cgoReports.filter((r) => getMonth(r)?.key === row.id),
                  `Month: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="HUB"
            total={hubRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'HUB Report',
              chartType: 'hub_breakdown',
              chartData: hubRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'summarization'],
            }}
          >
            <HBarChart
              rows={hubRows}
              emptyLabel="No HUB data"
              limit={6}
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => readHub(r).toLowerCase() === row.id),
                  `HUB: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Airline Type"
            total={airlineTypeRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Airlines Type Report',
              chartType: 'airline_type_donut',
              chartData: airlineTypeRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['summarization', 'riskScoring'],
            }}
          >
            <Donut
              rows={airlineTypeRows}
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => getAirlineType(r).toLowerCase() === row.id),
                  `Airline Type: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Category"
            total={reportCategoryRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Report Category',
              chartType: 'report_category_donut',
              chartData: reportCategoryRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['subcategory', 'summarization'],
            }}
          >
            <Donut
              rows={reportCategoryRows}
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => val(resolveReportCategory(r)).toLowerCase() === row.id),
                  `Report Category: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Station"
            total={stationRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Station Report',
              chartType: 'station_breakdown',
              chartData: stationRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'summarization', 'actionRecommendation'],
            }}
          >
            <HBarChart
              rows={stationRows}
              emptyLabel="No station data"
              limit={6}
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => readStation(r).toLowerCase() === row.id),
                  `Station: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Airlines"
            total={airlineRows.reduce((s, r) => s + r.total, 0)}
            className="h-[18rem]"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Airlines Report',
              chartType: 'airline_breakdown',
              chartData: airlineRows.slice(0, 12).map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'summarization', 'actionRecommendation'],
            }}
          >
            <HBarChart
              rows={airlineRows}
              emptyLabel="No airline data"
              scrollable
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => readAirline(r).toLowerCase() === row.id),
                  `Airline: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="Cargo Report Category"
            total={cargoCategoryRows.reduce((s, r) => s + r.total, 0)}
            totalLabel="identified"
            className="h-[18rem] xl:col-span-2"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Cargo Report Category',
              chartType: 'cargo_category_breakdown',
              chartData: cargoCategoryRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'rootCause', 'actionRecommendation'],
            }}
          >
            <BarList
              rows={cargoCategoryRows}
              emptyLabel="No cargo category data"
              onOpen={(row) =>
                openDrilldown(
                  cgoReports.filter((r) => readCargoCategory(r).toLowerCase() === row.id),
                  `Cargo Category: ${row.label}`
                )
              }
            />
          </Panel>
        </div>
      </section>

      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Breakdown CGO Category</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="CGO Station Category Report"
            className="h-[24rem]"
            bodyClassName="overflow-hidden"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Report Category by Station',
              chartType: 'station_category_matrix',
              chartData: stationKeys.map((s) => ({
                station: s.label,
                ...Object.fromEntries(presentCategoryCols.map((c) => [c.label, stationByCategory[s.id]?.[c.id]?.total || 0])),
              })),
              featureHints: ['riskScoring', 'summarization'],
            }}
          >
            <HeatMatrix
              rowKeys={stationKeys}
              rowLabel="Station"
              colKeys={presentCategoryCols}
              cells={stationByCategory}
              onOpen={(items, context) => openDrilldown(items, `Station: ${context}`)}
            />
          </Panel>

          <Panel
            title="CGO Airlines Category Report"
            className="h-[24rem]"
            bodyClassName="overflow-hidden"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Report Category by Airlines',
              chartType: 'airline_category_matrix',
              chartData: airlineKeysExclNonAirline.map((a) => ({
                airline: a.label,
                ...Object.fromEntries(presentCategoryCols.map((c) => [c.label, airlineByCategory[a.id]?.[c.id]?.total || 0])),
              })),
              featureHints: ['riskScoring', 'summarization'],
            }}
          >
            <HeatMatrix
              rowKeys={airlineKeysExclNonAirline}
              rowLabel="Airlines"
              colKeys={presentCategoryCols}
              cells={airlineByCategory}
              onOpen={(items, context) => openDrilldown(items, `Airline: ${context}`)}
            />
          </Panel>

          <Panel
            title="CGO Report Category"
            className="h-[24rem]"
            bodyClassName="overflow-hidden"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Cargo Category by Classification',
              chartType: 'cargo_category_classification_matrix',
              chartData: cargoKeys.map((c) => ({
                category: c.label,
                ...Object.fromEntries(presentCategoryCols.map((col) => [col.label, cargoByCategory[c.id]?.[col.id]?.total || 0])),
              })),
              featureHints: ['rootCause', 'riskScoring', 'actionRecommendation'],
            }}
          >
            <HeatMatrix
              rowKeys={cargoKeys}
              rowLabel="Cargo Category"
              colKeys={presentCategoryCols}
              cells={cargoByCategory}
              onOpen={(items, context) => openDrilldown(items, `Cargo: ${context}`)}
            />
          </Panel>

          <Panel
            title="Status Report"
            className="h-[24rem]"
            bodyClassName="overflow-hidden"
            aiContext={{
              section: 'CGO Cargo Report',
              chartTitle: 'Status Report Airlines',
              chartType: 'station_airline_status_matrix',
              chartData: stationAirlineByStatus.rowKeys.slice(0, 20).map((row) => ({
                station: row.label,
                airline: row.secondary || '',
                ...Object.fromEntries(statusCols.map((s) => [s.label, stationAirlineByStatus.cells[row.id]?.[s.id]?.total || 0])),
              })),
              featureHints: ['riskScoring', 'actionRecommendation'],
            }}
          >
            <HeatMatrix
              rowKeys={stationAirlineByStatus.rowKeys}
              rowLabel="Station"
              rowLabel2="Airlines"
              colKeys={statusCols}
              cells={stationAirlineByStatus.cells}
              groupByPrimary
              onOpen={(items, context) => openDrilldown(items, `Status: ${context}`)}
            />
          </Panel>
        </div>
      </section>

      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Detail Report CGO</h2>
        </div>
        <Panel
          title="Detail Report CGO"
          className="h-[34rem]"
          bodyClassName="flex min-h-0 flex-col p-3"
          aiContext={{
            section: 'CGO Cargo Report',
            chartTitle: 'Detail Report',
            chartType: 'cgo_detail_table',
            chartData: detailRows.slice(0, 20).map((r) => ({
              date: r.date,
              station: r.station,
              airline: r.airline,
              category: r.category,
              status: r.status,
            })),
            featureHints: ['rootCause', 'similaritySearch', 'actionRecommendation'],
          }}
        >
          <DetailTable rows={detailRows} />
        </Panel>
      </section>

      {DrilldownRenderer()}
    </div>
  );
}
