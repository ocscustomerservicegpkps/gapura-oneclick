
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Compass, LayoutGrid, Save, RotateCcw, Sparkles, Plus, Loader2, MousePointerClick, Play, BarChart3, Check, PanelLeft, SlidersHorizontal, X, Wand2, ArrowRight } from 'lucide-react';
import { useQueryBuilder } from '@/lib/hooks/useQueryBuilder';
import { useQueryExecution } from '@/lib/hooks/useQueryExecution';
import { useDashboardState } from '@/lib/hooks/useDashboardState';
import { FieldSidebar } from './FieldSidebar';
import { QueryPanel } from './QueryPanel';
import { ResultsPanel } from './ResultsPanel';
import { ChartConfigPanel } from './ChartConfigPanel';
import type { ChartVisualization, QueryResult, FieldDef, AggregateFunction, ChartType, QueryDefinition, TileLayout, QueryFilter } from '@/types/builder';
import { useAIDashboard } from '@/lib/hooks/useAIDashboard';
import { cn } from '@/lib/utils';

const ChartPreview = dynamic(
  () => import('./ChartPreview').then((module) => module.ChartPreview),
  { loading: () => <div className="min-h-64 animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
);
const DashboardComposer = dynamic(
  () => import('./DashboardComposer').then((module) => module.DashboardComposer),
  { loading: () => <div className="min-h-96 animate-pulse rounded-xl bg-[var(--surface-2)]" /> }
);
const SaveDashboardModal = dynamic(
  () => import('./SaveDashboardModal').then((module) => module.SaveDashboardModal)
);

type Mode = 'explore' | 'dashboard';

const PROMPT_SUGGESTIONS = [
  { label: 'Laporan Bulanan', prompt: 'Buatkan dashboard laporan bulanan yang menampilkan trend, distribusi kategori, dan perbandingan antar stasiun' },
  { label: 'Perbandingan Maskapai', prompt: 'Buat dashboard perbandingan jumlah laporan per maskapai dengan breakdown severity dan kategori' },
  { label: 'Trend Compliment', prompt: 'Buatkan dashboard analisis trend compliment per bulan dengan distribusi area dan maskapai' },
  { label: 'Severity Analysis', prompt: 'Buat dashboard analisis severity laporan dengan heatmap per stasiun dan trend waktu' },
];

const AI_STEPS = [
  { label: 'Menganalisis schema...', delay: 0 },
  { label: 'Merancang query...', delay: 3000 },
  { label: 'Menyusun visualisasi...', delay: 8000 },
  { label: 'Menyelesaikan dashboard...', delay: 15000 },
];

interface GlobalFilters {
  hub?: string;
  branch?: string;
  maskapai?: string;
  airlines?: string;
  category?: string;
  area?: string;
}

interface BuilderLayoutProps {
  onSaveDashboard: (name: string, description: string, tiles: SaveTile[], config?: SaveConfig, folder?: string | null) => Promise<{ embedUrl: string } | null>;
  existingFolders?: string[];
}

export interface SaveTile {
  title: string;
  chartType: ChartType;
  dataField: string;
  width: 'full' | 'half' | 'third';
  position: number;
  query_config: QueryDefinition;
  visualization_config: ChartVisualization;
  layout: TileLayout;
  page_name: string;
}

export interface SaveConfig {
  dateRange: string;
  autoRefresh: boolean;
  pages: string[];
  dateFrom?: string;
  dateTo?: string;
}

const defaultVisualization: ChartVisualization = {
  chartType: 'bar',
  yAxis: [],
  showLegend: true,
  showLabels: false,
};

export function BuilderLayout({ onSaveDashboard, existingFolders = [] }: BuilderLayoutProps) {
  const [mode, setMode] = useState<Mode>('explore');
  const [visualization, setVisualization] = useState<ChartVisualization>({ ...defaultVisualization });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingTileId, setEditingTileId] = useState<string | null>(null);
  const [tileResults, setTileResults] = useState<Map<string, QueryResult>>(new Map());
  const [showWelcome, setShowWelcome] = useState(true);
  const tileQuerySeqRef = useRef(0);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiFolder, setAiFolder] = useState('');
  const [aiStep, setAiStep] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<null | 'fields' | 'config'>(null);

  useEffect(() => {
    if (!mobilePanel) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobilePanel(null);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobilePanel]);

  const [cfDateFrom, setCfDateFrom] = useState('');
  const [cfDateTo, setCfDateTo] = useState('');
  const [cfFolder, setCfFolder] = useState('');
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    hub: 'all',
    branch: 'all',
    maskapai: 'all',
    airlines: 'all',
    category: 'all',
    area: 'all'
  });

  const qb = useQueryBuilder();
  const qe = useQueryExecution();
  const dash = useDashboardState();
  const ai = useAIDashboard();

  const hasDimensions = qb.query.dimensions.length > 0;
  const hasMeasures = qb.query.measures.length > 0;
  const hasQuery = hasDimensions || hasMeasures;
  const hasResult = qe.data !== null && qe.data.rows.length > 0;

  useEffect(() => {
    if (hasQuery) {

      Promise.resolve().then(() => setShowWelcome(false));
    }
  }, [hasQuery]);

  useEffect(() => {
    if (!ai.loading) {

      Promise.resolve().then(() => setAiStep(0));
      return;
    }
    const timers = AI_STEPS.map((step, idx) =>
      setTimeout(() => setAiStep(idx), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [ai.loading]);

  const handleFieldClick = useCallback((table: string, field: FieldDef) => {
    if (field.type === 'number' || field.type === 'uuid') {
      const fn: AggregateFunction = field.type === 'uuid' ? 'COUNT' : 'SUM';
      qb.addMeasure({
        table,
        field: field.name,
        function: fn,
        alias: `${fn.toLowerCase()}_${field.name}`,
      });
    } else {
      const isDate = field.type === 'date' || field.type === 'datetime';
      qb.addDimension({
        table,
        field: field.name,
        alias: `${table}_${field.name}`,
        dateGranularity: isDate ? 'month' : undefined,
      });
    }
  }, [qb]);

  const handleExecute = useCallback(async () => {
    const result = await qe.execute(qb.query);

    if (result && result.columns.length > 0) {
      const dims = qb.query.dimensions.map(d => d.alias || `${d.table}_${d.field}`);
      const measures = qb.query.measures.map(m => m.alias || `${m.function.toLowerCase()}_${m.table}_${m.field}`);

      setVisualization(prev => ({
        ...prev,
        xAxis: dims[0] || result.columns[0],
        yAxis: measures.length > 0 ? measures : [result.columns[1] || result.columns[0]],
        chartType: prev.chartType !== 'bar' ? prev.chartType :
          dims.length === 1 && measures.length === 1
            ? (dims[0] && (qb.query.dimensions[0]?.dateGranularity) ? 'line' : 'bar')
            : dims.length === 0 && measures.length === 1 ? 'kpi' : 'bar',
      }));
    }

    return result;
  }, [qb.query, qe]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleExecute]);

  const executeTileQueries = useCallback(async () => {
    const seq = ++tileQuerySeqRef.current;
    const results = new Map<string, QueryResult>();

    const globalFilterDefs: QueryFilter[] = [];
    if (globalFilters.hub !== 'all' && globalFilters.hub !== undefined) globalFilterDefs.push({ table: 'reports', field: 'hub', operator: 'eq', value: globalFilters.hub, conjunction: 'AND' });
    if (globalFilters.branch !== 'all' && globalFilters.branch !== undefined) globalFilterDefs.push({ table: 'reports', field: 'branch', operator: 'eq', value: globalFilters.branch, conjunction: 'AND' });
    if (globalFilters.airlines !== 'all' && globalFilters.airlines !== undefined) globalFilterDefs.push({ table: 'reports', field: 'airline', operator: 'eq', value: globalFilters.airlines, conjunction: 'AND' });
    if (globalFilters.maskapai !== 'all' && globalFilters.maskapai !== undefined) globalFilterDefs.push({ table: 'reports', field: 'airline_type', operator: 'eq', value: globalFilters.maskapai, conjunction: 'AND' });
    if (globalFilters.category !== 'all' && globalFilters.category !== undefined) globalFilterDefs.push({ table: 'reports', field: 'main_category', operator: 'eq', value: globalFilters.category, conjunction: 'AND' });
    if (globalFilters.area !== 'all' && globalFilters.area !== undefined) globalFilterDefs.push({ table: 'reports', field: 'area', operator: 'eq', value: globalFilters.area, conjunction: 'AND' });

    await Promise.all(
      dash.tiles.map(async tile => {
        if (tile.query.dimensions.length > 0 || tile.query.measures.length > 0) {
          try {

            const globalFilterKeys = new Set(globalFilterDefs.map(gf => `${gf.table}:${gf.field}`));
            const filteredTileFilters = tile.query.filters.filter(tf => !globalFilterKeys.has(`${tf.table}:${tf.field}`));

            const blendedQuery = {
              ...tile.query,
              filters: [...filteredTileFilters, ...globalFilterDefs]
            };

            const res = await fetch('/api/dashboards/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: blendedQuery }),
            });
            if (res.ok) {
              const data = await res.json();
              results.set(tile.id, data);
            }
          } catch {  }
        }
      })
    );
    if (seq === tileQuerySeqRef.current) setTileResults(results);
  }, [dash.tiles, globalFilters]);

  useEffect(() => {
    if (mode === 'dashboard') {

      Promise.resolve().then(() => executeTileQueries());
    }
  }, [mode, executeTileQueries]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    const def = await ai.generate(aiPrompt.trim());
    if (def) {
      dash.loadDashboard({ ...def, folder: aiFolder.trim() || undefined });
      setMode('dashboard');
    }
  }, [aiPrompt, ai, aiFolder, dash]);

  const yearRange = useMemo(() => {
    if (!cfDateFrom || !cfDateTo) return '';
    const fy = new Date(cfDateFrom).getFullYear();
    const ty = new Date(cfDateTo).getFullYear();
    return fy === ty ? `${fy}` : `${fy} - ${ty}`;
  }, [cfDateFrom, cfDateTo]);

  const handleCustomerFeedbackGenerate = useCallback(async () => {
    if (!cfDateFrom || !cfDateTo) return;
    const def = await ai.generateCustomerFeedback(cfDateFrom, cfDateTo);
    if (def) {
      dash.loadDashboard({ ...def, folder: cfFolder.trim() || undefined });
      setMode('dashboard');
    }
  }, [cfDateFrom, cfDateTo, cfFolder, ai, dash]);

  const addCurrentAsTile = useCallback(() => {
    if (!hasQuery) return;
    dash.addTile(qb.query, visualization);
    setMode('dashboard');
  }, [qb.query, visualization, dash, hasQuery]);

  const handleEditTile = useCallback((tileId: string) => {
    const tile = dash.tiles.find(t => t.id === tileId);
    if (!tile) return;
    setEditingTileId(tileId);
    qb.loadQuery(tile.query);
    setVisualization(tile.visualization);
    setMode('explore');
  }, [dash.tiles, qb]);

  const handleSaveTileEdit = useCallback(async () => {
    if (!editingTileId) return;
    const result = await handleExecute();
    dash.updateTile(editingTileId, { query: qb.query, visualization });
    if (result) {
      setTileResults(prev => {
        const next = new Map(prev);
        next.set(editingTileId, result);
        return next;
      });
    }
    setEditingTileId(null);
    setMode('dashboard');
  }, [editingTileId, qb.query, visualization, dash, handleExecute]);

  const handleSave = useCallback(async (name: string, description: string, folder: string | null) => {

    const tilePageMap = new Map<string, string>();
    if (dash.pages.length > 0) {
      for (const page of dash.pages) {
        for (const tile of page.tiles) {
          tilePageMap.set(tile.id, page.name);
        }
      }
    }

    const tiles = dash.tiles.map((t, idx) => ({
      title: t.visualization.title || 'Tanpa Judul',
      chartType: t.visualization.chartType,
      dataField: 'custom',
      width: (t.layout.w >= 12 ? 'full' : t.layout.w >= 6 ? 'half' : 'third') as 'full' | 'half' | 'third',
      position: idx,
      query_config: t.query,
      visualization_config: t.visualization,
      layout: t.layout,
      page_name: tilePageMap.get(t.id) || 'Ringkasan Umum',
    }));

    const config = {
      dateRange: '7d',
      autoRefresh: true,
      pages: dash.pages.map(p => p.name),
      dateFrom: cfDateFrom || undefined,
      dateTo: cfDateTo || undefined,
    };

    return onSaveDashboard(name, description, tiles, config, folder);
  }, [dash.tiles, dash.pages, onSaveDashboard, cfDateFrom, cfDateTo]);

  const updateVisualization = useCallback((updates: Partial<ChartVisualization>) => {
    setVisualization(prev => ({ ...prev, ...updates }));
  }, []);

  const chartPreviewNode = qe.data && qe.data.rows.length > 0
    ? <ChartPreview visualization={visualization} result={qe.data} />
    : null;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[var(--surface-1)]/90 supports-[backdrop-filter]:backdrop-blur border-b border-[var(--surface-4)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {}
          <div className="flex bg-[var(--surface-2)] rounded-xl p-0.5 border border-[var(--surface-4)] shrink-0">
            <button
              onClick={() => setMode('explore')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-[13px] font-bold rounded-lg transition-all",
                mode === 'explore'
                  ? "bg-[var(--brand-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Compass size={16} />
              <span className="hidden sm:inline">Jelajahi Data</span>
            </button>
            <button
              onClick={() => {
                if (editingTileId) handleSaveTileEdit();
                else setMode('dashboard');
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-[13px] font-bold rounded-lg transition-all",
                mode === 'dashboard'
                  ? "bg-[var(--brand-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Susun Dashboard</span>
              {dash.tiles.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full bg-white/20 sm:bg-[var(--surface-3)] sm:text-[var(--text-muted)]">
                  {dash.tiles.length}
                </span>
              )}
            </button>
          </div>

          {editingTileId && mode === 'explore' && (
            <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-full">
              Sedang mengedit tile
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {}
          {mode === 'explore' && (
            <>
              <button
                onClick={() => setMobilePanel(p => (p === 'fields' ? null : 'fields'))}
                className="xl:hidden p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
                title="Field data"
              >
                <PanelLeft size={16} />
              </button>
              {hasResult && (
                <button
                  onClick={() => setMobilePanel(p => (p === 'config' ? null : 'config'))}
                  className="xl:hidden p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
                  title="Atur grafik"
                >
                  <SlidersHorizontal size={16} />
                </button>
              )}
            </>
          )}
          {mode === 'explore' && !editingTileId && hasResult && (
            <button
              onClick={addCurrentAsTile}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-[13px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Tambah ke Dashboard</span>
            </button>
          )}
          {editingTileId && mode === 'explore' && (
            <button
              onClick={handleSaveTileEdit}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[13px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Simpan Perubahan</span>
            </button>
          )}
          {mode === 'explore' && (
            <button
              onClick={() => { qb.reset(); qe.clear(); setVisualization({ ...defaultVisualization }); setEditingTileId(null); setShowWelcome(true); setMobilePanel(null); }}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
              title="Mulai Ulang"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {mode === 'dashboard' && dash.tiles.length > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[13px] font-bold bg-[var(--brand-primary)] text-white rounded-lg hover:opacity-90 shadow-sm transition-all"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Simpan Dashboard</span>
            </button>
          )}
        </div>
      </header>

      {}
      {mode === 'explore' ? (
        <div className="relative flex flex-1 overflow-hidden">
          {}
          {mobilePanel && (
            <div
              onClick={() => setMobilePanel(null)}
              className="xl:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] animate-fade-in"
            />
          )}

          {}
          <div
            className={cn(
              "z-40 w-[85%] max-w-[320px] shrink-0 overflow-hidden bg-[var(--surface-1)] shadow-2xl transition-transform duration-300 ease-out",
              "fixed inset-y-0 left-0",
              "xl:static xl:z-auto xl:w-[300px] xl:max-w-none xl:translate-x-0 xl:shadow-none xl:visible xl:pointer-events-auto",
              mobilePanel === 'fields' ? "translate-x-0 visible pointer-events-auto" : "-translate-x-full invisible pointer-events-none"
            )}
          >
            <div className="xl:hidden flex items-center justify-between px-3 py-2 border-b border-[var(--surface-4)]">
              <span className="text-xs font-bold text-[var(--text-primary)]">Sumber Data</span>
              <button onClick={() => setMobilePanel(null)} className="min-h-11 min-w-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg">
                <X size={16} />
              </button>
            </div>
            <FieldSidebar
              source={qb.query.source}
              activeJoins={qb.query.joins.map(j => j.joinKey)}
              onFieldClick={handleFieldClick}
              onToggleJoin={qb.toggleJoin}
              onSetSource={qb.setSource}
            />
          </div>

          {}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {}
            <div className="border-b border-[var(--surface-4)] max-h-[45%] overflow-auto bg-[var(--surface-1)]">
              <QueryPanel
                query={qb.query}
                availableFields={qb.availableFields}
                loading={qe.loading}
                onRemoveDimension={qb.removeDimension}
                onUpdateDimension={qb.updateDimension}
                onRemoveMeasure={qb.removeMeasure}
                onUpdateMeasure={qb.updateMeasure}
                onAddFilter={qb.addFilter}
                onRemoveFilter={qb.removeFilter}
                onUpdateFilter={qb.updateFilter}
                onAddSort={qb.addSort}
                onRemoveSort={qb.removeSort}
                onExecute={handleExecute}
              />
            </div>

            {}
            <div className="flex-1 overflow-hidden">
              {showWelcome && !hasQuery ? (
                <div className="h-full overflow-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
                  <div className="w-full max-w-5xl mx-auto animate-fade-in-up">
                    {}
                    <div className="mb-6">
                      <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">Bangun Dashboard</h1>
                      <p className="text-sm text-[var(--text-muted)] mt-1">Mulai dari AI, pakai template, atau susun manual dari data mentah.</p>
                    </div>

                    {}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
                      {}
                      <div className="lg:col-span-3 relative overflow-hidden rounded-3xl border border-[var(--surface-4)] bg-[var(--surface-1)] shadow-sm">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                        <div className="p-5 sm:p-6">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-md shadow-purple-500/25">
                              <Wand2 size={17} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-[var(--text-primary)] leading-tight">Buat dengan AI</p>
                              <p className="text-[11px] text-[var(--text-muted)]">Deskripsikan, AI merancang seluruh dashboard.</p>
                            </div>
                          </div>

                          <textarea
                            value={aiPrompt}
                            onChange={(e) => { setAiPrompt(e.target.value); ai.clearError(); }}
                            onKeyDown={(e) => {
                              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                handleAIGenerate();
                              }
                            }}
                            placeholder="Contoh: Buatkan dashboard laporan compliment bulan Januari 2026 dengan trend bulanan, distribusi kategori, dan top 10 maskapai..."
                            className="w-full h-24 px-3.5 py-3 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                            disabled={ai.loading}
                          />

                          {!ai.loading && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {PROMPT_SUGGESTIONS.map(s => (
                                <button
                                  key={s.label}
                                  onClick={() => { setAiPrompt(s.prompt); ai.clearError(); }}
                                  className="px-3 py-1.5 text-[11px] font-semibold bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-full text-[var(--text-secondary)] hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="mt-3">
                            <input
                              type="text"
                              value={aiFolder}
                              onChange={(e) => setAiFolder(e.target.value)}
                              placeholder="Simpan di folder (opsional)…"
                              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                              disabled={ai.loading}
                            />
                          </div>

                          {ai.loading && (
                            <div className="mt-4 space-y-2.5">
                              {AI_STEPS.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2.5">
                                  {idx < aiStep ? (
                                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                      <Check size={12} className="text-emerald-600" />
                                    </div>
                                  ) : idx === aiStep ? (
                                    <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                      <Loader2 size={12} className="text-purple-600 animate-spin" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-[var(--surface-3)] shrink-0" />
                                  )}
                                  <span className={cn(
                                    "text-xs transition-colors",
                                    idx < aiStep ? "text-emerald-600 font-medium" :
                                    idx === aiStep ? "text-purple-600 font-bold" :
                                    "text-[var(--text-muted)]"
                                  )}>
                                    {step.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {ai.error && <p className="mt-2.5 text-xs text-red-500">{ai.error}</p>}

                          {!ai.loading && (
                            <div className="flex items-center justify-between mt-4">
                              <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">Ctrl+Enter untuk generate</span>
                              <button
                                onClick={handleAIGenerate}
                                disabled={!aiPrompt.trim()}
                                className={cn(
                                  "flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all w-full sm:w-auto justify-center",
                                  !aiPrompt.trim()
                                    ? "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
                                )}
                              >
                                <Sparkles size={15} />
                                Buat dengan AI
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {}
                      <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-[var(--surface-1)] shadow-sm">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-green-600" />
                        <div className="p-5 sm:p-6 flex flex-col h-full">
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/25">
                              <BarChart3 size={17} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-black text-[var(--text-primary)] leading-tight">Customer Feedback</p>
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wide">Template</span>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)]">Dashboard 5 halaman standar.</p>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                            Case Category, Detail Category, Detail Report, CGO Case Category & CGO Detail Report — layout tetap sesuai standar.
                          </p>
                          <div className="grid grid-cols-2 gap-2.5 mt-auto">
                            <div>
                              <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Dari</label>
                              <input type="date" value={cfDateFrom} onChange={(e) => setCfDateFrom(e.target.value)} disabled={ai.loading}
                                className="w-full mt-1 px-2.5 py-2 text-xs bg-[var(--surface-1)] border border-[var(--surface-4)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-[var(--text-primary)]" />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sampai</label>
                              <input type="date" value={cfDateTo} onChange={(e) => setCfDateTo(e.target.value)} disabled={ai.loading}
                                className="w-full mt-1 px-2.5 py-2 text-xs bg-[var(--surface-1)] border border-[var(--surface-4)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-[var(--text-primary)]" />
                            </div>
                            <div className="col-span-2">
                              <input type="text" value={cfFolder} onChange={(e) => setCfFolder(e.target.value)} placeholder="Folder (opsional)…" disabled={ai.loading}
                                className="w-full px-2.5 py-2 text-xs bg-[var(--surface-1)] border border-[var(--surface-4)] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                            </div>
                          </div>
                          <button
                            onClick={handleCustomerFeedbackGenerate}
                            disabled={!cfDateFrom || !cfDateTo || ai.loading}
                            className={cn(
                              "mt-3 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl transition-all",
                              !cfDateFrom || !cfDateTo || ai.loading
                                ? "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
                                : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg hover:shadow-emerald-500/25"
                            )}
                          >
                            {ai.loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>

                    {}
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-[var(--surface-4)]" />
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">atau buat manual</span>
                      <div className="flex-1 h-px bg-[var(--surface-4)]" />
                    </div>

                    {}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { n: 1, icon: MousePointerClick, from: 'from-blue-400', to: 'to-blue-600', text: 'Pilih field di panel data' },
                        { n: 2, icon: Play, from: 'from-emerald-400', to: 'to-emerald-600', text: 'Jalankan query' },
                        { n: 3, icon: BarChart3, from: 'from-purple-400', to: 'to-purple-600', text: 'Atur grafik & simpan' },
                      ].map((s) => (
                        <div key={s.n} className="flex items-center gap-3 p-3.5 rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)] hover:border-[var(--brand-primary)]/30 hover:-translate-y-0.5 transition-all">
                          <span className={cn("inline-flex w-8 h-8 rounded-xl bg-gradient-to-br text-white items-center justify-center text-xs font-black shrink-0", s.from, s.to)}>{s.n}</span>
                          <s.icon size={15} className="text-[var(--text-muted)] shrink-0" />
                          <p className="text-xs font-medium text-[var(--text-secondary)]">{s.text}</p>
                        </div>
                      ))}
                    </div>

                    {}
                    <button
                      onClick={() => setMobilePanel('fields')}
                      className="xl:hidden mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-bold text-[var(--brand-primary)] bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-2xl hover:bg-[var(--surface-3)] transition-colors"
                    >
                      <PanelLeft size={15} /> Buka Panel Data <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <ResultsPanel
                  result={qe.data}
                  loading={qe.loading}
                  error={qe.error}
                  chartPreview={chartPreviewNode}
                />
              )}
            </div>
          </div>

          {}
          {hasResult && (
            <div
              className={cn(
                "z-40 w-[85%] max-w-[320px] shrink-0 overflow-hidden bg-[var(--surface-1)] shadow-2xl transition-transform duration-300 ease-out",
                "fixed inset-y-0 right-0",
                "xl:static xl:z-auto xl:w-[280px] xl:max-w-none xl:translate-x-0 xl:shadow-none xl:visible xl:pointer-events-auto",
                mobilePanel === 'config' ? "translate-x-0 visible pointer-events-auto" : "translate-x-full invisible pointer-events-none"
              )}
            >
              {}
              <div className="xl:hidden flex items-center justify-between px-3 py-2 border-b border-[var(--surface-4)]">
                <span className="text-xs font-bold text-[var(--text-primary)]">Atur Grafik</span>
                <button onClick={() => setMobilePanel(null)} className="min-h-11 min-w-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg">
                  <X size={16} />
                </button>
              </div>
              <ChartConfigPanel
                visualization={visualization}
                result={qe.data}
                onChange={updateVisualization}
              />
            </div>
          )}
        </div>
      ) : (
        <DashboardComposer
          tiles={dash.tiles}
          onAddTile={dash.addEmptyTile}
          onEditTile={handleEditTile}
          onRemoveTile={dash.removeTile}
          onResizeTile={(id, w, h) => dash.updateTileLayout(id, { w, h })}
          onApplyPreset={dash.applyLayoutPreset}
          tileResults={tileResults}
          dashboardName={dash.name}
          dashboardDescription={dash.description}
          pages={dash.pages}
          yearRange={yearRange}
          onReset={dash.resetTiles}
          onFilterChange={setGlobalFilters}
          currentFilters={globalFilters}
          gridCols={12}
        />
      )}

      <SaveDashboardModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        initialName={dash.name}
        initialDescription={dash.description}
        initialFolder={dash.folder}
        existingFolders={existingFolders}
        onSave={handleSave}
        tileCount={dash.tiles.length}
        pageCount={dash.pages.length}
      />
    </div>
  );
}
