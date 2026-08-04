
'use client';

import { useState, useCallback } from 'react';
import type { DashboardTile, DashboardDefinition, DashboardPage, GlobalFilter, QueryDefinition, ChartVisualization, TileLayout } from '@/types/builder';

const defaultVisualization: ChartVisualization = {
  chartType: 'bar',
  yAxis: [],
  showLegend: true,
  showLabels: false,
};

const LAYOUT_PRESETS = {
  '1-col': [{ x: 0, y: 0, w: 12, h: 2 }],
  '2-col': [
    { x: 0, y: 0, w: 6, h: 2 },
    { x: 6, y: 0, w: 6, h: 2 },
  ],
  '3-col': [
    { x: 0, y: 0, w: 4, h: 2 },
    { x: 4, y: 0, w: 4, h: 2 },
    { x: 8, y: 0, w: 4, h: 2 },
  ],
  '2+1': [
    { x: 0, y: 0, w: 6, h: 2 },
    { x: 6, y: 0, w: 6, h: 2 },
    { x: 0, y: 2, w: 12, h: 2 },
  ],
  '1+2': [
    { x: 0, y: 0, w: 12, h: 2 },
    { x: 0, y: 2, w: 6, h: 2 },
    { x: 6, y: 2, w: 6, h: 2 },
  ],
};

export type LayoutPreset = keyof typeof LAYOUT_PRESETS;

let tileIdCounter = 0;

function nextTileId() {
  tileIdCounter++;
  return `tile-${Date.now()}-${tileIdCounter}`;
}

export function useDashboardState() {
  const [tiles, setTiles] = useState<DashboardTile[]>([]);
  const [pages, setPages] = useState<DashboardPage[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [globalFilters, setGlobalFilters] = useState<GlobalFilter[]>([]);

  const addTile = useCallback((query: QueryDefinition, visualization: ChartVisualization) => {
    const maxY = tiles.length > 0
      ? Math.max(...tiles.map(t => t.layout.y + t.layout.h))
      : 0;

    const newTile: DashboardTile = {
      id: nextTileId(),
      query,
      visualization,
      layout: { x: 0, y: maxY, w: 6, h: 2 },
    };
    setTiles(prev => [...prev, newTile]);
    return newTile.id;
  }, [tiles]);

  const removeTile = useCallback((id: string) => {
    setTiles(prev => {
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const resetTiles = useCallback(() => {
    setTiles([]);
    // loadDashboard() falls back to def.pages[].tiles when def.tiles is
    // empty (see below) — clearing only `tiles` would leave the reset-away
    // tiles resurrectable via stale pages.
    setPages([]);
  }, []);

  const updateTile = useCallback((id: string, updates: Partial<Omit<DashboardTile, 'id'>>) => {
    setTiles(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const updateTileLayout = useCallback((id: string, layout: Partial<TileLayout>) => {
    setTiles(prev => prev.map(t =>
      t.id === id ? { ...t, layout: { ...t.layout, ...layout } } : t
    ));
  }, []);

  const applyLayoutPreset = useCallback((preset: LayoutPreset) => {
    const layouts = LAYOUT_PRESETS[preset];
    setTiles(prev => prev.map((tile, idx) => {
      const layout = layouts[idx % layouts.length];
      const rowOffset = Math.floor(idx / layouts.length) * 2;
      return { ...tile, layout: { ...layout, y: layout.y + rowOffset } };
    }));
  }, []);

  const addEmptyTile = useCallback(() => {
    const defaultQuery: QueryDefinition = {
      source: 'reports',
      joins: [],
      dimensions: [],
      measures: [],
      filters: [],
      sorts: [],
      limit: 1000,
    };
    return addTile(defaultQuery, { ...defaultVisualization });
  }, [addTile]);

  const getDashboardDefinition = useCallback((): DashboardDefinition => {
    return {
      name,
      description: description || undefined,
      folder: folder || undefined,
      tiles,
      pages: pages.length > 0 ? pages : undefined,
      globalFilters: globalFilters.length > 0 ? globalFilters : undefined,
    };
  }, [name, description, folder, tiles, pages, globalFilters]);

  const loadDashboard = useCallback((def: DashboardDefinition) => {
    setName(def.name);
    setDescription(def.description || '');
    setFolder(def.folder || '');

    let allTiles = def.tiles || [];
    if (allTiles.length === 0 && def.pages && def.pages.length > 0) {
       allTiles = def.pages.flatMap(p => p.tiles || []);
    }

    setTiles(allTiles);
    setPages(def.pages || []);
    setGlobalFilters(def.globalFilters || []);
  }, []);

  return {
    tiles,
    pages,
    name,
    description,
    folder,
    globalFilters,
    setName,
    setDescription,
    setFolder,
    setGlobalFilters,
    addTile,
    addEmptyTile,
    removeTile,
    resetTiles,
    updateTile,
    updateTileLayout,
    applyLayoutPreset,
    getDashboardDefinition,
    loadDashboard,
  };
}
