import { useMemo } from 'react';
import type { QueryResult } from '@/types/builder';

export interface PivotDataConfig {
  result: QueryResult;
  title?: string;
  sortCol?: string;
  sortDesc?: boolean;
}

export interface PivotDataResult {
  rows: string[];
  cols: string[];
  matrix: Map<string, number>;
  rowStats: Record<string, { total: number; max: number }>;
  colStats: Record<string, { total: number; max: number }>;
  grandTotal: number;
  rowField: string;
  colField: string;
  hasData: boolean;
}

function toSafeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function toSafeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function usePivotData({ 
  result, 
  title, 
  sortCol = 'total', 
  sortDesc = true 
}: PivotDataConfig): PivotDataResult | null {

  return useMemo(() => {
    const columns = result.columns;
    const data = result.rows as Record<string, unknown>[];

    if (!data || data.length === 0) return null;

    const sampleRow = data[0];
    const dimColumns: string[] = [];
    const measureColumns: string[] = [];

    columns.forEach(col => {
      const val = sampleRow[col];

      if (typeof val === 'number') measureColumns.push(col);
      else dimColumns.push(col);
    });

    const isCaseReportByArea = title === 'Case Report by Area';
    const isDetailByBranch = title?.includes('by Branch');

    let rowField = dimColumns[0];
    let colField = dimColumns[1];
    let valueField = measureColumns[0];

    if (isCaseReportByArea) {
      rowField = dimColumns.find(c => c.toLowerCase().includes('branch')) || dimColumns[0];
      colField = dimColumns.find(c => c.toLowerCase().includes('area')) || dimColumns[2];
    } else if (isDetailByBranch) {
      rowField = dimColumns.find(c => c.toLowerCase().includes('category')) || dimColumns[0];
      colField = dimColumns.find(c => c.toLowerCase().includes('branch')) || dimColumns[1];
    } else if (title?.includes('by Airlines')) {
        rowField = dimColumns.find(c => c.toLowerCase().includes('airline')) || dimColumns[0];
        colField = dimColumns.find(c => c.toLowerCase().includes('area') || c.toLowerCase().includes('category') || c.toLowerCase().includes('criteria')) || dimColumns[1];
    }

    if (!rowField) rowField = columns[0];
    if (!colField) colField = columns[1] || columns[0];
    if (!valueField) valueField = columns.find(c => c !== rowField && c !== colField) || columns[columns.length - 1];

    const matrix = new Map<string, number>();
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    let grandTotal = 0;

    data.forEach(row => {
      const r = toSafeString(row[rowField]);
      const c = toSafeString(row[colField]);
      const v = toSafeNumber(row[valueField]);

      if (r !== '' && c !== '') {

        const key = `${r}__${c}`;
        const current = matrix.get(key) || 0;
        matrix.set(key, current + v);

        rowSet.add(r);
        colSet.add(c);
        grandTotal += v;
      }
    });

    const rows = Array.from(rowSet);
    const cols = Array.from(colSet);

    const rowStats: Record<string, { total: number; max: number }> = {};
    const colStats: Record<string, { total: number; max: number }> = {};

    rows.forEach(r => {
      let total = 0;
      let max = 0;
      cols.forEach(c => {
        const val = matrix.get(`${r}__${c}`) || 0;
        total += val;
        if (val > max) max = val;
      });
      rowStats[r] = { total, max };
    });

    cols.forEach(c => {
      let total = 0;
      let max = 0;
      rows.forEach(r => {
        const val = matrix.get(`${r}__${c}`) || 0;
        total += val;
        if (val > max) max = val;
      });
      colStats[c] = { total, max };
    });

    cols.sort((a, b) => colStats[b].total - colStats[a].total);

    rows.sort((a, b) => {
        if (sortCol === 'total') {
            return sortDesc 
                ? rowStats[b].total - rowStats[a].total 
                : rowStats[a].total - rowStats[b].total;
        }
        if (sortCol === 'name') {
            return sortDesc 
                ? a.localeCompare(b) 
                : b.localeCompare(a);
        }
        return 0;
    });

    return { 
        rows, 
        cols, 
        matrix, 
        rowStats, 
        colStats, 
        grandTotal, 
        rowField, 
        colField, 
        hasData: true 
    };
  }, [result, title, sortCol, sortDesc]);
}
