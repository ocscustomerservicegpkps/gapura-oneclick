
'use client';

import { X, Plus } from 'lucide-react';
import type { QueryFilter, FilterOperator, FieldDef } from '@/types/builder';
import { getFieldDef } from '@/lib/builder/schema';
import { cn } from '@/lib/utils';

interface FilterBuilderProps {
  filters: QueryFilter[];
  availableFields: Array<{ table: string; field: FieldDef }>;
  onAdd: (filter: QueryFilter) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<QueryFilter>) => void;
}

const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
  string: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'like', label: 'contains' },
    { value: 'in', label: 'one of' },
    { value: 'is_null', label: 'is empty' },
    { value: 'is_not_null', label: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'between', label: 'between' },
    { value: 'is_null', label: 'is empty' },
  ],
  date: [
    { value: 'eq', label: '=' },
    { value: 'gt', label: 'after' },
    { value: 'lt', label: 'before' },
    { value: 'between', label: 'between' },
    { value: 'is_null', label: 'is empty' },
    { value: 'is_not_null', label: 'is not empty' },
  ],
  datetime: [
    { value: 'eq', label: '=' },
    { value: 'gt', label: 'after' },
    { value: 'lt', label: 'before' },
    { value: 'between', label: 'between' },
    { value: 'is_null', label: 'is empty' },
    { value: 'is_not_null', label: 'is not empty' },
  ],
  boolean: [
    { value: 'eq', label: '=' },
  ],
  uuid: [
    { value: 'eq', label: '=' },
    { value: 'is_null', label: 'is empty' },
    { value: 'is_not_null', label: 'is not empty' },
  ],
};

function getOperatorsForField(table: string, field: string): { value: FilterOperator; label: string }[] {
  const def = getFieldDef(table, field);
  if (!def) return OPERATORS_BY_TYPE.string;

  if (def.enumValues && def.enumValues.length > 0) {
    return [
      { value: 'eq', label: '=' },
      { value: 'neq', label: '!=' },
      { value: 'in', label: 'one of' },
      { value: 'not_in', label: 'not one of' },
      { value: 'is_null', label: 'is empty' },
    ];
  }
  return OPERATORS_BY_TYPE[def.type] || OPERATORS_BY_TYPE.string;
}

export function FilterBuilder({ filters, availableFields, onAdd, onRemove, onUpdate }: FilterBuilderProps) {

  const handleAddFilter = () => {
    if (availableFields.length === 0) return;
    const first = availableFields[0];
    onAdd({
      table: first.table,
      field: first.field.name,
      operator: 'eq',
      value: '',
      conjunction: 'AND',
    });
  };

  return (
    <div className="space-y-2">
      {filters.map((filter, idx) => {
        const fieldDef = getFieldDef(filter.table, filter.field);
        const operators = getOperatorsForField(filter.table, filter.field);
        const needsValue = !['is_null', 'is_not_null'].includes(filter.operator);

        return (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            {}
            {idx > 0 && (
              <button
                onClick={() => onUpdate(idx, { conjunction: filter.conjunction === 'AND' ? 'OR' : 'AND' })}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded border transition-colors",
                  filter.conjunction === 'AND'
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                )}
              >
                {filter.conjunction}
              </button>
            )}

            {}
            <select
              value={`${filter.table}.${filter.field}`}
              onChange={e => {
                const [table, field] = e.target.value.split('.');
                onUpdate(idx, { table, field, value: '' });
              }}
              className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            >
              {availableFields.map(af => (
                <option key={`${af.table}.${af.field.name}`} value={`${af.table}.${af.field.name}`}>
                  {af.field.label}
                </option>
              ))}
            </select>

            {}
            <select
              value={filter.operator}
              onChange={e => onUpdate(idx, { operator: e.target.value as FilterOperator, value: '' })}
              className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            >
              {operators.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            {}
            {needsValue && (
              <>
                {fieldDef?.enumValues ? (
                  <select
                    value={String(filter.value || '')}
                    onChange={e => onUpdate(idx, { value: e.target.value })}
                    className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] min-w-[120px]"
                  >
                    <option value="">Select...</option>
                    {fieldDef.enumValues.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : fieldDef?.type === 'boolean' ? (
                  <select
                    value={String(filter.value || '')}
                    onChange={e => onUpdate(idx, { value: e.target.value === 'true' })}
                    className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (fieldDef?.type === 'date' || fieldDef?.type === 'datetime') ? (
                  filter.operator === 'between' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={Array.isArray(filter.value) ? String(filter.value[0] || '') : ''}
                        onChange={e => {
                          const arr = Array.isArray(filter.value) ? [...filter.value] : ['', ''];
                          arr[0] = e.target.value;
                          onUpdate(idx, { value: arr as string[] });
                        }}
                        className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                      />
                      <span className="text-[10px] text-[var(--text-muted)]">to</span>
                      <input
                        type="date"
                        value={Array.isArray(filter.value) ? String(filter.value[1] || '') : ''}
                        onChange={e => {
                          const arr = Array.isArray(filter.value) ? [...filter.value] : ['', ''];
                          arr[1] = e.target.value;
                          onUpdate(idx, { value: arr as string[] });
                        }}
                        className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                      />
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={String(filter.value || '')}
                      onChange={e => onUpdate(idx, { value: e.target.value })}
                      className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    />
                  )
                ) : (
                  <input
                    type={fieldDef?.type === 'number' ? 'number' : 'text'}
                    value={String(filter.value || '')}
                    onChange={e => onUpdate(idx, { value: fieldDef?.type === 'number' ? Number(e.target.value) : e.target.value })}
                    placeholder="Nilai..."
                    className="px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] min-w-[120px]"
                  />
                )}
              </>
            )}

            {}
            <button
              onClick={() => onRemove(idx)}
              className="p-1 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <button
        onClick={handleAddFilter}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] rounded-md transition-colors"
      >
        <Plus size={12} />
        Add Filter
      </button>
    </div>
  );
}
