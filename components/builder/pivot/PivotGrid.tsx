import { useState } from 'react';
import { ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PivotDataResult } from './usePivotData';
import { Normalization } from '@/components/chart-detail/GlobalControlBar';
import { PivotCell } from './PivotCell';
import type { QueryResult } from '@/types/builder';

interface PivotGridProps {
  data: PivotDataResult;
  sortCol: string;
  sortDesc: boolean;
  onSort: (col: string) => void;
  normalization: Normalization;
  compact?: boolean;
  rawData?: QueryResult;
  onCellClick?: (filteredData: Record<string, unknown>[], rowLabel: string, colLabel: string) => void;
}

const PAGE_SIZE = 12;

export function PivotGrid({
  data,
  sortCol,
  onSort,
  normalization,
  compact,
  rawData,
  onCellClick
}: PivotGridProps) {

  const [currentPage, setCurrentPage] = useState(1);
  const { rows, cols, matrix, rowStats, colStats, grandTotal, rowField, colField } = data;

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = rows.slice(startIdx, Math.min(startIdx + PAGE_SIZE, rows.length));

  const handleSort = (col: string) => {
      onSort(col);
      setCurrentPage(1);
  };

  const handleCellClick = (rowLabel: string, colLabel: string) => {
    if (!rawData || !onCellClick) return;

    const filteredData = rawData.rows.filter((row) => {
      const rowValue = String(row[rowField] || '').trim();
      const colValue = String(row[colField] || '').trim();
      return rowValue === rowLabel && colValue === colLabel;
    });

    if (filteredData.length > 0) {
      onCellClick(filteredData, rowLabel, colLabel);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      className={cn(
        "flex flex-col flex-1 min-h-0 bg-[var(--surface-glass)] backdrop-blur-md rounded-2xl border border-[var(--surface-border)] shadow-xl overflow-hidden relative group/pivot",
        compact ? "max-h-[300px]" : "max-h-[500px]"
      )}
    >
        {}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover/pivot:opacity-100 transition-opacity duration-1000">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-primary)]/5 blur-[100px] rounded-full" />
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
            <table className="w-max min-w-full border-separate border-spacing-0 text-[10px]">
                {}
                <thead className="sticky top-0 z-30">
                    <tr className="bg-[var(--surface-0)]/80 backdrop-blur-md">
                        {}
                        <th className="px-5 py-4 text-left border-b border-[var(--surface-border)] sticky left-0 z-40 w-[140px] min-w-[140px] sm:w-[200px] sm:min-w-[200px] lg:w-[280px] lg:min-w-[280px] bg-[var(--surface-0)]/90">
                             <button
                                onClick={() => handleSort('name')}
                                className="flex items-center gap-2 group transition-all"
                              >
                                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.12em] text-[var(--surface-900)] group-hover:text-[var(--brand-primary)]">{rowField}</span>
                                <ArrowUpDown size={10} className={cn("transition-all", sortCol === 'name' ? 'opacity-100 text-[var(--brand-primary)]' : 'opacity-0 group-hover:opacity-50 text-[var(--surface-400)]')} />
                              </button>
                        </th>

                        {}
                        {cols.map(c => (
                            <th key={c} className="px-3 py-4 text-center border-b border-[var(--surface-border)] min-w-[100px] bg-[var(--surface-0)]/90">
                                <div className="flex flex-col items-center justify-center gap-0.5 group cursor-default">
                                    <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-[var(--surface-900)] group-hover:text-[var(--brand-primary)] transition-colors" title={c}>
                                        {c}
                                    </span>
                                    <span className="text-[9px] text-[var(--surface-400)] font-bold group-hover:text-[var(--brand-primary)] transition-colors">
                                        {colStats[c].total.toLocaleString()}
                                    </span>
                                </div>
                            </th>
                        ))}

                        {}
                         <th className="px-3 sm:px-6 py-4 text-right border-b border-[var(--surface-border)] border-l border-[var(--surface-border)] sticky right-0 z-40 min-w-[80px] sm:min-w-[120px] bg-[var(--surface-0)]">
                            <button
                              onClick={() => handleSort('total')}
                              className="flex items-center justify-end gap-1 w-full group transition-all"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--surface-900)] group-hover:text-[var(--brand-primary)]">Total</span>
                                <ArrowUpDown size={10} className={cn("transition-all", sortCol === 'total' ? 'opacity-100 text-[var(--brand-primary)]' : 'opacity-0 group-hover:opacity-50 text-[var(--surface-400)]')} />
                            </button>
                        </th>
                    </tr>
                </thead>

                {}
                <tbody className="divide-y divide-[var(--surface-100)]">
                    <AnimatePresence mode="popLayout">
                        {paginatedRows.map((r, idx) => {
                            const rTotal = rowStats[r].total;
                            return (
                                <motion.tr 
                                    key={r}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className="group transition-colors hover:bg-[var(--brand-primary)]/[0.02]"
                                >
                                    {}
                                    <td className="px-5 py-4 text-[10px] font-black text-[var(--surface-900)] uppercase tracking-tight sticky left-0 bg-white group-hover:bg-[var(--surface-50)] transition-colors z-20 w-[140px] min-w-[140px] sm:w-[200px] sm:min-w-[200px] lg:w-[280px] lg:min-w-[280px] shadow-[2px_0_10px_-4px_rgba(0,0,0,0.05)]" title={r}>
                                        <span className="block w-[140px] sm:w-[200px] lg:w-[280px] truncate">{r}</span>
                                    </td>

                                    {}
                                    {cols.map(c => {
                                        const val = matrix.get(`${r}__${c}`) || 0;
                                        let contextMax = 0;
                                        if (normalization === 'row') contextMax = rTotal;
                                        else if (normalization === 'col') contextMax = colStats[c].max;
                                        else contextMax = colStats[cols[0]].max;

                                        return (
                                            <PivotCell
                                                key={`${r}-${c}`}
                                                value={val}
                                                rowLabel={r}
                                                colLabel={c}
                                                rowTotal={rTotal}
                                                colTotal={colStats[c].total}
                                                grandTotal={grandTotal}
                                                normalization={normalization}
                                                contextMax={contextMax}
                                                onClick={val > 0 && rawData && onCellClick ? () => handleCellClick(r, c) : undefined}
                                            />
                                        );
                                    })}

                                    {}
                                    <td className="px-3 sm:px-6 py-4 text-[10px] font-black text-[var(--surface-900)] text-right sticky right-0 bg-white/95 border-l border-[var(--surface-border)] group-hover:bg-[var(--surface-50)] transition-colors z-20 shadow-[-2px_0_10px_-4px_rgba(0,0,0,0.05)] tabular-nums">
                                        {rTotal.toLocaleString('id-ID')}
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </AnimatePresence>

                    {}
                    <tr className="sticky bottom-0 z-30 bg-[var(--surface-50)] border-t border-[var(--surface-border)] shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
                        <td className="px-6 py-4 text-[10px] font-black text-[var(--surface-900)] uppercase tracking-[0.2em] sticky left-0 z-40 bg-[var(--surface-50)] shadow-sm">
                            Grand Total
                        </td>
                        {cols.map(c => (
                           <td key={`total-${c}`} className="px-3 py-4 text-[10px] font-black text-[var(--surface-900)] text-center tabular-nums">
                               {colStats[c].total.toLocaleString('id-ID')}
                           </td> 
                        ))}
                        <td className="px-3 sm:px-6 py-4 text-[10px] font-black text-[var(--brand-primary)] text-right sticky right-0 z-40 bg-[var(--surface-100)]/90 border-l border-[var(--surface-border)] tabular-nums">
                            {grandTotal.toLocaleString('id-ID')}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {}
        <div className="relative z-10 px-6 py-4 border-t border-[var(--surface-border)] bg-[var(--surface-0)]/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-[10px] font-bold text-[var(--surface-400)] uppercase tracking-widest flex items-center gap-2">
                <FileSpreadsheet size={12} className="text-[var(--brand-primary)]" />
                <span>PHASE {currentPage} / {totalPages} • {rows.length} ENTRIES</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-[10px] font-black border border-[var(--surface-border)] rounded-full disabled:opacity-20 hover:bg-[var(--surface-50)] transition-all uppercase tracking-tighter"
                >
                    Start
                </button>
                <div className="flex items-center gap-1 bg-[var(--surface-50)] px-3 py-1.5 rounded-full border border-[var(--surface-border)]">
                    <span className="text-[10px] font-black text-[var(--brand-primary)]">{currentPage}</span>
                    <span className="text-[10px] font-black text-[var(--surface-300)]">/</span>
                    <span className="text-[10px] font-black text-[var(--surface-400)]">{totalPages}</span>
                </div>
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-1.5 text-[10px] font-black bg-[var(--surface-900)] text-white rounded-full disabled:opacity-20 hover:brightness-125 transition-all uppercase tracking-tight"
                >
                    Next Phase
                </button>
            </div>
        </div>
    </motion.div>
  );
}
