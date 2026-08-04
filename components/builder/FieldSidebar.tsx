
'use client';

import { useState, useMemo } from 'react';
import {
  Search, Calendar, Hash, Type, ToggleLeft, Key,
  ChevronDown, ChevronRight, Link2, Check, Database, Columns3,
} from 'lucide-react';
import { TABLES, getJoinsForSource } from '@/lib/builder/schema';
import type { FieldDef } from '@/types/builder';
import { cn } from '@/lib/utils';

interface FieldSidebarProps {
  source: string;
  activeJoins: string[];
  onFieldClick: (table: string, field: FieldDef) => void;
  onToggleJoin: (joinKey: string) => void;
  onSetSource: (source: string) => void;
}

const FIELD_TYPE_ICONS: Record<string, typeof Type> = {
  string: Type,
  number: Hash,
  date: Calendar,
  datetime: Calendar,
  boolean: ToggleLeft,
  uuid: Key,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  string: 'text-blue-500',
  number: 'text-emerald-500',
  date: 'text-amber-500',
  datetime: 'text-amber-500',
  boolean: 'text-purple-500',
  uuid: 'text-gray-400',
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  string: 'Teks',
  number: 'Angka',
  date: 'Date',
  datetime: 'Waktu',
  boolean: 'Ya/Tidak',
  uuid: 'ID',
};

export function FieldSidebar({
  source,
  activeJoins,
  onFieldClick,
  onToggleJoin,
  onSetSource,
}: FieldSidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set([source]));

  const availableJoins = useMemo(() => getJoinsForSource(source), [source]);

  const visibleTables = useMemo(() => {
    const tables = [TABLES.find(t => t.name === source)!];
    for (const joinKey of activeJoins) {
      const joinDef = availableJoins.find(j => j.key === joinKey);
      if (joinDef) {
        const t = TABLES.find(tb => tb.name === joinDef.to);
        if (t) tables.push(t);
      }
    }
    return tables.filter(Boolean);
  }, [source, activeJoins, availableJoins]);

  const toggleTable = (name: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filterFields = (fields: FieldDef[]) => {
    if (!search) return fields;
    const q = search.toLowerCase();
    return fields.filter(f => f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  };

  const totalFields = visibleTables.reduce((sum, t) => sum + filterFields(t.fields).length, 0);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] border-r border-[var(--surface-4)]">
      {}
      <div className="p-3 border-b border-[var(--surface-4)]">
        <div className="flex items-center gap-2 mb-2">
          <Database size={14} className="text-[var(--brand-primary)]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">Select Data</span>
        </div>

        {}
        <label className="text-[10px] text-[var(--text-muted)] mb-1 block">
          Tabel utama:
        </label>
        <select
          value={source}
          onChange={e => onSetSource(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
        >
          {TABLES.map(t => (
            <option key={t.name} value={t.name}>{t.label}</option>
          ))}
        </select>
      </div>

      {}
      {availableJoins.length > 0 && (
        <div className="p-3 border-b border-[var(--surface-4)]">
          <label className="text-[10px] text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <Link2 size={10} />
            Gabungkan dengan tabel lain:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {availableJoins.map(j => {
              const active = activeJoins.includes(j.key);
              return (
                <button
                  key={j.key}
                  onClick={() => onToggleJoin(j.key)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded-md border transition-all",
                    active
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-4)] hover:border-[var(--brand-primary)]"
                  )}
                >
                  {active && <Check size={10} className="inline mr-0.5" />}
                  {j.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {}
      <div className="p-3 border-b border-[var(--surface-4)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search fields..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] mt-1.5 block">{totalFields} field tersedia</span>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-2">
        {visibleTables.map(table => {
          const fields = filterFields(table.fields);
          const isExpanded = expandedTables.has(table.name);
          const isSource = table.name === source;

          return (
            <div key={table.name} className="mb-1">
              <button
                onClick={() => toggleTable(table.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-md transition-colors"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Columns3 size={12} className={isSource ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'} />
                <span className="uppercase tracking-wider">{table.label}</span>
                {isSource && <span className="text-[9px] text-[var(--brand-primary)] font-normal">(utama)</span>}
                <span className="text-[var(--text-muted)] font-normal ml-auto">{fields.length}</span>
              </button>

              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {fields.map(field => {
                    const Icon = FIELD_TYPE_ICONS[field.type] || Type;
                    const colorClass = FIELD_TYPE_COLORS[field.type] || 'text-[var(--text-muted)]';
                    return (
                      <button
                        key={`${table.name}.${field.name}`}
                        onClick={() => onFieldClick(table.name, field)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded-md transition-colors group"
                        title={`Klik untuk menambahkan "${field.label}" ke query`}
                      >
                        <Icon size={12} className={cn("shrink-0 transition-colors", colorClass)} />
                        <span className="truncate flex-1 text-left">{field.label}</span>
                        <span className="text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                          {FIELD_TYPE_LABELS[field.type] || field.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
