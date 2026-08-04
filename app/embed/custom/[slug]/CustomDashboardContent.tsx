
'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
const ChartPreview = dynamic(
  () => import('@/components/builder/ChartPreview').then(m => ({ default: m.ChartPreview })),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-2xl bg-slate-100" /> },
);
const CustomerFeedbackView = dynamic(
  () => import('@/components/dashboard/customer-feedback/CustomerFeedbackView').then(m => ({ default: m.CustomerFeedbackView })),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-2xl bg-slate-100" /> },
);
import { Loader2, ChevronDown as ChevronDownIcon, X, Download, FileSpreadsheet, Presentation, LayoutGrid, Box, Menu, Calendar } from 'lucide-react';
import { DynamicFilterHeader, type FilterData } from '@/components/builder/DynamicFilterHeader';
import type { QueryDefinition, QueryResult, ChartType, ChartVisualization, DashboardTile, TileLayout } from '@/types/builder';
import { cn } from '@/lib/utils';
import { DASHBOARD_FILTER_FIELDS } from '@/lib/dashboard-query-scope';
import { computeBento } from '@/lib/builder/bento-layout';

const GREEN_PALETTE = ['#7cb342', '#558b2f', '#aed581', '#33691e', '#9ccc65', '#689f38', '#c5e1a5', '#43a047', '#81c784', '#4caf50'];

const FILTER_FIELDS = DASHBOARD_FILTER_FIELDS.map((field) => ({
  key: field.key,
  label: field.key === 'hub'
    ? 'HUB'
    : field.key === 'branch'
    ? 'Station'
    : field.key === 'maskapai'
    ? 'Maskapai'
    : field.key === 'airline'
    ? 'Airlines'
    : field.key === 'main_category'
    ? 'Kategori'
    : field.key.charAt(0).toUpperCase() + field.key.slice(1),
  table: field.table,
  field: field.field,
}));

interface ChartData {
  id: string;
  title: string;
  chart_type: string;
  data_field: string;
  width: string;
  position: number;
  query_config?: QueryDefinition;
  visualization_config?: ChartVisualization;
  layout?: { x: number; y: number; w: number; h: number };
  page_name?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  config: {
    dateRange?: string;
    autoRefresh?: boolean;
    dateFrom?: string;
    dateTo?: string;
    subtitle?: string;
    filters?: string[];
    pages?: string[];
    hideControls?: boolean;
  };
  dashboard_charts: ChartData[];
}

interface ChartResult {
  type: 'legacy' | 'query';
  stats?: {
    distribution: { name: string; count: number; percentage: number }[];
    totalCount: number;
    trendData: { date: string; count: number }[];
  };
  queryResult?: QueryResult;
}

function greenify(viz: ChartVisualization): ChartVisualization {
  return { ...viz, colors: GREEN_PALETTE };
}

// Local-timezone Y-M-D formatter (mirrors toLocalDateInput in
// components/public-report/apple-form-shell.tsx). Using
// `date.toISOString().split('T')[0]` on a local Date converts to UTC first,
// which for WIB (UTC+7) users silently computes "yesterday" instead of
// "today" between local midnight and 7am.
function toLocalDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

export function CustomDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const range = searchParams.get('range') || '7d';
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [chartsData, setChartsData] = useState<Map<string, ChartResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterData>({});
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pptx' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [investigativeResult, setInvestigativeResult] = useState<QueryResult | undefined>(undefined);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktopViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const pageIndex = searchParams.get('pageIndex');
    if (pageIndex !== null) {
      setActivePage(parseInt(pageIndex, 10) || 0);
    }

    const filters: FilterData = {};
    FILTER_FIELDS.forEach(ff => {
      const val = searchParams.get(ff.key);
      if (val) filters[ff.key] = val;
    });
    if (Object.keys(filters).length > 0) {
      setActiveFilters(prev => ({ ...prev, ...filters }));
    }

    const from = searchParams.get('dateFrom');
    const to = searchParams.get('dateTo');
    if (from) setDateFrom(from);
    if (to) setDateTo(to);
  }, [searchParams]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboards?slug=${slug}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Akses ditolak');
          return null;
        }
        throw new Error('Dashboard not found');
      }
      const data = await res.json();
      setDashboard(data);
      if (data.config?.dateFrom && !searchParams.get('dateFrom')) setDateFrom(data.config.dateFrom);
      if (data.config?.dateTo && !searchParams.get('dateTo')) setDateTo(data.config.dateTo);
      setFiltersInitialized(true);
      return data as Dashboard;
    } finally {
      setLoading(false);
    }
  }, [slug, searchParams]);

  useEffect(() => {
    if (!filtersInitialized) return;

    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    Object.entries(activeFilters).forEach(([key, val]) => {
      if (val && val !== 'all' && params.get(key) !== val) {
        params.set(key, val);
        changed = true;
      } else if ((!val || val === 'all') && params.has(key)) {
        params.delete(key);
        changed = true;
      }
    });

    if (dateFrom && params.get('dateFrom') !== dateFrom) {
      params.set('dateFrom', dateFrom);
      changed = true;
    }
    if (dateTo && params.get('dateTo') !== dateTo) {
      params.set('dateTo', dateTo);
      changed = true;
    }
    if (activePage > 0 && params.get('pageIndex') !== activePage.toString()) {
      params.set('pageIndex', activePage.toString());
      changed = true;
    } else if (activePage === 0 && params.has('pageIndex')) {
      params.delete('pageIndex');
      changed = true;
    }

    if (changed) {
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [activeFilters, dateFrom, dateTo, activePage, filtersInitialized, router, searchParams]);

  // Guards against a slower, earlier page/filter fetch resolving after a
  // newer one's and clobbering the shared chartsData/investigativeResult
  // cache with stale results.
  const fetchSeqRef = useRef(0);

  const fetchPageData = useCallback(async (pageIndex: number): Promise<Map<string, ChartResult>> => {
    const requestSeq = ++fetchSeqRef.current;
    const params = new URLSearchParams({
      slug,
      includeData: '1',
      pageIndex: String(pageIndex),
      range,
    });

    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.set(key, value);
      }
    });

    const response = await fetch(`/api/dashboards?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 403) {
        if (fetchSeqRef.current === requestSeq) setError('Akses ditolak');
        return new Map();
      }
      throw new Error('Failed to load dashboard data');
    }

    const payload = await response.json();
    const nextMap = new Map<string, ChartResult>();
    for (const [chartId, value] of Object.entries(payload.chartResults || {})) {
      nextMap.set(chartId, value as ChartResult);
    }

    if (fetchSeqRef.current === requestSeq) {
      setChartsData((prev) => {
        const merged = new Map(prev);
        nextMap.forEach((value, key) => merged.set(key, value));
        return merged;
      });
      setInvestigativeResult(payload.investigativeResult || undefined);
    }
    return nextMap;
  }, [slug, range, dateFrom, dateTo, activeFilters]);

  const fetchChartDataRef = useRef(fetchPageData);
  useEffect(() => {
    fetchChartDataRef.current = fetchPageData;
  }, [fetchPageData]);

  const pages = useMemo(() => {
    if (!dashboard) return [];
    const charts = dashboard.dashboard_charts;
    const hasPages = charts.some(c => c.page_name && c.page_name !== 'Ringkasan Umum');
    const configPages = dashboard.config?.pages;

    if (hasPages || (configPages && configPages.length > 1)) {
      const pageMap = new Map<string, ChartData[]>();
      const pageOrder = configPages || [];
      for (const pn of pageOrder) pageMap.set(pn, []);
      for (const chart of charts) {
        const pageName = chart.page_name || 'Ringkasan Umum';
        if (!pageMap.has(pageName)) pageMap.set(pageName, []);
        pageMap.get(pageName)!.push(chart);
      }
      return Array.from(pageMap.entries())
        .filter(([, tiles]) => tiles.length > 0)
        .map(([name, tiles]) => ({
          name,
          tiles: tiles.sort((a, b) => a.position - b.position),
        }));
    }
    return [{ name: 'Ringkasan Umum', tiles: [...charts].sort((a, b) => a.position - b.position) }];
  }, [dashboard]);

  const isCustomerFeedbackDashboard = useMemo(() => {
    return dashboard?.name?.toLowerCase().includes('customer feedback') || slug?.includes('customer-feedback');
  }, [dashboard?.name, slug]);

  const useCustomerFeedbackOverviewLayout = isCustomerFeedbackDashboard && [0, 1, 2, 3, 4].includes(activePage);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (dashboard?.dashboard_charts && filtersInitialized) {
      fetchChartDataRef.current(activePage);
    }
  }, [dashboard, activePage, activeFilters, dateFrom, dateTo, filtersInitialized, isCustomerFeedbackDashboard, pages]);

  const currentPage = pages[activePage] || pages[0];
  const kpiTiles = useMemo(() => currentPage?.tiles.filter(c => (c.visualization_config?.chartType === 'kpi' || c.chart_type === 'kpi')) || [], [currentPage]);
  const contentTiles = useMemo(() => currentPage?.tiles.filter(c => (c.visualization_config?.chartType !== 'kpi' && c.chart_type !== 'kpi')) || [], [currentPage]);

  const bentoSpans = useMemo(() => {
    const spans = computeBento(contentTiles.map(t => ({
      id: t.id,
      chartType: (t.visualization_config?.chartType || t.chart_type || 'bar') as ChartType,
      rows: chartsData.get(t.id)?.queryResult?.rowCount,
    })));
    return new Map(spans.map(s => [s.id, s.colSpan]));
  }, [contentTiles, chartsData]);

  const handleExport = useCallback(async (format: 'xlsx' | 'pptx') => {
    if (!dashboard) return;
    setExportingFormat(format);
    setShowExportMenu(false);
    try {
      const completeChartsData = new Map(chartsData);
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const pageTiles = pages[pageIndex]?.tiles || [];
        const hasMissingTiles = pageTiles.some((tile) => !completeChartsData.has(tile.id));
        if (hasMissingTiles) {
          const freshData = await fetchPageData(pageIndex);
          freshData.forEach((value, key) => completeChartsData.set(key, value));
        }
      }
      const payload = {
        dashboardName: dashboard.name,
        subtitle: dashboard.description || dashboard.config?.subtitle,
        dashboardId: dashboard.id,
        baseUrl: window.location.origin,
        dateFrom: dateFrom || '1900-01-01',
        dateTo: dateTo || '2099-12-31',
        sourcePage: slug,
        pages: pages.map(p => ({
          name: p.name,
          tiles: p.tiles.map(t => ({ id: t.id, title: t.title, chartType: t.visualization_config?.chartType || t.chart_type || 'bar', yAxis: t.visualization_config?.yAxis })),
        })),
        chartsData: completeChartsData,
      };
      if (format === 'xlsx') {
        const { exportToXlsx } = await import('@/lib/dashboard-export');
        await exportToXlsx(payload);
      } else {
        const { exportToPptx } = await import('@/lib/dashboard-export');
        await exportToPptx(payload);
      }
    } catch (err) { console.error('Export error:', err); }
    finally { setExportingFormat(null); }
  }, [dashboard, pages, chartsData, fetchPageData, dateFrom, dateTo, slug]);

  const getChartSlug = (chartTitle: string) => {
    const title = chartTitle.toLowerCase();
    if (title.includes('report by case category')) return 'report-by-case-category';
    if (title.includes('branch report')) return 'branch-report';
    if (title.includes('airlines report') || title.includes('airline report')) return 'airline-report';
    if (title.includes('monthly report') || title.includes('monthly') || title.includes('bulanan')) return 'monthly-report';
    if (title.includes('category by area')) return 'category-by-area';
    if (title.includes('case category by branch')) return 'case-category-by-branch';
    if (title.includes('case category by airline') || title.includes('case category by airlines')) return 'case-category-by-airline';
    if (title.includes('case report by area') || title.includes('report by area')) return 'area-report';
    if (title.includes('terminal area category')) return 'terminal-area-category';
    if (title.includes('apron area category')) return 'apron-area-category';
    if (title.includes('general category')) return 'general-category';
    if (title.includes('hub report')) return 'hub-report';
    if (title.includes('terminal area by branch')) return 'terminal-area-category';
    if (title.includes('apron area by branch')) return 'apron-area-category';
    if (title.includes('general category by branch')) return 'general-category';
    if (title.includes('terminal area by airline') || title.includes('terminal area by airlines')) return 'terminal-area-category';
    if (title.includes('apron area by airline') || title.includes('apron area by airlines')) return 'apron-area-category';
    if (title.includes('general category by airline') || title.includes('general category by airlines')) return 'general-category';
    return 'pivot-report';
  };

  const getDetailParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (val && val !== 'all') params.set(key, val);
    });

    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    if (activePage > 0) {
      params.set('pageIndex', activePage.toString());
    }

    if ([3, 4].includes(activePage)) {
      params.set('sourceSheet', 'CGO');
    }

    params.set('sourcePage', slug);
    return params;
  }, [activeFilters, activePage, slug, dateFrom, dateTo]);

  const openCustomerFeedbackDetail = useCallback((chart: ChartData) => {
    const slug = getChartSlug(chart.title);
    const params = getDetailParams();
    const queryString = params.toString();
    router.push(`/embed/${slug}/detail${queryString ? `?${queryString}` : ''}`);
  }, [router, getDetailParams]);

  const onCopyLink = useCallback((chart: ChartData) => {
    const slug = getChartSlug(chart.title);
    const params = getDetailParams();
    params.set('viewMode', 'static');
    const queryString = params.toString();
    const url = `${window.location.origin}/embed/${slug}/detail?${queryString}`;

    navigator.clipboard.writeText(url).then(() => {

      alert('Chart link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  }, [getDetailParams]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" /></div>;
  if (error || !dashboard) return <div className="min-h-screen flex items-center justify-center text-red-500">{error || 'Dashboard not found'}</div>;

  const hasMultiplePages = pages.length > 1;
  const cf = isCustomerFeedbackDashboard;

  return (
    <div className={cn(
      "flex min-h-screen overflow-hidden selection:bg-brand-primary/10",
      cf ? "cf-root" : "bg-surface-0",
    )}>
      {hasMultiplePages && (
        <aside
          style={{ transform: isDesktopViewport ? 'none' : (mobileMenuOpen ? 'translateY(0)' : 'translateY(100%)') }}
          className={cn(
            "fixed z-50 flex flex-col transition-transform duration-300 ease-out shadow-sm",
            "inset-x-0 bottom-0 max-h-[80vh] rounded-t-3xl border-t",
            "md:inset-y-0 md:left-0 md:right-auto md:bottom-auto md:max-h-none md:rounded-t-none md:rounded-none md:border-t-0 md:border-r md:h-screen md:top-0",
            cf ? "bg-[var(--cf-card)] border-[var(--cf-line)]" : "bg-white border-gray-100",
            sidebarCollapsed ? "md:w-[80px]" : "md:w-72",
          )}>
          <div className={cn("p-6 flex items-center justify-between shrink-0 border-b", cf ? "border-[var(--cf-line-soft)]" : "border-gray-100")}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center shrink-0", cf ? "bg-[var(--cf-teal)] text-white shadow-[0_6px_16px_-8px_rgba(15,118,110,0.8)]" : "bg-brand-primary/10")}>
                  <Box className={cn("w-4 h-4", cf ? "text-white" : "text-brand-primary")} />
                </div>
                {cf ? (
                  <div className="flex flex-col leading-none min-w-0">
                    <span className="cf-display text-[19px] font-semibold text-[var(--cf-ink)] truncate">Feedback</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.28em] text-[var(--cf-ink-3)] mt-0.5">Intelligence</span>
                  </div>
                ) : (
                  <span className="text-sm font-black text-gray-800 tracking-tight uppercase">Dashboard</span>
                )}
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={cn("hidden md:inline-flex p-2 rounded-xl transition-all", cf ? "text-[var(--cf-ink-3)] hover:text-[var(--cf-teal)] hover:bg-[var(--cf-teal-tint)]" : "text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5")}><LayoutGrid size={18} /></button>
            <button onClick={() => setMobileMenuOpen(false)} className={cn("md:hidden p-2 rounded-xl transition-all", cf ? "text-[var(--cf-ink-3)] hover:text-[var(--cf-teal)] hover:bg-[var(--cf-teal-tint)]" : "text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5")}><X size={18} /></button>
          </div>
          {cf && !sidebarCollapsed && (
            <div className="px-6 pt-5 pb-1 hidden md:block">
              <span className="cf-eyebrow"><span className="cf-eyebrow-idx">§</span> Sections</span>
            </div>
          )}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {pages.map((p, i) => (
              cf ? (
                <button key={i} onClick={() => { setActivePage(i); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative text-left", activePage === i ? "bg-[var(--cf-teal)] text-white shadow-[0_8px_20px_-12px_rgba(15,118,110,0.9)]" : "text-[var(--cf-ink-2)] hover:bg-[var(--cf-teal-tint)] hover:text-[var(--cf-teal)]")}>
                  <span className={cn("cf-display text-[13px] tabular-nums shrink-0 w-6", activePage === i ? "text-white/70" : "text-[var(--cf-ink-3)] group-hover:text-[var(--cf-teal)]")}>{String(i + 1).padStart(2, '0')}</span>
                  {!sidebarCollapsed && <span className="text-[12.5px] font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</span>}
                </button>
              ) : (
                <button key={i} onClick={() => { setActivePage(i); setMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors duration-200 group relative", activePage === i ? "bg-brand-primary text-white shadow-sm" : "text-gray-500 hover:bg-brand-primary/5 hover:text-brand-primary")}>
                  <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-200", activePage === i ? "bg-white scale-100" : "bg-brand-primary scale-0 group-hover:scale-100")} />
                  {!sidebarCollapsed && <span className="text-[13px] font-bold tracking-wide whitespace-nowrap overflow-hidden">{p.name}</span>}
                </button>
              )
            ))}
          </nav>
        </aside>
      )}
      {hasMultiplePages && mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
      )}

      <main className={cn("flex-1 min-w-0 flex flex-col overflow-x-hidden relative transition-[margin] duration-200 ease-out", cf ? "bg-transparent" : "bg-surface-0", hasMultiplePages ? (sidebarCollapsed ? "md:ml-[80px]" : "md:ml-72") : "")}>
        <header className={cn("sticky top-0 z-40 w-full !p-0 border-b", cf ? "bg-[var(--cf-canvas)]/80 supports-[backdrop-filter]:backdrop-blur-md border-[var(--cf-line)]" : "bg-white border-gray-100 shadow-sm")}>
          <div className="px-8 py-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className={cn("rounded-2xl", cf ? "p-3 bg-[var(--cf-card)] border border-[var(--cf-line)] shadow-[var(--cf-shadow-sm)]" : "p-3 bg-brand-primary/10 shadow-inner")}><Image src="/logo.png" alt="Logo" width={32} height={32} unoptimized style={{ height: 32, width: 'auto', objectFit: 'contain' }} /></div>
                <div className="flex flex-col">
                  {cf ? (
                    <>
                      <h1 className="cf-display text-[30px] leading-[0.95] font-semibold text-[var(--cf-ink)] mb-1">{dashboard.name}</h1>
                      <p className="text-[10px] font-black text-[var(--cf-teal)] tracking-[0.24em] uppercase">{dashboard.description || dashboard.config?.subtitle || 'Voice of the Customer'}</p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase leading-none mb-1">{dashboard.name}</h1>
                      <p className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase opacity-80">{dashboard.description || dashboard.config?.subtitle || 'Executive Intelligence Portal'}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative group">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={cn(
                      "flex items-center gap-3 px-5 py-2.5 rounded-full text-[13px] font-bold transition-all min-w-[200px]",
                      cf
                        ? "bg-[var(--cf-card)] border border-[var(--cf-line)] text-[var(--cf-ink-2)] shadow-[var(--cf-shadow-sm)] hover:border-[var(--cf-teal)]"
                        : "bg-white border border-gray-100 text-gray-600 hover:border-brand-primary/40 hover:shadow-sm shadow-sm",
                    )}
                  >
                    <Calendar size={16} className={cn("flex-shrink-0", cf ? "text-[var(--cf-teal)]" : "text-brand-primary")} />
                    <span className="whitespace-nowrap flex-1 text-left">
                      {(() => {
                        if (!dateFrom && !dateTo) return 'Select Period';
                        if (dateFrom === '1900-01-01' && dateTo === '2099-12-31') return 'All Dates';
                        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
                        const from = dateFrom ? new Date(dateFrom).toLocaleDateString('en-GB', options) : '...';
                        const to = dateTo ? new Date(dateTo).toLocaleDateString('en-GB', options) : '...';
                        return `${from} — ${to}`;
                      })()}
                    </span>
                    <ChevronDownIcon size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                  {showDatePicker && (
                    <div className="absolute right-0 mt-3 p-6 bg-white rounded-3xl shadow-xl border border-gray-100 z-50 min-w-[320px] animate-prism-reveal overflow-hidden">
                      <div className="grid gap-6">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3 block">Quick Range</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Today', range: 'today' },
                              { label: 'Last 7 Days', range: '7d' },
                              { label: 'Last 30 Days', range: '30d' },
                              { label: 'This Year', range: 'year' },
                              { label: 'All Time', range: 'all' },
                            ].map((preset) => (
                              <button
                                key={preset.range}
                                onClick={() => {
                                  const now = new Date();
                                  let from = '';
                                  let to = toLocalDateInput(now);
                                  if (preset.range === 'today') from = to;
                                  else if (preset.range === '7d') { const d = new Date(); d.setDate(now.getDate() - 7); from = toLocalDateInput(d); }
                                  else if (preset.range === '30d') { const d = new Date(); d.setDate(now.getDate() - 30); from = toLocalDateInput(d); }
                                  else if (preset.range === 'year') from = `${now.getFullYear()}-01-01`;
                                  else if (preset.range === 'all') { from = '1900-01-01'; to = '2099-12-31'; }
                                  setDateFrom(from);
                                  setDateTo(to);
                                }}
                                className="px-3 py-2.5 bg-gray-50 text-[11px] font-bold text-gray-600 rounded-xl hover:bg-brand-primary/10 hover:text-brand-primary transition-all text-left"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3 block">Custom Range</label>
                          <div className="grid gap-3">
                            <div className="grid gap-1.5">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1">Start Date</label>
                              <input 
                                type="date" 
                                value={dateFrom} 
                                onChange={e => setDateFrom(e.target.value)} 
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" 
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1">End Date</label>
                              <input 
                                type="date" 
                                value={dateTo} 
                                onChange={e => setDateTo(e.target.value)} 
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => setShowDatePicker(false)}
                            className="flex-1 py-3.5 bg-brand-primary text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-sm"
                          >
                            Apply Selection
                          </button>
                          <button 
                            onClick={() => { setDateFrom(''); setDateTo(''); setShowDatePicker(false); }} 
                            className="px-4 py-3.5 bg-gray-100 text-gray-500 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"
                            title="Reset Filter"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exportingFormat !== null} className={cn("flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[13px] font-black tracking-widest uppercase transition-all disabled:opacity-50", cf ? "cf-btn cf-btn-primary !text-[12px]" : "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm")}>{exportingFormat ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}<span className="hidden sm:inline">{cf ? 'Export' : 'Dispatch'}</span></button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-3 p-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 min-w-[200px] animate-prism-reveal">
                      <button onClick={() => handleExport('xlsx')} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[12px] font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"><FileSpreadsheet size={16} /> Excel Spreadsheet</button>
                      <button onClick={() => handleExport('pptx')} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[12px] font-bold text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all"><Presentation size={16} /> Presentation Deck</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {!dashboard.config?.hideControls && <div className={cn("pt-5 border-t", cf ? "mt-5 border-[var(--cf-line)]" : "mt-8 border-gray-100")}>{cf && <div className="mb-3"><span className="cf-eyebrow"><span className="cf-eyebrow-rule" />Filters</span></div>}<DynamicFilterHeader onFilterChange={setActiveFilters} initialFilters={activeFilters} variant={isCustomerFeedbackDashboard ? 'pill' : 'default'} /></div>}
          </div>
        </header>

         <section className="px-8 pb-24 space-y-8" data-section="dashboard-content">
          {useCustomerFeedbackOverviewLayout ? (
            <div className="mt-8" data-layout="customer-feedback">
              <CustomerFeedbackView 
                chartsData={chartsData} 
                tiles={currentPage?.tiles || []} 
                extraKpis={pages[activePage === 0 ? 1 : activePage === 3 ? 4 : activePage]?.tiles.filter(t => t.visualization_config?.chartType === 'kpi' || t.chart_type === 'kpi') || []} 
                onViewDetail={openCustomerFeedbackDetail}
                onCopyLink={onCopyLink}
                forcePivot={activePage === 2}
                investigativeResult={investigativeResult}
              />
            </div>
          ) : (
            <div className="mt-8">
              {kpiTiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {kpiTiles.map((tile, i) => {
                    const cr = chartsData.get(tile.id);
                    let value = 0;
                    if (cr?.type === 'query' && cr.queryResult?.rows[0]) {
                      const row = cr.queryResult.rows[0] as Record<string, unknown>;
                      const cols = cr.queryResult.columns || [];
                      // read the measure column, not a synthetic helper like "_count"
                      const valueKey = (tile.visualization_config as { value?: string } | undefined)?.value
                        || tile.visualization_config?.yAxis?.[0]
                        || cols.filter(c => !c.startsWith('_')).slice(-1)[0]
                        || (cols.length ? cols[cols.length - 1] : undefined);
                      value = Number(valueKey ? row[valueKey] : Object.values(row)[0]) || 0;
                    }
                    return (
                      <button
                        key={tile.id}
                        onClick={() => openCustomerFeedbackDetail(tile)}
                        className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-green-600 opacity-70 group-hover:opacity-100 transition-opacity" style={{ animationDelay: `${i * 60}ms` }} />
                        <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-[0.18em] mb-2 opacity-80 group-hover:opacity-100 transition-opacity truncate">{tile.title}</span>
                        <span className="block text-[32px] leading-none font-black text-gray-800 tabular-nums tracking-tight">{value.toLocaleString('id-ID')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
                {contentTiles.map(chart => {
                  const cs = bentoSpans.get(chart.id) ?? 6;
                  return (
                    <div
                      key={chart.id}
                      style={{ ['--cs' as string]: cs }}
                      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm transition-shadow hover:shadow-md lg:[grid-column:span_var(--cs)]"
                    >
                      <div className="flex-1 min-h-[300px] flex flex-col">
                        <ChartPreview
                          visualization={greenify(chart.visualization_config || {
                            chartType: (chart.chart_type as ChartType) || 'bar',
                            xAxis: chartsData.get(chart.id)?.queryResult?.columns[0],
                            yAxis: chartsData.get(chart.id)?.queryResult?.columns.slice(1) || [],
                            showLegend: true
                          })}
                          result={chartsData.get(chart.id)?.queryResult || { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 }}
                          tile={{
                            id: chart.id,
                            query: chart.query_config || { source: 'reports', joins: [], dimensions: [], measures: [], filters: [], sorts: [] },
                            visualization: greenify(chart.visualization_config || { chartType: (chart.chart_type as ChartType) || 'bar', yAxis: [], showLegend: true }),
                            layout: (chart.layout as TileLayout) || { x: 0, y: 0, w: 12, h: 4 }
                          } as DashboardTile}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <footer className={cn("mt-auto px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-[11px] font-bold tracking-widest uppercase border-t", cf ? "bg-transparent border-[var(--cf-line)]" : "bg-white border-gray-100")}>
          <div className="flex items-center gap-3"><Image src="/logo.png" alt="Gapura" width={24} height={24} unoptimized style={{ height: 24, width: 'auto', objectFit: 'contain', opacity: 0.5 }} /><span className={cf ? "text-[var(--cf-ink-3)]" : "text-gray-400"}>{cf ? 'Voice of the Customer' : 'Integrated Intelligence'}</span></div>
          <div className={cn("flex items-center gap-6", cf ? "text-[var(--cf-ink-3)]" : "")}><span className={cn("flex items-center gap-2", cf ? "text-[var(--cf-ink-3)]" : "text-gray-400")}><div className={cn("w-2 h-2 rounded-full animate-pulse", cf ? "bg-[var(--cf-teal)] shadow-[0_0_8px_rgba(15,118,110,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]")} />Live</span><span className={cf ? "text-[var(--cf-line)]" : "text-gray-300"}>|</span><span className={cf ? "text-[var(--cf-ink-3)]" : "text-gray-400"}>© {new Date().getFullYear()} PT Gapura Angkasa</span></div>
        </footer>
      </main>

      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"><Menu size={24} /></button>
    </div>
  );
}
