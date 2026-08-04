
'use client';

import {
  BarChart3, ArrowRightLeft, Layers, TrendingUp, PieChart,
  Circle, ScatterChart as ScatterIcon, Table2, Gauge, GitMerge,
  Activity, Grid3X3,
} from 'lucide-react';
import type { ChartType, ChartVisualization, QueryResult } from '@/types/builder';
import { cn } from '@/lib/utils';

interface ChartConfigPanelProps {
  visualization: ChartVisualization;
  result: QueryResult | null;
  onChange: (updates: Partial<ChartVisualization>) => void;
}

const CHART_TYPES: { value: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'horizontal_bar', label: 'H. Bar', icon: ArrowRightLeft },
  { value: 'stacked_bar', label: 'Stacked', icon: Layers },
  { value: 'line', label: 'Line', icon: TrendingUp },
  { value: 'area', label: 'Area', icon: Activity },
  { value: 'pie', label: 'Pie', icon: PieChart },
  { value: 'donut', label: 'Donut', icon: Circle },
  { value: 'scatter', label: 'Scatter', icon: ScatterIcon },
  { value: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
  { value: 'table', label: 'Tabel', icon: Table2 },
  { value: 'kpi', label: 'KPI', icon: Gauge },
  { value: 'combo', label: 'Combo', icon: GitMerge },
];

const COLOR_PALETTES = [
  { name: 'Default', colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] },
  { name: 'Pastel', colors: ['#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5', '#c4b5fd'] },
  { name: 'Vivid', colors: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'] },
  { name: 'Cool', colors: ['#06b6d4', '#8b5cf6', '#3b82f6', '#14b8a6', '#6366f1'] },
  { name: 'Warm', colors: ['#f97316', '#ef4444', '#eab308', '#ec4899', '#f43f5e'] },
];

export function ChartConfigPanel({ visualization, result, onChange }: ChartConfigPanelProps) {
  const columns = result?.columns || [];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] border-l border-[var(--surface-4)]">
      <div className="p-3 border-b border-[var(--surface-4)]">
        <h3 className="text-xs font-bold text-[var(--text-primary)]">Konfigurasi Grafik</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
            Tipe Grafik
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              return (
                <button
                  key={ct.value}
                  onClick={() => onChange({ chartType: ct.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-all",
                    visualization.chartType === ct.value
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-4)] hover:border-[var(--brand-primary)]"
                  )}
                >
                  <Icon size={16} />
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>

        {}
        {columns.length > 0 && (
          <>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                Sumbu X / Label
              </label>
              <select
                value={visualization.xAxis || ''}
                onChange={e => onChange({ xAxis: e.target.value })}
                className="w-full px-2 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              >
                <option value="">Auto</option>
                {columns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                Sumbu Y / Nilai
              </label>
              <div className="space-y-1">
                {columns.map(c => (
                  <label key={c} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visualization.yAxis.includes(c)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...visualization.yAxis, c]
                          : visualization.yAxis.filter(y => y !== c);
                        onChange({ yAxis: next });
                      }}
                      className="rounded border-[var(--surface-4)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
            Judul Grafik
          </label>
          <input
            type="text"
            value={visualization.title || ''}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="Judul..."
            className="w-full px-2 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        {}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={visualization.showLegend}
              onChange={e => onChange({ showLegend: e.target.checked })}
              className="rounded border-[var(--surface-4)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            Show Legend
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={visualization.showLabels}
              onChange={e => onChange({ showLabels: e.target.checked })}
              className="rounded border-[var(--surface-4)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            Show Label
          </label>
        </div>

        {}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
            Tema Warna
          </label>
          <div className="space-y-1.5">
            {COLOR_PALETTES.map(p => (
              <button
                key={p.name}
                onClick={() => onChange({ colors: p.colors })}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors",
                  JSON.stringify(visualization.colors) === JSON.stringify(p.colors)
                    ? "border-[var(--brand-primary)] bg-[var(--surface-2)]"
                    : "border-[var(--surface-4)] hover:border-[var(--text-muted)]"
                )}
              >
                <div className="flex gap-0.5">
                  {p.colors.map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
