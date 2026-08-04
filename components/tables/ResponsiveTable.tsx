'use client';

import { cn } from '@/lib/utils';
import { useViewport } from '@/hooks/useViewport';
import { CardViewTable, TableColumn, TableAction, formatMobileDate, truncateMobile } from './CardViewTable';

interface ResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  tableClassName?: string;
  cardClassName?: string;
  emptyMessage?: string;

  cardBreakpoint?: number;
}

export function ResponsiveTable<T>({
  data,
  columns,
  actions,
  keyExtractor,
  onRowClick,
  className,
  tableClassName,
  cardClassName,
  emptyMessage = 'No data',
  cardBreakpoint = 640,
}: ResponsiveTableProps<T>) {
  const { width } = useViewport();
  const useCardView = width < cardBreakpoint;

  if (useCardView) {
    return (
      <CardViewTable
        data={data}
        columns={columns}
        actions={actions}
        keyExtractor={keyExtractor}
        onRowClick={onRowClick}
        className={cn(cardClassName, className)}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      actions={actions}
      keyExtractor={keyExtractor}
      onRowClick={onRowClick}
      className={cn(tableClassName, className)}
      emptyMessage={emptyMessage}
    />
  );
}

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
}

function DataTable<T>({
  data,
  columns,
  actions,
  keyExtractor,
  onRowClick,
  className,
  emptyMessage,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] bg-white rounded-xl border border-[var(--surface-4)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-[var(--surface-4)]', className)}>
      <table className="w-full text-sm text-left">
        <thead className="bg-[var(--surface-1)] text-[var(--text-secondary)] font-medium">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-4 py-3 whitespace-nowrap',
                  column.width && `w-[${column.width}]`
                )}
              >
                {column.header}
              </th>
            ))}
            {actions && actions.length > 0 && (
              <th className="px-4 py-3 text-right">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--surface-3)] bg-white">
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-[var(--surface-1)] focus-visible:outline-none focus-visible:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary)]'
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {column.accessor(row)}
                </td>
              ))}
              {actions && actions.length > 0 && (
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(row);
                        }}
                        className={cn(
                          'p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                          action.variant === 'danger' && 'text-red-600 hover:bg-red-50',
                          action.variant === 'primary' && 'text-[var(--brand-primary)] hover:bg-[var(--surface-1)]',
                          (!action.variant || action.variant === 'ghost') && 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)]'
                        )}
                        title={action.label}
                      >
                        {action.icon}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { formatMobileDate, truncateMobile };
export type { TableColumn, TableAction };
