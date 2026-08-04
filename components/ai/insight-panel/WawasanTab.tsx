'use client';

import { useMemo } from 'react';
import { type MLOverview } from '@/components/ai/ml-overview-sections';
import { buildExecutiveSummaryEn } from './format';
import { CARD, SkeletonCard } from './primitives';
import { KeyFigures } from './KeyFigures';
import { ForecastChartCard } from './ForecastChartCard';
import { SeasonalityCard } from './SeasonalityCard';
import { RiskLeaderboardCard } from './RiskLeaderboardCard';
import { DimensionForecastCard } from './DimensionForecastCard';
import { CaseRecurrenceCard } from './CaseRecurrenceCard';

function WawasanSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonCard className="h-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
      </div>
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-56" />
      <p className="pt-1 text-center text-[12px] text-slate-500">
        Analyzing report patterns across all stations · usually &lt; 15 seconds
      </p>
    </div>
  );
}

function WawasanError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${CARD} p-8 text-center`}>
      <p className="text-[13px] text-slate-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[12px] font-bold text-emerald-800 hover:bg-emerald-100"
      >
        Try again
      </button>
    </div>
  );
}

export function WawasanTab({
  loading, error, data, onRetry,
}: {
  loading: boolean;
  error: string;
  data: MLOverview | null;
  onRetry: () => void;
}) {
  const sentences = useMemo(() => (data ? buildExecutiveSummaryEn(data) : []), [data]);

  if (loading) return <WawasanSkeleton />;
  if (error) return <WawasanError message={error} onRetry={onRetry} />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <KeyFigures data={data} sentences={sentences} />
      {data.forecast?.forecast?.length ? <ForecastChartCard forecast={data.forecast} /> : null}
      {data.seasonality ? <SeasonalityCard seasonality={data.seasonality} /> : null}
      {data.risk ? <RiskLeaderboardCard risk={data.risk} /> : null}
      <DimensionForecastCard data={data} />
      {data.caseRecurrence ? <CaseRecurrenceCard recurrence={data.caseRecurrence} /> : null}
    </div>
  );
}
