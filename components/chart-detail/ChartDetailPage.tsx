'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Link as LinkIcon,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import type { DashboardTile, QueryResult } from '@/types/builder';
import { EnlargedChart } from './EnlargedChart';
import { ViewMode, Normalization } from './GlobalControlBar';
import { generateAnalyticalCharts, fetchAnalyticalChartData } from '@/lib/chart-detail-generator';
import type { AnalyticalChart } from '@/lib/chart-detail-generator';
import { MapPin, Plane, Layers, Crosshair, Target } from 'lucide-react';

const InvestigativeTable = dynamic(
  () => import('./InvestigativeTable').then((module) => module.InvestigativeTable),
  { loading: () => <div className="h-40 animate-pulse bg-slate-100" /> }
);
const SupportingCharts = dynamic(
  () => import('./SupportingCharts').then((module) => module.SupportingCharts),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-100" /> }
);

const INITIAL_DETAIL_ROW_LIMIT = 5_000;
const EXPORT_ROW_LIMIT = 100_000;

interface ChartDetailData {
  tile: DashboardTile;
  result: QueryResult;
  dashboardId?: string;
}

function ContextRibbon({ query }: { query: DashboardTile['query'] }) {
  const filters = query.filters || [];

  const getFilterValue = (fields: string[]) => {
    const filter = filters.find(f => fields.includes(f.field));
    return filter?.value || null;
  };

  const branch = getFilterValue(['branch', 'reporting_branch', 'station_code']);
  const airline = getFilterValue(['airline', 'airlines']);
  const category = getFilterValue(['main_category', 'category', 'irregularity_complain_category']);
  const area = getFilterValue(['area']);
  const subArea = getFilterValue(['apron_area_category', 'terminal_area_category', 'general_category']);

  const items = [
    { label: 'Cabang', value: branch, icon: MapPin },
    { label: 'Maskapai', value: airline, icon: Plane },
    { label: 'Kategori', value: category, icon: Layers },
    { label: 'Area', value: area, icon: Crosshair },
    { label: 'Sub-Area', value: subArea, icon: Target },
  ].filter(item => item.value);

  if (items.length === 0) return null;

  return (
    <div className="-mx-3 mb-6 flex flex-wrap gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--cf-line)] bg-[var(--cf-card)] px-3 py-1.5 shadow-[var(--cf-shadow-sm)]"
        >
          <item.icon size={13} className="text-[var(--cf-teal)]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--cf-ink-3)]">{item.label}</span>
          <span className="text-xs font-black tracking-tight text-[var(--cf-ink)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ChartDetailPage({ isPublic = false }: { isPublic?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<ChartDetailData | null>(null);
  const [fullData, setFullData] = useState<QueryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingTile, setLoadingTile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const supportingRef = useRef<HTMLDivElement>(null);
  const loadingTileIdRef = useRef<string | null>(null);
  const fullDataTileIdRef = useRef<string | null>(null);
  const [supportingVisible, setSupportingVisible] = useState(false);

  const [viewMode] = useState<ViewMode>('values');
  const [normalization] = useState<Normalization>('none');

  const [analyticalCharts, setAnalyticalCharts] = useState<AnalyticalChart[]>([]);
  const [analyticalDataMap, setAnalyticalDataMap] = useState<Record<number, QueryResult>>({});
  const [analyticalLoading, setAnalyticalLoading] = useState(false);
  const analyticalChartsSourceRef = useRef<typeof chartDefs>(null);
  const analyticalRequestSeqRef = useRef(0);


  const chartDefs = useMemo(() => {
    if (!data) return null;
    const displayResult = fullData || data.result;
    return generateAnalyticalCharts(data.tile, displayResult);
  }, [data, fullData]);

  const fetchTileData = useCallback(async (
    tile: DashboardTile,
    limit = INITIAL_DETAIL_ROW_LIMIT,
  ): Promise<QueryResult> => {
    try {

      const normalizedQuery = {
        ...tile.query,
        dimensions: tile.query.dimensions || [],
        measures: tile.query.measures || [],
        filters: tile.query.filters || [],
        joins: tile.query.joins || [],
        sorts: tile.query.sorts || [],
        limit
      };

      const response = await fetch('/api/dashboards/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: normalizedQuery
        })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch full data:', error);
    }

    return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  }, []);

  const handleDownloadImage = async () => {
    if (chartRef.current) {
      try {
        const [{ toPng }, { saveAs }] = await Promise.all([
          import('html-to-image'),
          import('file-saver'),
        ]);
        const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
        saveAs(dataUrl, `${data?.tile.visualization.title || 'chart'}.png`);
      } catch (err) {
        console.error('Failed to download image', err);
      }
    }
  };

  const handleExportCSV = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const [exportData, { saveAs }] = await Promise.all([
        fetchTileData(data.tile, EXPORT_ROW_LIMIT),
        import('file-saver'),
      ]);
      const headers = exportData.columns.join(',');
      const rows = exportData.rows.map((row) =>
        exportData.columns.map((column) => {
          const cell = row[column];
          if (typeof cell !== 'string') return cell;
          return /[",\n]/.test(cell)
            ? '"' + cell.replaceAll('"', '""') + '"'
            : cell;
        }).join(',')
      ).join('\n');

      const csvContent = headers + '\n' + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, (data.tile.visualization.title || 'data') + '.csv');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {

    const storedData = sessionStorage.getItem('chartDetailData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as ChartDetailData;
        const urlTileId = new URLSearchParams(window.location.search).get('tileId');
        if (!urlTileId || parsed.tile.id === urlTileId) {
          // A previous tile's fullData must not carry over to this one —
          // otherwise the refetch-when-missing effect below sees a (stale,
          // wrong-tile) fullData and never fetches this tile's.
          if (data?.tile.id !== parsed.tile.id) setFullData(null);
          fullDataTileIdRef.current = parsed.tile.id;
          setData(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse stored chart data:', e);
      }
    }

    const searchParams = new URLSearchParams(window.location.search);
    const tileId = searchParams.get('tileId');

    if (!tileId) {
      if (!isPublic) router.push('/dashboard');
      return;
    }

    if (data?.tile.id === tileId || loadingTile || fetchError === tileId) return;

    const loadTileData = async () => {
      // Guards against an older in-flight load resolving after a newer
      // tileId has superseded it and clobbering state with the wrong tile.
      loadingTileIdRef.current = tileId;
      setLoadingTile(true);
      try {
        const res = await fetch(`/api/dashboards?tileId=${tileId}`);
        const tile = await res.json();

        if (tile.error) throw new Error(tile.error);

        const dashboardTile: DashboardTile = {
          id: tile.id,
          visualization: {
            title: tile.title,
            chartType: tile.chart_type,
            ...(tile.visualization_config || {})
          },
          query: tile.query_config || {
            dimensions: [tile.data_field],
            measures: ['count'],
            filters: []
          },
          layout: tile.layout || { w: 6, h: 4 }
        };

        const result = await fetchTileData(dashboardTile);

        if (loadingTileIdRef.current !== tileId) return;
        fullDataTileIdRef.current = tileId;
        setData({
          tile: dashboardTile,
          result: result,
          dashboardId: tile.custom_dashboards?.id
        });
        setFullData(result);
      } catch (err) {
        if (loadingTileIdRef.current !== tileId) return;
        console.error('Failed to load public chart:', err);
        setFetchError(tileId);
        if (!isPublic) router.push('/dashboard');
      } finally {
        if (loadingTileIdRef.current === tileId) setLoadingTile(false);
      }
    };

    loadTileData();
  }, [router, isPublic, fetchTileData, loadingTile, data?.tile.id, fetchError]);

  useEffect(() => {
    if (data && !fullData) {
      // Same guard as above: if `data` moves on to a different tile before
      // this resolves, the stale response must not overwrite fullData.
      const tileId = data.tile.id;
      fullDataTileIdRef.current = tileId;
      fetchTileData(data.tile).then((result) => {
        if (fullDataTileIdRef.current === tileId) setFullData(result);
      });
    }
  }, [data, fullData, fetchTileData]);

  useEffect(() => {
    const element = supportingRef.current;
    if (!element || supportingVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSupportingVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [supportingVisible, data]);

  useEffect(() => {
    if (!supportingVisible || !chartDefs || chartDefs.charts.length === 0) return;
    // chartDefs is recomputed (new reference) once fullData replaces the
    // initial partial data.result — re-running only on a genuinely new
    // chartDefs (not "any charts already loaded") lets that refresh reach
    // the supporting charts instead of locking them to the first pass.
    if (analyticalChartsSourceRef.current === chartDefs) return;
    analyticalChartsSourceRef.current = chartDefs;

    // Guards against the partial-data pass's fetch resolving after the
    // full-data pass has already started/finished, which would otherwise
    // clobber the fresher full-data results with stale partial ones.
    const requestSeq = ++analyticalRequestSeqRef.current;

    setAnalyticalCharts(chartDefs.charts);
    setAnalyticalDataMap(chartDefs.dataMap);
    setAnalyticalLoading(true);

    fetchAnalyticalChartData(chartDefs.charts, chartDefs.dataMap)
      .then(fullMap => {
        if (analyticalRequestSeqRef.current === requestSeq) setAnalyticalDataMap(fullMap);
      })
      .finally(() => {
        if (analyticalRequestSeqRef.current === requestSeq) setAnalyticalLoading(false);
      });
  }, [chartDefs, supportingVisible]);

  const handleSharePublic = () => {
    if (!data?.tile.id) return;
    const shareUrl = `${window.location.origin}/embed/chart?tileId=${data.tile.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (fetchError) {
    return (
      <div className="cf-root flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#fee2e2] text-[var(--cf-coral)]">
          <X size={32} />
        </div>
        <h2 className="cf-display mb-2 text-2xl font-semibold text-[var(--cf-ink)]">Link Tidak Valid</h2>
        <p className="mb-8 max-w-md text-sm text-[var(--cf-ink-2)]">
          Tile ID <code className="rounded bg-[var(--cf-canvas-2)] px-1">{fetchError}</code> tidak ditemukan atau Anda tidak memiliki akses.
          Pastikan dashboard telah diatur menjadi publik.
        </p>
        <button onClick={() => router.push('/dashboard')} className="cf-btn cf-btn-primary px-6 py-2.5">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cf-root flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cf-teal)]" />
      </div>
    );
  }

  const displayData = fullData || data.result;
  const tile = data.tile;

  return (
    <div className="cf-root min-h-screen">
      {}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--cf-line)] bg-[var(--cf-card)]/90 px-3 backdrop-blur-xl sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {!isPublic && (
              <button
                onClick={() => router.back()}
                className="group flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--cf-line)] bg-[var(--cf-card)] text-[var(--cf-ink-2)] shadow-[var(--cf-shadow-sm)] transition-all hover:border-[var(--cf-teal)] hover:text-[var(--cf-teal)]"
              >
                <ArrowLeft size={17} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="cf-eyebrow">
                <span className="cf-eyebrow-idx">•</span>
                <span>Chart Detail</span>
              </div>
              <h1 className="cf-display truncate text-lg font-semibold tracking-tight text-[var(--cf-ink)] sm:text-2xl">
                {tile.visualization.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1 sm:flex sm:gap-2">
              <button
                onClick={handleCopyLink}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--cf-ink-2)] transition-colors hover:bg-[var(--cf-canvas-2)] hover:text-[var(--cf-teal)]"
                title="Copy Link"
              >
                {copied ? <Check size={18} className="text-[var(--cf-lime)]" /> : <LinkIcon size={18} />}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--cf-ink-2)] transition-colors hover:bg-[var(--cf-canvas-2)] hover:text-[var(--cf-teal)]"
                title="Export CSV"
              >
                {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              </button>
              <button
                onClick={handleDownloadImage}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--cf-ink-2)] transition-colors hover:bg-[var(--cf-canvas-2)] hover:text-[var(--cf-teal)]"
                title="Download PNG"
              >
                <Download size={18} />
              </button>
            </div>

            {!isPublic && (
              <button
                onClick={handleSharePublic}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--cf-ink-2)] transition-colors hover:bg-[var(--cf-canvas-2)] hover:text-[var(--cf-teal)]"
                title="Share Public Link"
              >
                {copied ? <Check size={18} className="text-[var(--cf-lime)]" /> : <Share2 size={18} />}
              </button>
            )}
            {!isPublic && (
              <>
                <div className="mx-1 h-6 w-px bg-[var(--cf-line)] sm:mx-2" />
                <button
                  onClick={() => router.back()}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--cf-ink-2)] transition-colors hover:bg-[var(--cf-canvas-2)]"
                >
                  <X size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="w-full px-3 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[1600px] space-y-6 sm:space-y-8">
          {}
          <ContextRibbon query={tile.query} />

          {}
          <div ref={chartRef} className="cf-card p-4 sm:p-5">
            <EnlargedChart
              tile={tile}
              result={displayData}
              viewMode={viewMode}
              normalization={normalization}
            />
          </div>

          {analyticalLoading && (
            <div className="flex justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cf-teal)] border-t-transparent"></div>
            </div>
          )}

          {}
          <div ref={supportingRef} className="space-y-4 border-t border-[var(--cf-line)] pt-6">
            <div className="cf-eyebrow">
              <span className="cf-eyebrow-idx">•</span>
              <span>Detailed Breakdown</span>
              <span className="cf-eyebrow-rule" />
            </div>
            {supportingVisible && (
              <SupportingCharts
                charts={analyticalCharts}
                dataMap={analyticalDataMap}
                loading={analyticalLoading}
                source="system"
                viewMode={viewMode}
                normalization={normalization}
              />
            )}
          </div>

          {}
          <InvestigativeTable
            data={displayData}
            title={tile.visualization.title || 'Chart Data'}
            theme="cf"
          />
        </div>
      </main>
    </div>
  );
}
