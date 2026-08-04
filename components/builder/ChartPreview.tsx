
'use client';
/* eslint-disable react/no-unescaped-entities */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { ChartVisualization, QueryResult, DashboardTile } from '@/types/builder';
import { CustomPivotTable } from './CustomPivotTable';
import { BranchAreaGrid } from '@/components/chart-detail/BranchAreaGrid';
import { ChartClickHandler } from '@/components/chart-detail/ChartClickHandler';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ExecutivePivotView } from '@/components/builder/ExecutivePivotView';
import { ViewMode, Normalization } from '@/components/chart-detail/GlobalControlBar';

import { formatDateValue, ISO_DATETIME_RE, processChartData, formatDisplayValue, isDateColumn } from '@/lib/chart-utils';

interface ChartPreviewProps {
  visualization: ChartVisualization;
  result: QueryResult;
  compact?: boolean;
  tile?: DashboardTile;
  dashboardId?: string;
  viewMode?: ViewMode;
  normalization?: Normalization;
  isThumbnail?: boolean;
}

const GAPURA_GREEN_LIGHT = '#7cb342';
const GAPURA_GREEN_DARK = '#558b2f';
const GAPURA_BLUE = '#42a5f5';
const GAPURA_YELLOW = '#fdd835';
const GAPURA_RED = '#ef5350';
const GAPURA_ORANGE = '#ffa726';
const GAPURA_GREY = '#bdbdbd';
const GAPURA_AMBER = '#ffca28';

const RANK_COLOR_1 = '#81c784';
const RANK_COLOR_2 = '#13b5cb';
const RANK_COLOR_3 = '#cddc39';
const RANK_COLORS = [RANK_COLOR_1, RANK_COLOR_2, RANK_COLOR_3];

const INTENSITY_COLORS = [
    '#e8f5e9',
    '#a5d6a7',
    '#66bb6a',
    '#388e3c',
    '#1b5e20'
];

const DEFAULT_COLORS = [
  GAPURA_GREEN_LIGHT, GAPURA_BLUE, GAPURA_YELLOW, GAPURA_GREEN_DARK, '#aed581',
  '#33691e', '#9ccc65', '#689f38', '#c5e1a5', '#43a047', '#81c784', '#4caf50',
];

const SEMANTIC_COLORS: Record<string, string> = {

  'irregularity': GAPURA_RED,
  'complaint': GAPURA_ORANGE,
  'compliment': GAPURA_GREEN_LIGHT,

  'terminal': GAPURA_BLUE,
  'terminal area': GAPURA_BLUE,
  'apron': GAPURA_AMBER,
  'apron area': GAPURA_AMBER,
  'general': GAPURA_GREY,
  'cargo': '#8d6e63',
  'kargo': '#8d6e63',

  'open': GAPURA_RED,
  'closed': GAPURA_GREEN_LIGHT,
  'in progress': GAPURA_YELLOW,
  'done': GAPURA_GREEN_LIGHT,
};

function getSemanticColor(value: string | unknown, index: number, fallbackPalette: string[]): string {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();

    if (SEMANTIC_COLORS[normalized]) return SEMANTIC_COLORS[normalized];

    if (normalized.includes('terminal')) return SEMANTIC_COLORS['terminal'];
    if (normalized.includes('apron')) return SEMANTIC_COLORS['apron'];
    if (normalized.includes('general')) return SEMANTIC_COLORS['general'];
    if (normalized.includes('kargo') || normalized.includes('cargo')) return SEMANTIC_COLORS['cargo'];

    if (normalized.includes('irregular')) return SEMANTIC_COLORS['irregularity'];
    if (normalized.includes('complaint')) return SEMANTIC_COLORS['complaint'];
    if (normalized.includes('compliment')) return SEMANTIC_COLORS['compliment'];
  }
  return fallbackPalette[index % fallbackPalette.length];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DateTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; name?: string; value: unknown; payload?: any }>; label?: string }) {
  if (!active || !payload?.length) return null;

  const title = label || payload[0]?.name || payload[0]?.payload?.name || '';

  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="font-medium mb-1 border-b border-gray-100 pb-1">{typeof title === 'string' && ISO_DATETIME_RE.test(title) ? formatDateValue(title) : String(title)}</p>
      {payload.map((p, i) => {

        const entryLabel = p.payload?.measureDisplayName || p.name;
        return (
          <p key={i} className="flex items-center gap-2 mt-0.5" style={{ color: p.color }}>
            <span className="opacity-70 text-[10px] uppercase font-bold">{entryLabel}:</span>
            <span className="font-mono font-bold text-[12px]">{typeof p.value === 'number' ? p.value.toLocaleString('id-ID') : String(p.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

function ExpandableTableCell({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isLong = content.length > 60;

  if (!isLong) return <span>{content}</span>;

  return (
    <div className="flex flex-col gap-1">
      <span className={isExpanded ? "" : "truncate block max-w-full"}>
        {isExpanded ? content : content.substring(0, 57) + "..."}
      </span>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-[9px] font-bold text-[#6b8e3d] hover:text-[#558b2f] flex items-center gap-0.5 w-fit"
      >
        {isExpanded ? "Collapse" : "Expand"}
      </button>
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

function cleanString(str: string) {
  if (!str) return '';

  return str.replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function cleanChartData(rows: Record<string, unknown>[]) {
  return rows
    .map(row => {
      const newRow: Record<string, unknown> = { ...row };
      Object.keys(newRow).forEach(key => {
        const val = newRow[key];
        if (typeof val === 'string') {

          if (val.toUpperCase() === 'CLOSED') {
            newRow[key] = 'Closed';
          } else if (val === '#N/A') {
            newRow[key] = null;
          } else {

            if (val === val.toUpperCase() && val.includes('_')) {
              newRow[key] = cleanString(val);
            }
          }
        }
      });
      return newRow;
    });
}

export function ChartPreview({ visualization, result, compact = false, tile, dashboardId, viewMode = 'values', normalization = 'none', isThumbnail = false }: ChartPreviewProps) {
  const { colorField, showLabels, colors } = visualization;
  let { chartType } = visualization;
  const isMobile = useIsMobile();
  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  const validChartTypes = ['bar', 'horizontal_bar', 'line', 'area', 'pie', 'donut', 'heatmap', 'table', 'pivot', 'kpi', 'branch_area_grid'];
  if (!chartType || !validChartTypes.includes(chartType)) {

    chartType = 'bar';
  }

  const palette = (colors && colors.length > 0) ? colors : DEFAULT_COLORS;

  const rawData = React.useMemo(() => cleanChartData(result.rows as Record<string, unknown>[]), [result.rows]);

  if (rawData.length === 0) {

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
          <span className="text-xl">📊</span>
        </div>
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight mb-1">Tidak Ada Data</p>
        <p className="text-[10px] text-slate-400 max-w-[160px] mb-2">Belum ada data tersedia untuk visualisasi "{visualization.title || chartType}" ini.</p>

        {result.columns.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-1 max-w-[200px]">
            <p className="text-[8px] text-slate-400 w-full mb-1">Kolom tersedia:</p>
            {result.columns.map(c => (
              <span key={c} className="px-1.2 py-0.4 bg-slate-200/50 rounded text-[7px] text-slate-500 font-mono">
                {c}
              </span>
            ))}
          </div>
        )}

        {compact && (
          <div className="mt-3 px-2 py-1 bg-slate-100 rounded text-[9px] text-slate-500 font-mono">
            {chartType}
          </div>
        )}
      </div>
    );
  }

  const wrap = (children: React.ReactNode) => {
    const content = tile ? (
      <ChartClickHandler tile={tile} result={result} dashboardId={dashboardId}>
        {children}
      </ChartClickHandler>
    ) : children;

    return (
      <>
        {content}
        <DrilldownRenderer />
      </>
    );
  };

  let activeXKey = visualization.xAxis || '';
  if (!result.columns.includes(activeXKey)) {

    const normalizedX = activeXKey.toLowerCase().replace(/[_\s]/g, '');

    const matches = result.columns.map(c => {
      const normalizedC = c.toLowerCase().replace(/[_\s]/g, '');
      let score = 0;
      if (normalizedC === normalizedX) score = 100;
      else if (normalizedC.startsWith(normalizedX) || normalizedX.startsWith(normalizedC)) score = 80;
      else if (normalizedC.includes(normalizedX) || normalizedX.includes(normalizedC)) score = 50;

      if (normalizedX.includes('name') || normalizedX.includes('label') || normalizedX.includes('kategori')) {
        if (normalizedC.includes('name') || normalizedC.includes('label') || normalizedC.includes('nama')) score += 10;
      }

      if (normalizedX.includes('date') || normalizedX.includes('time') || normalizedX.includes('bulan') || normalizedX.includes('month') || normalizedX.includes('tren') || normalizedX.includes('period')) {
        if (normalizedC.includes('date') || normalizedC.includes('time') || normalizedC.includes('tgl') || normalizedC.includes('tanggal') || normalizedC.includes('month') || normalizedC.includes('bulan') || normalizedC.includes('period')) {
          score += 20;
        }
      }

      return { col: c, score };
    }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      activeXKey = matches[0].col;
    } else {

      const firstDateCol = result.columns.find(c => {
        const val = rawData[0]?.[c];
        return typeof val === 'string' && ISO_DATETIME_RE.test(val);
      });

      const firstStringCol = result.columns.find(c => {
        const val = rawData[0]?.[c];
        return typeof val === 'string' && isNaN(Number(val));
      });

      activeXKey = firstDateCol || firstStringCol || result.columns[0] || '';
    }
  }

  if (rawData[0] && activeXKey && result.columns.length > 1) {
    const xVal = rawData[0][activeXKey];
    const firstOtherCol = result.columns.find(c => c !== activeXKey) || result.columns[1];
    const otherVal = rawData[0][firstOtherCol];

    const xIsNumeric = typeof xVal === 'number' || (typeof xVal === 'string' && xVal.trim() !== '' && !isNaN(Number(xVal)));
    const otherIsString = typeof otherVal === 'string' && (isNaN(Number(otherVal)) || otherVal.trim() === '');

    if (xIsNumeric && otherIsString) {

      if (!ISO_DATETIME_RE.test(String(xVal))) {
        activeXKey = firstOtherCol;
      }
    }
  }

  const rawY = visualization.yAxis;
  const rawYArray = Array.isArray(rawY) ? rawY : (rawY ? [String(rawY)] : []);

  let activeYKeys = rawYArray.filter(y => result.columns.includes(y));
  if (activeYKeys.length === 0) {

    activeYKeys = rawYArray.map(y => {
      const normalizedY = y.toLowerCase().replace(/[_\s]/g, '');
      const matches = result.columns.map(c => {
        const normalizedC = c.toLowerCase().replace(/[_\s]/g, '');
        let score = 0;
        if (normalizedC === normalizedY) score = 100;
        else if (normalizedC.startsWith(normalizedY) || normalizedY.startsWith(normalizedC)) score = 80;
        else if (normalizedC.includes(normalizedY) || normalizedY.includes(normalizedC)) score = 50;

        if (normalizedY.includes('total') || normalizedY.includes('count') || normalizedY.includes('jumlah') || normalizedY.includes('insiden') || normalizedY.includes('value')) {
          if (normalizedC.includes('total') || normalizedC.includes('count') || normalizedC.includes('jumlah') || normalizedC.includes('insiden') || normalizedC.includes('value')) score += 10;
        }

        return { col: c, score };
      }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

      return matches.length > 0 ? matches[0].col : null;
    }).filter((y): y is string => !!y);
  }

  if (activeYKeys.length === 0) {
    activeYKeys = result.columns.filter(c => {
      if (c === activeXKey) return false;

      return rawData.some(r => {
        const val = r[c];
        if (typeof val === 'number' && isFinite(val)) return true;
        if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) return true;
        return false;
      });
    });
  }

  if (activeYKeys.length === 0 && result.columns.length > 1) {
    const lastCol = result.columns[result.columns.length - 1];
    if (lastCol !== activeXKey) {
      activeYKeys = [lastCol];
    } else {
      activeYKeys = [result.columns[result.columns.length - 2] || result.columns[0]];
    }
  }

  if (activeYKeys.length === 1 && activeYKeys[0] === activeXKey && result.columns.length > 1) {
    const fallbackY = result.columns.find(c => c !== activeXKey);
    if (fallbackY) activeYKeys = [fallbackY];
  }

  const fullData = processChartData(rawData, activeXKey);
  const displayLimit = visualization.displayLimit;

  const isDateTrend = isDateColumn(rawData, activeXKey);
  const data = (displayLimit && displayLimit > 0)
    ? (isDateTrend ? fullData.slice(-displayLimit) : fullData.slice(0, displayLimit))
    : fullData;

  if (chartType === 'heatmap') {
    const cols = result.columns;
    if (cols.length < 3) return <div className="p-4 text-xs text-center text-muted-foreground bg-gray-50 rounded border border-dashed">Heatmap memerlukan minimal 3 kolom (2 dimensi, 1 nilai)</div>;

    const numericCols = cols.filter(c => {
      const vals = rawData.slice(0, 20).map(r => r[c]);

      return vals.some(v => (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))));
    });
    const categCols = cols.filter(c => !numericCols.includes(c));

    let valueKey = colorField && cols.includes(colorField) ? colorField : '';

    if (!valueKey) {

      const candidateValues = numericCols.filter(c => c !== activeXKey);
      if (candidateValues.length > 0) {

        const preferred = candidateValues.find(c => 
          /jumlah|total|count|nilai|score|value|qty|amount/i.test(c)
        );
        valueKey = preferred || candidateValues[0];
      } else {
        valueKey = numericCols[0] || activeYKeys[0] || cols[cols.length - 1];
      }
    }

    const availableDims = categCols.filter(c => c !== valueKey);
    const dimKeys = availableDims.length >= 2 
      ? availableDims.slice(0, 2) 
      : cols.filter(c => c !== valueKey).slice(0, 2);

    const colKey = activeXKey && dimKeys.includes(activeXKey) ? activeXKey : dimKeys[0];
    const rowKey = dimKeys.find(d => d !== colKey) || dimKeys[1] || dimKeys[0];

    const rowLabels = [...new Set(rawData.map(d => String(d[rowKey] ?? '')))];
    const colLabels = [...new Set(rawData.map(d => String(d[colKey] ?? '')))];

    const limitRows = displayLimit && displayLimit > 0 ? displayLimit : (compact ? 10 : rowLabels.length);
    const displayRowLabels = rowLabels.slice(0, limitRows);
    const displayColLabels = compact ? colLabels.slice(0, 8) : colLabels;

    const cellWidth = compact ? 'minmax(45px, 1fr)' : 'minmax(64px, 1fr)';
    const cellHeight = compact ? 'h-7' : 'h-10';
    const rowHeaderWidth = compact ? 'w-20' : 'w-28';

    const heatmapMaxVal = Math.max(...rawData.map(r => {
      const v = r[valueKey];
      const num = (typeof v === 'number') ? v : Number(v);
      return isNaN(num) ? 0 : num;
    }), 1);

    return (
      <>
      <div className="w-full h-full overflow-auto p-1 custom-scrollbar bg-white">
        <div className="grid gap-px bg-slate-200 p-px rounded-lg overflow-hidden min-w-full shadow-sm" 
             style={{ gridTemplateColumns: `auto repeat(${displayColLabels.length}, ${cellWidth})` }}>
          <div className="bg-slate-50/80 sticky left-0 z-20" /> 
          {displayColLabels.map(cl => (
            <div key={cl} className={`bg-slate-50/80 p-1.5 ${compact ? 'text-[8px]' : 'text-[9px]'} text-center font-bold text-slate-500 uppercase tracking-tight border-b border-slate-200 flex items-center justify-center`}>
              <span className="truncate w-full" title={cl}>
                {cl.length > 10 && compact ? cl.substring(0, 8) + '..' : cl}
              </span>
            </div>
          ))}
          {displayRowLabels.map(rl => (
            <React.Fragment key={rl}>
              <div className={`bg-slate-50/80 p-1.5 ${compact ? 'text-[8px]' : 'text-[9px]'} text-right font-bold text-slate-600 uppercase tracking-tight self-center border-r border-slate-200 ${rowHeaderWidth} sticky left-0 z-10 flex items-center justify-end`}>
                <span className="truncate w-full" title={rl}>
                  {rl.length > 12 && compact ? rl.substring(0, 10) + '..' : rl}
                </span>
              </div>
              {displayColLabels.map(cl => {
                const row = rawData.find(r => String(r[rowKey]) === rl && String(r[colKey]) === cl);
                const rawVal = row?.[valueKey];
                const val = (typeof rawVal === 'number') ? rawVal : (rawVal ? Number(rawVal) : 0);
                const displayVal = isNaN(val) ? '0' : val.toLocaleString('id-ID');

                const intensity = !isNaN(val) && val > 0 ? Math.max(10, (val / heatmapMaxVal) * 100) : 0;

                return (
                  <div 
                    key={cl} 
                    className={`group relative ${cellHeight} flex items-center justify-center ${compact ? 'text-[8px]' : 'text-[10px]'} bg-white transition-all hover:z-30 hover:scale-[1.1] hover:shadow-xl ${!isNaN(val) && val > 0 ? 'cursor-pointer' : 'cursor-default'} border-r border-b border-slate-100 last:border-r-0`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isNaN(val) && val > 0) {
                        const filtered = rawData.filter(r => String(r[rowKey]) === rl && String(r[colKey]) === cl);
                        if (filtered.length > 0) {
                          openDrilldown(filtered, `${rowKey}: ${rl} × ${colKey}: ${cl}`);
                        }
                      }
                    }}
                  >
                    <div 
                      className="absolute inset-0 transition-all duration-300"
                      style={{ 
                        backgroundColor: palette[0],
                        opacity: !isNaN(val) && val > 0 ? (intensity / 100) : 0.03
                      }}
                    />
                    <span className={`relative font-mono font-bold transition-colors ${!isNaN(val) && val > 0 ? (intensity > 50 ? 'text-white' : 'text-slate-900') : 'text-slate-300'}`}>
                      {!isNaN(val) && val !== 0 ? displayVal : '0'}
                    </span>

                    {}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 pointer-events-none transition-all animate-in fade-in slide-in-from-bottom-1">
                      <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[10px] py-2 px-3 rounded-lg shadow-2xl border border-white/10 min-w-[120px]">
                        <div className="flex items-center justify-between mb-1.5 border-b border-white/10 pb-1">
                          <span className="font-bold text-white/50 uppercase text-[8px] tracking-wider">Detail</span>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette[0] }} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-white/60">{rowKey}:</span>
                            <span className="font-bold text-right">{rl}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-white/60">{colKey}:</span>
                            <span className="font-bold text-right">{cl}</span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 mt-1 border-t border-white/5">
                            <span className="text-emerald-400/80 font-medium">{valueKey}:</span>
                            <span className="font-bold text-emerald-400 text-sm">
                              {displayVal}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-2.5 h-2.5 bg-slate-900/95 rotate-45 mx-auto -mt-1.5 border-r border-b border-white/10" />
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <DrilldownRenderer />
      </>
    );
  }

  if (chartType === 'table') {
    return wrap(
      <div className="w-full h-full overflow-auto">
        <table className="min-w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>{result.columns.map(c => <th key={c} className="px-3 py-2 text-left font-bold border-b">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rawData.slice(0, 50).map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 border-b transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openDrilldown([row], `Record #${i + 1}`); }}>
                {result.columns.map(c => {
                   const val = row[c];
                   const valStr = String(val ?? '-');
                   const isUrlCol = c.toLowerCase().includes('link') || c.toLowerCase().includes('url') || c.toLowerCase().includes('evidence');
                   const isReport = c.toLowerCase().includes('report') || c.toLowerCase().includes('desc') || c.toLowerCase().includes('root') || c.toLowerCase().includes('action');

                   return (
                     <td key={c} className={`px-3 py-2 ${isReport ? 'min-w-[180px]' : (isUrlCol ? 'min-w-[120px]' : 'truncate max-w-[150px]')} align-top`}>
                       {isUrlCol ? (
                         <div className="flex flex-wrap gap-2 text-[10px]">
                           {valStr.split(/[\s,]+/).filter(link => link.startsWith('http')).map((link, lidx) => (
                             <a 
                               key={lidx} 
                               href={link} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-bold transition-colors bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"
                             >
                               Link {valStr.split(/[\s,]+/).filter(l => l.startsWith('http')).length > 1 ? `#${lidx + 1}` : ''} <span className="text-[8px]">↗</span>
                             </a>
                           ))}
                           {!valStr.includes('http') && valStr !== '-' && <span className="text-slate-400 italic font-mono">{valStr}</span>}
                           {valStr === '-' && <span className="text-slate-300">-</span>}
                         </div>
                       ) : isReport ? (
                         <ExpandableTableCell content={valStr} />
                       ) : (
                         valStr
                       )}
                     </td>
                   );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (chartType === 'pivot') {

    const isExecutiveContext = visualization.title?.includes('by Airlines');

    if (isExecutiveContext && !isThumbnail) {
      return wrap(
        <ExecutivePivotView 
          result={result} 
          title={visualization.title} 
          viewMode={viewMode}
          normalization={normalization}
          isTile={!!tile}
        />
      );
    }

    return wrap(
      <CustomPivotTable 
        result={result} 
        title={visualization.title} 
        viewMode={viewMode}
        normalization={normalization}
        compact={compact}
      />
    );
  }

  if (chartType === 'branch_area_grid') {
    return wrap(
      <BranchAreaGrid 
        data={result} 
        config={visualization} 
        viewMode={viewMode}
        normalization={normalization}
      />
    );
  }

  if (chartType === 'pie' || chartType === 'donut') {
    const isDonut = chartType === 'donut';

    let nameKey = activeXKey;
    if (!nameKey || !result.columns.includes(nameKey)) {
      const stringCols = result.columns.filter(c => {
        const val = rawData[0]?.[c];
        return typeof val === 'string' && isNaN(Number(val));
      });
      nameKey = stringCols[0] || result.columns[0];
    }

    let dataKey = visualization.colorField || activeYKeys[0];

    if (dataKey === nameKey) dataKey = '';

    if (!dataKey || !result.columns.includes(dataKey)) {
      const numericMatches = result.columns.map(c => {
        if (c === nameKey) return { col: c, score: -1 };

        const normalizedC = c.toLowerCase().replace(/[_\s]/g, '');
        let score = 0;

        const samples = rawData.slice(0, 5).map(r => r[c]);
        const isNumeric = samples.some(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))));

        if (isNumeric) {
          score += 50;

          if (normalizedC.includes('total') || normalizedC.includes('count') || normalizedC.includes('jumlah') || normalizedC.includes('value')) {
            score += 30;
          }

          if (normalizedC.includes('insiden') || normalizedC.includes('incident')) {
            score += 10;
          }
        }

        return { col: c, score };
      }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

      if (numericMatches.length > 0) {
        dataKey = numericMatches[0].col;
      }
    }

    if (!dataKey && result.columns.length >= 2) {
      dataKey = result.columns.find(c => c !== nameKey) || result.columns[1];
    }

  if (!dataKey) {

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
          <span className="text-lg">🥧</span>
        </div>
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight mb-1">Gagal Memuat Pie Chart</p>
        <p className="text-[10px] text-slate-400 mb-2">Kolom data numerik tidak ditemukan dalam hasil query.</p>
        <div className="flex flex-wrap justify-center gap-1 mt-1">
          {result.columns.map(c => (
            <span key={c} className="px-1.5 py-0.5 bg-slate-200/50 rounded text-[8px] text-slate-500 font-mono">
              {c}
            </span>
          ))}
        </div>
      </div>
    );
  }

    const stringCols = result.columns.filter(c => {

      if (c === dataKey) return false;
      const val = rawData[0]?.[c];
      return typeof val === 'string' && isNaN(Number(val));
    });

    let pieData = rawData.map(row => {

      const descriptiveName = stringCols
        .map(c => String(row[c] ?? ''))
        .filter(v => v !== '')
        .join(' - ');

      return {
        name: descriptiveName || 'Unknown',
        value: Number(row[dataKey]) || 0,
        measureDisplayName: dataKey,
        payload: row
      };
    }).filter(d => d.value > 0);

    pieData.sort((a, b) => b.value - a.value);

    if (displayLimit && displayLimit > 0) {
        pieData = pieData.slice(0, displayLimit);
    }

    const pieProps = compact
      ? { cx: '50%', cy: '50%', innerRadius: isDonut ? 40 : 0, outerRadius: 65 }
      : { cx: '50%', cy: '50%', innerRadius: isDonut ? 80 : 0, outerRadius: 110 };

    const pieHeight = isMobile ? (compact ? 300 : 350) : (compact ? 250 : 380); 

    return wrap(
      <div style={{ width: '100%', height: pieHeight, overflow: 'hidden' }} className="flex flex-col items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
            <Tooltip content={<DateTooltip />} />
            <Legend 
              verticalAlign="bottom"
              align="center"
              layout="horizontal"
              iconSize={isMobile ? 6 : 8}
              iconType="circle"
              wrapperStyle={{ 
                fontSize: isMobile ? '10px' : '11px',
                width: '100%',
                paddingTop: isMobile ? '5px' : '10px',
                lineHeight: '1.2'
              }}
            />
            <Pie
              isAnimationActive={false}
              data={pieData}
              {...pieProps}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              labelLine={false}
              cursor="pointer"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={((entry: any, _index: number, event: any) => {
                if (event) event.stopPropagation();
                const originalRow = entry?.payload;
                if (originalRow) {
                  const filtered = rawData.filter(row => {
                    return stringCols.every(c => String(row[c] ?? '').trim() === String(originalRow[c] ?? '').trim());
                  });
                  openDrilldown(filtered.length > 0 ? filtered : [originalRow], entry.name || 'Detail');
                }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(showLabels || isDonut) ? (props: any) => {
                const { cx, cy, midAngle, outerRadius, percent, value, name } = props;
                const RADIAN = Math.PI / 180;

                const radius = outerRadius + (isDonut ? 14 : 20); 
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                if (isDonut) {
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#374151"
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      fontSize={compact ? 10 : 11}
                      fontWeight={700}
                    >
                      {Number(value || 0).toLocaleString('id-ID')}
                    </text>
                  );
                }

                if (percent < 0.03) return null;

                return (
                  <text 
                    x={x} 
                    y={y} 
                    fill="#374151" 
                    textAnchor={x > cx ? 'start' : 'end'} 
                    dominantBaseline="central"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {`${name}: ${value?.toLocaleString('id-ID')} (${(percent * 100).toFixed(0)}%)`}
                  </text>
                );
              } : false}
            >
              {pieData.map((entry, index) => {

                let fill = getSemanticColor(entry.name, index, palette);
                if (index < 3) {
                  fill = RANK_COLORS[index];
                }
                return <Cell key={`cell-${index}`} fill={fill} stroke="white" strokeWidth={2} />;
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const commonProps = {
    tick: { fontSize: 10, fill: '#6b7280' },
    axisLine: { stroke: '#e5e7eb' },
    tickLine: false,
  };

  const chartHeight = isMobile ? (compact ? 280 : 350) : (compact ? 220 : 400);

  const isXLong = data.some(d => String(d[activeXKey] ?? '').length > (compact ? 6 : 10));

  const shouldRotateX = !(['pie', 'donut', 'heatmap', 'horizontal_bar', 'bar'] as string[]).includes(chartType) && (isXLong || data.length > (compact ? 4 : 8));

  let bottomMargin = shouldRotateX ? (compact ? 45 : 65) : (compact ? 30 : 20);
  if (chartType === 'bar') {
      bottomMargin = compact ? 30 : 70;
  }

  if (chartType === 'kpi') {
    const row = rawData[0];
    let value: string | number = '-';
    const label = visualization.title || 'Total';

    if (row) {

      const yKey = activeYKeys[0] || result.columns.find(c => c !== activeXKey) || result.columns[0];
      const val = row[yKey];
      value = (typeof val === 'number') ? val : Number(val);
      if (isNaN(value as number)) value = '-';
    }

    const kpiColor = getSemanticColor(label, 0, [GAPURA_GREEN_DARK]);

    return wrap(
      <div 
        className="flex flex-col items-center justify-center h-full min-h-[120px] p-4 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); if (rawData.length > 0) openDrilldown(rawData, visualization.title || 'KPI Detail'); }}
      >
        <div className="text-xs font-bold uppercase tracking-wider text-center mb-1" style={{ color: kpiColor }}>
          {label}
        </div>
        <div className="text-4xl md:text-5xl font-bold" style={{ color: kpiColor }}>
          {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
        </div>
        {compact && (
          <div className="mt-2 text-[10px] text-gray-400 font-medium">
            {formatDateValue(new Date().toISOString())}
          </div>
        )}
      </div>
    );
  }

  if (chartType === 'bar' || chartType === 'horizontal_bar') {
    const horizontal = chartType === 'horizontal_bar';

    let sortedValues: number[] = [];
    if (activeYKeys.length === 1) {
        const yKey = activeYKeys[0];
        sortedValues = data.map(d => {
            const val = d[yKey];
            return typeof val === 'number' ? val : Number(val) || 0;
        }).sort((a, b) => b - a);
    }

    const fontSize = compact ? 9 : 10;

    const itemHeight = compact ? 32 : (data.length > 20 ? 30 : (data.length > 10 ? 40 : 55));

    const dynamicMinH = horizontal ? (data.length * itemHeight + 50) : '100%';

    const containerHeight = horizontal ? dynamicMinH : chartHeight;

    let yAxisWidth = 80;
    if (horizontal) {
      const labels = data.map(d => String(d[activeXKey] ?? ''));
      const longestWord = Math.max(...labels.flatMap(l => l.split(' ').map(w => w.length)), 0);

      const effectiveCharLen = Math.min(Math.max(longestWord, compact ? 12 : 15), 35);
      yAxisWidth = Math.min(Math.max(effectiveCharLen * (compact ? 6 : 8), compact ? 100 : 150), 300);
    }

    return wrap(
      <div className="bg-white rounded-lg p-1" style={{ width: '100%', height: horizontal ? 'auto' : chartHeight, overflow: horizontal ? 'visible' : 'hidden' }}>
        <ResponsiveContainer width="100%" height={containerHeight} minWidth={0} minHeight={0}>
          <BarChart 
            data={data} 
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ 
              top: compact ? 30 : 25, 
              right: horizontal ? (compact ? 40 : 60) : 10, 
              left: 0, 
              bottom: horizontal ? 5 : bottomMargin
            }}
            barCategoryGap={compact ? "20%" : "30%"}
            barSize={horizontal ? (compact ? 20 : 32) : undefined}
          >
            {}
            <CartesianGrid strokeDasharray="3 3" vertical={!horizontal} horizontal={false} stroke="#f3f4f6" />

            {horizontal ? (
              <>
                <XAxis type="number" {...commonProps} hide={true} domain={[0, 'auto']} />
                <YAxis 
                  type="category" 
                  dataKey={activeXKey} 
                  {...commonProps} 
                  width={yAxisWidth} 
                  interval={0} 
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const label = String(payload.value);
                    const isTop = payload.index === 0;

                    const maxChars = compact ? Math.floor(yAxisWidth / 5.5) : 30;
                    const truncatedLabel = label.length > maxChars ? label.substring(0, maxChars - 2) + '..' : label;

                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text 
                          x={-8} 
                          y={4} 
                          textAnchor="end" 
                          fontSize={fontSize} 
                          fill={isTop ? "#111827" : "#6b7280"}
                          fontWeight={isTop ? 600 : 400}
                        >
                          {truncatedLabel}
                        </text>
                      </g>
                    );
                  }}
                />
              </>
            ) : (
              <>
                <XAxis 
                  dataKey={activeXKey} 
                  {...commonProps} 
                  height={80}
                  interval={0} 
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const label = String(payload.value);
                    const words = label.split(/\s+/);
                    const lines: string[] = [];
                    let currentLine = words[0] || ''; 

                    for (let i = 1; i < words.length; i++) {
                        if ((currentLine + ' ' + words[i]).length < 15) {
                            currentLine += ' ' + words[i];
                        } else {
                            lines.push(currentLine);
                            currentLine = words[i];
                        }
                    }
                    lines.push(currentLine);

                    const displayLines = lines.slice(0, 3);
                    if (lines.length > 3) {
                        displayLines[2] += '...';
                    } 

                    return (
                      <g transform={`translate(${x},${y})`}>
                        {displayLines.map((line, i) => (
                            <text
                              key={i}
                              x={0}
                              y={0}
                              dy={16 + (i * 12)}
                              textAnchor="middle"
                              fill="#6b7280"
                              fontSize={fontSize}
                              fontWeight={400}
                            >
                              {line}
                            </text>
                        ))}
                      </g>
                    );
                  }}
                />
                <YAxis {...commonProps} width={compact ? 25 : 40} allowDecimals={false} />
              </>
            )}
            <Tooltip content={<DateTooltip />} />
            {activeYKeys.map((key, i) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={getSemanticColor(key, i, palette)} 
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} 
                animationDuration={1000}
                cursor="pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={((entry: any, _index: number, event: any) => {
                  if (event) event.stopPropagation();
                  const xVal = String(entry?.payload?.[activeXKey] ?? '');
                  const filtered = rawData.filter(r => String(r[activeXKey]) === xVal);
                  if (filtered.length > 0) {
                    openDrilldown(filtered, `${activeXKey}: ${xVal}`);
                  }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any}
                label={showLabels ? { 
                  position: horizontal ? 'right' : 'top', 
                  fontSize: fontSize, 
                  fill: '#374151',
                  fontWeight: 600,
                  formatter: (val: unknown) => formatDisplayValue(val),
                  offset: 5
                } : false}
              >
                {}
                {activeYKeys.length === 1 && data.map((entry, index) => {
                  const xVal = String(entry[activeXKey]);
                  const yKey = activeYKeys[0];
                  const val = entry[yKey];
                  const numericVal = typeof val === 'number' ? val : Number(val) || 0;

                  let finalColor = getSemanticColor(xVal, index, palette);
                  let finalOpacity = 1;

                  if (horizontal) {

                      const maxValue = sortedValues.length > 0 ? sortedValues[0] : 0;

                      const ratio = maxValue > 0 ? (numericVal / maxValue) : 0;

                      let intensityIndex = Math.floor(ratio * 5);

                      if (intensityIndex >= 5) intensityIndex = 4;
                      if (intensityIndex < 0) intensityIndex = 0;

                      finalColor = INTENSITY_COLORS[intensityIndex];
                      finalOpacity = 1;
                  } else {

                      if (sortedValues.length > 0) {
                          const rankIndex = sortedValues.indexOf(numericVal);
                          if (rankIndex >= 0 && rankIndex < 3) {
                              finalColor = RANK_COLORS[rankIndex];
                          }
                      }
                  }

                  return <Cell key={`cell-${index}`} fill={finalColor} fillOpacity={finalOpacity} />;
                })}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (!activeXKey || activeYKeys.length === 0) {
    console.error('[ChartPreview] Cannot render chart - missing axis configuration:', {
      chartType,
      activeXKey,
      activeYKeys,
      columns: result.columns
    });
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center p-6 bg-red-50/50 rounded-xl border border-dashed border-red-200">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
          <span className="text-lg">⚠️</span>
        </div>
        <p className="text-[11px] font-bold text-red-600 uppercase tracking-tight mb-1">Konfigurasi Tidak Valid</p>
        <p className="text-[10px] text-red-400 max-w-[160px]">Tidak dapat menemukan kolom yang sesuai untuk sumbu X atau Y.</p>
        <div className="mt-3 px-2 py-1 bg-red-100/50 rounded text-[8px] text-red-500 font-mono">
          X: {activeXKey || '?'}, Y: {activeYKeys.join(', ') || '?'}
        </div>
      </div>
    );
  }

  return wrap(
    <div className="bg-white rounded-lg p-1" style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {chartType === 'line' ? (
          <LineChart 
            data={data} 
            margin={{ 
              top: 10, 
              right: 10, 
              left: 0, 
              bottom: bottomMargin 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey={activeXKey} 
              {...commonProps} 
              height={shouldRotateX ? (compact ? 55 : 75) : (compact ? 35 : 30)}
              interval={data.length > (compact ? 10 : 20) ? 'preserveStartEnd' : 0}
              tick={(props) => {
                const { x, y, payload } = props;
                let label = String(payload.value);

                if (label.includes(' ') && label.length > 10) {
                  const parts = label.split(' ');
                  if (parts.length >= 2) {

                    if (compact || data.length > 10) {
                      label = `${parts[0]} ${parts[1]}`;
                    }
                  }
                }

                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={10}
                      textAnchor={shouldRotateX ? "end" : "middle"}
                      fill="#666"
                      fontSize={compact ? 8 : 10}
                      transform={shouldRotateX ? "rotate(-45)" : undefined} 
                      fontWeight={500}
                    >
                      {label.length > (compact ? 12 : 25) ? label.substring(0, compact ? 10 : 22) + '...' : label}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis {...commonProps} width={compact ? 25 : 40} allowDecimals={false} />
            <Tooltip content={<DateTooltip />} />
            {activeYKeys.map((key, i) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={getSemanticColor(key, i, palette)} 
                strokeWidth={2} 
                dot={compact ? {r: 2} : {r: 3}} 
                activeDot={{ r: 5, cursor: 'pointer' }}
                animationDuration={1000}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={((entry: any, _index: number, event: any) => {
                  if (event) event.stopPropagation();
                  const xVal = String(entry?.payload?.[activeXKey] ?? '');
                  const filtered = rawData.filter(r => String(r[activeXKey]) === xVal);
                  if (filtered.length > 0) {
                    openDrilldown(filtered, `${activeXKey}: ${xVal}`);
                  }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart 
            data={data} 
            margin={{ 
              top: 10, 
              right: 10, 
              left: 0, 
              bottom: bottomMargin 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey={activeXKey} 
              {...commonProps} 
              height={shouldRotateX ? (compact ? 55 : 75) : (compact ? 35 : 30)}
              interval={data.length > (compact ? 10 : 20) ? 'preserveStartEnd' : 0}
              tick={(props) => {
                const { x, y, payload } = props;
                let label = String(payload.value);

                if (label.includes(' ') && label.length > 10) {
                  const parts = label.split(' ');
                  if (parts.length >= 2) {

                    if (compact || data.length > 10) {
                      label = `${parts[0]} ${parts[1]}`;
                    }
                  }
                }

                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={10}
                      textAnchor={shouldRotateX ? "end" : "middle"}
                      fill="#666"
                      fontSize={compact ? 8 : 10}
                      transform={shouldRotateX ? "rotate(-45)" : undefined} 
                      fontWeight={500}
                    >
                      {label.length > (compact ? 12 : 25) ? label.substring(0, compact ? 10 : 22) + '...' : label}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis {...commonProps} width={compact ? 25 : 40} allowDecimals={false} />
            <Tooltip content={<DateTooltip />} />
            {activeYKeys.map((key, i) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={getSemanticColor(key, i, palette)} 
                fill={getSemanticColor(key, i, palette)} 
                fillOpacity={0.2} 
                animationDuration={1000}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={((entry: any, _index: number, event: any) => {
                  if (event) event.stopPropagation();
                  const xVal = String(entry?.payload?.[activeXKey] ?? '');
                  const filtered = rawData.filter(r => String(r[activeXKey]) === xVal);
                  if (filtered.length > 0) {
                    openDrilldown(filtered, `${activeXKey}: ${xVal}`);
                  }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
