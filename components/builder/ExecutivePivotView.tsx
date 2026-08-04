
'use client';

import { useMemo } from 'react';
import type { QueryResult } from '@/types/builder';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { ViewMode, Normalization } from '@/components/chart-detail/GlobalControlBar';

interface ExecutivePivotViewProps {
  result: QueryResult;
  title?: string;
  viewMode?: ViewMode;
  normalization?: Normalization;
  isTile?: boolean;
}

const EXEC_COLORS = {
  bar: '#10b981',
  barBg: '#ecfdf5',
  textMax: '#064e3b',
  textNorm: '#374151',
  highlight: '#f0fdf4',
  progress: '#34d399',
};

export function ExecutivePivotView({
  result,
  viewMode = 'values',
  normalization = 'none',
  isTile = false
}: ExecutivePivotViewProps) {

  const processedData = useMemo(() => {
    const columns = result.columns;
    const data = result.rows as Record<string, unknown>[];
    if (data.length === 0) return null;

    const numCols = columns.filter(c => typeof data[0][c] === 'number');
    const strCols = columns.filter(c => typeof data[0][c] === 'string');

    const valueField = numCols[0] || columns[columns.length - 1];
    const rowField = strCols[0] || columns[0];
    const colField = strCols[1] || columns[1];

    const matrix = new Map<string, number>();
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    let grandTotal = 0;

    data.forEach(row => {
      const r = String(row[rowField] || '').trim();
      const c = String(row[colField] || '').trim();
      const v = Number(row[valueField]) || 0;

      if (r && c) {
        matrix.set(`${r}__${c}`, v);
        rowSet.add(r);
        colSet.add(c);
        grandTotal += v;
      }
    });

    const rows = Array.from(rowSet);
    const cols = Array.from(colSet);

    const rowStats: Record<string, { total: number; max: number; maxCol: string }> = {};
    rows.forEach(r => {
      let total = 0;
      let max = 0;
      let maxCol = '';
      cols.forEach(c => {
        const val = matrix.get(`${r}__${c}`) || 0;
        total += val;
        if (val > max) {
          max = val;
          maxCol = c;
        }
      });
      rowStats[r] = { total, max, maxCol };
    });

    const colStats: Record<string, number> = {};
    cols.forEach(c => {
      let total = 0;
      rows.forEach(r => {
        total += (matrix.get(`${r}__${c}`) || 0);
      });
      colStats[c] = total;
    });

    rows.sort((a, b) => rowStats[b].total - rowStats[a].total);

    cols.sort((a, b) => colStats[b] - colStats[a]);

    return { rows, cols, matrix, rowStats, colStats, grandTotal, rowField, colField };
  }, [result]);

  if (!processedData) return null;

  const { rows, cols, matrix, rowStats, colStats, grandTotal, rowField } = processedData;

  const topAirline: string | undefined = rows[0];
  const topAirlineShare = (topAirline && grandTotal > 0)
    ? (rowStats[topAirline].total / grandTotal * 100).toFixed(1)
    : '0.0';

  const top5 = rows.slice(0, 5);

  const formatValue = (val: number, rowTotal: number, colTotal: number) => {
    if (normalization === 'row') return rowTotal > 0 ? `${((val / rowTotal) * 100).toFixed(1)}%` : '0.0%';
    if (normalization === 'col') return colTotal > 0 ? `${((val / colTotal) * 100).toFixed(1)}%` : '0.0%';
    if (viewMode === 'percentage') return rowTotal > 0 ? `${((val / rowTotal) * 100).toFixed(1)}%` : '0.0%';
    return val.toLocaleString('id-ID');
  };

  return (
    <div className={`flex flex-col h-full bg-white font-sans text-sm ${
      isTile ? '' : 'rounded-3xl border border-gray-100 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]'
    } overflow-hidden`}>

      {}
      <div className="p-6 bg-gradient-to-b from-white to-gray-50/50 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
            <TrendingUp size={16} />
          </div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Top Contributors</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {top5.map((r, i) => {
            const stats = rowStats[r];
            const pct = grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0;
            return (
              <div key={r} className="relative group">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] items-center gap-2 text-xs mb-1 relative z-10">
                  <span className="font-bold text-gray-700 truncate min-w-0">{i + 1}. {r}</span>
                  <span className="text-gray-400 text-[10px] text-right truncate min-w-0">
                     Dominant: <span className="text-emerald-600 font-medium">{stats.maxCol}</span>
                  </span>
                  <span className="font-bold text-gray-900 text-right whitespace-nowrap">{stats.total.toLocaleString()}</span>
                </div>
                {}
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {}
      <div className="flex-1 overflow-auto bg-white p-0 relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
        <table className="w-full border-collapse min-w-full">
          <thead className="sticky top-0 bg-white z-20 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/4 bg-white sticky left-0 z-30 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                {rowField}
              </th>
              {cols.map(c => (
                <th key={c} className="px-2 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white min-w-[80px]">
                  {c}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-800 uppercase tracking-wider bg-white border-l border-dashed border-gray-100 sticky right-0 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
               const stats = rowStats[r];
               const isTop = top5.includes(r);

               return (
                 <tr key={r} className="group hover:bg-gray-50/80 transition-colors">
                   <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-gray-50 group-hover:bg-gray-50 transition-colors">
                     <div className="text-xs font-medium text-gray-700 truncate w-40" title={r}>
                       {r}
                     </div>
                   </td>

                   {cols.map(c => {
                     const val = matrix.get(`${r}__${c}`) || 0;
                     const isMax = val === stats.max && val > 0;
                     const intensity = (val / stats.max) * 100;

                     return (
                       <td key={c} className="px-2 py-2 text-right min-w-[80px]">
                         <div className="relative h-8 w-full flex items-center justify-end">
                             {}
                             {val > 0 && (
                               <div 
                                 className={`absolute right-0 h-full rounded-md opacity-20 transition-all group-hover:opacity-30 ${isMax ? 'bg-emerald-400' : 'bg-gray-200'}`}
                                 style={{ width: `${intensity}%` }}
                               />
                             )}

                             <span 
                               className={`
                                 relative z-10 px-2 text-xs font-medium transition-colors
                                 ${isMax ? 'text-emerald-700 font-bold' : (val === 0 ? 'text-gray-300' : 'text-gray-600')}
                               `}
                             >
                               {val === 0 ? '-' : formatValue(val, stats.total, colStats[c])}
                             </span>
                          </div>
                       </td>
                     );
                   })}

                   <td className="px-6 py-3 text-right font-bold text-xs text-gray-900 border-l border-dashed border-gray-100 bg-white sticky right-0 z-10 group-hover:bg-gray-50 transition-colors">
                     {viewMode === 'percentage'
                        ? `${(grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0).toFixed(1)}%`
                        : stats.total.toLocaleString('id-ID')
                     }
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      {}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
         <div className="flex gap-4">
           <div>Total Columns: <span className="font-bold text-gray-900">{cols.length}</span></div>
           <div>Rows: <span className="font-bold text-gray-900">{rows.length}</span></div>
         </div>
         <div className="flex items-center gap-2">
             <span>Market Share Leader:</span>
             <span className="font-bold text-emerald-700">{topAirline} ({topAirlineShare}%)</span>
         </div>
      </div>

    </div>
  );
}
