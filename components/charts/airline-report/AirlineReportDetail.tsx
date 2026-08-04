'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  fetchBranchByAirline,
  fetchRootCauseByAirline,
  fetchAllAirlineReports,
  fetchAreaByAirline,
  fetchRootCausePareto,
  fetchAggregatedAirlineReport,
  fetchReportsFromSheets,
  AirlineSummary,
  TrendDataPoint,
  BranchByAirlineData,
  RootCauseByAirlineData,
  AirlineReportRecord,
  AirlineCategoryData,
  AreaByAirlineData,
  RootCauseParetoData,
  AirlineKPIs,
  AirlineCategoryBreakdown,
} from './data';
import {
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Bar as RechartsBar,
} from 'recharts';
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

interface FilterParams {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

function AutoInsight({ data }: { data: AirlineSummary[] }) {
  if (data.length === 0) return null;

  const topAirline = data[0];
  const highRiskAirlines = data.filter((a) => a.riskIndex >= 50);

  const insightParts: string[] = [];
  if (highRiskAirlines.length > 0) {
    insightParts.push(
      `${highRiskAirlines.length} airline${highRiskAirlines.length > 1 ? 's' : ''} flagged as high risk (${highRiskAirlines.map((a) => a.airline).join(', ')})`,
    );
  }
  insightParts.push(`${topAirline.airline} leads with ${topAirline.total} reports (${topAirline.contribution.toFixed(1)}% share)`);

  const mainInsight = `Performance analysis across ${data.length} airlines. ${topAirline.airline} currently shows the highest report volume.`;

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
          <RechartsLine type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={false} />
          <RechartsLine type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={false} />
          <RechartsLine type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BranchDistributionChart({ data }: { data: BranchByAirlineData[] }) {
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

function CategoryStackedBar({ data }: { data: AirlineCategoryData[] }) {
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.airline, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));
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

function Top10AirlinesCategoryChart({ data }: { data: AirlineCategoryBreakdown[] }) {
  const rechartsData = data.map((d) => ({ name: d.airline, Irregularity: d.irregularity, Complaint: d.complaint, Compliment: d.compliment }));
  return (
    <div className="h-[280px] sm:h-[360px]">
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

function AreaBreakdownChart({ data }: { data: AreaByAirlineData[] }) {
  const rechartsData = data.map((d) => ({ name: d.area, Reports: d.count }));
  return (
    <div className="h-[180px] sm:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-slate)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data }: { data: AirlineSummary[] }) {
  if (data.length === 0) return null;

  const topAirline = data[0];
  const highRiskCount = data.filter((a) => a.riskIndex >= 50).length;
  const totalIrreg = data.reduce((sum, a) => sum + a.irregularity, 0);
  const totalReports = data.reduce((sum, a) => sum + a.total, 0);
  const avgIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insights = [
    `${topAirline.airline} leads with ${topAirline.total} reports (${topAirline.contribution.toFixed(1)}% of total).`,
    `${highRiskCount} airline${highRiskCount !== 1 ? 's' : ''} identified as high risk.`,
    `Average irregularity rate across airlines: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports across ${data.length} airlines.`,
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

export default function AirlineReportDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState({
    airlineData: [] as AirlineSummary[],
    trendData: [] as TrendDataPoint[],
    branchData: [] as BranchByAirlineData[],
    rootCauseData: [] as RootCauseByAirlineData[],
    tableData: [] as AirlineReportRecord[],
    categoryData: [] as AirlineCategoryData[],
    areaData: [] as AreaByAirlineData[],
    paretoData: [] as RootCauseParetoData[],
    categoryBreakdown: [] as AirlineCategoryBreakdown[],
  });
  const [kpis, setKpis] = useState<AirlineKPIs | null>(null);
  const investigativeData: QueryResult = useMemo(() => {
    const rows = chartData.tableData as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: rows.length, executionTimeMs: 0 };
  }, [chartData.tableData]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAggregatedData() {
      setLoading(true);
      setError(null);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aggregated = await fetchAggregatedAirlineReport(filters as any);

        if (aggregated && aggregated.airlineData) {
          setChartData((prev) => ({
            ...prev,
            airlineData: aggregated.airlineData,
            trendData: aggregated.trendData || [],
            categoryBreakdown: aggregated.categoryBreakdown || [],
            categoryData: aggregated.categoryData || [],
          }));
          setKpis(aggregated.kpis);
        } else {
          throw new Error('Invalid aggregated airline data');
        }
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any).name === 'AbortError') return;
        console.error('Failed to load aggregated airline data:', err);
        setError('Failed to load primary chart data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAggregatedData();
    return () => controller.abort();
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    let cancelled = false;

    async function loadDeferredData() {
      try {
        // Fetch the raw report set exactly once, then derive every deferred
        // view (station breakdown, root cause breakdown, area breakdown,
        // pareto, investigative table) from that single array instead of
        // each view re-fetching the same data independently.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reports = await fetchReportsFromSheets(filters as any);
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const branch = fetchBranchByAirline(reports, filters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rootCause = fetchRootCauseByAirline(reports, filters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = fetchAllAirlineReports(reports, filters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const area = fetchAreaByAirline(reports, filters as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pareto = fetchRootCausePareto(reports, filters as any);

        setChartData((prev) => ({ ...prev, branchData: branch, rootCauseData: rootCause, tableData: table, areaData: area, paretoData: pareto }));
      } catch (err) {
        if (!cancelled) console.error('Failed to load deferred airline data:', err);
      }
    }

    loadDeferredData();
    return () => { cancelled = true; };
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  if (loading) return <ReportLoading label="Loading airline report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const totalReports = chartData.airlineData.reduce((sum, a) => sum + a.total, 0);
  const totalIrreg = chartData.airlineData.reduce((sum, a) => sum + a.irregularity, 0);
  const totalComplaint = chartData.airlineData.reduce((sum, a) => sum + a.complaint, 0);
  const totalCompliment = chartData.airlineData.reduce((sum, a) => sum + a.compliment, 0);

  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;
  const overallNetSentiment = totalCompliment + totalComplaint > 0 ? ((totalCompliment - totalComplaint) / (totalCompliment + totalComplaint)) * 100 : 0;

  const rankColumns: CompactColumn<AirlineSummary>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'airline', label: 'Airline' },
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
      <AutoInsight data={chartData.airlineData} />

      {kpis && kpis.totalAirlines > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ReportStatCard label="Total Airlines" value={kpis.totalAirlines} tone="teal" />
          <ReportStatCard label="Top Airline" value={kpis.topAirline?.name || '-'} subtitle={`${kpis.topAirline?.count || 0} reports`} tone="coral" />
          <ReportStatCard label="Best Performer" value={kpis.bestPerformer?.name || '-'} subtitle={`${kpis.bestPerformer?.count || 0} reports`} tone="lime" />
          <ReportStatCard label="Avg / Airline" value={kpis.avgReportsPerAirline || 0} tone="amber" />
          <ReportStatCard label="Compliment Ratio" value={`${kpis.complimentRatio || 0}%`} tone="lime" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Overall Irreg. Rate" value={`${overallIrregRate.toFixed(1)}%`} tone={overallIrregRate >= 5 ? 'coral' : 'lime'} />
        <ReportStatCard label="Overall Net Sentiment" value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`} tone={overallNetSentiment > 0 ? 'lime' : 'coral'} />
        <ReportStatCard label="Top Airline" value={chartData.airlineData[0]?.airline || '-'} subtitle={`#1 with ${chartData.airlineData[0]?.total || 0} reports`} tone="teal" />
      </div>

      {chartData.categoryBreakdown.length > 0 && (
        <ReportSection index={1} title="Top 10 Airlines — Category Breakdown" subtitle="Stacked distribution of irregularity, complaint, and compliment" tone="teal">
          <Top10AirlinesCategoryChart data={chartData.categoryBreakdown} />
        </ReportSection>
      )}

      <ReportSection index={2} title="Airline Performance Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={chartData.airlineData} rowKey="airline" maxRows={15} />
      </ReportSection>

      <ReportSection index={3} title="Monthly Trend" subtitle="Stability check across the reporting period" tone="teal">
        <MonthlyTrendChart data={chartData.trendData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={4} title="Category Composition" subtitle="Irregularity / Complaint / Compliment per airline" tone="amber">
          <CategoryStackedBar data={chartData.categoryData} />
        </ReportSection>
        <ReportSection index={5} title="Station Distribution" subtitle="Are issues systemic or specific to one location?" tone="slate">
          <BranchDistributionChart data={chartData.branchData} />
        </ReportSection>
      </div>

      <ReportSection index={6} title="Area Breakdown" tone="slate">
        <AreaBreakdownChart data={chartData.areaData} />
      </ReportSection>

      <ReportSection index={7} title="Management Summary" tone="teal">
        <ManagementSummary data={chartData.airlineData} />
      </ReportSection>

      <ReportSection index={8} title="Investigative Table" subtitle="Airline reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable data={investigativeData} title="Airline Reports" rowsPerPage={8} maxRows={40} theme="cf" />
      </ReportSection>
    </div>
  );
}
