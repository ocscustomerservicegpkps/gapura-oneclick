'use client';

import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import {
  fetchRootCauseByArea,
  fetchBranchByArea,
  fetchAirlineByArea,
  fetchAllAreaReports,
  fetchCellIntelligence,
  fetchBranchAreaPareto,
  fetchAggregatedAreaReport,
  fetchReportsFromSheets,
  AreaSummary,
  TrendDataPoint,
  AreaCategoryData,
  RootCauseByAreaData,
  BranchByAreaData,
  AirlineByAreaData,
  AreaReportRecord,
  CellIntelligence,
  BranchAreaPareto,
} from './data';
import {
  BarChart,
  Bar as RechartsBar,
  LineChart,
  Line as RechartsLine,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';
import { useSearchParams } from 'next/navigation';
import { ArrowUp, Sparkles } from 'lucide-react';
import { InvestigativeTable } from '@/components/chart-detail/InvestigativeTable';
import {
  ReportSection,
  ReportStatCard,
  CompactTable,
  ReportLoading,
  ReportError,
  type CompactColumn,
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
  pageIndex?: number;
}

function AutoInsight({ data }: { data: AreaSummary[] }) {
  if (data.length === 0) return null;

  const topArea = data[0];
  const highRiskAreas = data.filter((a) => a.riskIndex >= 50);
  const totalReports = data.reduce((s, a) => s + a.total, 0);
  const totalIrreg = data.reduce((s, a) => s + a.irregularity, 0);
  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insightParts: string[] = [];
  if (highRiskAreas.length > 0) {
    insightParts.push(
      `${highRiskAreas.length} area${highRiskAreas.length > 1 ? 's' : ''} flagged as high risk (${highRiskAreas.slice(0, 3).map((a) => a.area).join(', ')}${highRiskAreas.length > 3 ? '…' : ''})`,
    );
  }
  insightParts.push(`${topArea.area} leads with ${topArea.total} reports (${topArea.contribution.toFixed(1)}% share)`);
  insightParts.push(`Overall irregularity rate is ${overallIrregRate.toFixed(1)}% across ${data.length} areas`);

  const mainInsight = highRiskAreas.length > 0
    ? `Action required: ${highRiskAreas.length} areas identified with high operational risk.`
    : 'Operational stability: all areas currently below high-risk thresholds.';

  return (
    <div className="cf-card p-4 sm:p-5" style={{ '--cf-spine': 'var(--cf-amber)' } as CSSProperties}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fef3c7] text-[var(--cf-amber)]">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <h3 className="cf-eyebrow mb-2">
            <span>Summary</span>
            <span className="cf-eyebrow-rule" />
          </h3>
          <p className="cf-display mb-3 text-[15px] font-medium leading-snug text-[var(--cf-ink)]">{mainInsight}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {insightParts.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 rounded-lg border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] px-3 py-2 text-[11px] font-medium leading-relaxed text-[var(--cf-ink-2)]">
                <span className="mt-0.5 text-[var(--cf-amber)]">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      </div>
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
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsLegend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          <RechartsLine type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={false} />
          <RechartsLine type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={false} />
          <RechartsLine type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryStackedBar({ data }: { data: AreaCategoryData[] }) {
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.area, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));
  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsLegend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <RechartsBar dataKey="Irregularity" fill="var(--cf-coral)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Complaint" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Compliment" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BranchBreakdownChart({ data }: { data: BranchByAreaData[] }) {
  const topBranches = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.branch) || 0;
      acc.set(curr.branch, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const rechartsData = topBranches.map(([branch, count]) => ({ name: branch, Reports: count }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-teal)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AirlineBreakdownChart({ data }: { data: AirlineByAreaData[] }) {
  const topAirlines = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.airline) || 0;
      acc.set(curr.airline, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const rechartsData = topAirlines.map(([airline, count]) => ({ name: airline, Reports: count }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-slate)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data }: { data: AreaSummary[] }) {
  if (data.length === 0) return null;

  const topArea = data[0];
  const highRiskCount = data.filter((a) => a.riskIndex >= 50).length;
  const areasWithIrreg = data.filter((a) => a.irregularity > 0).length;
  const totalIrreg = data.reduce((sum, a) => sum + a.irregularity, 0);
  const totalReports = data.reduce((sum, a) => sum + a.total, 0);
  const avgIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insights = [
    `${topArea.area} leads with ${topArea.total} reports (${topArea.contribution.toFixed(1)}% of total).`,
    `${areasWithIrreg} of ${data.length} areas have irregularity reports.`,
    `${highRiskCount} area${highRiskCount !== 1 ? 's' : ''} identified as high risk.`,
    `Average irregularity rate across areas: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports across ${data.length} areas.`,
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

export default function AreaReportDetail({ filters = {} }: { filters?: FilterParams }) {
  const searchParams = useSearchParams();
  const focusedBranch = searchParams.get('branch');
  const focusedArea = searchParams.get('area');
  const isFocused = !!focusedBranch && !!focusedArea;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [chartData, setChartData] = useState({
    areaData: [] as AreaSummary[],
    trendData: [] as TrendDataPoint[],
    categoryData: [] as AreaCategoryData[],
    rootCauseData: [] as RootCauseByAreaData[],
    branchData: [] as BranchByAreaData[],
    airlineData: [] as AirlineByAreaData[],
    tableData: [] as AreaReportRecord[],
    paretoData: [] as BranchAreaPareto[],
  });
  const [cellIntel, setCellIntel] = useState<CellIntelligence | null>(null);

  const investigativeData: QueryResult = useMemo(() => {
    const rows = chartData.tableData as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: 0,
    };
  }, [chartData.tableData]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadAggregatedData() {
      setLoading(true);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeFilters: any = {
        ...filters,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branch: focusedBranch || (filters as any).branch,
        area: (focusedArea === 'all' || !focusedArea) ? undefined : focusedArea,
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aggregated = await fetchAggregatedAreaReport(activeFilters as any, signal);

        if (aggregated && aggregated.areaData) {
          setChartData((prev) => ({
            ...prev,
            areaData: aggregated.areaData,
            trendData: aggregated.trendData || [],
            categoryData: aggregated.categoryData || [],
          }));
        } else {
          throw new Error('Invalid aggregated area data');
        }

        if (isFocused) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetchCellIntelligence(focusedBranch!, focusedArea!, activeFilters as any, signal)
            .then((data) => {
              if (!signal.aborted) setCellIntel(data);
            })
            .catch((err) => {
              if (err?.name === 'AbortError') return;
              console.error('Failed to load cell intelligence:', err);
            });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetchBranchAreaPareto(activeFilters as any, signal)
            .then((d) => {
              if (!signal.aborted) {
                setChartData((prev) => ({ ...prev, paretoData: d }));
              }
            })
            .catch((err) => {
              if (err?.name === 'AbortError') return;
              console.error('Failed to load branch/area pareto:', err);
            });
        }
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any).name === 'AbortError') return;
        console.error('Failed to load aggregated area data:', err);
        setError('Failed to load primary chart data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAggregatedData();

    return () => {
      controller.abort();
    };
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo, focusedBranch, focusedArea, isFocused]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDeferredData() {
      setTableLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeFilters: any = {
        ...filters,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branch: focusedBranch || (filters as any).branch,
        area: (focusedArea === 'all' || !focusedArea) ? undefined : focusedArea,
      };

      try {
        // Fetch the raw report set exactly once, then derive every deferred
        // view (root cause, station, airline breakdowns, investigative
        // table) from that single array instead of each view re-fetching
        // the same data independently.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reports = await fetchReportsFromSheets(activeFilters as any);
        if (controller.signal.aborted) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rootCause = fetchRootCauseByArea(reports, activeFilters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const branch = fetchBranchByArea(reports, activeFilters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const airline = fetchAirlineByArea(reports, activeFilters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = fetchAllAreaReports(reports, activeFilters as any);

        setChartData((prev) => ({
          ...prev,
          rootCauseData: rootCause,
          branchData: branch,
          airlineData: airline,
          tableData: table,
        }));
      } catch (err) {
        console.error('Failed to load deferred area data:', err);
      } finally {
        if (!controller.signal.aborted) setTableLoading(false);
      }
    }

    loadDeferredData();
    return () => controller.abort();
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo, focusedBranch, focusedArea]);

  if (loading) return <ReportLoading label="Loading area report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const totalReports = chartData.areaData.reduce((sum, a) => sum + a.total, 0);
  const totalIrreg = chartData.areaData.reduce((sum, a) => sum + a.irregularity, 0);
  const totalComplaint = chartData.areaData.reduce((sum, a) => sum + a.complaint, 0);
  const totalCompliment = chartData.areaData.reduce((sum, a) => sum + a.compliment, 0);

  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;
  const overallNetSentiment = (totalCompliment + totalComplaint) > 0
    ? ((totalCompliment - totalComplaint) / (totalCompliment + totalComplaint)) * 100
    : 0;

  const topArea = chartData.areaData.length > 0 ? chartData.areaData[0].area : '-';

  const rankColumns: CompactColumn<AreaSummary>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'area', label: 'Area' },
    { key: 'total', label: 'Total', align: 'right', numeric: true, render: (r) => r.total.toLocaleString('id-ID') },
    { key: 'irregularity', label: 'Irreg.', align: 'right', numeric: true, hideBelow: 'sm' },
    { key: 'complaint', label: 'Complaint', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'compliment', label: 'Compliment', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'irregularityRate', label: 'Irreg. Rate', align: 'right', numeric: true, hideBelow: 'lg', render: (r) => `${r.irregularityRate.toFixed(1)}%` },
    { key: 'netSentiment', label: 'Net Sentiment', align: 'right', numeric: true, hideBelow: 'lg', render: (r) => `${r.netSentiment > 0 ? '+' : ''}${r.netSentiment.toFixed(1)}%` },
    {
      key: 'riskIndex',
      label: 'Risk',
      align: 'center',
      render: (r) => {
        const tone = r.riskIndex >= 50 ? { label: 'High', cls: 'bg-[#fee2e2] text-[var(--cf-coral)]' } : r.riskIndex >= 20 ? { label: 'Medium', cls: 'bg-[#fef3c7] text-[var(--cf-amber)]' } : { label: 'Low', cls: 'bg-[#ecfccb] text-[var(--cf-lime)]' };
        return <span className={`cf-chip ${tone.cls}`}>{tone.label}</span>;
      },
    },
  ];

  const paretoChartData = chartData.paretoData.map((d) => ({ name: d.branch, Reports: d.count, 'Cumulative %': d.cumulativePercent }));
  const velocityChartData = chartData.trendData.map((d) => ({ name: d.month, Reports: d.total }));

  let sectionIdx = 0;
  const nextIdx = () => ++sectionIdx;

  return (
    <div className="space-y-6 sm:space-y-8">
      {isFocused ? (
        <div className="cf-card p-4 sm:p-5" style={{ '--cf-spine': 'var(--cf-teal)' } as CSSProperties}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.delete('branch');
                  params.delete('area');
                  window.location.href = `${window.location.pathname}?${params.toString()}`;
                }}
                className="cf-eyebrow mb-2 cursor-pointer"
              >
                <ArrowUp className="-rotate-90" size={11} />
                <span>Back to hub overview</span>
              </button>
              <h1 className="cf-display truncate text-xl font-semibold text-[var(--cf-ink)] sm:text-2xl">
                {focusedArea === 'all' ? `All Areas in ${focusedBranch}` : `${focusedArea} • ${focusedBranch}`}
              </h1>
            </div>
            <span className="cf-chip flex-shrink-0 bg-[var(--cf-teal-tint)] text-[var(--cf-teal)]">
              Risk {cellIntel?.riskScore.toFixed(0) || '0'}/100
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ReportStatCard label="Total Volume" value={cellIntel?.count || 0} tone="teal" />
            <ReportStatCard label="Area Rank" value={`#${cellIntel?.rank || '?'}`} tone="slate" />
            <ReportStatCard
              label="Growth MoM"
              value={`${cellIntel ? cellIntel.momGrowth.toFixed(1) : '0.0'}%`}
              trend={cellIntel?.momGrowth}
              tone={cellIntel && cellIntel.momGrowth > 0 ? 'coral' : 'lime'}
            />
            <ReportStatCard
              label="Risk Intensity"
              value={cellIntel?.riskLevel || 'Low'}
              tone={(cellIntel?.riskLevel?.toUpperCase() === 'TOP RISK' || cellIntel?.riskLevel?.toUpperCase() === 'HIGH RISK') ? 'coral' : 'teal'}
            />
            <ReportStatCard label="Contribution" value={`${cellIntel ? cellIntel.contribution.toFixed(1) : '0.0'}%`} tone="amber" />
            <ReportStatCard label="Avg Severity" value={(cellIntel?.severityScore || 0).toFixed(1)} tone="slate" />
          </div>
        </div>
      ) : (
        <AutoInsight data={chartData.areaData} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard
          label={isFocused ? 'Focused Volume' : 'Total Reports'}
          value={totalReports.toLocaleString('id-ID')}
          tone="teal"
        />
        <ReportStatCard
          label={isFocused ? 'Area Risk Index' : 'Overall Irreg. Rate'}
          value={isFocused ? (cellIntel?.riskScore.toFixed(0) || '0') : `${overallIrregRate.toFixed(1)}%`}
          tone={isFocused ? ((cellIntel?.riskLevel?.toUpperCase() === 'TOP RISK' || cellIntel?.riskLevel?.toUpperCase() === 'HIGH RISK') ? 'coral' : 'teal') : (overallIrregRate >= 5 ? 'coral' : 'lime')}
        />
        <ReportStatCard
          label="Net Sentiment"
          value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`}
          tone={overallNetSentiment > 0 ? 'lime' : 'coral'}
        />
        <ReportStatCard
          label={isFocused ? 'Area Rank' : 'Top Area'}
          value={isFocused ? `#${cellIntel?.rank || '?'}` : topArea}
          subtitle={!isFocused && chartData.areaData.length > 0 ? `${chartData.areaData[0].total} reports` : undefined}
          tone="amber"
        />
      </div>

      {!isFocused && (
        <ReportSection index={nextIdx()} title="Area Performance Ranking" tone="teal">
          <CompactTable columns={rankColumns} rows={chartData.areaData} rowKey="area" maxRows={15} />
        </ReportSection>
      )}

      {isFocused && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <ReportSection index={nextIdx()} title="Area Concentration" subtitle="80/20 rule — cumulative share by station" tone="amber">
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoChartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
                  <RechartsBar yAxisId="left" dataKey="Reports" fill="var(--cf-teal-tint-2)" radius={[4, 4, 0, 0]} />
                  <RechartsLine yAxisId="right" type="monotone" dataKey="Cumulative %" stroke="var(--cf-amber)" strokeWidth={2} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportSection>
          <ReportSection index={nextIdx()} title="Velocity & Acceleration" subtitle="Report volume trend for this cell" tone="teal">
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityChartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
                  <RechartsLine type="monotone" dataKey="Reports" stroke="var(--cf-teal)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ReportSection>
        </div>
      )}

      <ReportSection index={nextIdx()} title={isFocused ? 'Detailed Volume Trend' : 'Monthly Trend Analysis'} tone="teal">
        <MonthlyTrendChart data={chartData.trendData} />
      </ReportSection>

      <ReportSection index={nextIdx()} title={isFocused ? 'Focused Category Split' : 'Category Composition by Area'} tone="amber">
        <CategoryStackedBar data={chartData.categoryData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={nextIdx()} title={isFocused ? 'Station Comparisons' : 'Station Distribution by Area'} tone="slate">
          <BranchBreakdownChart data={chartData.branchData} />
        </ReportSection>
        <ReportSection index={nextIdx()} title={isFocused ? 'Airline Impact' : 'Airline Distribution by Area'} tone="slate">
          <AirlineBreakdownChart data={chartData.airlineData} />
        </ReportSection>
      </div>

      {!isFocused && (
        <ReportSection index={nextIdx()} title="Management Summary" tone="teal">
          <ManagementSummary data={chartData.areaData} />
        </ReportSection>
      )}

      <ReportSection
        index={nextIdx()}
        title={isFocused ? `Intelligence Node: ${focusedArea}` : 'Investigative Table'}
        subtitle="Area reports — expand a row for full case detail"
        bodyClassName="p-0"
      >
        <InvestigativeTable data={investigativeData} title="Area Reports" rowsPerPage={8} maxRows={40} isLoading={tableLoading} theme="cf" />
      </ReportSection>
    </div>
  );
}
