
'use client';

import { X, ChevronDown, ChevronRight, ArrowUpDown, Layers, BarChart3, Filter, ArrowDownUp, Zap } from 'lucide-react';
import type {
  QueryDefinition,
  QueryDimension,
  QueryMeasure,
  QueryFilter,
  QuerySort,
  DateGranularity,
  AggregateFunction,
  FieldDef,
} from '@/types/builder';
import { getFieldDef } from '@/lib/builder/schema';
import { FilterBuilder } from './FilterBuilder';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface QueryPanelProps {
  query: QueryDefinition;
  availableFields: Array<{ table: string; field: FieldDef }>;
  loading: boolean;
  onRemoveDimension: (index: number) => void;
  onUpdateDimension: (index: number, updates: Partial<QueryDimension>) => void;
  onRemoveMeasure: (index: number) => void;
  onUpdateMeasure: (index: number, updates: Partial<QueryMeasure>) => void;
  onAddFilter: (filter: QueryFilter) => void;
  onRemoveFilter: (index: number) => void;
  onUpdateFilter: (index: number, updates: Partial<QueryFilter>) => void;
  onAddSort: (sort: QuerySort) => void;
  onRemoveSort: (index: number) => void;
  onExecute: () => void;
}

const DATE_GRANULARITIES: { value: DateGranularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const AGG_FUNCTIONS: { value: AggregateFunction; label: string }[] = [
  { value: 'COUNT', label: 'Jumlah (COUNT)' },
  { value: 'COUNT_DISTINCT', label: 'Jumlah Unik' },
  { value: 'SUM', label: 'Total (SUM)' },
  { value: 'AVG', label: 'Rata-rata (AVG)' },
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maksimum' },
];

export function QueryPanel({
  query,
  availableFields,
  loading,
  onRemoveDimension,
  onUpdateDimension,
  onRemoveMeasure,
  onUpdateMeasure,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onAddSort,
  onRemoveSort,
  onExecute,
}: QueryPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);

  const hasDimensions = query.dimensions.length > 0;
  const hasMeasures = query.measures.length > 0;
  const canExecute = hasDimensions || hasMeasures;

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--surface-1)]">
      {}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Layers size={12} className={hasDimensions ? "text-blue-500" : "text-[var(--text-muted)]"} />
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Dimensi
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px] pl-5">
          {!hasDimensions && (
            <span className="text-[10px] text-[var(--text-muted)] italic py-1">
              Klik field teks/tanggal di panel kiri
            </span>
          )}
          {query.dimensions.map((dim, idx) => {
            const fieldDef = getFieldDef(dim.table, dim.field);
            const isDate = fieldDef && (fieldDef.type === 'date' || fieldDef.type === 'datetime');
            return (
              <div key={idx} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                <span className="font-medium">{fieldDef?.label || dim.field}</span>
                {isDate && (
                  <select
                    value={dim.dateGranularity || 'month'}
                    onChange={e => onUpdateDimension(idx, { dateGranularity: e.target.value as DateGranularity })}
                    className="px-1 py-0 text-[10px] bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    {DATE_GRANULARITIES.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => onRemoveDimension(idx)} className="hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <BarChart3 size={12} className={hasMeasures ? "text-emerald-500" : "text-[var(--text-muted)]"} />
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Ukuran
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px] pl-5">
          {!hasMeasures && (
            <span className="text-[10px] text-[var(--text-muted)] italic py-1">
              Klik field angka di panel kiri
            </span>
          )}
          {query.measures.map((m, idx) => {
            const fieldDef = getFieldDef(m.table, m.field);
            return (
              <div key={idx} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                <select
                  value={m.function}
                  onChange={e => onUpdateMeasure(idx, { function: e.target.value as AggregateFunction })}
                  className="px-0 py-0 text-[10px] bg-transparent border-none focus:outline-none cursor-pointer font-bold"
                >
                  {AGG_FUNCTIONS.map(fn => (
                    <option key={fn.value} value={fn.value}>{fn.label}</option>
                  ))}
                </select>
                <span className="font-medium">({fieldDef?.label || m.field})</span>
                <button onClick={() => onRemoveMeasure(idx)} className="hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {}
      <div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors pl-5"
        >
          <Filter size={10} />
          {showFilters ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Filter {query.filters.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold">
              {query.filters.length}
            </span>
          )}
          <span className="text-[9px] font-normal normal-case text-[var(--text-muted)]">
            (opsional)
          </span>
        </button>
        {showFilters && (
          <div className="mt-2 pl-5">
            <FilterBuilder
              filters={query.filters}
              availableFields={availableFields}
              onAdd={onAddFilter}
              onRemove={onRemoveFilter}
              onUpdate={onUpdateFilter}
            />
          </div>
        )}
      </div>

      {}
      <div>
        <button
          onClick={() => setShowSorts(!showSorts)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors pl-5"
        >
          <ArrowDownUp size={10} />
          {showSorts ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Urutkan {query.sorts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold">
              {query.sorts.length}
            </span>
          )}
          <span className="text-[9px] font-normal normal-case text-[var(--text-muted)]">
            (opsional)
          </span>
        </button>
        {showSorts && (
          <div className="mt-2 pl-5 space-y-1">
            {query.sorts.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)]">{s.alias || s.field}</span>
                <button
                  onClick={() => {
                    onRemoveSort(idx);
                    onAddSort({ ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' });
                  }}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
                >
                  <ArrowUpDown size={12} />
                </button>
                <span className="text-[10px] text-[var(--text-muted)]">{s.direction === 'asc' ? 'A→Z' : 'Z→A'}</span>
                <button onClick={() => onRemoveSort(idx)} className="text-[var(--text-muted)] hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                if (availableFields.length > 0) {
                  const f = availableFields[0];
                  onAddSort({ field: `${f.table}_${f.field.name}`, direction: 'asc' });
                }
              }}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
            >
              + Add Sort
            </button>
          </div>
        )}
      </div>

      {}
      <div className="flex items-center gap-3 pt-2 border-t border-[var(--surface-4)]">
        <button
          onClick={onExecute}
          disabled={loading || !canExecute}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
            loading
              ? "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
              : canExecute
                ? "bg-[var(--brand-primary)] text-white hover:opacity-90 shadow-sm"
                : "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed"
          )}
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {loading ? 'Menjalankan...' : 'Jalankan Query'}
        </button>
        <span className="text-[10px] text-[var(--text-muted)]">Ctrl+Enter</span>
        {!canExecute && !loading && (
          <span className="text-[10px] text-amber-500">Select at least 1 dimension or measure</span>
        )}
      </div>
    </div>
  );
}
