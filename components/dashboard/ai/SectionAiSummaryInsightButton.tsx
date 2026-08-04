'use client';

/**
 * "AI Summary & Insight" button — opens a side sheet with two tabs:
 *
 *  - Ringkasan : summary of the CURRENT section tab. The dashboard sends
 *                named datasets (per-month, per-station, YoY, …) to
 *                POST /api/ai/section-summary; every number displayed is
 *                computed server-side from the real data, and the LLM only
 *                writes the narrative around those facts.
 *  - Wawasan   : network-wide analysis from the Gapura ML Service, one
 *                section per ml-service capability (forecast, seasonality,
 *                risk score, trends, dimension forecasts, report-count
 *                forecast, case recurrence, model health, text analysis).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { buildCacheKey, readClientCache, writeClientCache } from '@/lib/ai/client-cache';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMLOverview } from '@/components/ai/ml-overview-sections';
import { WawasanTab, ModelHealthPill } from '@/components/ai/insight-panel';
import { CARD, KICKER, CAPTION } from '@/components/ai/insight-panel/primitives';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionDatasetInput = {
  id: string;
  name: string;
  unit?: string;
  /** 'timeseries' | 'ranking' | 'comparison' — loose so tabs can pass literals. */
  kind: string;
  description?: string;
  rows: Array<{
    label: string;
    value: number;
    delta?: number;
    note?: string;
    breakdown?: Record<string, number>;
  }>;
};

type SectionAiContext = {
  section: string;
  title: string;
  chartType: string;
  /** Preferred: named datasets so incomparable numbers stay separate. */
  datasets?: SectionDatasetInput[];
  /** Legacy flat rows — still accepted by the API. */
  chartData?: unknown;
  featureHints?: string[];
  filters?: Record<string, unknown>;
};

type SummaryDatasetRow = { label: string; value: number; sharePct: number; delta?: number; note?: string };

type SummaryDataset = {
  id: string;
  name: string;
  unit: string;
  kind: string;
  total: number;
  headline: string;
  rows: SummaryDatasetRow[];
  narrative: string;
};

type SummaryRecommendation = {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
};

export type SectionSummaryResponse = {
  status: string;
  cached?: boolean;
  generatedAt: string;
  section: string;
  executiveSummary: string;
  keyPoints: string[];
  datasets: SummaryDataset[];
  recommendations: SummaryRecommendation[];
  predictiveSummary: string;
};

const SUMMARY_CACHE_NS = 'section-summary-v2';
// The cacheKey already encodes the exact data snapshot (datasets/chartData),
// so a long TTL is safe — a different filter/data state gets its own key
// rather than reusing a stale one.
const SUMMARY_CACHE_TTL_MS = 60 * 60 * 1000;

function stableKey(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '—';
}

// ---------------------------------------------------------------------------
// Ringkasan — shared building blocks
// ---------------------------------------------------------------------------

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className={cn(CARD, 'h-32 animate-pulse bg-slate-100')} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className={cn(CARD, 'h-52 animate-pulse bg-slate-100')} />
        <div className={cn(CARD, 'h-52 animate-pulse bg-slate-100')} />
      </div>
      <div className={cn(CARD, 'h-40 animate-pulse bg-slate-100')} />
      <p className="text-center text-[12px] text-slate-500">
        AI is reading and summarizing this section&apos;s data — please wait a moment…
      </p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={cn(CARD, 'p-8 text-center')}>
      <p className="break-words text-[13px] text-slate-600">{message}</p>
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

/** Signed change badge — rising incident counts are bad (rose), falling good (emerald). */
function DeltaBadge({ delta }: { delta: number }) {
  const rising = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
        flat ? 'bg-slate-100 text-slate-500' : rising ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
      )}
    >
      {flat ? '±0%' : `${rising ? '▲' : '▼'} ${Math.abs(delta)}%`}
    </span>
  );
}

/** Ranked horizontal bars — emerald throughout, gold reserved for the #1 leader. */
function RankedBars({ dataset }: { dataset: SummaryDataset }) {
  const rows = dataset.rows.slice(0, 8);
  const max = Math.max(...rows.map((row) => row.value), 1);
  // Share-of-total only makes sense when rows partition one whole.
  const showShare = dataset.kind === 'ranking';

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 break-words text-[13px] font-semibold text-slate-800">
              {row.label}
              {row.delta !== undefined && <DeltaBadge delta={row.delta} />}
            </p>
            <p className="shrink-0 text-[12px] font-bold tabular-nums text-slate-600">
              {formatNumber(row.value)}
              {showShare && row.sharePct > 0 && (
                <span className="ml-1.5 font-semibold text-slate-400">{row.sharePct}%</span>
              )}
            </p>
          </div>
          {row.note ? (
            <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">{row.note}</p>
          ) : null}
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                index === 0 ? 'bg-amber-500' : 'bg-emerald-600',
              )}
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chronological mini column chart for per-month datasets. */
function MonthlyColumns({ dataset }: { dataset: SummaryDataset }) {
  const rows = dataset.rows;
  const maxValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={0}
            tickFormatter={(label: string) => label.slice(0, 3)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(5,150,105,0.08)' }}
            contentStyle={{
              fontSize: 12,
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              background: '#fff',
            }}
            formatter={(value: number) => [`${formatNumber(value)} ${dataset.unit}`, 'Amount']}
          />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={false}>
            {rows.map((row, index) => (
              <Cell
                key={`${row.label}-${index}`}
                fill={row.value === maxValue && maxValue > 0 ? '#d97706' : '#059669'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DatasetCard({ dataset }: { dataset: SummaryDataset }) {
  return (
    <div className={cn(CARD, 'flex flex-col p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h4 className={KICKER}>{dataset.name}</h4>
        {/* Comparison rows may include their own "Total" row — summing them double-counts. */}
        {dataset.kind !== 'comparison' && (
          <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800">
            {formatNumber(dataset.total)} {dataset.unit}
          </span>
        )}
      </div>

      <p className="mt-3 break-words text-[13.5px] font-semibold leading-relaxed text-slate-900">
        {dataset.headline}
      </p>

      <div className="mt-4 flex-1">
        {dataset.kind === 'timeseries' && dataset.rows.length >= 3 ? (
          <MonthlyColumns dataset={dataset} />
        ) : (
          <RankedBars dataset={dataset} />
        )}
      </div>

      {dataset.narrative ? (
        <p className="mt-4 break-words border-l-2 border-slate-200 pl-3 text-[12.5px] leading-relaxed text-slate-500">
          {dataset.narrative}
        </p>
      ) : null}
    </div>
  );
}

const PRIORITY_STYLES: Record<SummaryRecommendation['priority'], { badge: string; label: string }> = {
  high: { badge: 'border-rose-200 bg-rose-50 text-rose-700', label: 'High Priority' },
  medium: { badge: 'border-amber-200 bg-amber-50 text-amber-800', label: 'Medium Priority' },
  low: { badge: 'border-slate-200 bg-slate-50 text-slate-600', label: 'Low Priority' },
};

function RecommendationCards({ items }: { items: SummaryRecommendation[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-slate-500">No recommendations for this section.</p>;
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...items].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));

  return (
    <div className="space-y-3">
      {sorted.map((rec, index) => {
        const style = PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.medium;
        return (
          <div
            key={`${rec.title}-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <p className="break-words text-[13.5px] font-bold text-slate-900">{rec.title}</p>
              <span className={cn('shrink-0 rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', style.badge)}>
                {style.label}
              </span>
            </div>
            <p className="mt-1.5 break-words text-[13px] leading-relaxed text-slate-600">{rec.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function KeyPointList({ items }: { items: string[] }) {
  const cleaned = items
    .map((item) => String(item ?? '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return <p className="text-[13px] text-slate-500">No notes for this section.</p>;
  }

  return (
    <ul className="space-y-3">
      {cleaned.slice(0, 6).map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
            {index + 1}
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Ringkasan tab
// ---------------------------------------------------------------------------

export function SummaryTab({
  loading, error, summary, onRetry,
}: {
  loading: boolean;
  error: string | null;
  summary: SectionSummaryResponse | null;
  onRetry: () => void;
}) {
  if (loading) return <SummarySkeleton />;
  if (error) return <ErrorCard message={error} onRetry={onRetry} />;
  if (!summary) return null;

  const datasets = summary.datasets ?? [];

  return (
    <div className="space-y-3">
      {/* Executive summary */}
      <div className={cn(CARD, 'p-5')}>
        <h4 className={KICKER}>Executive Summary</h4>
        <p className="mt-3 break-words text-[14px] leading-relaxed text-slate-800">
          {summary.executiveSummary}
        </p>
      </div>

      {/* One card per dataset — numbers computed from the dashboard data */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {datasets.map((dataset) => (
          <DatasetCard key={dataset.id} dataset={dataset} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className={cn(CARD, 'p-5')}>
          <h4 className={KICKER}>Key Points</h4>
          <div className="mt-4">
            <KeyPointList items={summary.keyPoints} />
          </div>
        </div>
        <div className={cn(CARD, 'p-5')}>
          <h4 className={KICKER}>Recommended Actions</h4>
          <div className="mt-4">
            <RecommendationCards items={summary.recommendations ?? []} />
          </div>
        </div>
      </div>

      <div className={cn(CARD, 'p-5')}>
        <h4 className={KICKER}>Looking Ahead</h4>
        <p className="mt-3 break-words text-[13.5px] leading-relaxed text-slate-700">
          {summary.predictiveSummary}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SectionAiSummaryInsightButton({ context }: { context: SectionAiContext }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'insight'>('summary');

  // Ringkasan: per-section summary. cacheKey encodes the exact data shown
  // (datasets + filters), so a filter change naturally gets its own cache
  // entry instead of reusing a stale one.
  const cacheKey = useMemo(() => stableKey(context), [context]);
  const storageKey = useMemo(() => buildCacheKey(SUMMARY_CACHE_NS, cacheKey), [cacheKey]);

  const [summary, setSummary] = useState<SectionSummaryResponse | null>(() =>
    readClientCache<SectionSummaryResponse>(storageKey, SUMMARY_CACHE_TTL_MS),
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // Which cacheKey `summary` currently reflects — lets a context change
  // (different filters/data) trigger a real refetch instead of showing stale data.
  const loadedKeyRef = useRef<string | null>(summary ? cacheKey : null);

  // Wawasan: network-wide ML overview (fetched only when the tab is opened)
  const overview = useMLOverview({ enabled: open && activeTab === 'insight' });

  const loadSummary = useCallback(async (force = false) => {
    if (!force && loadedKeyRef.current === cacheKey) return;

    if (!force) {
      const cached = readClientCache<SectionSummaryResponse>(storageKey, SUMMARY_CACHE_TTL_MS);
      if (cached) {
        loadedKeyRef.current = cacheKey;
        setSummary(cached);
        setSummaryError(null);
        return;
      }
    }

    loadedKeyRef.current = cacheKey;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch('/api/ai/section-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to generate AI summary (${response.status})`);
      writeClientCache(storageKey, payload);
      // Context may have changed while this request was in flight; a stale
      // response must not clobber the summary for the now-current context.
      if (loadedKeyRef.current !== cacheKey) return;
      setSummary(payload);
    } catch (error) {
      if (loadedKeyRef.current !== cacheKey) return;
      loadedKeyRef.current = null;
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate AI summary');
    } finally {
      if (loadedKeyRef.current === cacheKey || loadedKeyRef.current === null) setSummaryLoading(false);
    }
  }, [cacheKey, storageKey, context]);

  useEffect(() => {
    if (open && activeTab === 'summary') void loadSummary();
  }, [open, activeTab, loadSummary]);

  const refreshing = activeTab === 'summary' ? summaryLoading : overview.loading;
  const handleRefresh = () => {
    if (activeTab === 'summary') void loadSummary(true);
    else void overview.refresh(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-[11.5px] font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
      >
        AI Summary &amp; Insight
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(96vw,1040px)] overflow-y-auto bg-[#f8faf9] p-0 sm:max-w-[1040px]">
          {/* Header */}
          <div className="border-b border-slate-200 bg-white px-6 py-5 pr-14">
            <SheetHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="break-words text-[17px] font-bold text-slate-900">
                    {context.title}
                  </SheetTitle>
                  <p className="mt-0.5 break-words text-[11.5px] text-slate-500">
                    AI Summary &amp; Insight
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {activeTab === 'insight' && <ModelHealthPill enabled={open} />}
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-emerald-700 disabled:opacity-40"
                  >
                    <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
                    Refresh
                  </button>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs — underline style */}
            <div className="mt-4 flex gap-6 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={cn(
                  'border-b-2 pb-2.5 text-[12.5px] font-bold transition-colors',
                  activeTab === 'summary' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('insight')}
                className={cn(
                  'border-b-2 pb-2.5 text-[12.5px] font-bold transition-colors',
                  activeTab === 'insight' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                Insights
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {activeTab === 'summary' ? (
              <SummaryTab
                loading={summaryLoading}
                error={summaryError}
                summary={summary}
                onRetry={() => loadSummary(true)}
              />
            ) : (
              <WawasanTab
                loading={overview.loading}
                error={overview.error}
                data={overview.data}
                onRetry={() => overview.refresh()}
              />
            )}

            {/* Fine print */}
            <div className={cn(CAPTION, 'mt-5 border-t border-slate-200 pt-4')}>
              {activeTab === 'summary'
                ? 'Every number is pulled directly from the dashboard data you’re viewing — the AI only writes the narrative.'
                : 'All figures are estimates based on historical report patterns — not exact numbers. Use them as guidance, not a final decision.'}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
