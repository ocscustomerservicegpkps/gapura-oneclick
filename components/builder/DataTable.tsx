
'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Table as TableIcon } from 'lucide-react';
import { formatDisplayValue } from '@/lib/chart-utils';
import { motion, AnimatePresence } from 'framer-motion';

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  maxRows?: number;
}

function formatValue(val: unknown, colName: string): string {
  return formatDisplayValue(val, colName);
}

export function DataTable({ columns, rows, maxRows = 100 }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const displayRows = sortedRows.slice(0, maxRows);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[10px] font-black uppercase tracking-widest text-[var(--surface-400)] italic">
        No Data Synchronized
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-[var(--surface-glass)] backdrop-blur-md rounded-xl border border-[var(--surface-border)] shadow-lg overflow-hidden relative group/datatable"
    >
      {}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover/datatable:opacity-100 transition-opacity duration-1000">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand-primary)]/5 blur-[60px] rounded-full" />
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
        <table className="w-full text-[10px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[var(--surface-0)]/80 backdrop-blur-md">
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="text-left p-3 border-b border-[var(--surface-border)] cursor-pointer hover:bg-[var(--surface-50)] transition-all whitespace-nowrap select-none group/th"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black uppercase tracking-widest text-[var(--surface-900)] group-hover/th:text-[var(--brand-primary)] transition-colors">{col}</span>
                    {sortCol === col ? (
                      sortDir === 'asc' ? <ArrowUp size={10} className="text-[var(--brand-primary)]" /> : <ArrowDown size={10} className="text-[var(--brand-primary)]" />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-0 group-hover/th:opacity-100 text-[var(--surface-300)] transition-all" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-100)]">
            <AnimatePresence mode="popLayout">
              {displayRows.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  className="hover:bg-[var(--brand-primary)]/[0.02] transition-colors"
                >
                  {columns.map(col => (
                    <td key={col} className="p-3 text-[var(--surface-600)] font-medium whitespace-nowrap max-w-[200px] truncate tabular-nums">
                      {formatValue(row[col], col)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {rows.length > maxRows && (
        <div className="px-4 py-2 text-[9px] font-black uppercase tracking-tighter text-[var(--surface-400)] bg-[var(--surface-0)]/50 border-t border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TableIcon size={10} />
            <span>TRUNCATED SET: {maxRows} OF {rows.length} RECORDED ENTRIES</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
