'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Copy, ExternalLink, Loader2, QrCode, X } from 'lucide-react';
import type { Report } from '@/types';
import { normalizeText } from './summary/summary-utils';
import { ResponsiveContainer } from './shared/chart-ui';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { useVoiceDrilldown } from '@/components/chart-detail/useVoiceDrilldown';
import { YearCard } from '@/components/dashboard/year-context';
import { ReportTable, ReportTBody, ReportTD, ReportTH, ReportTHead, ReportTR } from '@/components/ui/report-table';
import {
  isJoumpaServiceReport as resolveIsJoumpaServiceReport,
  resolveCaseClassification,
  resolveJoumpaCategory,
  resolveJoumpaDetailCategory,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
} from '@/lib/report-normalization';

interface JoumpaServiceTabProps {
  allReports: Report[];
  reports: Report[];
}

interface JoumpaRecord {
  timestamp: string;
  email: string;
  date: string;
  airlines: string;
  flightNumber: string;
  branch: string;
  serviceType: string;
  category: string;
  evidence: string;
  evidence_urls?: string[];
  report: string;
  reportBy: string;
  reportType: string;
  satisfactionRating: string;
  averageRating: string;
  [key: string]: unknown;
}

interface MetricRow {
  id: string;
  label: string;
  value: number;
}

type JoumpaCategoryKey = 'compliment' | 'complaint' | 'irregularity';
type JoumpaKpiId =
  | 'report'
  | 'station'
  | 'airlines'
  | 'complaintFeedback'
  | 'complimentReport'
  | 'nonCorporate'
  | 'corporatePassenger'
  | 'reportOpen'
  | 'closedRecord';

interface JoumpaKpiItem {
  id: JoumpaKpiId;
  label: string;
  value: number;
  helper?: string;
  tone?: 'accent' | 'gold' | 'neutral';
}

interface JoumpaCategoryMatrixRow {
  id: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  station?: string;
  customerSegment?: string;
  customer?: string;
  values: Record<JoumpaCategoryKey, number>;
  total: number;
  openCount: number;
  closedCount: number;
  onProgressCount: number;
}

const CHART_COLORS = {
  emerald: 'var(--sr-accent)',
  teal: 'var(--sr-chart-3)',
  amber: 'var(--sr-gold)',
  orange: 'var(--sr-chart-4)',
  rose: 'var(--sr-chart-5)',
  indigo: 'var(--sr-chart-3)',
  staff: 'var(--sr-accent)',
  customer: 'var(--sr-gold-strong)',
};

const JOUMPA_CATEGORY_METRICS: Array<{ key: JoumpaCategoryKey; label: string; color: string }> = [
  { key: 'compliment', label: 'Compliment', color: 'var(--sr-accent)' },
  { key: 'complaint', label: 'Complaint', color: 'var(--sr-gold)' },
  { key: 'irregularity', label: 'Irregularity', color: 'var(--sr-neg)' },
];

function isJoumpaServiceReport(report: Report) {
  return resolveIsJoumpaServiceReport(report);
}

function hasValidKeyFields(report: Report) {
  const airlines = normalize(resolveReportAirline(report));
  const branch = normalize(resolveReportBranch(report));
  const category = normalize(resolveJoumpaCategory(report) || resolveReportCategory(report));
  return airlines !== '' && airlines !== '-' &&
    branch !== '' && branch !== '-' &&
    category !== '' && category !== '-';
}

function normalize(value: unknown) {
  return String(value || '').trim();
}

function normalizeLower(value: unknown) {
  return normalize(value).toLowerCase();
}

function parseCalendarDate(value?: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'long' });
}

function buildCountRows<T>(items: T[], getKey: (item: T) => string, preferredOrder?: string[]): MetricRow[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = normalize(getKey(item));
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  if (preferredOrder?.length) {
    return preferredOrder
      .map((label) => ({ id: label, label, value: counts.get(label) || 0 }))
      .filter((row) => row.value > 0);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ id: label, label, value }))
    .sort((left, right) => (right.value === left.value ? left.label.localeCompare(right.label) : right.value - left.value));
}

function buildMonthlyRows<T>(items: T[], getDate: (item: T) => string | undefined) {
  const counts = new Map<string, { label: string; value: number; order: number }>();
  items.forEach((item) => {
    const parsed = parseCalendarDate(getDate(item));
    if (!parsed) return;
    const key = monthKey(parsed);
    const label = monthLabel(parsed);
    const existing = counts.get(key);
    counts.set(key, {
      label,
      value: (existing?.value || 0) + 1,
      order: parsed.getFullYear() * 100 + parsed.getMonth(),
    });
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1].order - left[1].order)
    .map(([id, row]) => ({ id, label: row.label, value: row.value }));
}

function buildPieSlices<T>(items: T[], getKey: (item: T) => string, palette: string[]) {
  const counts = buildCountRows(items, getKey);
  return counts.map((row, index) => ({
    name: row.label,
    value: row.value,
    fill: palette[index % palette.length],
  }));
}

function getJoumpaCategoryKey(report: Report): JoumpaCategoryKey {
  const category = normalizeLower(resolveReportCategory(report));
  if (category.includes('compliment')) return 'compliment';
  if (category.includes('complaint') || category.includes('complain')) return 'complaint';
  return 'irregularity';
}

function getJoumpaCategoryLabel(report: Report) {
  const key = getJoumpaCategoryKey(report);
  return JOUMPA_CATEGORY_METRICS.find((metric) => metric.key === key)?.label || 'Irregularity';
}

function getCustomerSegment(report: Report) {
  return normalizeText(report.customer_joumpa, '-');
}

function getCustomerName(report: Report) {
  return normalizeText(
    report.detail_customer_joumpa ||
    report.customer_company_profile_corporate ||
    report.detail_customer_corporate ||
    report.non_corporate ||
    report.customer_background_non_corporate ||
    report.detail_customer_non_corporate,
    '-'
  );
}

function getCorporateCategory(report: Report) {
  return normalizeText(report.corporate || report.customer_company_profile_corporate || getCustomerName(report), '-');
}

function getNonCorporateCategory(report: Report) {
  return normalizeText(report.non_corporate || report.detail_customer_joumpa || getCustomerName(report), '-');
}

function getJoumpaCaseGroup(report: Report) {
  return normalizeText(resolveJoumpaCategory(report), '-');
}

function getJoumpaDetailIssue(report: Report) {
  return normalizeText(resolveJoumpaDetailCategory(report) || report.case_joumpa || resolveCaseClassification(report), '-');
}

function buildJoumpaCategoryMatrix(
  items: Report[],
  getRow: (report: Report) => Partial<JoumpaCategoryMatrixRow> & { primary: string }
) {
  const map = new Map<string, JoumpaCategoryMatrixRow>();

  items.forEach((report) => {
    const rowBase = getRow(report);
    const id = [
      rowBase.primary,
      rowBase.secondary,
      rowBase.tertiary,
      rowBase.station,
      rowBase.customerSegment,
      rowBase.customer,
    ].map((value) => normalizeText(value, '-')).join('::');
    const existing = map.get(id) || {
      id,
      primary: normalizeText(rowBase.primary, '-'),
      secondary: rowBase.secondary,
      tertiary: rowBase.tertiary,
      station: rowBase.station,
      customerSegment: rowBase.customerSegment,
      customer: rowBase.customer,
      values: { compliment: 0, complaint: 0, irregularity: 0 },
      total: 0,
      openCount: 0,
      closedCount: 0,
      onProgressCount: 0,
    };
    existing.values[getJoumpaCategoryKey(report)] += 1;
    existing.total += 1;
    const statusRaw = normalizeLower(report.status);
    if (statusRaw === 'closed') existing.closedCount += 1;
    else if (statusRaw === 'on progress') existing.onProgressCount += 1;
    else existing.openCount += 1;
    map.set(id, existing);
  });

  const rows = Array.from(map.values()).sort((a, b) =>
    b.total - a.total ||
    a.primary.localeCompare(b.primary) ||
    normalizeText(a.secondary).localeCompare(normalizeText(b.secondary))
  );
  const totals = JOUMPA_CATEGORY_METRICS.reduce<Record<JoumpaCategoryKey, number>>((acc, metric) => {
    acc[metric.key] = rows.reduce((sum, row) => sum + row.values[metric.key], 0);
    return acc;
  }, { compliment: 0, complaint: 0, irregularity: 0 });
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const maxValue = Math.max(1, ...rows.flatMap((row) => JOUMPA_CATEGORY_METRICS.map((metric) => row.values[metric.key])));

  return { rows, totals, grandTotal, maxValue };
}

function renderStackedBarLabel(category: string) {
  const StackedBarLabel = (props: { x?: number; y?: number; width?: number; height?: number; value?: number | string; }) => {
    const { x = 0, y = 0, width = 0, height = 0, value } = props;
    const numericValue = Number(value || 0);
    if (!numericValue || width < 22 || height < 14) return null;
    const compactLabel = category.length > 10 ? `${category.slice(0, 10)}\u2026` : category;
    const showTextAndValue = width >= 120;
    const label = showTextAndValue ? `${compactLabel} ${numericValue}` : `${numericValue}`;
    const textX = showTextAndValue ? x + 10 : x + width / 2;
    const textAnchor = showTextAndValue ? 'start' : 'middle';
    return (
      <text
        x={textX}
        y={y + height / 2}
        fill="white"
        textAnchor={textAnchor}
        dominantBaseline="middle"
        style={{ fontSize: 10, fontWeight: 800, pointerEvents: 'none' }}
      >
        {label}
      </text>
    );
  };
  StackedBarLabel.displayName = `StackedBarLabel(${category})`;
  return StackedBarLabel;
}

const JOUMPA_PANEL_CLASS = 'sr-table-card flex min-h-0 min-w-0 flex-col';
const JOUMPA_TEXT = 'var(--sr-text)';

function joumpaHeatColor(value: number, max: number) {
  if (!value || max <= 0) return undefined;
  const intensity = Math.max(0.10, Math.min(0.55, value / max * 0.55));
  return `oklch(0.55 0.16 155 / ${intensity})`;
}

function JoumpaSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="sr-section-h">
        <span className="sr-section-rule" aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function JoumpaPanel({
  title,
  subtitle,
  total,
  headerExtra,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  subtitle?: string;
  total?: number;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`${JOUMPA_PANEL_CLASS} ${className}`}>
      <div className="sr-table-caption">
        <div className="sr-table-caption-title min-w-0 !items-start">
          <span className="mt-[5px] h-[19px] w-1 shrink-0 bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)] break-words">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {typeof total === 'number' ? (
            <span className="inline-flex items-baseline gap-1 rounded-md bg-[color:var(--sr-accent-soft)] px-2 py-0.5 text-[color:var(--sr-accent-dark)]">
              <span className="font-mono text-[13px] font-bold tabular-nums">{total}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]">cases</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function JoumpaHorizontalBarPanel({
  title,
  rows,
  color = CHART_COLORS.emerald,
  className = 'h-[16rem]',
  labelWidth = 118,
  onRowClick,
  headerExtra,
}: {
  title: string;
  rows: MetricRow[];
  color?: string;
  className?: string;
  labelWidth?: number;
  onRowClick?: (row: MetricRow) => void;
  headerExtra?: ReactNode;
}) {
  const chartHeight = Math.max(150, rows.length * 30);

  return (
    <JoumpaPanel title={title} className={className} bodyClassName="overflow-auto px-1.5 py-2" headerExtra={headerExtra}>
      {rows.length === 0 ? <EmptyPanel /> : (
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 30, left: 2, bottom: 2 }}>
              <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="var(--sr-border)" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }} />
              <YAxis
                type="category"
                dataKey="label"
                width={labelWidth}
                interval={0}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text)' }}
              />
              <Tooltip cursor={{ fill: 'var(--sr-accent-tint)' }} contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }} />
              <Bar
                dataKey="value"
                fill={color}
                radius={[0, 4, 4, 0]}
                barSize={17}
                cursor={onRowClick ? 'pointer' : 'default'}
                onClick={(data: { payload?: MetricRow }) => data.payload && onRowClick?.(data.payload)}
              >
                <LabelList dataKey="value" position="right" style={{ fontSize: 10, fontWeight: 900, fill: JOUMPA_TEXT }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </JoumpaPanel>
  );
}

function JoumpaPiePanel({
  title,
  rows,
  className = 'h-[18rem]',
  onSliceClick,
}: {
  title: string;
  rows: Array<{ name: string; value: number; fill: string }>;
  className?: string;
  onSliceClick?: (name: string) => void;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <JoumpaPanel title={title} className={className} bodyClassName="flex min-h-0 items-stretch gap-3 px-3 py-2">
      {rows.length === 0 ? <EmptyPanel /> : (
        <>
          {}
          <div className="relative flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={rows}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="82%"
                    stroke="white"
                    strokeWidth={3}
                    labelLine={false}
                    cursor={onSliceClick ? 'pointer' : 'default'}
                    onClick={(data) => onSliceClick?.(data.name)}
                  >
                    {rows.map((row) => <Cell key={row.name} fill={row.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[color:var(--sr-text-3)]">Total</span>
              <span className="text-[20px] font-black leading-none text-[color:var(--sr-text)]">{total}</span>
            </div>
          </div>

          {}
          <div className="flex w-1/2 shrink-0 flex-col justify-center gap-3">
            {rows.map((row) => {
              const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => onSliceClick?.(row.name)}
                  className="group flex w-full flex-col gap-1 text-left outline-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-2)] group-hover:text-[color:var(--sr-text)]">{row.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-[color:var(--sr-text-3)]">{pct}%</span>
                  </div>
                  <div className="flex items-center gap-2 pl-3.5">
                    <span className="text-[19px] font-black leading-none text-[color:var(--sr-text)]">{row.value}</span>
                  </div>
                  <div className="ml-3.5 h-[3px] overflow-hidden rounded-full bg-[color:var(--sr-border)]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.fill }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </JoumpaPanel>
  );
}

function JoumpaBarTable({
  title,
  rows,
  className = 'h-[22rem]',
  onRowClick,
}: {
  title: string;
  headerLabel: string;
  rows: MetricRow[];
  className?: string;
  onRowClick?: (row: MetricRow) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0) || 1;

  return (
    <JoumpaPanel title={title} total={rows.reduce((s, r) => s + r.value, 0)} className={className} bodyClassName="overflow-hidden">
      {rows.length === 0 ? <EmptyPanel /> : (
        <ol className="flex h-full flex-col gap-1.5 overflow-y-auto p-2.5">
          {rows.map((row) => {
            const barPct = Math.max(4, (row.value / max) * 100);
            const sharePct = (row.value / totalValue) * 100;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onRowClick?.(row)}
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
                    {row.value}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </JoumpaPanel>
  );
}

function JoumpaKpiStrip({
  items,
  onItemClick,
}: {
  items: JoumpaKpiItem[];
  onItemClick?: (item: JoumpaKpiItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9">
      {items.map((item) => {
        const valueColor =
          item.tone === 'gold' ? 'var(--sr-gold-strong)' :
          item.tone === 'neutral' ? 'var(--sr-text)' :
          'var(--sr-accent-dark)';
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className="sr-table-card group flex h-full min-h-[88px] flex-col justify-between gap-2 p-4 text-left outline-none transition-all hover:-translate-y-0.5 hover:border-[color:var(--sr-accent-soft-2)] hover:shadow-[0_16px_30px_-24px_rgba(6,78,59,0.55)] focus-visible:ring-2 focus-visible:ring-[color:var(--sr-accent)] focus-visible:ring-offset-2"
            aria-label={`Open ${item.label} drilldown`}
          >
            <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-text-3)]">
              <span className="mt-0.5 h-3 w-1 shrink-0 rounded-sm bg-[color:var(--sr-gold)] transition-all group-hover:h-4 group-hover:bg-[color:var(--sr-accent)]" aria-hidden="true" />
              <span className="break-words leading-tight group-hover:text-[color:var(--sr-text)]">{item.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[26px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: valueColor }}>
                {item.value.toLocaleString()}
              </span>
              {item.helper ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">{item.helper}</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getJoumpaKpiRecords(metricId: JoumpaKpiId, data: Report[]) {
  switch (metricId) {
    case 'complaintFeedback':
      return data.filter((report) => getJoumpaCategoryKey(report) !== 'compliment');
    case 'complimentReport':
      return data.filter((report) => getJoumpaCategoryKey(report) === 'compliment');
    case 'nonCorporate':
      return data.filter((report) => normalizeLower(getCustomerSegment(report)).includes('non'));
    case 'corporatePassenger':
      return data.filter((report) => normalizeLower(getCustomerSegment(report)) === 'corporate');
    case 'reportOpen':
      return data.filter((report) => normalizeLower(report.status) === 'open');
    case 'closedRecord':
      return data.filter((report) => normalizeLower(report.status) === 'closed');
    case 'station': {
      // The tile shows a distinct-station count (new Set(...).size), so the
      // drilldown must match: one representative report per station, not
      // every report at that station.
      const seenStations = new Set<string>();
      return data.filter((report) => {
        const key = normalizeText(resolveReportBranch(report), '-');
        if (key === '-' || seenStations.has(key)) return false;
        seenStations.add(key);
        return true;
      });
    }
    case 'airlines': {
      const seenAirlines = new Set<string>();
      return data.filter((report) => {
        const key = normalizeText(resolveReportAirline(report), '-');
        if (key === '-' || seenAirlines.has(key)) return false;
        seenAirlines.add(key);
        return true;
      });
    }
    case 'report':
    default:
      return data;
  }
}

function JoumpaCustomerCategoryPanel({
  rows,
  className = 'h-[14rem]',
  onSegmentClick,
}: {
  rows: Array<{ id: string; label: string; compliment: number; complaint: number; irregularity: number }>;
  className?: string;
  onSegmentClick?: (row: { id: string; label: string }, key: JoumpaCategoryKey) => void;
}) {
  const chartHeight = Math.max(120, rows.length * 48);
  return (
    <JoumpaPanel title="Joumpa Customer Category" className={className} bodyClassName="overflow-auto px-2 py-3">
      {rows.length === 0 ? <EmptyPanel /> : (
        <>
          <div className="mb-2 flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-2)]">
            {JOUMPA_CATEGORY_METRICS.map((metric) => (
              <span key={metric.key} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: metric.color }} />
                {metric.label}
              </span>
            ))}
          </div>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="var(--sr-border)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text-3)' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--sr-text)' }}
                />
                <Tooltip cursor={{ fill: 'var(--sr-accent-tint)' }} contentStyle={{ borderRadius: 4, borderColor: 'var(--sr-border-strong)', fontSize: 11 }} />
                {JOUMPA_CATEGORY_METRICS.map((metric, index) => (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    name={metric.label}
                    stackId="category"
                    fill={metric.color}
                    barSize={22}
                    radius={index === JOUMPA_CATEGORY_METRICS.length - 1 ? [0, 5, 5, 0] : [0, 0, 0, 0]}
                    cursor={onSegmentClick ? 'pointer' : 'default'}
                    onClick={(data: { payload?: { id: string; label: string } }) => data.payload && onSegmentClick?.(data.payload, metric.key)}
                  >
                    <LabelList dataKey={metric.key} content={renderStackedBarLabel(metric.label)} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </JoumpaPanel>
  );
}

function JoumpaCategoryMatrixTable({
  title,
  rows,
  primaryHeader,
  secondaryHeader,
  className = 'h-[18rem]',
  groupByPrimary = false,
  onCellClick,
}: {
  title: string;
  rows: ReturnType<typeof buildJoumpaCategoryMatrix>;
  primaryHeader: string;
  secondaryHeader?: string;
  className?: string;
  groupByPrimary?: boolean;
  onCellClick?: (row: JoumpaCategoryMatrixRow, key?: JoumpaCategoryKey) => void;
}) {

  const primarySpans = useMemo(() => {
    if (!groupByPrimary) return new Map<number, number>();
    const spans = new Map<number, number>();
    let i = 0;
    while (i < rows.rows.length) {
      const primary = rows.rows[i].primary;
      let j = i;
      while (j < rows.rows.length && rows.rows[j].primary === primary) j++;
      spans.set(i, j - i);
      i = j;
    }
    return spans;
  }, [groupByPrimary, rows.rows]);

  return (
    <JoumpaPanel title={title} className={className} bodyClassName="overflow-auto">
      {rows.rows.length === 0 ? <EmptyPanel /> : (
        <ReportTable density="compact" containerClassName="overflow-visible rounded-none border-0 shadow-none" className="w-full table-fixed border-collapse text-[10px]">
          <colgroup>
            <col className={secondaryHeader ? 'w-[22%]' : 'w-[34%]'} />
            {secondaryHeader ? <col className="w-[18%]" /> : null}
            {JOUMPA_CATEGORY_METRICS.map((metric) => (
              <col key={metric.key} className={secondaryHeader ? 'w-[14%]' : 'w-[16%]'} />
            ))}
            <col className={secondaryHeader ? 'w-[14%]' : 'w-[18%]'} />
          </colgroup>
          <ReportTHead className="sticky top-0 z-20">
            <ReportTR>
              <ReportTH colSpan={(secondaryHeader ? 2 : 1) + JOUMPA_CATEGORY_METRICS.length + 1} className="border border-[color:var(--sr-border-strong)] bg-[color:var(--sr-accent)] px-1.5 py-1.5 text-right text-[11px] font-black text-white">
                Category Report / Total
              </ReportTH>
            </ReportTR>
            <ReportTR className="bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]">
              <ReportTH className="break-words border border-[color:var(--sr-border)] px-1.5 py-1.5 text-left font-bold">{primaryHeader}</ReportTH>
              {secondaryHeader ? <ReportTH className="break-words border border-[color:var(--sr-border)] px-1.5 py-1.5 text-left font-bold">{secondaryHeader}</ReportTH> : null}
              {JOUMPA_CATEGORY_METRICS.map((metric) => (
                <ReportTH key={metric.key} className="break-words border border-[color:var(--sr-border)] px-1 py-1.5 text-center font-bold">{metric.label}</ReportTH>
              ))}
              <ReportTH className="break-words border border-[color:var(--sr-border)] px-1 py-1.5 text-center font-black">Grand total</ReportTH>
            </ReportTR>
          </ReportTHead>
          <ReportTBody>
            {rows.rows.map((row, index) => {
              const showPrimary = !groupByPrimary || primarySpans.has(index);
              const rowSpan = groupByPrimary ? primarySpans.get(index) : undefined;
              return (
                <ReportTR key={row.id} className="transition-colors hover:bg-[color:var(--sr-accent-tint)]">
                  {showPrimary ? (
                    <ReportTD
                      rowSpan={rowSpan}
                      className={`break-words border border-[color:var(--sr-border)] px-1.5 py-1.5 align-top font-semibold text-[color:var(--sr-text)] ${groupByPrimary ? 'bg-[color:var(--sr-sunken)] font-bold text-[color:var(--sr-accent-dark)]' : ''}`}
                    >
                      {row.primary}
                    </ReportTD>
                  ) : null}
                  {secondaryHeader ? <ReportTD className="break-words border border-[color:var(--sr-border)] px-1.5 py-1.5 align-top text-[color:var(--sr-text)]">{row.secondary || '-'}</ReportTD> : null}
                  {JOUMPA_CATEGORY_METRICS.map((metric) => {
                    const value = row.values[metric.key] || 0;
                    return (
                      <ReportTD
                        key={metric.key}
                        className={`${value && onCellClick ? 'cursor-pointer' : ''} border border-[color:var(--sr-border)] px-1 py-1.5 text-center font-semibold text-[color:var(--sr-text)] transition-colors hover:bg-[color:var(--sr-accent-tint)]`}
                        style={{ backgroundColor: joumpaHeatColor(value, rows.maxValue) }}
                        onClick={() => value > 0 && onCellClick?.(row, metric.key)}
                      >
                        {value || '-'}
                      </ReportTD>
                    );
                  })}
                  <ReportTD
                    className={`${onCellClick ? 'cursor-pointer' : ''} border border-[color:var(--sr-border)] px-1 py-1.5 text-center font-black text-[color:var(--sr-text)]`}
                    onClick={() => onCellClick?.(row)}
                  >
                    {row.total}
                  </ReportTD>
                </ReportTR>
              );
            })}
            <ReportTR className="bg-[color:var(--sr-accent-soft)] font-black">
              <ReportTD colSpan={secondaryHeader ? 2 : 1} className="break-words border border-[color:var(--sr-accent)] px-1.5 py-1.5 text-[color:var(--sr-accent-dark)]">Grand total</ReportTD>
              {JOUMPA_CATEGORY_METRICS.map((metric) => (
                <ReportTD key={metric.key} className="border border-[color:var(--sr-accent)] px-1 py-1.5 text-center text-[color:var(--sr-accent-dark)]">{rows.totals[metric.key]}</ReportTD>
              ))}
              <ReportTD className="border border-[color:var(--sr-accent)] px-1 py-1.5 text-center text-[color:var(--sr-accent-dark)]">{rows.grandTotal}</ReportTD>
            </ReportTR>
          </ReportTBody>
        </ReportTable>
      )}
    </JoumpaPanel>
  );
}

function statusBadge(status: string) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'CLOSED') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Closed</span>;
  if (s === 'ON PROGRESS') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">On Progress</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">Open</span>;
}

function rowStatusBg(status: string) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'CLOSED') return 'bg-emerald-50/60';
  if (s === 'ON PROGRESS') return 'bg-amber-50/60';
  return 'bg-red-50/60';
}

function JoumpaIssueDetailTable({
  reports,
  className = 'h-[27rem]',
  onRowClick,
}: {
  reports: Report[];
  className?: string;
  onRowClick?: (report: Report) => void;
}) {
  const openCount = reports.filter((r) => String(r.status || '').toUpperCase() !== 'CLOSED').length;
  const closedCount = reports.filter((r) => String(r.status || '').toUpperCase() === 'CLOSED').length;

  const sorted = useMemo(() => {
    const groupOrder = new Map<string, number>();
    reports.forEach((r) => {
      const g = getJoumpaCaseGroup(r);
      if (!groupOrder.has(g)) groupOrder.set(g, groupOrder.size);
    });
    return [...reports].sort((a, b) => {
      const ga = groupOrder.get(getJoumpaCaseGroup(a)) ?? 0;
      const gb = groupOrder.get(getJoumpaCaseGroup(b)) ?? 0;
      return ga - gb;
    });
  }, [reports]);

  const primarySpans = useMemo(() => {
    const spans = new Map<number, number>();
    let i = 0;
    while (i < sorted.length) {
      const primary = getJoumpaCaseGroup(sorted[i]);
      let j = i;
      while (j < sorted.length && getJoumpaCaseGroup(sorted[j]) === primary) j++;
      spans.set(i, j - i);
      i = j;
    }
    return spans;
  }, [sorted]);

  return (
    <JoumpaPanel title="Joumpa Service Type Report by Case Category" className={className} bodyClassName="overflow-auto">
      {sorted.length === 0 ? <EmptyPanel /> : (
        <ReportTable density="compact" containerClassName="overflow-visible rounded-none border-0 shadow-none" className="min-w-[840px] w-full border-collapse text-[11px]">
          <ReportTHead className="sticky top-0 z-20">
            <ReportTR className="bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]">
              {['Category Case Joumpa', 'Detail Issue', 'Station', 'Customer Joumpa', 'Detail Customer Joumpa', 'Status'].map((label, index) => (
                <ReportTH key={label} className={`border border-[color:var(--sr-border)] px-2.5 py-2 font-bold ${index === 5 ? 'text-center' : 'text-left'}`}>{label}</ReportTH>
              ))}
            </ReportTR>
          </ReportTHead>
          <ReportTBody>
            {sorted.map((report, idx) => {
              const showPrimary = primarySpans.has(idx);
              const rowSpan = primarySpans.get(idx);
              const bg = rowStatusBg(report.status);
              return (
                <ReportTR
                  key={report.id ?? idx}
                  className={`${bg} ${onRowClick ? 'cursor-pointer' : ''} transition-colors hover:brightness-95`}
                  onClick={() => onRowClick?.(report)}
                >
                  {showPrimary && (
                    <ReportTD
                      rowSpan={rowSpan}
                      className="border border-[color:var(--sr-border)] bg-[color:var(--sr-sunken)] px-2.5 py-2 align-top font-bold text-[color:var(--sr-accent-dark)]"
                    >
                      {getJoumpaCaseGroup(report)}
                    </ReportTD>
                  )}
                  <ReportTD className="border border-[color:var(--sr-border)] px-2.5 py-2 align-top text-[color:var(--sr-text)]">{getJoumpaDetailIssue(report)}</ReportTD>
                  <ReportTD className="border border-[color:var(--sr-border)] px-2.5 py-2 align-top text-[color:var(--sr-text)]">{normalizeText(resolveReportBranch(report), '-')}</ReportTD>
                  <ReportTD className="border border-[color:var(--sr-border)] px-2.5 py-2 align-top text-[color:var(--sr-text)]">{getCustomerSegment(report)}</ReportTD>
                  <ReportTD className="border border-[color:var(--sr-border)] px-2.5 py-2 align-top text-[color:var(--sr-text)]">{getCustomerName(report)}</ReportTD>
                  <ReportTD className="border border-[color:var(--sr-border)] px-2.5 py-2 text-center">
                    {statusBadge(report.status)}
                  </ReportTD>
                </ReportTR>
              );
            })}
          </ReportTBody>
          <tfoot>
            <tr className="bg-[color:var(--sr-accent-soft)] font-black">
              <td colSpan={5} className="border border-[color:var(--sr-accent)] px-2.5 py-2 text-[13px] text-[color:var(--sr-accent-dark)]">
                {reports.length} reports
              </td>
              <td className="border border-[color:var(--sr-accent)] px-2.5 py-2 text-center">
                <span className="inline-flex flex-wrap justify-center gap-1.5">
                  {openCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{openCount} Open</span>}
                  {closedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{closedCount} Closed</span>}
                </span>
              </td>
            </tr>
          </tfoot>
        </ReportTable>
      )}
    </JoumpaPanel>
  );
}

function EmptyPanel({ message = 'No data available for the current filter.' }: { message?: string }) {
  return (
    <div className="flex min-h-[9rem] flex-col items-center justify-center px-4 py-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#677571]">{message}</p>
    </div>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)] mb-3" />
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="h-5 w-5 text-red-500 mb-3" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function LookerQrCard({ title, url, qrUrl }: { title: string; url: string; qrUrl: string }) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <JoumpaPanel title={title} className="min-h-[13rem]" bodyClassName="p-5">
        <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--sr-accent-soft-2)] bg-[color:var(--sr-accent-tint)] text-[color:var(--sr-accent)]">
              <QrCode size={20} />
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm leading-6 text-[color:var(--sr-text-2)] hover:text-[color:var(--sr-text)]">{url}</a>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-[color:var(--sr-accent)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition-all hover:bg-[color:var(--sr-accent-strong)] active:scale-[0.98]">
              <ExternalLink size={16} />
              <span>Open Dashboard</span>
            </a>
            <button type="button" onClick={handleCopyLink} className="ml-2 inline-flex items-center gap-2 rounded-md border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--sr-text)] transition-all hover:bg-[color:var(--sr-sunken)] active:scale-[0.98]">
              <Copy size={16} />
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>
          </div>
          <div className="flex justify-center sm:justify-end">
            <button type="button" onClick={() => setShowQrModal(true)} className="rounded-lg border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] p-3 shadow-sm transition-all hover:border-[color:var(--sr-accent-soft-2)] hover:bg-[color:var(--sr-accent-tint)] hover:shadow-md" aria-label={`Show QR code ${title}`}>
              {}
              <Image src={qrUrl} alt={`QR code ${title}`} width={240} height={240} className="h-36 w-36 object-contain" />
            </button>
          </div>
        </div>
      </JoumpaPanel>

      {showQrModal && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="relative z-10 w-full max-w-md border border-[color:var(--sr-border)] bg-white p-6 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.45)]">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center border border-[color:var(--sr-border)] bg-white text-[color:var(--sr-text)] hover:bg-[#f4f8f2]"
              aria-label="Close QR modal"
            >
              <X size={18} />
            </button>
            <h3 className="pr-10 text-xl font-black tracking-[-0.03em] text-[#20282b]">{title}</h3>
            <div className="mt-5 flex justify-center">
              <div className="border border-[color:var(--sr-border)] bg-white p-4 shadow-sm">
                {}
                <Image src={qrUrl} alt={`QR code ${title}`} width={240} height={240} className="h-64 w-64 object-contain" />
              </div>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 bg-[#007878] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white transition-all hover:bg-[#00676b] active:scale-[0.98]">
              <ExternalLink size={16} />
              <span>Open Dashboard</span>
            </a>
            <button type="button" onClick={handleCopyLink} className="ml-2 mt-5 inline-flex items-center gap-2 border border-[color:var(--sr-border)] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[color:var(--sr-text)] transition-all hover:bg-[#f4f8f2] active:scale-[0.98]">
              <Copy size={16} />
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function JoumpaServiceTab({ allReports, reports }: JoumpaServiceTabProps) {
  const { openDrilldown, DrilldownRenderer } = useDrilldown();
  const { openDrilldown: openVoiceDrilldown, DrilldownRenderer: VoiceDrilldownRenderer } = useVoiceDrilldown();
  const externalLinks = useExternalLinks();
  const joumpaLookerUrl = getLinkUrl(externalLinks, 'joumpa-dashboard');
  const joumpaLookerQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joumpaLookerUrl)}`;
  const joumpaSurveyUrl = getLinkUrl(externalLinks, 'joumpa-customer-survey');
  const joumpaSurveyQr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joumpaSurveyUrl)}`;

  const activeReportIds = useMemo(() => new Set(reports.map((report) => report.id)), [reports]);
  const activeMainReports = useMemo(
    () => allReports.filter((report) => activeReportIds.has(report.id)),
    [activeReportIds, allReports]
  );
  const scopedMainReports = useMemo(
    () => activeMainReports.filter((r) => isJoumpaServiceReport(r) && hasValidKeyFields(r)),
    [activeMainReports]
  );

  const [voiceRecords, setVoiceRecords] = useState<JoumpaRecord[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadVoiceData() {
      setVoiceLoading(true);
      setVoiceError(null);
      try {
        const response = await fetch('/api/joumpa', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load Joumpa dataset (${response.status})`);
        const payload = await response.json();
        if (!isMounted) return;
        setVoiceRecords(Array.isArray(payload.records) ? payload.records : []);
      } catch (error) {
        if (!isMounted) return;
        setVoiceError(error instanceof Error ? error.message : 'Failed to load Joumpa dataset');
      } finally {
        if (isMounted) setVoiceLoading(false);
      }
    }
    loadVoiceData();
    return () => { isMounted = false; };
  }, []);

  const joumpaDashboardReports = scopedMainReports;

  const joumpaKpis = useMemo(() => {
    const stationCount = new Set(joumpaDashboardReports.map((report) => normalizeText(resolveReportBranch(report), '-')).filter((value) => value !== '-')).size;
    const airlineCount = new Set(joumpaDashboardReports.map((report) => normalizeText(resolveReportAirline(report), '-')).filter((value) => value !== '-')).size;
    const complaintFeedback = joumpaDashboardReports.filter((report) => getJoumpaCategoryKey(report) !== 'compliment').length;
    const complimentReport = joumpaDashboardReports.filter((report) => getJoumpaCategoryKey(report) === 'compliment').length;
    const nonCorporate = joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)).includes('non')).length;
    const corporate = joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)) === 'corporate').length;
    const open = joumpaDashboardReports.filter((report) => normalizeLower(report.status) === 'open').length;
    const closed = joumpaDashboardReports.filter((report) => normalizeLower(report.status) === 'closed').length;
    return [
      { id: 'report' as const, label: 'Report', value: joumpaDashboardReports.length, tone: 'neutral' as const },
      { id: 'station' as const, label: 'Station', value: stationCount, tone: 'neutral' as const },
      { id: 'airlines' as const, label: 'Airlines', value: airlineCount, tone: 'neutral' as const },
      { id: 'complaintFeedback' as const, label: 'Complaint Feedback', value: complaintFeedback, tone: 'gold' as const },
      { id: 'complimentReport' as const, label: 'Compliment Report', value: complimentReport, tone: 'accent' as const },
      { id: 'nonCorporate' as const, label: 'Non - Corporate', value: nonCorporate, tone: 'accent' as const },
      { id: 'corporatePassenger' as const, label: 'Corporate Passenger', value: corporate, tone: 'accent' as const },
      { id: 'reportOpen' as const, label: 'Report Open', value: open, tone: 'gold' as const },
      { id: 'closedRecord' as const, label: 'Closed Record', value: closed, tone: 'accent' as const },
    ];
  }, [joumpaDashboardReports]);

  const hubRows = useMemo(
    () => buildCountRows(joumpaDashboardReports, (report) => normalizeText(report.hub, '-')),
    [joumpaDashboardReports]
  );

  const stationRows = useMemo(
    () => buildCountRows(joumpaDashboardReports, (report) => normalizeText(resolveReportBranch(report), '-')),
    [joumpaDashboardReports]
  );

  const customerCategoryRows = useMemo(() => {
    const matrix = buildJoumpaCategoryMatrix(joumpaDashboardReports, (report) => ({
      primary: getCustomerSegment(report),
    }));
    return matrix.rows.map((row) => ({
      id: row.id,
      label: row.primary,
      compliment: row.values.compliment,
      complaint: row.values.complaint,
      irregularity: row.values.irregularity,
    }));
  }, [joumpaDashboardReports]);

  const categoryDistributionRows = useMemo(
    () => buildPieSlices(joumpaDashboardReports, getJoumpaCategoryLabel, JOUMPA_CATEGORY_METRICS.map((metric) => metric.color)),
    [joumpaDashboardReports]
  );

  const nonCorporateRows = useMemo(
    () => buildCountRows(
      joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)).includes('non')),
      getNonCorporateCategory
    ),
    [joumpaDashboardReports]
  );

  const corporateRows = useMemo(
    () => buildCountRows(
      joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)) === 'corporate'),
      getCorporateCategory
    ),
    [joumpaDashboardReports]
  );

  const serviceCaseMatrix = useMemo(
    () => buildJoumpaCategoryMatrix(joumpaDashboardReports, (report) => ({
      primary: getJoumpaCaseGroup(report),
    })),
    [joumpaDashboardReports]
  );

  const issueRows = useMemo(
    () => buildCountRows(joumpaDashboardReports, getJoumpaDetailIssue),
    [joumpaDashboardReports]
  );

  const customerCaseMatrix = useMemo(
    () => buildJoumpaCategoryMatrix(joumpaDashboardReports, (report) => ({
      primary: getCustomerSegment(report),
      secondary: getCustomerName(report),
    })),
    [joumpaDashboardReports]
  );

  return (
    <div className="sr-scope space-y-6 bg-[color:var(--sr-canvas)] px-4 py-6 pb-10 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              JOUMPA Service
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              {joumpaDashboardReports.length} reports · {stationRows.length} stations · {hubRows.length} hubs · {voiceRecords.length} voice records
            </p>
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LookerQrCard title="Joumpa Customer Feedback Lookers Version" url={joumpaLookerUrl} qrUrl={joumpaLookerQr} />
        <LookerQrCard title="JOUMPA Customer Survey Lookers Version" url={joumpaSurveyUrl} qrUrl={joumpaSurveyQr} />
      </div>

      <JoumpaSection title="Joumpa Service Customer Handling Overview">
        <JoumpaKpiStrip items={joumpaKpis} onItemClick={(item) => openDrilldown(getJoumpaKpiRecords(item.id, joumpaDashboardReports), item.label)} />

        {}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <YearCard reports={joumpaDashboardReports}>{({ filtered, toggle }) => (
            <JoumpaHorizontalBarPanel
              title="Joumpa Monthly Report"
              rows={buildMonthlyRows(filtered, (report) => report.date_of_event || report.created_at)}
              className="h-[18rem]"
              labelWidth={78}
              headerExtra={toggle}
              onRowClick={(row) => openDrilldown(
                filtered.filter((report) => {
                  const date = parseCalendarDate(report.date_of_event || report.created_at);
                  return date ? monthLabel(date) === row.label : false;
                }),
                `Joumpa Monthly Report: ${row.label}`
              )}
            />
          )}</YearCard>
          <JoumpaCustomerCategoryPanel
            rows={customerCategoryRows}
            className="h-[18rem]"
            onSegmentClick={(row, key) => openDrilldown(
              joumpaDashboardReports.filter((report) => getCustomerSegment(report) === row.label && getJoumpaCategoryKey(report) === key),
              `Joumpa Customer Category: ${row.label} - ${key}`
            )}
          />
          <JoumpaPiePanel
            title="Report Category Feedback"
            rows={categoryDistributionRows}
            className="h-[18rem] md:col-span-2 xl:col-span-1"
            onSliceClick={(name) => openDrilldown(
              joumpaDashboardReports.filter((report) => getJoumpaCategoryLabel(report) === name),
              `Report Category Feedback: ${name}`
            )}
          />
        </div>

        {}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <JoumpaHorizontalBarPanel
            title="HUB Report"
            rows={hubRows}
            className="h-[22rem]"
            labelWidth={82}
            onRowClick={(row) => openDrilldown(
              joumpaDashboardReports.filter((report) => normalizeText(report.hub, '-') === row.label),
              `HUB Report: ${row.label}`
            )}
          />
          <JoumpaHorizontalBarPanel
            title="Station Report"
            rows={stationRows}
            className="h-[22rem]"
            labelWidth={48}
            onRowClick={(row) => openDrilldown(
              joumpaDashboardReports.filter((report) => normalizeText(resolveReportBranch(report), '-') === row.label),
              `Station Report: ${row.label}`
            )}
          />
          <JoumpaBarTable
            title="Total Non-Corporate Passenger"
            headerLabel="Non-Corporate"
            rows={nonCorporateRows}
            className="h-[22rem]"
            onRowClick={(row) => openDrilldown(
              joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)).includes('non') && getNonCorporateCategory(report) === row.label),
              `Non-Corporate Passenger: ${row.label}`
            )}
          />
          <JoumpaBarTable
            title="Total Corporate Passenger"
            headerLabel="Corporate"
            rows={corporateRows}
            className="h-[22rem]"
            onRowClick={(row) => openDrilldown(
              joumpaDashboardReports.filter((report) => normalizeLower(getCustomerSegment(report)) === 'corporate' && getCorporateCategory(report) === row.label),
              `Corporate Passenger: ${row.label}`
            )}
          />
        </div>

        {}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <JoumpaCategoryMatrixTable
            title="Joumpa Service Type Report by Case Category"
            rows={serviceCaseMatrix}
            primaryHeader="Category Case Joumpa"
            className="h-[20rem]"
            onCellClick={(row, key) => openDrilldown(
              joumpaDashboardReports.filter((report) =>
                getJoumpaCaseGroup(report) === row.primary &&
                (!key || getJoumpaCategoryKey(report) === key)
              ),
              `Service Type: ${row.primary}${key ? ` - ${key}` : ''}`
            )}
          />
          <JoumpaCategoryMatrixTable
            title="Joumpa Customer Report by Case Category"
            rows={customerCaseMatrix}
            primaryHeader="Customer Joumpa"
            secondaryHeader="Customer"
            groupByPrimary
            className="h-[20rem]"
            onCellClick={(row, key) => openDrilldown(
              joumpaDashboardReports.filter((report) =>
                getCustomerSegment(report) === row.primary &&
                getCustomerName(report) === normalizeText(row.secondary, '-') &&
                (!key || getJoumpaCategoryKey(report) === key)
              ),
              `Customer Case Category: ${row.primary} / ${row.secondary || '-'}`
            )}
          />
        </div>

        {}
        <JoumpaBarTable
          title="Detail Issue Joumpa Report"
          headerLabel="Case Joumpa"
          rows={issueRows}
          className="h-[22rem]"
          onRowClick={(row) => openDrilldown(
            joumpaDashboardReports.filter((report) => getJoumpaDetailIssue(report) === row.label),
            `Detail Issue Joumpa: ${row.label}`
          )}
        />

        {}
        <div className="grid gap-4 xl:grid-cols-1">
          <JoumpaIssueDetailTable
            reports={joumpaDashboardReports}
            className="h-[27rem]"
            onRowClick={(report) => openDrilldown(
              [report],
              `Joumpa Detail: ${getJoumpaCaseGroup(report)} / ${getJoumpaDetailIssue(report)}`
            )}
          />
        </div>
      </JoumpaSection>

      {DrilldownRenderer()}
      {VoiceDrilldownRenderer()}
    </div>
  );
}
