'use client';

import React, { useMemo } from 'react';
import { FeedbackDonutChart } from './FeedbackDonutChart';
import { FeedbackBarChart } from './FeedbackBarChart';
import { FeedbackPivotTable } from './FeedbackPivotTable';
import { InvestigativeTable } from '../../chart-detail/InvestigativeTable';
import { Share2 } from 'lucide-react';
import type { QueryResult } from '@/types/builder';

interface CustomerFeedbackTile {
  id: string;
  title?: string;
  chart_type?: string;
  visualization_config?: {
    chartType?: string;
  };
  layout?: {
    x?: number;
    y?: number;
    w?: number;
  };
  position?: number;
}

interface CustomerFeedbackChartResult {
  type: string;
  queryResult?: QueryResult;
  stats?: unknown;
}

interface CustomerFeedbackViewProps {
  chartsData: Map<string, CustomerFeedbackChartResult>;
  tiles: CustomerFeedbackTile[];
  extraKpis?: CustomerFeedbackTile[];
  onViewDetail?: (chart: CustomerFeedbackTile, result?: QueryResult) => void;
  onCopyLink?: (chart: CustomerFeedbackTile) => void;
  forcePivot?: boolean;
  investigativeResult?: QueryResult;
}

export function CustomerFeedbackView({
  chartsData,
  tiles,
  extraKpis = [],
  onViewDetail,
  onCopyLink,
  investigativeResult
}: CustomerFeedbackViewProps) {
  const orderedContentTiles = useMemo(() => {
    const sorted = tiles
      .filter((t) => !(t.visualization_config?.chartType === 'kpi' || t.chart_type === 'kpi'))
      .slice()
      .sort((a, b) => {
        const ay = a.layout?.y ?? 0;
        const by = b.layout?.y ?? 0;
        if (ay !== by) return ay - by;
        const ax = a.layout?.x ?? 0;
        const bx = b.layout?.x ?? 0;
        if (ax !== bx) return ax - bx;
        return (a.position ?? 0) - (b.position ?? 0);
      });

    // manual pin: 'Category by Area' and 'Branch Report' trade slots — requested
    // override, independent of builder layout order or kind-priority sort
    const idxA = sorted.findIndex((t) => String(t.title || '').toLowerCase() === 'category by area');
    const idxB = sorted.findIndex((t) => String(t.title || '').toLowerCase() === 'branch report');
    if (idxA !== -1 && idxB !== -1) {
      const layoutA = sorted[idxA].layout;
      sorted[idxA] = { ...sorted[idxA], layout: sorted[idxB].layout };
      sorted[idxB] = { ...sorted[idxB], layout: layoutA };
    }

    return sorted;
  }, [tiles]);

  const classify = (chart: CustomerFeedbackTile): 'table' | 'donut' | 'pivot' | 'bar' => {
    const title = String(chart.title || '').toLowerCase();
    const type = String(chart.visualization_config?.chartType || chart.chart_type || '').toLowerCase();

    const isExplicitDonut = type === 'donut' || type === 'pie';
    const isExplicitBar = type === 'bar' || type === 'horizontal_bar' || type === 'column';

    if (type === 'table') return 'table';
    if (isExplicitDonut || ((title.includes('report by case category') || title.includes('category by area')) && !isExplicitBar)) return 'donut';
    if (
      type === 'pivot' || type === 'heatmap' ||
      title.includes('category by branch') ||
      title.includes('category by airlines') ||
      title.includes('category by airline') ||
      title.includes('identification of root') ||
      title.includes('total area report') ||
      title.includes('detail report landside & airside') ||
      title.includes('detail root cause summary') ||
      title.includes('detail report cgo cargo') ||
      title.includes('primary indicators') ||
      title.includes('root cause result')
    ) return 'pivot';
    return 'bar';
  };

  const rows = useMemo(() => {
    const grouped = new Map<number, CustomerFeedbackTile[]>();
    for (const tile of orderedContentTiles) {
      const y = tile.layout?.y ?? 0;
      if (!grouped.has(y)) {
        grouped.set(y, []);
      }
      grouped.get(y)!.push(tile);
    }
    // scan order per row: summary donut anchors first, trend bars next, dense
    // matrices (pivot/table) last — reads simple-to-detailed left to right
    const kindPriority: Record<string, number> = { donut: 0, bar: 1, pivot: 2, table: 3 };
    return Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .map((y) => grouped.get(y)!.slice().sort((a, b) => kindPriority[classify(a)] - kindPriority[classify(b)]));
  }, [orderedContentTiles]);

  const getAccentColor = (chart: CustomerFeedbackTile) => {
    const t = String(chart.title || '').toLowerCase();
    if (t.includes('complaint')) return '#ef4444';
    if (t.includes('irregularity')) return '#f59e0b';
    if (t.includes('compliment')) return '#84cc16';
    return '#0f766e';
  };

  // light tiles (donut/bar) get the hero-aware bento grid, capped at 3 columns
  // so nothing gets crushed — a 4th tile wraps full-width below via getItemSpanClass
  // instead of forcing a cramped 4-up row
  const getGridClass = (rowItems: CustomerFeedbackTile[]) => {
    const len = rowItems.length;
    const heroFirst = len >= 2 && classify(rowItems[0]) === 'donut';
    if (heroFirst) {
      if (len === 2) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr]';
      return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr]';
    }
    if (len === 1) return 'grid-cols-1';
    if (len === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  // dense tiles (pivot/table) never share a row with light tiles — heatmaps and
  // matrices need real width to read, so they get their own capped-at-2 grid below
  const getDenseGridClass = (denseItems: CustomerFeedbackTile[]) => {
    const len = denseItems.length;
    if (len <= 1) return 'grid-cols-1';
    if (len === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  // trailing item that would otherwise be the lone survivor on a half-empty
  // final row wraps full-width instead — avoids the dead-track gap bug
  const getItemSpanClass = (groupItems: CustomerFeedbackTile[], idx: number): string => {
    const len = groupItems.length;
    const isLast = idx === len - 1;
    if (len === 4 && isLast) return 'xl:col-span-3';
    if (len > 4 && len % 3 === 1 && isLast) return 'xl:col-span-3';
    return '';
  };

  const getKpiGridClass = (count: number): string => {
    // hero card spans 2 cols at lg, rest span 1 each — total cols must match card count
    // or leftover grid tracks render as dead whitespace (no card to fill them)
    const totalCols = count + 1;
    if (totalCols <= 2) return 'grid-cols-2';
    if (totalCols === 3) return 'grid-cols-2 md:grid-cols-3';
    if (totalCols === 4) return 'grid-cols-2 md:grid-cols-4';
    if (totalCols === 5) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5';
    if (totalCols === 6) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6';
    if (totalCols === 8) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8';
    return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7';
  };

  const getKpiAccent = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes('irregularity')) return 'var(--cf-amber)';
    if (t.includes('complaint')) return 'var(--cf-coral)';
    if (t.includes('compliment')) return 'var(--cf-lime)';
    return 'var(--cf-slate)';
  };

  const getContentMinH = (kind: 'table' | 'donut' | 'pivot' | 'bar', isFullWidth: boolean): string => {
    // dense matrices (pivot/table) need more vertical room than a donut legend
    // or a handful of bars — uniform height across kinds is what made every
    // tile look like the same boxy block regardless of content
    if (kind === 'pivot') return isFullWidth ? 'min-h-[300px]' : 'min-h-[240px]';
    if (kind === 'table') return isFullWidth ? 'min-h-[260px]' : 'min-h-[220px]';
    if (kind === 'donut') return isFullWidth ? 'min-h-[240px]' : 'min-h-[200px]';
    return isFullWidth ? 'min-h-[200px]' : 'min-h-[190px]';
  };

  const getResult = (id: string) => chartsData.get(id)?.queryResult;

  const toChartData = (id: string) => {
    const rows = getResult(id)?.rows || [];
    return rows.map((r: Record<string, unknown>) => {
      const entries = Object.entries(r || {});
      const numericEntry = entries.find(([, v]) => typeof v === 'number');
      const textEntry =
        entries.find(([, v]) => typeof v === 'string' && Number.isNaN(Number(v))) ||
        entries.find(([, v]) => typeof v === 'string') ||
        entries[0];

      return {
        name: String(textEntry?.[1] || 'Unknown'),
        value: Number(numericEntry?.[1] || 0),
      };
    });
  };

  const renderTileCard = (chart: CustomerFeedbackTile, idx: number, groupTiles: CustomerFeedbackTile[]) => {
    const accent = getAccentColor(chart);
    const kind = classify(chart);
    const isFullWidth = groupTiles.length === 1;
    const isHeroAnchor = idx === 0 && kind === 'donut' && groupTiles.length >= 2 && groupTiles.length <= 4;
    return (
      <div
        key={chart.id}
        className={`cf-card group h-full ${getItemSpanClass(groupTiles, idx)}`}
        style={{
          ['--cf-spine' as string]: accent,
          ...(isHeroAnchor ? { background: 'var(--cf-teal-tint)' } : {}),
        }}
      >
        <div className="cf-card-head">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <span className="h-3.5 w-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: accent }} aria-hidden="true" />
            <h3 className="cf-card-title">{chart.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onCopyLink?.(chart)}
              className="p-1.5 rounded-full text-[var(--cf-ink-3)] hover:text-[var(--cf-teal)] hover:bg-[var(--cf-teal-tint)] transition-all active:scale-90"
              title="Copy link"
              aria-label="Copy link"
            >
              <Share2 size={12} />
            </button>
            <button
              onClick={() => onViewDetail?.(chart, getResult(chart.id)!)}
              className="cf-btn cf-btn-primary px-2.5 py-1 !text-[9px] !tracking-[0.14em]"
            >
              Detail
            </button>
          </div>
        </div>
        <div className={`p-3.5 flex-1 flex flex-col items-center justify-center overflow-hidden ${getContentMinH(kind, isFullWidth)}`}>
          {renderChart(chart, isFullWidth)}
        </div>
      </div>
    );
  };

  const renderChart = (chart: CustomerFeedbackTile, isFullWidth: boolean) => {
    const title = String(chart.title || '').toLowerCase();
    const kind = classify(chart);

    if (kind === 'table') {
      return (
        <div className="w-full h-full min-h-[200px] overflow-hidden">
          <InvestigativeTable
            data={getResult(chart.id) || { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 }}
            title={chart.title}
            rowsPerPage={isFullWidth ? 8 : 5}
            maxRows={isFullWidth ? 500 : 120}
            theme="cf"
          />
        </div>
      );
    } else if (kind === 'donut') {
      return <FeedbackDonutChart title="" data={toChartData(chart.id)} height={isFullWidth ? 220 : 170} />;
    } else if (kind === 'pivot') {
      return (
        <div className={`w-full h-full ${isFullWidth ? 'min-h-[260px]' : 'min-h-[180px]'} overflow-auto custom-scrollbar`}>
          <FeedbackPivotTable title="" result={getResult(chart.id) || { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 }} compact />
        </div>
      );
    } else {
      return (
        <div className="w-full h-full max-h-[280px] overflow-hidden">
          <FeedbackBarChart
            title=""
            data={toChartData(chart.id)}
            limit={title.includes('monthly') || title.includes('bulan') ? 0 : 8}
            sortByValue={!(title.includes('monthly') || title.includes('bulan'))}
            barColor={getAccentColor(chart)}
            compact
          />
        </div>
      );
    }
  };

  return (
    <div className="space-y-5">
      {extraKpis.length > 0 && (
        <div className={`grid ${getKpiGridClass(extraKpis.length)} gap-3`}>
          {extraKpis.map((kpi, i) => {
            const isHero = i === 0;
            const accent = getKpiAccent(kpi.title || '');
            const value = Number(getResult(kpi.id)?.rows[0]?.total || 0).toLocaleString('id-ID');
            if (isHero) {
              return (
                <div
                  key={kpi.id}
                  className="relative overflow-hidden rounded-[var(--cf-radius)] p-5 flex flex-col justify-between text-left lg:col-span-2 min-h-[124px] bg-[var(--cf-teal)] text-white shadow-[0_18px_40px_-22px_rgba(15,118,110,0.9)]"
                >
                  <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
                  <div className="absolute right-3 bottom-2 cf-display text-white/10 text-[80px] leading-none pointer-events-none select-none" aria-hidden="true">”</div>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75 relative z-10 truncate">{kpi.title}</span>
                  <span className="cf-display cf-tabular text-[40px] leading-none font-semibold relative z-10">{value}</span>
                </div>
              );
            }
            return (
              <div
                key={kpi.id}
                className="cf-card p-4 flex flex-col justify-between text-left min-h-[124px]"
                style={{ ['--cf-spine' as string]: accent }}
              >
                <span className="text-[9.5px] font-black uppercase tracking-[0.16em] truncate w-full" style={{ color: accent }}>
                  {kpi.title}
                </span>
                <span className="cf-display cf-tabular text-[30px] leading-none font-semibold text-[var(--cf-ink)] truncate w-full">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {rows.map((rowTiles, rowIndex) => {
        const lightTiles = rowTiles.filter((t) => { const k = classify(t); return k !== 'pivot' && k !== 'table'; });
        const denseTiles = rowTiles.filter((t) => { const k = classify(t); return k === 'pivot' || k === 'table'; });
        return (
          <section key={`row-${rowIndex}`} className="space-y-3">
            <div className="flex items-center gap-3 px-0.5">
              <span className="cf-eyebrow">
                <span className="cf-eyebrow-idx">{String(rowIndex + 1).padStart(2, '0')}</span>
                <span className="cf-eyebrow-rule" />
              </span>
            </div>
            {lightTiles.length > 0 && (
              <div className={`grid ${getGridClass(lightTiles)} gap-3 xl:gap-4`}>
                {lightTiles.map((chart, idx) => renderTileCard(chart, idx, lightTiles))}
              </div>
            )}
            {denseTiles.length > 0 && (
              <div className={`grid ${getDenseGridClass(denseTiles)} gap-3 xl:gap-4`}>
                {denseTiles.map((chart, idx) => renderTileCard(chart, idx, denseTiles))}
              </div>
            )}
          </section>
        );
      })}

      {investigativeResult && (
        <section className="space-y-3">
          <div className="flex items-center gap-3 px-0.5">
            <span className="cf-eyebrow">
              <span className="cf-eyebrow-idx">◆</span>
              <span className="cf-eyebrow-rule" />
              Case Records
            </span>
          </div>
          <InvestigativeTable
            data={investigativeResult}
            title="Investigative Report Details"
            rowsPerPage={10}
            maxRows={500}
            theme="cf"
          />
        </section>
      )}
    </div>
  );
}
