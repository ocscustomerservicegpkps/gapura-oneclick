'use client';

import React, { useMemo } from 'react';
import type { QueryResult } from '@/types/builder';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';

interface FeedbackPivotTableProps {
  title: string;
  result: QueryResult;
  rowKey?: string;
  colKey?: string;
  valueKey?: string;
  compact?: boolean;
}

const HEATMAP_SCALE = [
  { bg: '#F0FDFA', text: '#374151', min: 0.00 },
  { bg: '#CCFBF1', text: '#134E4A', min: 0.15 },
  { bg: '#5EEAD4', text: '#134E4A', min: 0.40 },
  { bg: '#0F766E', text: '#FFFFFF', min: 0.60 },
  { bg: '#134E4A', text: '#FFFFFF', min: 0.80 },
];

function formatAxisLabel(value: string): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getIntensity(value: number, max: number) {
  if (value === 0 || max === 0) return { bg: '#f8fbf8', text: '#9ca3af' };
  const ratio = value / max;
  const step = [...HEATMAP_SCALE].reverse().find(s => ratio >= s.min) || HEATMAP_SCALE[0];
  return step;
}

export function FeedbackPivotTable({ title, result, rowKey, colKey, valueKey, compact = false }: FeedbackPivotTableProps) {
  const { rows, columns } = result;
  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  const keys = useMemo(() => {
    const dimensions = columns.filter(c => rows.length > 0 && typeof rows[0][c] === 'string');
    const measures = columns.filter(c => rows.length > 0 && typeof rows[0][c] === 'number');
    const rk = rowKey || dimensions[0] || columns[0];
    const ck = colKey || dimensions[1] || columns[1];
    const vk = valueKey || measures[0] || columns[2] || columns[columns.length - 1];
    return { rk, ck, vk };
  }, [columns, rows, rowKey, colKey, valueKey]);

  const pivotData = useMemo(() => {
    const matrix = new Map<string, number>();
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    const uniqueRows = new Set<string>();
    const uniqueCols = new Set<string>();
    let maxVal = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.forEach((r: any) => {
      const rowVal = formatAxisLabel(String(r[keys.rk] ?? ''));
      const colVal = formatAxisLabel(String(r[keys.ck] ?? ''));
      const rawVal = Number(r[keys.vk]);
      const val = Number.isFinite(rawVal) ? rawVal : 0;

      if (!rowVal || !colVal) return;
      if (rowVal.toLowerCase() === 'unknown' || colVal.toLowerCase() === 'unknown') return;
      if (val <= 0) return;

      const cellKey = `${rowVal}::${colVal}`;
      const cellVal = (matrix.get(cellKey) || 0) + val;
      matrix.set(cellKey, cellVal);
      uniqueRows.add(rowVal);
      uniqueCols.add(colVal);

      rowTotals.set(rowVal, (rowTotals.get(rowVal) || 0) + val);
      colTotals.set(colVal, (colTotals.get(colVal) || 0) + val);

      if (cellVal > maxVal) maxVal = cellVal;
    });

    const sortedRows = Array.from(uniqueRows).sort((a, b) => {
      return (rowTotals.get(b) || 0) - (rowTotals.get(a) || 0);
    });

    return {
      rows: sortedRows,
      cols: Array.from(uniqueCols).sort((a, b) => (colTotals.get(b) || 0) - (colTotals.get(a) || 0)),
      matrix,
      maxVal,
      keys,
    };
  }, [rows, keys]);

  const handleCellClick = (rowVal: string, colVal: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchedGroups = rows.filter((row: any) => {
      const rowValue = formatAxisLabel(String(row[keys.rk] ?? ''));
      const colValue = formatAxisLabel(String(row[keys.ck] ?? ''));
      return rowValue === rowVal && colValue === colVal;
    });
    // Pivot rows are pre-aggregated groups; use the raw report records each
    // group carries (`_records`) so the drawer gets real fields, not the
    // group's bare dimension/measure values.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredData = matchedGroups.flatMap((row: any) => Array.isArray(row._records) ? row._records : []);
    if (filteredData.length > 0) {
      openDrilldown(filteredData, `${title}: ${rowVal} x ${colVal}`);
    }
  };

  const rowLabelWidthPx = useMemo(() => {
    const maxLabelLength = pivotData.rows.reduce((max, row) => {
      return Math.max(max, formatAxisLabel(row).length);
    }, 0);
    const charWidth = compact ? 5.2 : 6.4;
    const padding = compact ? 10 : 14;
    return Math.max(compact ? 48 : 64, Math.min(compact ? 130 : 172, Math.round(maxLabelLength * charWidth + padding)));
  }, [pivotData.rows, compact]);

  const containerHeight = compact ? '220px' : '300px';
  const cellHeight = compact ? 'h-6' : 'h-8';
  const headerFontSize = compact ? 'text-[8px]' : 'text-[9px]';
  const rowLabelFontSize = compact ? 'text-[8px]' : 'text-[10px]';
  const minColWidth = compact ? 'min-w-[60px]' : 'min-w-[78px]';
  const maxColWidth = compact ? 'max-w-[110px]' : 'max-w-[132px]';
  const cellPad = compact ? 'p-px' : 'p-0.5';
  const spacing = compact ? 'border-spacing-1' : 'border-spacing-2';
  const legendDotSize = compact ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div className="w-full flex flex-col overflow-hidden">
      <div
        className="overflow-auto pr-1 custom-scrollbar"
        style={{ height: containerHeight, maxHeight: containerHeight }}
      >
        <span className="sr-only">FeedbackPivotTable Active</span>
        <table className={`w-max min-w-full border-separate ${spacing}`}>
          <thead>
            <tr className="sticky top-0 bg-[var(--cf-teal-tint,#edf7f5)] z-20">
              <th
                className="sticky left-0 bg-[var(--cf-teal-tint,#edf7f5)] z-30"
                style={{ minWidth: rowLabelWidthPx, width: rowLabelWidthPx, maxWidth: rowLabelWidthPx }}
              />
              {pivotData.cols.map(c => (
                <th
                  key={c}
                  className={`p-1.5 ${headerFontSize} font-black text-[var(--cf-teal,#0f766e)] uppercase tracking-widest text-center ${minColWidth} ${maxColWidth} whitespace-normal break-words leading-tight align-bottom`}
                  title={formatAxisLabel(c)}
                >
                  {formatAxisLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="relative">
            {pivotData.rows.map(r => (
              <tr key={r}>
                <td
                  className={`sticky left-0 bg-[var(--cf-canvas,#f6f2e7)] z-10 p-1.5 ${rowLabelFontSize} font-bold text-[var(--cf-ink-2,#57534e)] uppercase pr-1 whitespace-normal break-words leading-tight border-r border-[var(--cf-line-soft,#f0ead9)] rounded-l-lg`}
                  style={{ minWidth: rowLabelWidthPx, width: rowLabelWidthPx, maxWidth: rowLabelWidthPx }}
                  title={formatAxisLabel(r)}
                >
                  {formatAxisLabel(r)}
                </td>
                {pivotData.cols.map(c => {
                  const val = pivotData.matrix.get(`${r}::${c}`) || 0;
                  const intensity = getIntensity(val, pivotData.maxVal);
                  return (
                    <td key={c} className={`${cellPad} ${minColWidth}`}>
                      <div
                        className={`w-full ${cellHeight} flex items-center justify-center rounded-lg font-black transition-all hover:scale-105 hover:shadow-md cursor-pointer active:scale-95`}
                        style={{ backgroundColor: intensity.bg, color: intensity.text, fontSize: compact ? 8 : 10 }}
                        title={`${formatAxisLabel(r)} \u2022 ${formatAxisLabel(c)}: ${val}`}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {val || '-'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {pivotData.rows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, pivotData.cols.length + 1)}
                  className="p-3 text-center text-[10px] font-semibold text-gray-400"
                >
                  No non-zero data in this view
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-end gap-2">
        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mr-1">Intensity:</span>
        {HEATMAP_SCALE.map((s, i) => (
          <div key={i} className="flex items-center gap-0.5">
            <div className={`${legendDotSize} rounded-md`} style={{ backgroundColor: s.bg }} />
          </div>
        ))}
      </div>

      <DrilldownRenderer />
    </div>
  );
}
