'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  fetchPivotData,
  buildPivotMatrix,
  fetchDimensionBreakdown,
  fetchMonthlyTrend,
  fetchAllPivotReports,
  inferDimensions,
  PivotMatrix,
  TrendDataPoint,
  DimensionBreakdown,
  PivotReportRecord,
} from './data';
import { Report } from '@/types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { InvestigativeTable } from '@/components/chart-detail/InvestigativeTable';
import { DataTableWithPagination } from '@/components/chart-detail/DataTableWithPagination';
import {
  ReportSection,
  ReportStatCard,
  ReportLoading,
  ReportError,
} from '@/components/chart-detail/ReportDetailKit';
import type { QueryResult } from '@/types/builder';

interface FilterParams {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

function HeatmapTable({ matrix }: { matrix: PivotMatrix }) {
  const maxValue = Math.max(...Array.from(matrix.cells.values()), 1);

  function cellStyle(value: number): { background: string; color: string } {
    if (value === 0) return { background: 'var(--cf-canvas-2)', color: 'var(--cf-ink-3)' };
    const intensity = value / maxValue;
    if (intensity > 0.75) return { background: 'var(--cf-teal)', color: '#fff' };
    if (intensity > 0.5) return { background: 'var(--cf-teal-tint-2)', color: 'var(--cf-teal-deep)' };
    if (intensity > 0.25) return { background: 'var(--cf-teal-tint)', color: 'var(--cf-teal-deep)' };
    return { background: '#fbfaf5', color: 'var(--cf-ink-2)' };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--cf-line)]">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-[11px] sm:text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 whitespace-nowrap border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2"></th>
              {matrix.cols.map((col) => (
                <th key={col} className="whitespace-nowrap border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-[var(--cf-ink-3)]">
                  {col}
                </th>
              ))}
              <th className="border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-[var(--cf-ink)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 whitespace-nowrap border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 font-bold text-[var(--cf-ink)]">
                  {row}
                </td>
                {matrix.cols.map((col) => {
                  const value = matrix.cells.get(`${row}|||${col}`) || 0;
                  return (
                    <td key={col} className="border border-[var(--cf-line)] px-2.5 py-2 text-center font-semibold" style={cellStyle(value)}>
                      {value || '-'}
                    </td>
                  );
                })}
                <td className="border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 text-center font-bold text-[var(--cf-ink)]">
                  {matrix.rowTotals.get(row) || 0}
                </td>
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 font-black text-[var(--cf-ink)]">
                Grand Total
              </td>
              {matrix.cols.map((col) => (
                <td key={col} className="border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-2.5 py-2 text-center font-black text-[var(--cf-ink)]">
                  {matrix.colTotals.get(col) || 0}
                </td>
              ))}
              <td className="border border-[var(--cf-line)] bg-[var(--cf-teal-tint-2)] px-2.5 py-2 text-center font-black text-[var(--cf-teal-deep)]">
                {matrix.grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DimensionChart({ data, label, color }: { data: DimensionBreakdown[]; label: string; color: string }) {
  const rechartsData = data.slice(0, 12).map((d) => ({ name: d.label, [label]: d.count }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} width={110} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Bar dataKey={label} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyTrendChart({ data }: { data: TrendDataPoint[] }) {
  const rechartsData = data.map((d) => ({ name: d.month, Total: d.total, Irregularity: d.Irregularity, Complaint: d.Complaint }));

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          <Line type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ matrix, rowLabel, colLabel }: { matrix: PivotMatrix; rowLabel: string; colLabel: string }) {
  if (matrix.grandTotal === 0) return null;

  const topRow = matrix.rows[0];
  const topCol = matrix.cols[0];
  const topRowCount = matrix.rowTotals.get(topRow) || 0;
  const topColCount = matrix.colTotals.get(topCol) || 0;

  let peakValue = 0;
  let peakRow = '';
  let peakCol = '';
  matrix.cells.forEach((value, key) => {
    if (value > peakValue) {
      peakValue = value;
      const [r, c] = key.split('|||');
      peakRow = r;
      peakCol = c;
    }
  });

  const insights = [
    `Highest ${rowLabel}: "${topRow}" with ${topRowCount} reports (${((topRowCount / matrix.grandTotal) * 100).toFixed(1)}%).`,
    `Highest ${colLabel}: "${topCol}" with ${topColCount} reports.`,
    `Peak cell: "${peakRow}" × "${peakCol}" = ${peakValue} reports.`,
    `Matrix spans ${matrix.rows.length} ${rowLabel}s × ${matrix.cols.length} ${colLabel}s (${matrix.grandTotal} total).`,
  ];

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight, idx) => (
        <li key={idx} className="flex items-start gap-3 rounded-xl border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] p-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cf-teal-tint)] text-[10px] font-bold text-[var(--cf-teal)]">
            0{idx + 1}
          </span>
          <span className="text-[12px] font-medium leading-snug text-[var(--cf-ink-2)]">{insight}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PivotReportDetail({ filters = {}, pivotTitle = '' }: { filters?: FilterParams; pivotTitle?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [tableData, setTableData] = useState<PivotReportRecord[]>([]);
  const requestIdRef = useRef(0);
  const investigativeData: QueryResult = useMemo(() => {
    const rows = tableData as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: rows.length, executionTimeMs: 0 };
  }, [tableData]);

  const { rowField, colField } = useMemo(() => inferDimensions(pivotTitle), [pivotTitle]);

  const rowLabel = rowField.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
  const colLabel = colField === 'category' ? 'Case Category' : colField.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());

  useEffect(() => {
    async function loadData() {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const [pivotReports, trend, table] = await Promise.all([
          fetchPivotData(filters),
          fetchMonthlyTrend(filters),
          fetchAllPivotReports(filters),
        ]);

        if (requestId !== requestIdRef.current) return;

        setReports(pivotReports);
        setTrendData(trend);
        setTableData(table);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('Failed to load data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }

    loadData();
    return () => {
      // Invalidates this run's pending success/error/finally handlers if the
      // component unmounts or filters change again before it resolves.
      requestIdRef.current += 1;
    };
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  const matrix = useMemo(() => buildPivotMatrix(reports, rowField, colField), [reports, rowField, colField]);
  const rowBreakdown = useMemo(() => fetchDimensionBreakdown(reports, rowField), [reports, rowField]);
  const colBreakdown = useMemo(() => fetchDimensionBreakdown(reports, colField), [reports, colField]);
  const fullTableData: QueryResult = useMemo(() => {
    const rowColumn = rowLabel;
    const valueColumns = matrix.cols;
    const columns = [rowColumn, ...valueColumns, 'Total'];

    const rows: Record<string, unknown>[] = matrix.rows.map((rowName) => {
      const record: Record<string, unknown> = { [rowColumn]: rowName };
      valueColumns.forEach((col) => {
        record[col] = matrix.cells.get(`${rowName}|||${col}`) || 0;
      });
      record.Total = matrix.rowTotals.get(rowName) || 0;
      return record;
    });

    const grandTotalRow: Record<string, unknown> = { [rowColumn]: 'Grand Total' };
    valueColumns.forEach((col) => {
      grandTotalRow[col] = matrix.colTotals.get(col) || 0;
    });
    grandTotalRow.Total = matrix.grandTotal;

    const allRows = [...rows, grandTotalRow];

    return { columns, rows: allRows, rowCount: allRows.length, executionTimeMs: 0 };
  }, [matrix, rowLabel]);

  if (loading) return <ReportLoading label="Loading pivot report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  let peakValue = 0;
  matrix.cells.forEach((value) => {
    if (value > peakValue) peakValue = value;
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Total Reports" value={matrix.grandTotal.toLocaleString('id-ID')} tone="teal" />
        <ReportStatCard label={`Unique ${rowLabel}s`} value={matrix.rows.length} tone="lime" />
        <ReportStatCard label={`Unique ${colLabel}s`} value={matrix.cols.length} tone="amber" />
        <ReportStatCard label="Peak Cell Value" value={peakValue} tone="coral" />
      </div>

      <ReportSection index={1} title={pivotTitle || `${colLabel} by ${rowLabel}`} tone="teal">
        <HeatmapTable matrix={matrix} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={2} title={`${rowLabel} Breakdown`} tone="teal">
          <DimensionChart data={rowBreakdown} label={rowLabel} color="var(--cf-teal)" />
        </ReportSection>
        <ReportSection index={3} title={`${colLabel} Breakdown`} tone="amber">
          <DimensionChart data={colBreakdown} label={colLabel} color="var(--cf-amber)" />
        </ReportSection>
      </div>

      <ReportSection index={4} title="Monthly Trend Analysis" tone="teal">
        <MonthlyTrendChart data={trendData} />
      </ReportSection>

      <ReportSection index={5} title="Management Summary" tone="slate">
        <ManagementSummary matrix={matrix} rowLabel={rowLabel} colLabel={colLabel} />
      </ReportSection>

      <ReportSection index={6} title="Investigative Table" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title={`${pivotTitle || `${colLabel} by ${rowLabel}`} — Records`}
          rowsPerPage={8}
          maxRows={40}
          theme="cf"
        />
      </ReportSection>

      <ReportSection index={7} title="Full Data Table" bodyClassName="p-0">
        <div className="p-4 sm:p-5">
          <DataTableWithPagination data={fullTableData} title={pivotTitle || `${colLabel} by ${rowLabel}`} rowsPerPage={5} />
        </div>
      </ReportSection>
    </div>
  );
}
