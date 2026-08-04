'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for embed "chart detail" pages, styled to match the
 * customer-feedback dashboard's cf-* design language (warm paper canvas, teal
 * accent, cf-card bento tiles). Import into any ReportDetail component instead
 * of hand-rolling section wrappers / KPI cards / tables per page.
 */

export type ReportTone = 'teal' | 'amber' | 'coral' | 'lime' | 'slate';

const TONE_ACCENT: Record<ReportTone, string> = {
  teal: 'var(--cf-teal)',
  amber: 'var(--cf-amber)',
  coral: 'var(--cf-coral)',
  lime: 'var(--cf-lime)',
  slate: 'var(--cf-slate)',
};

const TONE_TINT: Record<ReportTone, string> = {
  teal: 'var(--cf-teal-tint)',
  amber: '#fef3c7',
  coral: '#fee2e2',
  lime: '#ecfccb',
  slate: '#f1ecdd',
};

/* -------------------------------------------------------------------- */
/* Section wrapper — numbered editorial eyebrow + cf-card body           */
/* -------------------------------------------------------------------- */

export function ReportSection({
  index,
  title,
  subtitle,
  tone = 'teal',
  actions,
  children,
  className,
  bodyClassName,
}: {
  index?: number | string;
  title: string;
  subtitle?: string;
  tone?: ReportTone;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="cf-eyebrow">
          {index !== undefined && (
            <span className="cf-eyebrow-idx">
              {typeof index === 'number' ? String(index).padStart(2, '0') : index}
            </span>
          )}
          <span>{title}</span>
          <span className="cf-eyebrow-rule" />
        </div>
        {actions}
      </div>
      {subtitle && (
        <p className="-mt-2 text-[11px] font-medium leading-relaxed text-[var(--cf-ink-3)]">
          {subtitle}
        </p>
      )}
      <div
        className={cn('cf-card p-4 sm:p-5', bodyClassName)}
        style={{ '--cf-spine': TONE_ACCENT[tone] } as CSSProperties}
      >
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- */
/* Stat / KPI card                                                       */
/* -------------------------------------------------------------------- */

export function ReportStatCard({
  label,
  value,
  subtitle,
  trend,
  tone = 'teal',
  className,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  tone?: ReportTone;
  className?: string;
}) {
  const accent = TONE_ACCENT[tone];
  const tint = TONE_TINT[tone];
  return (
    <div
      className={cn('cf-card min-w-0 p-4', className)}
      style={{ '--cf-spine': accent } as CSSProperties}
    >
      <div className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[var(--cf-ink-3)]">
        {label}
      </div>
      <div className="cf-display cf-tabular mt-1 truncate text-2xl font-semibold leading-none text-[var(--cf-ink)] sm:text-[26px]">
        {value}
      </div>
      {subtitle && (
        <div className="mt-1.5 truncate text-[10px] font-semibold text-[var(--cf-ink-2)]">
          {subtitle}
        </div>
      )}
      {trend !== undefined && (
        <div
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: tint, color: accent }}
        >
          {trend > 0 ? <ArrowUp size={10} /> : trend < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Compact, responsive data table (replaces bespoke wide tables)         */
/* -------------------------------------------------------------------- */

export interface CompactColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  /** Hide this column below the given breakpoint to avoid horizontal scroll on small screens */
  hideBelow?: 'sm' | 'md' | 'lg';
  render?: (row: T) => ReactNode;
}

export function CompactTable<T extends object>({
  columns,
  rows,
  rowKey,
  maxRows,
  emptyLabel = 'No data available',
  className,
}: {
  columns: CompactColumn<T>[];
  rows: T[];
  rowKey?: keyof T;
  maxRows?: number;
  emptyLabel?: string;
  className?: string;
}) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;

  const alignClass = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
  const hideClass = (h?: 'sm' | 'md' | 'lg') =>
    h === 'sm' ? 'hidden sm:table-cell' : h === 'md' ? 'hidden md:table-cell' : h === 'lg' ? 'hidden lg:table-cell' : '';

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-[var(--cf-line)]', className)}>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-[11px] sm:text-[12px]">
          <thead>
            <tr className="border-b border-[var(--cf-line)] bg-[var(--cf-canvas-2)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--cf-ink-3)]',
                    alignClass(col.align),
                    hideClass(col.hideBelow),
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--cf-line-soft)]">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[11px] italic text-[var(--cf-ink-3)]">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => {
                const record = row as Record<string, unknown>;
                return (
                  <tr
                    key={rowKey ? String(record[rowKey as string]) : i}
                    className="transition-colors hover:bg-[var(--cf-teal-tint)]/60"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-2.5 py-2 font-medium text-[var(--cf-ink-2)]',
                          col.numeric && 'cf-tabular',
                          alignClass(col.align),
                          hideClass(col.hideBelow),
                        )}
                      >
                        {col.render ? col.render(row) : String((record[col.key] as ReactNode) ?? '-')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Loading / error states                                                */
/* -------------------------------------------------------------------- */

export function ReportLoading({ label = 'Loading report…' }: { label?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--cf-teal)] border-t-transparent" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--cf-ink-3)]">{label}</span>
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <div className="text-sm font-semibold text-[var(--cf-coral)]">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="cf-btn cf-btn-primary px-4 py-2">
          Retry
        </button>
      )}
    </div>
  );
}
