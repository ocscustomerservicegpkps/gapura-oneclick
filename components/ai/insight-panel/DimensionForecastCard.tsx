'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildCacheKey, readClientCache, writeClientCache } from '@/lib/ai/client-cache';
import { isNotable, signedChange, type MLOverview } from '@/components/ai/ml-overview-sections';
import type { DimensionForecastResult } from '@/lib/ml-client';
import { fmtSignedPct, trendGlyphEn, trendWordEn } from './format';
import { CAPTION, EmptyNote, InlineNote, Section, SegmentedControl, StatTile } from './primitives';

const DIM_TABS = [
  { key: 'airline', label: 'Airline' },
  { key: 'branch', label: 'Station' },
  { key: 'area', label: 'Area' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Area Category' },
  { key: 'case_classification', label: 'Case Classification' },
] as const;
type DimKey = (typeof DIM_TABS)[number]['key'];

// branch/category/case_classification come with a ranked-volume + range forecast
// (reportCounts); airline/area/subcategory come with a per-dimension trend forecast
// (dimForecast) instead. Each tab only ever pulls from one of the two sources.
const REPORT_COUNT_DIMS = new Set<DimKey>(['branch', 'category', 'case_classification']);

const FORECAST_CACHE_TTL_MS = 15 * 60 * 1000;

type Row = {
  entity: string;
  predictedTotal: number;
  lo?: number;
  hi?: number;
  trendDirection: 'rising' | 'falling' | 'stable';
  changePct?: number;
};

export function DimensionForecastCard({ data }: { data: MLOverview }) {
  const availableTabs = useMemo(
    () => DIM_TABS.filter((t) => {
      if (REPORT_COUNT_DIMS.has(t.key)) {
        return (data.reportCounts?.forecasts?.[t.key]?.forecasts?.length ?? 0) > 0;
      }
      const trend = data.trends[t.key as Exclude<DimKey, 'case_classification'>];
      const hasMovers = ((trend?.rising ?? []).filter(isNotable).length + (trend?.falling ?? []).filter(isNotable).length) > 0;
      const eager = t.key === 'subcategory' ? data.subcategoryForecast : null;
      return hasMovers || (eager?.forecasts?.length ?? 0) > 0;
    }),
    [data],
  );

  const [tab, setTab] = useState<DimKey>('branch');
  const active: DimKey = availableTabs.some((t) => t.key === tab) ? tab : (availableTabs[0]?.key ?? 'branch');

  // On-demand fetch for the two dimension-forecast tabs not already in the overview payload.
  const [lazyForecasts, setLazyForecasts] = useState<Partial<Record<'airline' | 'area', DimensionForecastResult | null>>>({});
  const [loadingDim, setLoadingDim] = useState<DimKey | null>(null);

  useEffect(() => {
    if (active !== 'airline' && active !== 'area') return;
    if (lazyForecasts[active] !== undefined) return;

    const cacheKey = buildCacheKey('forecast-by-dimension', active);
    const cached = readClientCache<DimensionForecastResult>(cacheKey, FORECAST_CACHE_TTL_MS);
    if (cached) {
      setLazyForecasts((prev) => ({ ...prev, [active]: cached }));
      return;
    }

    let cancelled = false;
    setLoadingDim(active);
    fetch(`/api/ai/forecast/by-dimension?dimension=${active}&weeks=4`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: DimensionForecastResult | null) => {
        if (cancelled) return;
        setLazyForecasts((prev) => ({ ...prev, [active]: json }));
        if (json) writeClientCache(cacheKey, json);
      })
      .catch(() => {
        if (!cancelled) setLazyForecasts((prev) => ({ ...prev, [active]: null }));
      })
      .finally(() => {
        if (!cancelled) setLoadingDim((cur) => (cur === active ? null : cur));
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const trend = active === 'case_classification' ? null : data.trends[active as Exclude<DimKey, 'case_classification'>];
  const changeByEntity = useMemo(() => {
    const map = new Map<string, number>();
    [...(trend?.rising ?? []), ...(trend?.falling ?? [])].filter(isNotable).forEach((e) => {
      map.set(e.entity, signedChange(e));
    });
    return map;
  }, [trend]);

  let rows: Row[] = [];
  let totalForecast: number | null = null;
  let periodLabel = 'weeks';
  let nPeriods = 4;
  let loading = false;

  if (REPORT_COUNT_DIMS.has(active)) {
    const dim = data.reportCounts?.forecasts?.[active];
    nPeriods = dim?.n_periods ?? 4;
    periodLabel = dim?.granularity === 'monthly' ? 'months' : 'weeks';
    totalForecast = dim?.total_forecast?.predicted_total ?? null;
    rows = (dim?.forecasts ?? [])
      .filter((e) => e.entity.toLowerCase() !== 'other')
      .map((e) => {
        const lo = e.forecast.reduce((s, p) => s + (p.lower ?? p.predicted_count), 0);
        const hi = e.forecast.reduce((s, p) => s + (p.upper ?? p.predicted_count), 0);
        return {
          entity: e.entity, predictedTotal: e.predicted_total, lo, hi,
          trendDirection: e.trend_direction, changePct: changeByEntity.get(e.entity),
        };
      })
      .sort((a, b) => b.predictedTotal - a.predictedTotal)
      .slice(0, 8);
  } else {
    const eager = active === 'subcategory' ? data.subcategoryForecast : null;
    const dimForecast = eager ?? lazyForecasts[active as 'airline' | 'area'] ?? null;
    loading = loadingDim === active;
    nPeriods = dimForecast?.n_weeks ?? 4;
    periodLabel = 'weeks';
    rows = (dimForecast?.forecasts ?? [])
      .filter((e) => e.entity.toLowerCase() !== 'other')
      .map((e) => ({
        entity: e.entity, predictedTotal: e.predicted_total,
        trendDirection: e.trend_direction, changePct: changeByEntity.get(e.entity),
      }))
      .sort((a, b) => b.predictedTotal - a.predictedTotal)
      .slice(0, 8);
  }

  const maxTotal = Math.max(...rows.map((r) => r.predictedTotal), 1);

  if (availableTabs.length === 0) return null;

  return (
    <Section
      title={`Forecast by Dimension · ${nPeriods} ${periodLabel}`}
      right={<SegmentedControl<DimKey> options={availableTabs} active={active} onChange={setTab} />}
    >
      <p className={cn(CAPTION, '-mt-1 mb-3')}>
        Predicted volume per entity, ranked highest first. The % badge flags entities whose recent change is large enough to be notable.
      </p>

      {totalForecast != null && (
        <div className="mb-4">
          <StatTile value={String(Math.round(totalForecast))} label={`Total forecast · ${nPeriods} ${periodLabel}`} />
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <EmptyNote>Not enough signal yet for this dimension.</EmptyNote>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((row, idx) => (
            <li key={row.entity} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 tabular-nums">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-[12.5px] font-semibold text-slate-900">{row.entity}</p>
                  {row.changePct !== undefined && (
                    <span className={cn('shrink-0 text-[11px] font-bold tabular-nums', row.changePct > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {row.changePct > 0 ? '▲' : '▼'} {fmtSignedPct(row.changePct)}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, (row.predictedTotal / maxTotal) * 100)}%` }} />
                </div>
                <p className={cn(CAPTION, 'mt-1 flex items-center gap-1')}>
                  {trendGlyphEn(row.trendDirection)} {trendWordEn(row.trendDirection)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] font-bold tabular-nums text-slate-900">{Math.round(row.predictedTotal)}</p>
                {row.lo !== undefined && row.hi !== undefined && (
                  <p className="text-[10.5px] tabular-nums text-slate-600">{Math.round(row.lo)}–{Math.round(row.hi)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <InlineNote>The large number is the main estimate; the range below it (when shown) is the likely minimum–maximum.</InlineNote>
    </Section>
  );
}
