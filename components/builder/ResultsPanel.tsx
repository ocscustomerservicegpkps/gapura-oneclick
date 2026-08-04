
'use client';

import { useState } from 'react';
import { Table2, BarChart3, Clock, Rows3, AlertCircle } from 'lucide-react';
import { DataTable } from './DataTable';
import type { QueryResult } from '@/types/builder';
import { cn } from '@/lib/utils';

interface ResultsPanelProps {
  result: QueryResult | null;
  loading: boolean;
  error: string | null;
  chartPreview: React.ReactNode;
}

export function ResultsPanel({ result, loading, error, chartPreview }: ResultsPanelProps) {
  const [tab, setTab] = useState<'table' | 'chart'>('table');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div
          className="w-8 h-8 rounded-full border-3 animate-spin"
          style={{ borderColor: 'var(--surface-4)', borderTopColor: 'var(--brand-primary)' }}
        />
        <p className="text-xs text-[var(--text-muted)]">Menjalankan query...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm text-red-500 text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Table2 size={32} className="text-[var(--text-muted)] opacity-30" />
        <p className="text-xs text-[var(--text-muted)]">Jalankan query untuk melihat hasil</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--surface-4)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('table')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              tab === 'table'
                ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <Table2 size={12} /> Tabel
          </button>
          <button
            onClick={() => setTab('chart')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              tab === 'chart'
                ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <BarChart3 size={12} /> Grafik
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Rows3 size={10} />
            {result.rowCount} baris
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock size={10} />
            {result.executionTimeMs}ms
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-hidden">
        {tab === 'table' ? (
          <DataTable columns={result.columns} rows={result.rows} />
        ) : (
          <div className="p-4 h-full overflow-auto custom-scrollbar">
            {chartPreview}
          </div>
        )}
      </div>
    </div>
  );
}
