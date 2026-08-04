'use client';

/**
 * Shared visual primitives for the "AI Summary & Insight" Wawasan tab.
 * Flat, high-contrast, data-first — one card per ml-service capability,
 * no decorative gradients/glass. Emerald is the only accent color, used
 * solely for active/positive states so it never competes with the
 * semantic rose (warn) / amber (mid) colors used in the data itself.
 */

import { cn } from '@/lib/utils';

export const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
export const KICKER = 'text-[11px] font-bold uppercase tracking-wide text-slate-900';
export const CAPTION = 'text-[12.5px] text-slate-600 leading-relaxed';
export const BODY = 'text-[13.5px] text-slate-700 leading-relaxed';

export function Section({
  title, right, children, className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(CARD, 'p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={KICKER}>{title}</p>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function NewBadge() {
  return <span className="text-[10px] font-bold text-emerald-700">✦ baru</span>;
}

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="text-[22px] font-extrabold text-slate-900 tabular-nums leading-tight break-words">{value}</p>
      <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
    </div>
  );
}

export function SegmentedControl<K extends string>({
  options, active, onChange,
}: {
  options: readonly { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-1">
      {options.map((opt) => {
        const on = opt.key === active;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt.key)}
            className={cn(
              'rounded-md border-0 px-3 py-1.5 text-[11.5px] font-bold transition-colors',
              on ? 'bg-white text-emerald-700 shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SeverityChip({ label, score }: { label: string; score: number }) {
  const tone =
    score >= 0.78 ? 'text-rose-700 bg-rose-50 border-rose-200'
    : score >= 0.58 ? 'text-amber-800 bg-amber-50 border-amber-200'
    : 'text-slate-700 bg-slate-50 border-slate-200';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-bold', tone)}>
      {label}
    </span>
  );
}

export function InlineNote({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn(CAPTION, 'mt-4 border-t border-slate-100 pt-3')}>{children}</p>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className={CAPTION}>{children}</p>;
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn(CARD, 'animate-pulse bg-slate-100', className)} />;
}
