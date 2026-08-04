'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { Report } from '@/types';
import { normalizeText } from './summary/summary-utils';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { SectionAiSummaryInsightButton } from '@/components/dashboard/ai/SectionAiSummaryInsightButton';
import { isGseServiceReport } from '@/lib/report-normalization';

interface GsePerformanceTabProps {
  reports: Report[];
}

type CountRow = { id: string; label: string; total: number; sources: Set<string> };

const PANEL_FRAME = 'sr-table-card flex min-h-0 min-w-0 flex-col';

function val(v: unknown): string {
  return normalizeText(typeof v === 'string' ? v : '', '').trim();
}

function yearOf(r: Report): number | null {
  const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

function monthOf(r: Report): string {
  const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const mo = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${mo} ${d.getUTCFullYear()}`;
}

function aggregate(reports: Report[], getValue: (r: Report) => string): CountRow[] {
  const buckets = new Map<string, CountRow>();
  reports.forEach((r) => {
    const raw = getValue(r);
    if (!raw) return;
    const key = raw.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.total += 1;
      existing.sources.add(raw);
    } else {
      buckets.set(key, { id: key, label: raw, total: 1, sources: new Set([raw]) });
    }
  });
  return Array.from(buckets.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function Panel({
  title,
  subtitle,
  total,
  children,
  className = '',
  aiContext,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  children: ReactNode;
  className?: string;
  aiContext?: ChartAiContext;
}) {
  return (
    <div className={`${PANEL_FRAME} ${className}`}>
      <div className="sr-table-caption">
        <div className="sr-table-caption-title min-w-0">
          <span className="h-6 w-1 bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof total === 'number' ? (
            <span className="inline-flex items-baseline gap-1 rounded-md bg-[color:var(--sr-accent-soft)] px-2.5 py-1 text-[color:var(--sr-accent-dark)]">
              <span className="font-mono text-[15px] font-bold tabular-nums">{total}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]">cases</span>
            </span>
          ) : null}
          {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function BarList({
  rows,
  emptyLabel,
  onOpen,
}: {
  rows: CountRow[];
  emptyLabel: string;
  onOpen: (row: CountRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[9rem] items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        {emptyLabel}
      </div>
    );
  }

  const max = rows[0]?.total || 1;
  const totalValue = rows.reduce((sum, r) => sum + r.total, 0) || 1;

  return (
    <ol className="flex flex-col gap-1.5 overflow-y-auto p-3" style={{ maxHeight: 280 }}>
      {rows.map((row, idx) => {
        const barPct = Math.max(4, (row.total / max) * 100);
        const sharePct = (row.total / totalValue) * 100;
        const isTop = idx < 3;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="group flex w-full items-center gap-2 rounded-md border border-[color:var(--sr-border)] bg-white px-2 py-1.5 text-left transition-all hover:border-[color:var(--sr-accent)] hover:shadow-[0_4px_12px_-6px_rgba(6,78,59,0.2)]"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold tabular-nums ${
                  isTop
                    ? 'bg-[color:var(--sr-accent)] text-white'
                    : 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]'
                }`}
              >
                {idx + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-[12px] font-semibold leading-snug text-[color:var(--sr-text)]">{row.label}</p>
                <div className="flex items-center gap-1.5">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--sr-sunken)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--sr-accent)] transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-[color:var(--sr-text-3)]">
                    {sharePct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-mono text-[14px] font-bold tabular-nums leading-none text-[color:var(--sr-text)]">
                {row.total}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StatBadge({ label, value, onClick }: { label: string; value: number | string; onClick?: () => void }) {
  const cls = 'flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-[color:var(--sr-border)] bg-white px-4 py-3 text-center';
  const inner = (
    <>
      <span className="font-mono text-[22px] font-bold tabular-nums leading-none text-[color:var(--sr-text)]">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">{label}</span>
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} transition-opacity hover:opacity-75`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function MonthBarChart({
  rows,
  onOpen,
}: {
  rows: { month: string; total: number; reports: Report[] }[];
  onOpen: (reports: Report[], ctx: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        No data available
      </div>
    );
  }
  return (
    <div className="h-[280px] px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 24, left: 0 }} barCategoryGap="30%">
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--sr-text-3)' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-35}
            textAnchor="end"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--sr-text-3)' }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(6,78,59,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { month: string; total: number };
              return (
                <div className="rounded-lg border border-[color:var(--sr-border)] bg-white px-3 py-2 shadow-lg">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-3)]">{d.month}</p>
                  <p className="font-mono text-[18px] font-black text-[color:var(--sr-accent)]">{d.total}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="var(--sr-accent)" onClick={(d: unknown) => { const row = (d as { payload: { month: string; total: number; reports: Report[] } }).payload; onOpen(row.reports, `Month: ${row.month}`); }} style={{ cursor: 'pointer' }}>
            <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--sr-text)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CrossMatrix2025({
  rowLabels,
  colLabels,
  cells,
  rowTotals,
  colTotals,
  grandTotal,
  rowHeader,
  colHeader,
  onOpen,
}: {
  rowLabels: string[];
  colLabels: string[];
  cells: Record<string, Record<string, { total: number; reports: Report[] }>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
  rowHeader: string;
  colHeader: string;
  onOpen: (reports: Report[], ctx: string) => void;
}) {
  if (rowLabels.length === 0) {
    return (
      <div className="flex min-h-[9rem] items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        No data available
      </div>
    );
  }
  let maxCell = 0;
  rowLabels.forEach((r) => colLabels.forEach((c) => {
    maxCell = Math.max(maxCell, cells[r]?.[c]?.total ?? 0);
  }));
  const shade = (v: number) => {
    if (!v || !maxCell) return 'transparent';
    const intensity = Math.min(0.92, 0.1 + (v / maxCell) * 0.68);
    return `rgba(6,78,59,${intensity.toFixed(3)})`;
  };
  return (
    <div className="overflow-auto" style={{ maxHeight: 280 }}>
      <table className="sr-table text-[11px]">
        <thead className="sticky top-0 z-10 bg-[color:var(--sr-overlay)]">
          <tr>
            <th className="sr-sticky-col-1 !text-left text-[10px]" style={{ width: 140, minWidth: 140, whiteSpace: 'normal' }}>{rowHeader}</th>
            {colLabels.map((c) => (
              <th key={c} className="sr-center whitespace-nowrap px-2 text-[10px]" style={{ minWidth: 80 }} title={c}>{c}</th>
            ))}
            <th className="sr-center text-[11px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((r) => (
            <tr key={r}>
              <td className="sr-label sr-sticky-col-1 align-middle text-[11px]" style={{ width: 140, minWidth: 140, whiteSpace: 'normal' }}>{r}</td>
              {colLabels.map((c) => {
                const cell = cells[r]?.[c];
                const v = cell?.total ?? 0;
                const bg = shade(v);
                const fg = v / Math.max(1, maxCell) > 0.5 ? 'white' : 'var(--sr-text)';
                return (
                  <td key={c} className="sr-center align-middle !p-0">
                    <button
                      type="button"
                      disabled={!v}
                      onClick={() => cell && onOpen(cell.reports, `${r} × ${c}`)}
                      className="h-full w-full px-1.5 py-2 font-mono text-[12px] font-bold tabular-nums transition-opacity hover:opacity-80 disabled:cursor-default"
                      style={{ backgroundColor: bg, color: v ? fg : 'var(--sr-text-3)' }}
                    >
                      {v || '–'}
                    </button>
                  </td>
                );
              })}
              <td className="sr-center align-middle font-mono text-[12px] font-bold tabular-nums">{rowTotals[r] ?? 0}</td>
            </tr>
          ))}
          <tr>
            <td className="sr-label sr-sticky-col-1 !bg-[color:var(--sr-overlay)] align-middle font-bold uppercase tracking-[0.06em] text-[11px]" style={{ width: 140, minWidth: 140, whiteSpace: 'normal' }}>
              {colHeader} Total
            </td>
            {colLabels.map((c) => (
              <td key={c} className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
                {colTotals[c] ?? 0}
              </td>
            ))}
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[14px] font-bold tabular-nums">{grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type MatrixCell = { total: number; reports: Report[] };

function CrossMatrix({
  categories,
  matrix,
  motorizedTotal,
  nonMotorizedTotal,
  grandTotal,
  onOpen,
}: {
  categories: { id: string; label: string; total: number }[];
  matrix: Record<string, { motorized: MatrixCell; nonMotorized: MatrixCell }>;
  motorizedTotal: number;
  nonMotorizedTotal: number;
  grandTotal: number;
  onOpen: (reports: Report[], context: string) => void;
}) {
  if (categories.length === 0) {
    return (
      <div className="flex min-h-[9rem] items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
        No data available
      </div>
    );
  }

  let maxCell = 0;
  categories.forEach((c) => {
    const row = matrix[c.id];
    if (!row) return;
    maxCell = Math.max(maxCell, row.motorized.total, row.nonMotorized.total);
  });

  const shade = (value: number) => {
    if (!value || !maxCell) return 'transparent';
    const intensity = Math.min(0.95, 0.12 + (value / maxCell) * 0.65);
    return `rgba(6, 78, 59, ${intensity.toFixed(3)})`;
  };

  return (
    <div className="overflow-auto touch-scroll" style={{ maxHeight: 280, '--sr-sticky-col-1-width': '150px' } as React.CSSProperties}>
      <table className="sr-table w-full text-[11px]">
        <thead>
          <tr>
            <th className="sr-sticky-col-1 !text-left text-[10px]">Category Case GSE</th>
            <th className="sr-center text-[10px]">Motorized</th>
            <th className="sr-center text-[10px]">Non-Motorized</th>
            <th className="sr-center text-[10px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const row = matrix[cat.id] || {
              motorized: { total: 0, reports: [] },
              nonMotorized: { total: 0, reports: [] },
            };
            const mShade = shade(row.motorized.total);
            const nShade = shade(row.nonMotorized.total);
            const mFg = row.motorized.total / Math.max(1, maxCell) > 0.5 ? 'white' : 'var(--sr-text)';
            const nFg = row.nonMotorized.total / Math.max(1, maxCell) > 0.5 ? 'white' : 'var(--sr-text)';
            return (
              <tr key={cat.id}>
                <td className="sr-label sr-sticky-col-1 align-middle text-[11px]">{cat.label}</td>
                <td className="sr-center align-middle !p-0">
                  <button
                    type="button"
                    disabled={!row.motorized.total}
                    onClick={() => onOpen(row.motorized.reports, `${cat.label} · GSE Motorized`)}
                    className="h-full w-full px-2 py-2 font-mono text-[13px] font-bold tabular-nums transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-100"
                    style={{ backgroundColor: mShade, color: row.motorized.total ? mFg : 'var(--sr-text-3)' }}
                  >
                    {row.motorized.total || '–'}
                  </button>
                </td>
                <td className="sr-center align-middle !p-0">
                  <button
                    type="button"
                    disabled={!row.nonMotorized.total}
                    onClick={() => onOpen(row.nonMotorized.reports, `${cat.label} · GSE Non-Motorized`)}
                    className="h-full w-full px-2 py-2 font-mono text-[13px] font-bold tabular-nums transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-100"
                    style={{ backgroundColor: nShade, color: row.nonMotorized.total ? nFg : 'var(--sr-text-3)' }}
                  >
                    {row.nonMotorized.total || '–'}
                  </button>
                </td>
                <td className="sr-center align-middle font-mono text-[13px] font-bold tabular-nums">{cat.total}</td>
              </tr>
            );
          })}
          <tr>
            <td className="sr-label sr-sticky-col-1 align-middle !bg-[color:var(--sr-overlay)] font-bold uppercase tracking-[0.06em] text-[10px]">
              Grand Total
            </td>
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
              {motorizedTotal}
            </td>
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
              {nonMotorizedTotal}
            </td>
            <td className="sr-center align-middle !bg-[color:var(--sr-overlay)] font-mono text-[13px] font-bold tabular-nums">
              {grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function GsePerformanceTab({ reports }: GsePerformanceTabProps) {
  const deferredReports = useDeferredValue(reports);
  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  const gseReports = useMemo(
    () => deferredReports.filter(isGseServiceReport),
    [deferredReports]
  );

  const categoryRows = useMemo(
    () => aggregate(gseReports, (r) => val(r.category_case_gse)),
    [gseReports]
  );

  const motorizedRows = useMemo(
    () => aggregate(gseReports, (r) => val(r.gse_motorized)),
    [gseReports]
  );

  const nonMotorizedRows = useMemo(
    () => aggregate(gseReports, (r) => val(r.gse_non_motorized)),
    [gseReports]
  );

  const { matrix, motorizedTotal, nonMotorizedTotal, grandTotal } = useMemo(() => {
    const m: Record<string, { motorized: MatrixCell; nonMotorized: MatrixCell }> = {};
    let mTot = 0;
    let nTot = 0;
    let gTot = 0;

    gseReports.forEach((r) => {
      const cat = val(r.category_case_gse);
      if (!cat) return;
      const key = cat.toLowerCase();
      if (!m[key]) m[key] = { motorized: { total: 0, reports: [] }, nonMotorized: { total: 0, reports: [] } };

      const hasMotor = !!val(r.gse_motorized);
      const hasNonMotor = !!val(r.gse_non_motorized);
      if (hasMotor) {
        m[key].motorized.total += 1;
        m[key].motorized.reports.push(r);
        mTot += 1;
        gTot += 1;
      } else if (hasNonMotor) {
        m[key].nonMotorized.total += 1;
        m[key].nonMotorized.reports.push(r);
        nTot += 1;
        gTot += 1;
      } else {
        gTot += 1;
      }
    });
    return { matrix: m, motorizedTotal: mTot, nonMotorizedTotal: nTot, grandTotal: gTot };
  }, [gseReports]);

  const gseDelayReports = useMemo(
    () => gseReports.filter((r) => {
      const code = val(r.delay_code).toLowerCase();
      return code && !/^(no[\s-]?delay|none|n\/?a|tidak ada|nil|null|-+|0)$/.test(code);
    }),
    [gseReports]
  );

  const delayCodeRows = useMemo(
    () => aggregate(gseDelayReports, (r) => val(r.delay_code)),
    [gseDelayReports]
  );

  const matrixCategories = useMemo(
    () => categoryRows.map((row) => ({ id: row.id, label: row.label, total: row.total })),
    [categoryRows]
  );

  const sectionAiContext = useMemo(
    () => ({
      section: 'GSE Performance',
      title: 'GSE Performance',
      chartType: 'gse_availability_overview',
      datasets: [
        {
          id: 'categories',
          name: 'Kategori Ketersediaan GSE',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah kasus per kategori masalah ketersediaan peralatan GSE (ground support equipment).',
          rows: categoryRows.map((r) => ({ label: r.label, value: r.total })),
        },
        {
          id: 'motorized',
          name: 'Peralatan Motorized',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah kasus per jenis peralatan GSE bermotor.',
          rows: motorizedRows.map((r) => ({ label: r.label, value: r.total })),
        },
        {
          id: 'non_motorized',
          name: 'Peralatan Non-Motorized',
          unit: 'kasus',
          kind: 'ranking',
          description: 'Jumlah kasus per jenis peralatan GSE tanpa motor.',
          rows: nonMotorizedRows.map((r) => ({ label: r.label, value: r.total })),
        },
      ],
      featureHints: ['summarization', 'rootCause', 'riskScoring', 'actionRecommendation'],
    }),
    [categoryRows, motorizedRows, nonMotorizedRows]
  );

  const currentYear = new Date().getUTCFullYear();

  const gse2026Reports = useMemo(
    () => deferredReports.filter((r) => yearOf(r) === currentYear && val(r.apron_area_category).toLowerCase().includes('gse')),
    [deferredReports, currentYear]
  );

  const month2026Rows = useMemo(() => {
    const buckets = new Map<string, { total: number; reports: Report[]; sortKey: number }>();
    gse2026Reports.forEach((r) => {
      const m = monthOf(r);
      if (!m) return;
      const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
      const d = new Date(raw!);
      const sortKey = d.getUTCFullYear() * 100 + d.getUTCMonth();
      const existing = buckets.get(m);
      if (existing) { existing.total += 1; existing.reports.push(r); }
      else buckets.set(m, { total: 1, reports: [r], sortKey });
    });
    return Array.from(buckets.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [gse2026Reports]);

  const gse2025Reports = useMemo(
    () => deferredReports.filter((r) => yearOf(r) === 2025 && val(r.apron_area_category).toLowerCase().includes('gse')),
    [deferredReports]
  );

  const apron2025Rows = useMemo(
    () => aggregate(gse2025Reports, (r) => val(r.apron_area_category)),
    [gse2025Reports]
  );

  const airline2025Rows = useMemo(
    () => aggregate(gse2025Reports, (r) => val(r.airlines) || val(r.airline)),
    [gse2025Reports]
  );

  const branch2025Rows = useMemo(
    () => aggregate(gse2025Reports, (r) => val(r.branch) || val(r.station_code) || val(r.branch_code)),
    [gse2025Reports]
  );

  const month2025Rows = useMemo(() => {
    const buckets = new Map<string, { total: number; reports: Report[]; sortKey: number }>();
    gse2025Reports.forEach((r) => {
      const m = monthOf(r);
      if (!m) return;
      const raw = r.date_of_event || r.event_date || r.incident_date || r.created_at;
      const d = new Date(raw!);
      const sortKey = d.getUTCFullYear() * 100 + d.getUTCMonth();
      const existing = buckets.get(m);
      if (existing) { existing.total += 1; existing.reports.push(r); }
      else buckets.set(m, { total: 1, reports: [r], sortKey });
    });
    return Array.from(buckets.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [gse2025Reports]);

  const { matrix2025, rowLabels2025, colLabels2025, rowTotals2025, colTotals2025, grand2025 } = useMemo(() => {
    const topAirlines = airline2025Rows.slice(0, 8).map((r) => r.label);
    const topAirlineKeys = new Set(topAirlines.map((a) => a.toLowerCase()));
    const cells: Record<string, Record<string, { total: number; reports: Report[] }>> = {};
    const rt: Record<string, number> = {};
    const ct: Record<string, number> = {};
    let grand = 0;

    gse2025Reports.forEach((r) => {
      const cat = val(r.apron_area_category);
      const air = val(r.airlines) || val(r.airline);
      if (!cat) return;
      const airLabel = topAirlines.find((a) => a.toLowerCase() === air.toLowerCase()) ?? (air && !topAirlineKeys.has(air.toLowerCase()) ? 'Others' : '');
      const col = airLabel || (air ? 'Others' : 'Unknown');
      if (!cells[cat]) cells[cat] = {};
      if (!cells[cat][col]) cells[cat][col] = { total: 0, reports: [] };
      cells[cat][col].total += 1;
      cells[cat][col].reports.push(r);
      rt[cat] = (rt[cat] ?? 0) + 1;
      ct[col] = (ct[col] ?? 0) + 1;
      grand += 1;
    });

    const rows = Object.keys(rt).sort((a, b) => rt[b] - rt[a]);
    const allCols = Array.from(new Set(Object.values(cells).flatMap(Object.keys)));

    const cols = [
      ...topAirlines.filter((a) => allCols.includes(a)),
      ...allCols.filter((c) => c === 'Others' || c === 'Unknown'),
    ];

    return { matrix2025: cells, rowLabels2025: rows, colLabels2025: cols, rowTotals2025: rt, colTotals2025: ct, grand2025: grand };
  }, [gse2025Reports, airline2025Rows]);

  const { stationMatrix, stationRowLabels, stationColLabels, stationRowTotals, stationColTotals } = useMemo(() => {
    const topStations = branch2025Rows.slice(0, 8).map((r) => r.label);
    const topStationKeys = new Set(topStations.map((s) => s.toLowerCase()));
    const cells: Record<string, Record<string, { total: number; reports: Report[] }>> = {};
    const rt: Record<string, number> = {};
    const ct: Record<string, number> = {};

    gse2025Reports.forEach((r) => {
      const cat = val(r.apron_area_category);
      const sta = val(r.branch) || val(r.station_code) || val(r.branch_code);
      if (!cat) return;
      const staLabel = topStations.find((s) => s.toLowerCase() === sta.toLowerCase()) ?? (sta && !topStationKeys.has(sta.toLowerCase()) ? 'Others' : '');
      const col = staLabel || (sta ? 'Others' : 'Unknown');
      if (!cells[cat]) cells[cat] = {};
      if (!cells[cat][col]) cells[cat][col] = { total: 0, reports: [] };
      cells[cat][col].total += 1;
      cells[cat][col].reports.push(r);
      rt[cat] = (rt[cat] ?? 0) + 1;
      ct[col] = (ct[col] ?? 0) + 1;
    });

    const rows = Object.keys(rt).sort((a, b) => rt[b] - rt[a]);
    const allCols = Array.from(new Set(Object.values(cells).flatMap(Object.keys)));
    const cols = [...topStations.filter((s) => allCols.includes(s)), ...allCols.filter((c) => c === 'Others' || c === 'Unknown')];
    return { stationMatrix: cells, stationRowLabels: rows, stationColLabels: cols, stationRowTotals: rt, stationColTotals: ct };
  }, [gse2025Reports, branch2025Rows]);

  const [expanded2025, setExpanded2025] = useState(false);

  const section2025AiContext = useMemo(
    () => ({
      section: 'GSE Performance 2025',
      title: 'GSE Performance 2025 (Apron Area Classification)',
      chartType: 'gse_2025_overview',
      chartData: apron2025Rows.map((r) => ({ label: r.label, value: r.total })),
      featureHints: ['summarization', 'rootCause', 'riskScoring', 'actionRecommendation'],
    }),
    [apron2025Rows]
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
              GSE Performance
              <span className="block text-[clamp(16px,1.5vw,22px)] font-semibold text-[color:var(--sr-text-2)]">Detail Report</span>
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              GSE availability · {grandTotal} cases · {matrixCategories.length} categories
            </p>
          </div>
        </div>
        <SectionAiSummaryInsightButton context={sectionAiContext} />
      </div>

      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>GSE Availability Overview</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="GSE Availability Category"
            total={grandTotal}
            aiContext={{
              section: 'GSE Performance',
              chartTitle: 'GSE Availability Category Matrix',
              chartType: 'category_equipment_matrix',
              chartData: matrixCategories.map((cat) => ({
                category: cat.label,
                motorized: matrix[cat.id]?.motorized.total || 0,
                non_motorized: matrix[cat.id]?.nonMotorized.total || 0,
                total: cat.total,
              })),
              featureHints: ['riskScoring', 'rootCause', 'summarization'],
            }}
          >
            <CrossMatrix
              categories={matrixCategories}
              matrix={matrix}
              motorizedTotal={motorizedTotal}
              nonMotorizedTotal={nonMotorizedTotal}
              grandTotal={grandTotal}
              onOpen={(items, context) => openDrilldown(items, context)}
            />
          </Panel>
          <Panel
            title="Top Delay Codes"
            total={gseDelayReports.length}
          >
            <BarList
              rows={delayCodeRows}
              emptyLabel="No delay codes"
              onOpen={(row) =>
                openDrilldown(
                  gseDelayReports.filter((r) => val(r.delay_code).toLowerCase() === row.id),
                  `Delay Code: ${row.label}`
                )
              }
            />
          </Panel>
        </div>
      </section>

      <section>
        <div className="sr-section-h">
          <span className="sr-section-rule" aria-hidden="true" />
          <h2>Breakdown by Equipment Class</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel
            title="Category Case GSE"
            total={categoryRows.reduce((s, r) => s + r.total, 0)}
            aiContext={{
              section: 'GSE Performance',
              chartTitle: 'Category Case GSE',
              chartType: 'category_breakdown',
              chartData: categoryRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'summarization', 'actionRecommendation'],
            }}
          >
            <BarList
              rows={categoryRows}
              emptyLabel="No category data"
              onOpen={(row) =>
                openDrilldown(
                  gseReports.filter((r) => val(r.category_case_gse).toLowerCase() === row.id),
                  `Category Case GSE: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="GSE Motorized"
            total={motorizedRows.reduce((s, r) => s + r.total, 0)}
            aiContext={{
              section: 'GSE Performance',
              chartTitle: 'GSE Motorized',
              chartType: 'motorized_breakdown',
              chartData: motorizedRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'rootCause', 'actionRecommendation'],
            }}
          >
            <BarList
              rows={motorizedRows}
              emptyLabel="No motorized data"
              onOpen={(row) =>
                openDrilldown(
                  gseReports.filter((r) => val(r.gse_motorized).toLowerCase() === row.id),
                  `GSE Motorized: ${row.label}`
                )
              }
            />
          </Panel>

          <Panel
            title="GSE Non-Motorized"
            total={nonMotorizedRows.reduce((s, r) => s + r.total, 0)}
            className="md:col-span-2 xl:col-span-1"
            aiContext={{
              section: 'GSE Performance',
              chartTitle: 'GSE Non-Motorized',
              chartType: 'non_motorized_breakdown',
              chartData: nonMotorizedRows.map((r) => ({ name: r.label, total: r.total })),
              featureHints: ['riskScoring', 'rootCause', 'actionRecommendation'],
            }}
          >
            <BarList
              rows={nonMotorizedRows}
              emptyLabel="No non-motorized data"
              onOpen={(row) =>
                openDrilldown(
                  gseReports.filter((r) => val(r.gse_non_motorized).toLowerCase() === row.id),
                  `GSE Non-Motorized: ${row.label}`
                )
              }
            />
          </Panel>
        </div>
      </section>

      {month2026Rows.length > 0 && (
        <section>
          <div className="sr-section-h">
            <span className="sr-section-rule" aria-hidden="true" />
            <h2>Monthly Reports</h2>
          </div>
          <Panel
            title="GSE Monthly Report"
            subtitle={`${currentYear} — click any bar to drill into records`}
            total={gse2026Reports.length}
            aiContext={{ section: `GSE Performance ${currentYear}`, chartTitle: `Monthly GSE Trend ${currentYear}`, chartType: 'gse_2026_monthly_trend', chartData: month2026Rows.map((r) => ({ month: r.month, total: r.total })), featureHints: ['summarization', 'rootCause'] }}
          >
            <MonthBarChart rows={month2026Rows} onOpen={(items, ctx) => openDrilldown(items, ctx)} />
          </Panel>
        </section>
      )}

      {}
      {gse2025Reports.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setExpanded2025((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-[color:var(--sr-gold)] bg-white px-5 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--sr-gold)] shadow-sm transition-all hover:bg-[color:var(--sr-gold)] hover:text-white"
          >
            {expanded2025 ? '▲ Collapse' : '▼ View'} 2025 GSE Performance Report
            <span className="rounded-md bg-[color:var(--sr-gold)] px-1.5 py-0.5 font-mono text-[11px] font-black text-white">
              {grand2025}
            </span>
          </button>
        </div>
      )}

      {}
      {gse2025Reports.length > 0 && expanded2025 && (
        <>
          <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-gold)]" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-4">
              <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-gold)] shadow-[5px_0_0_var(--sr-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="font-display leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
                  <span className="text-[clamp(48px,5vw,72px)] font-black tabular-nums text-[color:var(--sr-gold)]">2025</span>
                  <span className="ml-3 text-[clamp(18px,1.8vw,26px)] font-bold">GSE Performance</span>
                  <span className="block text-[clamp(12px,1.1vw,16px)] font-semibold text-[color:var(--sr-text-2)]">Apron Area Classification Report</span>
                </h1>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
                  GSE incidents classified by apron area · {grand2025} cases · {apron2025Rows.length} categories
                </p>
              </div>
            </div>
            <SectionAiSummaryInsightButton context={section2025AiContext} />
          </div>

          {}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBadge label="Total Cases" value={grand2025} onClick={() => openDrilldown(gse2025Reports, '2025 GSE — All Cases')} />
            <StatBadge label="GSE Categories" value={apron2025Rows.length} onClick={() => openDrilldown(gse2025Reports, '2025 GSE — All Categories')} />
            <StatBadge label="Airlines Involved" value={airline2025Rows.length} onClick={() => openDrilldown(gse2025Reports.filter((r) => !!(val(r.airlines) || val(r.airline))), '2025 GSE — Airline Cases')} />
            <StatBadge label="Stations" value={branch2025Rows.length} onClick={() => openDrilldown(gse2025Reports.filter((r) => !!(val(r.branch) || val(r.station_code) || val(r.branch_code))), '2025 GSE — Station Cases')} />
          </div>

          {}
          <section>
            <div className="sr-section-h">
              <span className="sr-section-rule" aria-hidden="true" />
              <h2>GSE Performance Station &amp; Airline Report</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel
                title="GSE Distribution by Carrier"
                subtitle="Category vs. top airlines · others grouped"
                total={grand2025}
                aiContext={{
                  section: 'GSE Performance 2025',
                  chartTitle: 'GSE Distribution by Carrier',
                  chartType: 'gse_2025_category_airline_matrix',
                  chartData: rowLabels2025.map((r) => ({ category: r, total: rowTotals2025[r], ...Object.fromEntries(colLabels2025.map((c) => [c, matrix2025[r]?.[c]?.total ?? 0])) })),
                  featureHints: ['riskScoring', 'rootCause', 'summarization'],
                }}
              >
                <CrossMatrix2025
                  rowLabels={rowLabels2025}
                  colLabels={colLabels2025}
                  cells={matrix2025}
                  rowTotals={rowTotals2025}
                  colTotals={colTotals2025}
                  grandTotal={grand2025}
                  rowHeader="Airline Reports GSE Category"
                  colHeader="Airline"
                  onOpen={(items, ctx) => openDrilldown(items, ctx)}
                />
              </Panel>

              <Panel
                title="GSE Distribution by Station"
                subtitle="Category vs. top stations · others grouped"
                total={grand2025}
                aiContext={{
                  section: 'GSE Performance 2025',
                  chartTitle: 'GSE Distribution by Station',
                  chartType: 'gse_2025_category_station_matrix',
                  chartData: stationRowLabels.map((r) => ({ category: r, total: stationRowTotals[r], ...Object.fromEntries(stationColLabels.map((c) => [c, stationMatrix[r]?.[c]?.total ?? 0])) })),
                  featureHints: ['riskScoring', 'rootCause', 'summarization'],
                }}
              >
                <CrossMatrix2025
                  rowLabels={stationRowLabels}
                  colLabels={stationColLabels}
                  cells={stationMatrix}
                  rowTotals={stationRowTotals}
                  colTotals={stationColTotals}
                  grandTotal={grand2025}
                  rowHeader="Station Reports GSE category"
                  colHeader="Station"
                  onOpen={(items, ctx) => openDrilldown(items, ctx)}
                />
              </Panel>
            </div>
          </section>

          {}
          <section>
            <div className="sr-section-h">
              <span className="sr-section-rule" aria-hidden="true" />
              <h2>GSE Category Breakdown</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Panel
                title="Category GSE Report"
                total={apron2025Rows.reduce((s, r) => s + r.total, 0)}
                aiContext={{ section: 'GSE Performance 2025', chartTitle: 'GSE Incident Category', chartType: 'gse_2025_apron_category', chartData: apron2025Rows.map((r) => ({ name: r.label, total: r.total })), featureHints: ['riskScoring', 'summarization'] }}
              >
                <BarList rows={apron2025Rows} emptyLabel="No category data" onOpen={(row) => openDrilldown(gse2025Reports.filter((r) => val(r.apron_area_category).toLowerCase() === row.id), `GSE Category: ${row.label}`)} />
              </Panel>

              <Panel
                title="Airline Reports"
                total={airline2025Rows.reduce((s, r) => s + r.total, 0)}
                aiContext={{ section: 'GSE Performance 2025', chartTitle: 'Airline Involvement 2025', chartType: 'gse_2025_airline', chartData: airline2025Rows.map((r) => ({ name: r.label, total: r.total })), featureHints: ['riskScoring', 'rootCause', 'actionRecommendation'] }}
              >
                <BarList rows={airline2025Rows} emptyLabel="No airline data" onOpen={(row) => openDrilldown(gse2025Reports.filter((r) => (val(r.airlines) || val(r.airline)).toLowerCase() === row.id), `Airline: ${row.label}`)} />
              </Panel>

              <Panel
                title="Station Reports"
                total={branch2025Rows.reduce((s, r) => s + r.total, 0)}
                aiContext={{ section: 'GSE Performance 2025', chartTitle: 'Station Exposure 2025', chartType: 'gse_2025_station', chartData: branch2025Rows.map((r) => ({ name: r.label, total: r.total })), featureHints: ['riskScoring', 'summarization', 'actionRecommendation'] }}
              >
                <BarList rows={branch2025Rows} emptyLabel="No station data" onOpen={(row) => openDrilldown(gse2025Reports.filter((r) => (val(r.branch) || val(r.station_code) || val(r.branch_code)).toLowerCase() === row.id), `Station: ${row.label}`)} />
              </Panel>
            </div>
          </section>

          {}
          <section>
            <div className="sr-section-h">
              <span className="sr-section-rule" aria-hidden="true" />
              <h2>Monthly Reports</h2>
            </div>
            <Panel
              title="GSE Monthly Report"
              subtitle="2025 — click any bar to drill into records"
              total={grand2025}
              aiContext={{ section: 'GSE Performance 2025', chartTitle: 'Monthly GSE Trend 2025', chartType: 'gse_2025_monthly_trend', chartData: month2025Rows.map((r) => ({ month: r.month, total: r.total })), featureHints: ['summarization', 'rootCause'] }}
            >
              <MonthBarChart rows={month2025Rows} onOpen={(items, ctx) => openDrilldown(items, ctx)} />
            </Panel>
          </section>
        </>
      )}

      {DrilldownRenderer()}
    </div>
  );
}
