'use client';

import { useState, type ReactNode, type ComponentProps } from 'react';
import {
  ResponsiveContainer as RechartsResponsiveContainer,
} from 'recharts';
import { ChartAiAnalysisButton, type ChartAiContext } from '@/components/dashboard/ai/ChartAiAnalysisButton';

export const REFERENCE_COLORS = {
  irregularity: 'oklch(0.65 0.18 160)',
  complaint: 'oklch(0.6 0.14 240)',
  compliment: 'oklch(0.8 0.15 80)',
  trend: 'oklch(0.65 0.18 160)',
  neutral: 'oklch(0.55 0.02 250)',
};

export const CHART_PALETTE = [
  'oklch(0.65 0.18 160)',
  'oklch(0.6 0.14 240)',
  'oklch(0.7 0.2 330)',
  'oklch(0.8 0.15 80)',
  'oklch(0.6 0.2 25)',
  'oklch(0.75 0.1 190)',
];

export function ResponsiveContainer(props: ComponentProps<typeof RechartsResponsiveContainer>) {
  return (
    <RechartsResponsiveContainer
      {...props}
      minWidth={props.minWidth ?? 1}
      minHeight={props.minHeight ?? 1}
    />
  );
}

export const WrappedYAxisTick = (props: { x?: number; y?: number; payload?: { value?: unknown } }) => {
  const { x, y, payload } = props;
  const words = String(payload?.value ?? '').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = 20;

  words.forEach((word: string) => {
    if ((currentLine + word).length > maxLineLength) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={-12}
          y={i * 11}
          dy={-((lines.length - 1) * 5.5)}
          textAnchor="end"
          fill="var(--text-primary)"
          fontSize={10}
          fontWeight={700}
          className="tracking-tighter"
        >
          {line}
        </text>
      ))}
    </g>
  );
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[oklch(1_0_0_/_0.8)] backdrop-blur-xl p-4 border border-[oklch(1_0_0_/_0.1)] shadow-2xl rounded-2xl min-w-[140px] animate-scale-in">
      {label && <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3 border-b border-[oklch(0_0_0_/_0.05)] pb-1.5">{label}</p>}
      <div className="space-y-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: entry.fill || entry.color || '#10b981' }}
              />
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                {entry.name || 'Value'}
              </span>
            </div>
            <span className="text-[11px] font-black text-[var(--text-primary)]">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function heatColor(value: number, max: number): { bg: string; fg: string } {
  if (value === 0 || max === 0) return { bg: 'transparent', fg: 'var(--text-muted)' };
  const ratio = Math.min(1, Math.max(0, value / max));
  const l = 0.95 - (0.45 * ratio);
  const c = 0.03 + (0.17 * ratio);
  const h = 160;
  return {
    bg: `oklch(${l} ${c} ${h})`,
    fg: l < 0.65 ? '#ffffff' : '#0f172a',
  };
}

export function ChartCard({
  title,
  subtitle,
  accent,
  className,
  aiContext,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  className?: string;
  aiContext?: ChartAiContext;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        'card-glass p-4 sm:p-6 group transition-all duration-500 hover:shadow-2xl flex flex-col min-w-0',
        accent ? 'border-t-2' : '',
        className ?? '',
      ].join(' ')}
      style={accent ? { borderTopColor: accent } : undefined}
    >
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">{title}</h3>
          {subtitle && <p className="mt-2 text-[10px] font-medium text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
      </div>
      {children}
    </div>
  );
}

export function HeatmapTableCard({
  title,
  subtitle,
  accent,
  className,
  aiContext,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  className?: string;
  aiContext?: ChartAiContext;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        'card-glass p-4 sm:p-6 group transition-all duration-500 hover:shadow-2xl overflow-x-auto overflow-y-hidden min-w-0',
        accent ? 'border-t-2' : '',
        className ?? '',
      ].join(' ')}
      style={accent ? { borderTopColor: accent } : undefined}
    >
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-70">{title}</h3>
          {subtitle && <p className="mt-2 text-[10px] font-medium text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {aiContext ? <ChartAiAnalysisButton context={aiContext} /> : null}
      </div>
      {children}
    </div>
  );
}

const PAGE_SIZE = 5;

export function CategoryBarList({ data, color = '#4ade80', title, onClick }: { data: readonly { name: string; value: number }[]; color?: string; title?: string; onClick?: (item: { name: string; value: number }) => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  // Clamp instead of trusting `page` directly — if a filter change shrinks
  // `data` while the user is on a later page, an unclamped index would slice
  // past the end and render an empty page instead of the last valid one.
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = data.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const maxValue = data[0]?.value || 1;
  const startIdx = safePage * PAGE_SIZE + 1;
  const endIdx = Math.min((safePage + 1) * PAGE_SIZE, data.length);

  return (
    <div>
      {title && <h3 className="font-semibold text-[13px] tracking-tight text-slate-900 mb-3">{title}</h3>}
      <div className="space-y-2">
        {pageItems.map((item) => (
          <div 
            key={item.name} 
            className={`flex items-center gap-2 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition-colors rounded-sm p-1 -mx-1' : ''}`}
            onClick={() => onClick?.(item)}
          >
            <span className="text-[11px] font-medium text-slate-600 w-[100px] sm:w-[140px] shrink-0 whitespace-normal break-words leading-tight" title={item.name}>
              {item.name}
            </span>
            <div className="flex-1 flex items-center gap-1.5">
              <div className="flex-1 bg-slate-100 rounded-sm h-3.5 overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 w-7 text-right shrink-0">
                {item.value}
              </span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No data</p>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="text-[10px] text-gray-500">
            {startIdx}&ndash;{endIdx} / {data.length}
          </span>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function formatStatusValue(value: number) {
  return value > 0 ? value.toLocaleString() : '-';
}

export function normalizeStatusKey(status: string | undefined | null): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'CLOSED') return 'closed';
  if (normalized === 'OPEN') return 'open';
  return 'onProgress';
}

export const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  CLOSED: { bg: 'oklch(0.92 0.08 145 / 0.9)', fg: 'oklch(0.38 0.12 145)', label: 'Closed' },
  OPEN: { bg: 'oklch(0.93 0.07 25 / 0.9)', fg: 'oklch(0.45 0.14 25)', label: 'Open' },
  'ON PROGRESS': { bg: 'oklch(0.94 0.07 80 / 0.9)', fg: 'oklch(0.42 0.12 80)', label: 'On Progress' },
};

export function StatusBadge({ status }: { status: string | undefined }) {
  const key = String(status || '').trim().toUpperCase();
  const cfg = STATUS_BADGE[key] || STATUS_BADGE['ON PROGRESS'];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  progress,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="card-glass p-4 sm:p-5 group transition-all duration-500 hover:shadow-2xl flex items-center gap-3 sm:gap-4 min-w-0">
      <div
        className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0"
        style={{ backgroundColor: accent }}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] truncate">{label}</p>
        <p className="text-lg sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">{value}</p>
        {progress !== undefined && (
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-[oklch(0_0_0_/_0.06)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: accent }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function renderPieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
  percent,
}: {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  outerRadius?: number | string;
  name?: string;
  value?: number;
  percent?: number;
}) {
  const RADIAN = Math.PI / 180;
  const cxNum = Number(cx || 0);
  const cyNum = Number(cy || 0);
  const radius = Number(outerRadius || 0) + 18;
  const x = cxNum + radius * Math.cos(-(midAngle || 0) * RADIAN);
  const y = cyNum + radius * Math.sin(-(midAngle || 0) * RADIAN);
  const anchor = x > cxNum ? 'start' : 'end';
  const shortName = String(name || '').length > 16 ? `${String(name || '').slice(0, 16)}…` : name || '';
  const pct = percent != null ? Math.round(percent * 100) : 0;

  return (
    <g>
      <text
        x={x}
        y={y - 6}
        fill="var(--text-primary)"
        textAnchor={anchor}
        dominantBaseline="central"
        style={{ fontSize: 10, fontWeight: 800 }}
      >
        {shortName}
      </text>
      <text
        x={x}
        y={y + 7}
        fill="var(--text-muted)"
        textAnchor={anchor}
        dominantBaseline="central"
        style={{ fontSize: 9, fontWeight: 700 }}
      >
        {`${value} (${pct}%)`}
      </text>
    </g>
  );
}

export const PIE_LABEL_LINE_PROPS = {
  stroke: 'oklch(0.68 0.12 180 / 0.7)',
  strokeWidth: 1,
};

const DETAIL_PAGE_SIZE = 10;

export function DetailReportTable<T extends Record<string, unknown>>({
  data,
  columns,
  statusKey,
}: {
  data: T[];
  columns: Array<{ key: string; label: string; minWidth?: string }>;
  statusKey?: string;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / DETAIL_PAGE_SIZE);
  // Clamp instead of trusting `page` directly — if a filter change shrinks
  // `data` while the user is on a later page, an unclamped index would slice
  // past the end and render an empty page instead of the last valid one.
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = data.slice(safePage * DETAIL_PAGE_SIZE, (safePage + 1) * DETAIL_PAGE_SIZE);
  const startIdx = safePage * DETAIL_PAGE_SIZE + 1;
  const endIdx = Math.min((safePage + 1) * DETAIL_PAGE_SIZE, data.length);

  if (data.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">No data</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="max-h-[260px] sm:max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs" style={{ minWidth: columns.length > 6 ? '1200px' : 'auto' }}>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-gray-200">
                {columns.map(col => (
                  <th key={col.key} className="text-left py-1.5 px-2 font-semibold text-gray-700 whitespace-nowrap" style={col.minWidth ? { minWidth: col.minWidth } : undefined}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                  {columns.map(col => {
                    const val = row[col.key];
                    if (statusKey && col.key === statusKey) {
                      return (
                        <td key={col.key} className="py-1.5 px-2 whitespace-nowrap">
                          <StatusBadge status={val as string} />
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className="py-1.5 px-2 text-gray-700" style={col.minWidth ? { minWidth: col.minWidth } : undefined}>
                        <p className="whitespace-pre-wrap break-words leading-snug">{val != null ? String(val) : '-'}</p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-500">
            {startIdx}&ndash;{endIdx} / {data.length} records
          </span>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[10px] font-semibold text-gray-600 tabular-nums">Page {safePage + 1} / {totalPages}</span>
            <button className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
