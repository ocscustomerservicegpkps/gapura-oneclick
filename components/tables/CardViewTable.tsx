'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface TableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  priority?: 'high' | 'medium' | 'low';
  width?: string;
}

export interface TableAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (row: T) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface CardViewTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
  showHeader?: boolean;
}

export function CardViewTable<T>({
  data,
  columns,
  actions,
  keyExtractor,
  onRowClick,
  className,
  emptyMessage = 'No data',
  showHeader = false,
}: CardViewTableProps<T>) {

  const mobileColumns = columns.filter(
    (col) => !col.priority || col.priority !== 'low'
  );

  const primaryColumn = mobileColumns.find((col) => col.priority === 'high') || mobileColumns[0];
  const metaColumns = mobileColumns.filter((col) => col.key !== primaryColumn?.key);

  if (data.length === 0) {
    return (
      <div className={cn('text-center py-8 text-[var(--text-muted)] text-sm', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showHeader && primaryColumn && (
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1">
          {primaryColumn.header}
        </div>
      )}

      {data.map((row) => (
        <CardItem
          key={keyExtractor(row)}
          row={row}
          primaryColumn={primaryColumn}
          metaColumns={metaColumns}
          actions={actions}
          onClick={() => onRowClick?.(row)}
        />
      ))}
    </div>
  );
}

interface CardItemProps<T> {
  row: T;
  primaryColumn: TableColumn<T>;
  metaColumns: TableColumn<T>[];
  actions?: TableAction<T>[];
  onClick?: () => void;
}

function CardItem<T>({
  row,
  primaryColumn,
  metaColumns,
  actions,
  onClick,
}: CardItemProps<T>) {
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'bg-white rounded-xl border border-[var(--surface-4)] p-4',
        'transition-shadow duration-200',
        clickable && 'cursor-pointer active:shadow-md hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2',
        'touch-manipulation'
      )}
      style={{ minHeight: '80px' }}
    >
      {}
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--text-primary)] text-sm line-clamp-2">
            {primaryColumn.accessor(row)}
          </div>
        </div>

        {}
        {!actions && clickable && (
          <div className="text-[var(--text-muted)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>

      {}
      {metaColumns.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
          {metaColumns.slice(0, 3).map((column) => (
            <div key={column.key} className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">{column.header}:</span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                {column.accessor(row)}
              </span>
            </div>
          ))}
        </div>
      )}

      {}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 pt-3 border-t border-[var(--surface-3)]">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(row);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                'min-h-[44px] transition-colors',
                action.variant === 'danger' && 'text-red-600 bg-red-50 hover:bg-red-100',
                action.variant === 'primary' && 'text-[var(--text-on-primary)] bg-[var(--brand-primary)] hover:opacity-90',
                action.variant === 'secondary' && 'text-[var(--text-secondary)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]',
                (!action.variant || action.variant === 'ghost') && 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
              )}
            >
              {action.icon && <span className="w-4 h-4">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function formatMobileDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return format(d, 'dd MMM');
}

export function truncateMobile(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
