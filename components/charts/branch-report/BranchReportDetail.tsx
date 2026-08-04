'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  fetchRootCauseByBranch,
  fetchAirlineByBranch,
  fetchAreaByBranch,
  fetchAllBranchReports,
  fetchAggregatedBranchReport,
  fetchReportsFromSheets,
  BranchSummary,
  TrendDataPoint,
  BranchCategoryData,
  RootCauseByBranchData,
  AirlineByBranchData,
  AreaByBranchData,
  BranchReportRecord,
  BranchKPIs,
  BranchCategoryDistribution,
} from './data';
import { LineChart, Line as RechartsLine } from 'recharts';
import { Sparkles } from 'lucide-react';
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
import { BarChart as RechartsBarChart, Bar as RechartsBar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, LabelList, Cell } from 'recharts';

interface FilterParams {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

function AutoInsight({ data }: { data: BranchSummary[] }) {
  if (data.length === 0) return null;

  const topBranch = data[0];
  const highRiskBranches = data.filter((b) => b.riskIndex >= 50);
  const totalReports = data.reduce((s, b) => s + b.total, 0);
  const totalIrreg = data.reduce((s, b) => s + b.irregularity, 0);
  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insightParts: string[] = [];
  if (highRiskBranches.length > 0) {
    insightParts.push(
      `${highRiskBranches.length} branch${highRiskBranches.length > 1 ? 'es' : ''} flagged as high risk (${highRiskBranches.slice(0, 3).map((b) => b.branch).join(', ')}${highRiskBranches.length > 3 ? '…' : ''})`,
    );
  }
  insightParts.push(`${topBranch.branch} leads with ${topBranch.total} reports (${topBranch.contribution.toFixed(1)}% share)`);
  insightParts.push(`Overall irregularity rate is ${overallIrregRate.toFixed(1)}% across ${data.length} branches`);

  const mainInsight = highRiskBranches.length > 0
    ? `Action required: ${highRiskBranches.length} branches identified with high operational risk.`
    : 'Operational stability: all branches currently below high-risk thresholds.';

  return (
    <div className="cf-card p-4 sm:p-5" style={{ '--cf-spine': 'var(--cf-amber)' } as React.CSSProperties}>
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
          <RechartsLine type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={{ r: 2 }} />
          <RechartsLine type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={{ r: 2 }} />
          <RechartsLine type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryStackedBar({ data }: { data: BranchCategoryData[] }) {
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.branch, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));
  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsLegend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <RechartsBar dataKey="Irregularity" fill="var(--cf-coral)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Complaint" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Compliment" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AirlineBreakdownChart({ data }: { data: AirlineByBranchData[] }) {
  const topAirlines = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.airline) || 0;
      acc.set(curr.airline, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const rechartsData = topAirlines.map(([airline, count]) => ({ name: airline.split(' '), Reports: count }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-teal)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Reports" position="top" style={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          </RechartsBar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AreaBreakdownChart({ data }: { data: AreaByBranchData[] }) {
  const areaTotals = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.area) || 0;
      acc.set(curr.area, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  const colors = ['var(--cf-teal)', 'var(--cf-amber)', 'var(--cf-coral)', 'var(--cf-lime)'];
  const rechartsData = areaTotals.map(([area, count], i) => ({ name: area.split(' '), Reports: count, fill: colors[i % colors.length] }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" radius={[4, 4, 0, 0]}>
            {rechartsData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </RechartsBar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data }: { data: BranchSummary[] }) {
  if (data.length === 0) return null;

  const topBranch = data[0];
  const highRiskCount = data.filter((b) => b.riskIndex >= 50).length;
  const totalIrreg = data.reduce((sum, b) => sum + b.irregularity, 0);
  const totalReports = data.reduce((sum, b) => sum + b.total, 0);
  const avgIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insights = [
    `${topBranch.branch} leads with ${topBranch.total} reports (${topBranch.contribution.toFixed(1)}% of total).`,
    `${highRiskCount} branch${highRiskCount !== 1 ? 'es' : ''} identified as high risk.`,
    `Average irregularity rate across branches: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports.`,
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

export default function BranchReportDetail({ filters = {} }: { filters?: FilterParams; hideAnalyzeButton?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState({
    branchData: [] as BranchSummary[],
    trendData: [] as TrendDataPoint[],
    categoryData: [] as BranchCategoryData[],
    rootCauseData: [] as RootCauseByBranchData[],
    airlineData: [] as AirlineByBranchData[],
    areaData: [] as AreaByBranchData[],
    tableData: [] as BranchReportRecord[],
    kpis: null as BranchKPIs | null,
    categoryDistribution: [] as BranchCategoryDistribution[],
  });

  const investigativeData: QueryResult = useMemo(() => {
    const rows = chartData.tableData as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: rows.length, executionTimeMs: 0 };
  }, [chartData.tableData]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      setLoading(true);
      setError(null);
      try {
        const aggregated = await fetchAggregatedBranchReport(filters, controller.signal);
        if (controller.signal.aborted) return;
        if (aggregated && aggregated.branchData) {
          setChartData((prev) => ({
            ...prev,
            branchData: aggregated.branchData,
            trendData: aggregated.trendData || [],
            categoryData: (aggregated.branchData || []).map((b) => ({
              branch: b.branch,
              Irregularity: b.irregularity,
              Complaint: b.complaint,
              Compliment: b.compliment,
            })),
            kpis: aggregated.kpis,
            categoryDistribution: aggregated.categoryDistribution || [],
          }));
        } else {
          throw new Error('Invalid aggregated data received');
        }
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any).name === 'AbortError') return;
        console.error('Failed to load initial branch data:', err);
        setError('Failed to load initial dashboard data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    async function loadDeferredData() {
      setTableLoading(true);
      try {
        // Fetch the raw report set exactly once, then derive every deferred
        // view (root cause, airline, area breakdowns, investigative table)
        // from that single array instead of each view re-fetching the same
        // data independently.
        const reports = await fetchReportsFromSheets(filters);
        if (controller.signal.aborted) return;

        const rootCause = fetchRootCauseByBranch(reports, filters);
        const airline = fetchAirlineByBranch(reports, filters);
        const area = fetchAreaByBranch(reports, filters);
        const table = fetchAllBranchReports(reports, filters);

        setChartData((prev) => ({ ...prev, rootCauseData: rootCause, airlineData: airline, areaData: area, tableData: table }));
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any).name === 'AbortError') return;
      } finally {
        if (!controller.signal.aborted) {
          setTableLoading(false);
        }
      }
    }

    loadInitialData();
    loadDeferredData();

    return () => controller.abort();
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.dateFrom, filters.dateTo, filters.sourceSheet]);

  if (loading) return <ReportLoading label="Loading station report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const rankColumns: CompactColumn<BranchSummary>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'branch', label: 'Station' },
    { key: 'total', label: 'Total', align: 'right', numeric: true, render: (r) => r.total.toLocaleString('id-ID') },
    { key: 'irregularity', label: 'Irreg.', align: 'right', numeric: true, hideBelow: 'sm' },
    { key: 'complaint', label: 'Complaint', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'compliment', label: 'Compliment', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'irregularityRate', label: 'Irreg. Rate', align: 'right', numeric: true, hideBelow: 'lg', render: (r) => `${r.irregularityRate.toFixed(1)}%` },
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoInsight data={chartData.branchData} />

      {chartData.kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ReportStatCard label="Total Stations" value={chartData.kpis.totalBranches} tone="teal" />
          <ReportStatCard label="Top Performer" value={chartData.kpis.topPerformer.name} subtitle={`${chartData.kpis.topPerformer.count} reports`} tone="lime" />
          <ReportStatCard label="Worst Performer" value={chartData.kpis.worstPerformer.name} subtitle={`${chartData.kpis.worstPerformer.count} reports`} tone="coral" />
          <ReportStatCard label="Avg / Station" value={chartData.kpis.avgReportsPerBranch} tone="amber" />
          <ReportStatCard
            label="MoM Change"
            value={chartData.kpis.momChange > 0 ? `+${chartData.kpis.momChange}%` : `${chartData.kpis.momChange}%`}
            trend={chartData.kpis.momChange}
            tone="teal"
          />
        </div>
      )}

      <ReportSection index={1} title="Station Performance Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={chartData.branchData} rowKey="branch" maxRows={15} />
      </ReportSection>

      {chartData.categoryDistribution.length > 0 && (
        <ReportSection index={2} title="Category Distribution per Station" subtitle="Top 10 stations by report volume" tone="amber">
          <ResponsiveContainer width="100%" height={340}>
            <RechartsBarChart data={chartData.categoryDistribution.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <YAxis dataKey="branch" type="category" width={90} tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
              <RechartsLegend wrapperStyle={{ fontSize: 10 }} />
              <RechartsBar dataKey="irregularity" fill="var(--cf-coral)" name="Irregularity" />
              <RechartsBar dataKey="complaint" fill="var(--cf-amber)" name="Complaint" />
              <RechartsBar dataKey="compliment" fill="var(--cf-lime)" name="Compliment" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ReportSection>
      )}

      <ReportSection index={3} title="Monthly Trend Analysis" tone="teal">
        <MonthlyTrendChart data={chartData.trendData} />
      </ReportSection>

      <ReportSection index={4} title="Category Composition by Station" tone="slate">
        <CategoryStackedBar data={chartData.categoryData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={5} title="Airline Distribution" tone="teal">
          <AirlineBreakdownChart data={chartData.airlineData} />
        </ReportSection>
        <ReportSection index={6} title="Area Breakdown" tone="slate">
          <AreaBreakdownChart data={chartData.areaData} />
        </ReportSection>
      </div>

      <ReportSection index={7} title="Management Summary" tone="teal">
        <ManagementSummary data={chartData.branchData} />
      </ReportSection>

      <ReportSection index={8} title="Investigative Table" subtitle="Station reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title="Station Reports"
          rowsPerPage={8}
          maxRows={40}
          isLoading={tableLoading}
          theme="cf"
        />
      </ReportSection>
    </div>
  );
}
