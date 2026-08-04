'use client';

import { cn } from '@/lib/utils';
import type { ReportCountDimension } from '@/lib/ml-client';
import { InlineNote, Section } from './primitives';

export function CaseRecurrenceCard({ recurrence }: { recurrence: ReportCountDimension }) {
  const entries = (recurrence.forecasts ?? [])
    .filter((e) => e.entity.toLowerCase() !== 'other')
    .sort((a, b) => (b.prob_appear_next ?? 0) - (a.prob_appear_next ?? 0))
    .slice(0, 8);
  if (entries.length === 0) return null;
  const perLabel = recurrence.granularity === 'monthly' ? 'month' : 'week';
  const perLabelPlural = recurrence.granularity === 'monthly' ? 'months' : 'weeks';

  return (
    <Section title="Cases Likely to Recur">
      <ul className="divide-y divide-slate-100">
        {entries.map((e) => {
          const prob = e.prob_appear_next ?? 0;
          const probPct = Math.round(prob * 100);
          const tone = prob >= 0.7 ? 'bg-rose-50 text-rose-700' : prob >= 0.4 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700';
          return (
            <li key={e.entity} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">{e.entity}</span>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', tone)}>{probPct}%</span>
            </li>
          );
        })}
      </ul>
      <InlineNote>
        Likelihood this case classification appears at least once in the next {recurrence.n_periods} {recurrence.n_periods === 1 ? perLabel : perLabelPlural}. &gt;70% = almost certain to recur.
      </InlineNote>
    </Section>
  );
}
