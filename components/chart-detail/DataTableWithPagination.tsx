'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, LayoutList } from 'lucide-react';
import type { QueryResult } from '@/types/builder';
import { formatDisplayValue } from '@/lib/chart-utils';
import { sanitizeTableCell } from '@/lib/security/sanitize';

interface DataTableWithPaginationProps {
  data: QueryResult;
  title: string;
  isLoading?: boolean;
  rowsPerPage?: number;
  columnClasses?: Record<string, string>;
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  variant?: 'default' | 'minimal';
  className?: string;
}

export function DataTableWithPagination({ data, title, isLoading, rowsPerPage = 50, columnClasses, onRowClick, variant = 'default', className }: DataTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const pageSize = rowsPerPage;

  const uniqueColumns = useMemo(() => {
    const unique = Array.from(new Set(data.columns));
    return unique.filter(c => c !== 'id' && (c !== 'count' || !unique.includes('Count')));
  }, [data.columns]);

  const rows = data.rows as Record<string, unknown>[];

  const filteredRows = useMemo(() => {
    let filtered = rows;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        uniqueColumns.some(col => 
          String(row[col]).toLowerCase().includes(term)
        )
      );
    }

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        const aIsTotal = Object.values(a).some(v => String(v).toLowerCase().includes('total'));
        const bIsTotal = Object.values(b).some(v => String(v).toLowerCase().includes('total'));
        if (aIsTotal) return 1;
        if (bIsTotal) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [rows, uniqueColumns, searchTerm, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const MathMaxPage = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(currentPage, MathMaxPage);

  const paginatedRows = filteredRows.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const exportCSV = () => {
    const headers = uniqueColumns.join(',');
    const csvRows = filteredRows.map(row => 
      uniqueColumns.map(col => {
        const val = row[col];
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    );

    const csv = [headers, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatValue = (val: unknown, colName: string): string => {
    return formatDisplayValue(val, colName);
  };

  return (
    <div
      className={`block-enter flex flex-col h-full overflow-hidden relative group/fulltable isolate ${
        variant === 'minimal'
          ? 'bg-white/40 backdrop-blur-3xl rounded-[32px] border border-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03]'
          : 'bg-[var(--surface-1)] backdrop-blur-3xl rounded-3xl border border-[var(--surface-2)] shadow-spatial-md'
      } ${className || ''}`}
    >
      {}
      {variant === 'default' && (
        <>
          <div className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-[var(--brand-primary)]/10 to-transparent blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        </>
      )}

      {}
      <div className={`relative z-10 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${
        variant === 'minimal' ? 'border-slate-200/50 bg-white/30 backdrop-blur-md' : 'border-[var(--surface-border)]/50 bg-[var(--surface-0)]/30 backdrop-blur-md'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden group ${
            variant === 'minimal' 
              ? 'bg-slate-100 border border-slate-200 shadow-sm' 
              : 'bg-gradient-to-br from-[var(--brand-primary)]/20 to-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 shadow-inner-rim'
          }`}>
            {variant === 'default' && <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />}
            <LayoutList size={18} className={`${variant === 'minimal' ? 'text-slate-600' : 'text-[var(--brand-primary)] drop-shadow-md'} group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]`} />
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-[0.15em] font-display ${variant === 'minimal' ? 'text-slate-900' : 'text-[var(--text-primary)]'}`}>
              {title}
            </h3>
            <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mt-1 ${variant === 'minimal' ? 'text-slate-500' : 'text-[var(--text-tertiary)]'}`}>
              <span>Syncing Archive</span>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${variant === 'minimal' ? 'bg-slate-400 shadow-[0_0_8px_#94a3b8]' : 'bg-[var(--brand-emerald-500)] shadow-[0_0_8px_var(--brand-emerald-500)]'}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group/search">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${variant === 'minimal' ? 'text-slate-400 group-focus-within/search:text-slate-700' : 'text-[var(--text-tertiary)] group-focus-within/search:text-[var(--brand-primary)]'}`} />
            <input
              type="text"
              placeholder="QUERYS_SEARCH..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`pl-9 pr-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-full focus:outline-none focus:ring-4 w-full sm:w-56 transition-all shadow-inner ${
                variant === 'minimal'
                  ? 'bg-white border border-slate-200 focus:ring-slate-100 focus:border-slate-300 placeholder:text-slate-400 text-slate-800'
                  : 'bg-[var(--surface-2)]/50 border border-[var(--surface-border)] focus:ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)]/50 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)]'
              }`}
            />
          </div>

          <button
            onClick={exportCSV}
            className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black rounded-full transition-all shadow-sm active:scale-95 uppercase tracking-[0.15em] ${
              variant === 'minimal'
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'text-[var(--text-on-brand)] bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] shadow-lg'
            }`}
          >
            <FileText size={12} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {}
      <div className={`flex-1 overflow-auto custom-scrollbar relative z-10 ${variant === 'minimal' ? '' : 'bg-[var(--surface-0)]/20'}`}>
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr className={variant === 'minimal' ? 'bg-white/90 backdrop-blur-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]' : 'bg-[var(--surface-1)]/80 backdrop-blur-xl shadow-sm'}>
              <th className={`px-6 py-5 border-b text-[9px] font-black uppercase tracking-[0.2em] text-center w-16 bg-transparent ${variant === 'minimal' ? 'border-slate-200 text-slate-400' : 'border-[var(--surface-border)] text-[var(--text-tertiary)]'}`}>idx</th>
              {uniqueColumns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`px-6 py-5 border-b text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors select-none group/th text-left bg-transparent ${
                    variant === 'minimal' 
                      ? 'border-slate-200 text-slate-500 hover:text-slate-900' 
                      : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--brand-primary)]'
                  } ${columnClasses?.[col] || ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.replace(/_/g, ' ')}</span>
                    {sortColumn === col ? (
                      <span className={variant === 'minimal' ? 'text-slate-900' : 'text-[var(--brand-primary)]'}>
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    ) : (
                      <span className={`opacity-0 group-hover/th:opacity-100 transition-opacity ${variant === 'minimal' ? 'text-slate-300' : 'text-[var(--text-tertiary)]'}`}>▼</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={variant === 'minimal' ? 'divide-y divide-slate-100' : 'divide-y divide-[var(--surface-border)]/50'}>
            {isLoading ? (
              <tr>
                <td colSpan={uniqueColumns.length + 1} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--brand-primary)]/20 blur-2xl rounded-full animate-pulse" />
                      <div className="relative w-12 h-12 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                    <span className="text-[10px] font-black text-[var(--text-primary)] tracking-[0.2em] uppercase italic">Streaming Records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={uniqueColumns.length + 1} className={`px-6 py-16 text-center text-[11px] font-medium italic ${variant === 'minimal' ? 'text-slate-500' : 'text-[var(--text-tertiary)]'}`}>
                  Null result set.
                </td>
              </tr>
            ) : (
              <>
                {paginatedRows.map((row, idx) => {
                  const isGrandTotal = Object.values(row).some(v => String(v).toLowerCase().includes('grand total') || String(v).toLowerCase() === 'total');
                  const firstCol = uniqueColumns[0];
                  const prevRow = idx > 0 ? paginatedRows[idx - 1] : null;
                  const isRepeated = !searchTerm && !isGrandTotal && (!sortColumn || sortColumn === firstCol) && prevRow && String(row[firstCol]) === String(prevRow[firstCol]);

                  return (
                    <tr
                      key={idx}
                      style={{ animationDelay: `${Math.min(idx * 15, 300)}ms` }}
                      className={`
                        tr-enter group/tr transition-colors duration-300
                        ${isGrandTotal 
                            ? (variant === 'minimal' 
                                ? 'bg-slate-50 font-black text-slate-900 sticky bottom-0 z-10 border-t border-slate-200 shadow-[0_-8px_24px_rgba(0,0,0,0.02)]' 
                                : 'bg-[var(--surface-1)] font-black text-[var(--text-primary)] sticky bottom-0 z-10 border-t border-[var(--brand-primary)]/20 shadow-[0_-8px_24px_rgba(0,0,0,0.05)]')
                            : (variant === 'minimal' ? 'hover:bg-white/60' : 'hover:bg-[var(--surface-2)]/40')}
                        ${onRowClick ? 'cursor-pointer' : ''}
                      `}
                      onClick={() => onRowClick?.(row, (safeCurrentPage - 1) * pageSize + idx)}
                    >
                      <td className={`px-6 py-4 text-[10px] font-bold text-center border-b border-transparent ${
                        isRepeated && !isGrandTotal ? 'text-transparent' : (variant === 'minimal' ? 'text-slate-400' : 'text-[var(--text-tertiary)]')
                      }`}>
                        {isGrandTotal ? '∑' : (safeCurrentPage - 1) * pageSize + idx + 1}
                      </td>
                      {uniqueColumns.map((col, cIdx) => {
                        const val = row[col];
                        const isNumber = typeof val === 'number';
                        const showValue = cIdx === 0 && isRepeated && !isGrandTotal ? false : true;

                        return (
                          <td
                            key={col}
                            className={`
                              px-6 py-4 border-b border-transparent text-[11px] 
                              ${cIdx === 0 && !isGrandTotal 
                                ? (variant === 'minimal' ? 'font-black text-slate-800 whitespace-nowrap' : 'font-black text-[var(--text-primary)] whitespace-nowrap') 
                                : (variant === 'minimal' ? 'text-slate-600 font-medium' : 'text-[var(--text-secondary)] font-medium')}
                              ${isNumber ? 'tabular-nums tracking-tight font-mono text-[10px]' : ''}
                              ${cIdx === 0 ? 'relative' : ''}
                              ${columnClasses?.[col] || ''}
                            `}
                          >
                            {(() => {
                              const low = col.toLowerCase();
                              const isEvidence = low.includes('evidence') || low.includes('link');
                              if (!isEvidence) {
                                return showValue ? formatValue(val, col) : '';
                              }
                              if (typeof val === 'string' && val.includes('<a href')) {
                                return <span dangerouslySetInnerHTML={{ __html: sanitizeTableCell(val) }} />;
                              }
                              const looksUrl = (s: string) => /^https?:\/\//i.test(s);
                              let urls: string[] = [];
                              if (Array.isArray(val)) {
                                urls = (val as unknown[]).map(String).filter(looksUrl);
                              } else if (typeof val === 'string') {
                                const s = val.trim();
                                if (s.startsWith('[') && s.endsWith(']')) {
                                  try {
                                    const arr = JSON.parse(s);
                                    if (Array.isArray(arr)) urls = arr.map(String).filter(looksUrl);
                                  } catch {}
                                }
                                if (urls.length === 0) {
                                  urls = s.split(/[\s,;|\n]+/).filter(Boolean).filter(looksUrl);
                                }
                                if (urls.length === 0 && looksUrl(s)) urls = [s];
                              } else if (val && typeof val === 'object') {
                                const anyVal = val as Record<string, unknown>;
                                const maybe = anyVal['urls'] || anyVal['url'];
                                if (Array.isArray(maybe)) urls = maybe.map(String).filter(looksUrl);
                                else if (typeof maybe === 'string' && looksUrl(maybe)) urls = [maybe];
                              }
                              if (urls.length === 0 && low.includes('urls')) {
                                const alt = row['evidence_url'];
                                if (typeof alt === 'string' && looksUrl(alt)) urls = [alt];
                              }
                              urls = Array.from(new Set(urls));
                              if (urls.length === 0) {
                                return showValue ? formatValue(val, col) : '';
                              }
                              return (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {urls.map((u, i) => (
                                    <a
                                      key={`${u}-${i}`}
                                      href={u}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all duration-300 ${
                                        variant === 'minimal' 
                                          ? 'bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white' 
                                          : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white'
                                      }`}
                                    >
                                      {urls.length > 1 ? `Evidence ${i + 1}` : 'Evidence'}
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      {}
      <div className={`relative z-10 px-6 py-5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        variant === 'minimal' ? 'border-slate-200/50 bg-white/50 backdrop-blur-xl' : 'border-[var(--surface-border)]/50 bg-[var(--surface-0)]/50 backdrop-blur-xl'
      }`}>
        <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${variant === 'minimal' ? 'text-slate-400' : 'text-[var(--text-tertiary)]'}`}>
           {filteredRows.length > 0
            ? `SYNCING ${((safeCurrentPage - 1) * pageSize + 1).toString().padStart(3, '0')} — ${Math.min(safeCurrentPage * pageSize, filteredRows.length).toString().padStart(3, '0')} / ${filteredRows.length.toString().padStart(3, '0')} RECORDS`
            : 'NULL SET'}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safeCurrentPage === 1}
            className={`px-4 py-2 text-[10px] font-black border rounded-full disabled:opacity-20 transition-all uppercase tracking-[0.15em] ${
              variant === 'minimal' 
                ? 'border-slate-200 hover:bg-slate-50 text-slate-600' 
                : 'border-[var(--surface-border)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
            }`}
          >
            Start
          </button>

          <div className={`flex items-center gap-1 px-4 py-2 rounded-full border shadow-inner-rim ${
            variant === 'minimal' ? 'bg-white border-slate-200' : 'bg-[var(--surface-0)] border-[var(--surface-border)]'
          }`}>
            <span className={`text-[10px] font-black ${variant === 'minimal' ? 'text-slate-900' : 'text-[var(--brand-primary)]'}`}>{safeCurrentPage}</span>
            <span className={`text-[10px] font-black mx-1 ${variant === 'minimal' ? 'text-slate-300' : 'text-[var(--text-tertiary)]'}`}>/</span>
            <span className={`text-[10px] font-black ${variant === 'minimal' ? 'text-slate-500' : 'text-[var(--text-secondary)]'}`}>{MathMaxPage}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className={`p-2 border rounded-full disabled:opacity-20 transition-all ${
                variant === 'minimal' 
                  ? 'border-slate-200 hover:bg-slate-50 text-slate-600' 
                  : 'border-[var(--surface-border)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
              }`}
            >
              <ChevronLeft size={14} strokeWidth={3} />
            </button>
            <button
            onClick={() => setCurrentPage(p => Math.min(MathMaxPage, p + 1))}
            disabled={safeCurrentPage === MathMaxPage || filteredRows.length === 0}
            className={`px-4 py-2 text-[10px] font-black border rounded-full disabled:opacity-20 transition-all uppercase tracking-[0.15em] ${
              variant === 'minimal' 
                ? 'border-slate-200 hover:bg-slate-50 text-slate-600' 
                : 'border-[var(--surface-border)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
            }`}
          >
            Next Phase
          </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(MathMaxPage, p + 1))}
              disabled={safeCurrentPage === MathMaxPage || filteredRows.length === 0}
              className={`p-2 border rounded-full disabled:opacity-20 transition-all ${
                variant === 'minimal' 
                  ? 'border-slate-200 hover:bg-slate-50 text-slate-600' 
                  : 'border-[var(--surface-border)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
              }`}
            >
              <ChevronRight size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
