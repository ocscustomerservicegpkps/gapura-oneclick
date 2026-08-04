'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { riskEntityName } from '@/components/ai/ml-overview-sections';
import type { RiskScoreResult } from '@/lib/ml-client';
import { fmtNumberEn, momentumLabelEn, momentumToneEn, severityLabelEn } from './format';
import { CAPTION, EmptyNote, InlineNote, Section, SegmentedControl, SeverityChip } from './primitives';

const RISK_TABS = [
  { key: 'airline', label: 'Airline' },
  { key: 'branch', label: 'Station' },
  { key: 'area', label: 'Area' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Area Category' },
  { key: 'case_classification', label: 'Case Classification' },
] as const;
type RiskTabKey = (typeof RISK_TABS)[number]['key'];

export function RiskLeaderboardCard({ risk }: { risk: RiskScoreResult }) {
  const tabs = useMemo(() => RISK_TABS.filter((t) => (risk.rankings?.[t.key]?.length ?? 0) > 0), [risk]);
  const [tab, setTab] = useState<RiskTabKey>('airline');
  const active: RiskTabKey = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? 'airline');
  const entries = (risk.rankings?.[active] ?? []).slice(0, 8);
  const showSeverity = entries.some((e) => typeof e.severity === 'number');

  return (
    <Section
      title="Priority Leaderboard"
      right={tabs.length > 0 ? <SegmentedControl<RiskTabKey> options={tabs} active={active} onChange={setTab} /> : undefined}
    >
      <p className={cn(CAPTION, '-mt-1 mb-3')}>Ranked by a blend of report volume, severity, recent momentum, and last-30-day activity. The top of the list needs the most attention.</p>
      {entries.length === 0 ? (
        <EmptyNote>No ranking data yet.</EmptyNote>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry, idx) => {
            const sev = typeof entry.severity === 'number' ? entry.severity : null;
            const mom = typeof entry.momentum === 'number' ? entry.momentum : null;
            return (
              <li key={riskEntityName(entry)} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                      idx === 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-900">{riskEntityName(entry)}</p>
                    <p className={cn(CAPTION, 'mt-0.5')}>
                      {fmtNumberEn(entry.incident_count)} reports
                      {typeof entry.recent_30d === 'number' ? ` · ${entry.recent_30d} in the last 30 days` : ''}
                      {mom != null ? ` · ${momentumLabelEn(mom)}` : ''}
                    </p>
                  </div>
                </div>
                {showSeverity && sev != null && <SeverityChip label={severityLabelEn(sev)} score={sev} />}
                {mom != null && !showSeverity && (
                  <span className={cn('shrink-0 text-[11.5px] font-bold', momentumToneEn(mom))}>{momentumLabelEn(mom)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <InlineNote>
        Total reports counts everything since records began; &quot;last 30 days&quot; reflects recent activity.
      </InlineNote>
    </Section>
  );
}
