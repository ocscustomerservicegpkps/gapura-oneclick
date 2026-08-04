'use client';

import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import {
  fetchRootCauseByHub,
  fetchAirlineByHub,
  fetchAreaByHub,
  fetchAllHubReports,
  fetchAggregatedHubReport,
  fetchReportsFromSheets,
  HubSummary,
  TrendDataPoint,
  HubCategoryData,
  RootCauseByHubData,
  AirlineByHubData,
  AreaByHubData,
  HubReportRecord,
  HubKPIs,
  HubCategoryDistribution,
} from './data';
import { BarChart, Bar as RechartsBar, LineChart, Line as RechartsLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, LabelList, Cell } from 'recharts';
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

function AutoInsight({ data }: { data: HubSummary[] }) {
  if (data.length === 0) return null;

  const topHub = data[0];
  const highRiskHubs = data.filter((h) => h.riskIndex >= 50);
  const totalReports = data.reduce((s, h) => s + h.total, 0);
  const totalIrreg = data.reduce((s, h) => s + h.irregularity, 0);
  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insightParts: string[] = [];
  if (highRiskHubs.length > 0) {
    insightParts.push(
      `${highRiskHubs.length} hub${highRiskHubs.length > 1 ? 's' : ''} flagged as high risk (${highRiskHubs.slice(0, 3).map((h) => h.hub).join(', ')}${highRiskHubs.length > 3 ? '…' : ''})`,
    );
  }
  insightParts.push(`${topHub.hub} leads with ${topHub.total} reports (${topHub.contribution.toFixed(1)}% share)`);
  insightParts.push(`Overall irregularity rate is ${overallIrregRate.toFixed(1)}% across ${data.length} hubs`);

  const mainInsight = highRiskHubs.length > 0
    ? `Action required: ${highRiskHubs.length} hubs identified with high operational risk.`
    : 'Operational stability: all hubs currently below high-risk thresholds.';

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
          <RechartsLine type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={{ r: 2 }} />
          <RechartsLine type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={{ r: 2 }} />
          <RechartsLine type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryStackedBar({ data }: { data: HubCategoryData[] }) {
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.hub, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));
  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsLegend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <RechartsBar dataKey="Irregularity" stackId="category" fill="var(--cf-coral)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Complaint" stackId="category" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
          <RechartsBar dataKey="Compliment" stackId="category" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AirlineBreakdownChart({ data }: { data: AirlineByHubData[] }) {
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
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-teal)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Reports" position="top" style={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          </RechartsBar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AreaBreakdownChart({ data }: { data: AreaByHubData[] }) {
  const areaTotals = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.area) || 0;
      acc.set(curr.area, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  const colors = ['var(--cf-teal)', 'var(--cf-amber)', 'var(--cf-coral)', 'var(--cf-lime)'];
  const rechartsData = areaTotals.map(([area, count], i) => ({ name: area, Reports: count, fill: colors[i % colors.length] }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" radius={[4, 4, 0, 0]}>
            {rechartsData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </RechartsBar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data }: { data: HubSummary[] }) {
  if (data.length === 0) return null;

  const topHub = data[0];
  const highRiskCount = data.filter((h) => h.riskIndex >= 50).length;
  const totalIrreg = data.reduce((sum, h) => sum + h.irregularity, 0);
  const totalReports = data.reduce((sum, h) => sum + h.total, 0);
  const avgIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;

  const insights = [
    `${topHub.hub} leads with ${topHub.total} reports (${topHub.contribution.toFixed(1)}% of total).`,
    `${highRiskCount} hub${highRiskCount !== 1 ? 's' : ''} identified as high risk.`,
    `Average irregularity rate across hubs: ${avgIrregRate.toFixed(1)}%.`,
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

export default function HubReportDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState({
    hubData: [] as HubSummary[],
    trendData: [] as TrendDataPoint[],
    categoryData: [] as HubCategoryData[],
    rootCauseData: [] as RootCauseByHubData[],
    airlineData: [] as AirlineByHubData[],
    areaData: [] as AreaByHubData[],
    tableData: [] as HubReportRecord[],
    kpis: null as HubKPIs | null,
    categoryDistribution: [] as HubCategoryDistribution[],
  });

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

    async function loadInitialData() {
      setLoading(true);
      setError(null);
      try {
        const aggregated = await fetchAggregatedHubReport(filters, controller.signal);
        if (controller.signal.aborted) return;
        if (aggregated && aggregated.hubData) {
          setChartData((prev) => ({
            ...prev,
            hubData: aggregated.hubData,
            trendData: aggregated.trendData || [],
            categoryData: (aggregated.hubData || []).map((h) => ({
              hub: h.hub,
              Irregularity: h.irregularity,
              Complaint: h.complaint,
              Compliment: h.compliment,
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
        console.error('Failed to load initial hub data:', err);
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

        const rootCause = fetchRootCauseByHub(reports, filters);
        const airline = fetchAirlineByHub(reports, filters);
        const area = fetchAreaByHub(reports, filters);
        const table = fetchAllHubReports(reports, filters);

        setChartData((prev) => ({
          ...prev,
          rootCauseData: rootCause,
          airlineData: airline,
          areaData: area,
          tableData: table,
        }));
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

    return () => {
      controller.abort();
    };
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.dateFrom, filters.dateTo, filters.sourceSheet]);

  if (loading) return <ReportLoading label="Loading hub report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const rankColumns: CompactColumn<HubSummary>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'hub', label: 'Hub' },
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoInsight data={chartData.hubData} />

      {chartData.kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ReportStatCard label="Total Hubs" value={chartData.kpis.totalHubs} tone="teal" />
          <ReportStatCard label="Top Performer" value={chartData.kpis.topPerformer.name} subtitle={`${chartData.kpis.topPerformer.count} reports`} tone="lime" />
          <ReportStatCard label="Worst Performer" value={chartData.kpis.worstPerformer.name} subtitle={`${chartData.kpis.worstPerformer.count} reports`} tone="coral" />
          <ReportStatCard label="Avg Reports / Hub" value={chartData.kpis.avgReportsPerHub} tone="amber" />
          <ReportStatCard
            label="MoM Change"
            value={chartData.kpis.momChange > 0 ? `+${chartData.kpis.momChange}%` : `${chartData.kpis.momChange}%`}
            trend={chartData.kpis.momChange}
            tone="teal"
          />
        </div>
      )}

      <ReportSection index={1} title="Hub Performance Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={chartData.hubData} rowKey="hub" maxRows={15} />
      </ReportSection>

      {chartData.categoryDistribution.length > 0 && (
        <ReportSection index={2} title="Category Distribution per Hub" subtitle="Top 10 hubs by report volume" tone="amber">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData.categoryDistribution.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <YAxis dataKey="hub" type="category" width={90} tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
              <RechartsLegend wrapperStyle={{ fontSize: 10 }} />
              <RechartsBar dataKey="irregularity" fill="var(--cf-coral)" name="Irregularity" />
              <RechartsBar dataKey="complaint" fill="var(--cf-amber)" name="Complaint" />
              <RechartsBar dataKey="compliment" fill="var(--cf-lime)" name="Compliment" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>
      )}

      <ReportSection index={3} title="Monthly Trend Analysis" tone="teal">
        <MonthlyTrendChart data={chartData.trendData} />
      </ReportSection>

      <ReportSection index={4} title="Category Composition by Hub" tone="slate">
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
        <ManagementSummary data={chartData.hubData} />
      </ReportSection>

      <ReportSection index={8} title="Investigative Table" subtitle="Hub reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable data={investigativeData} title="Hub Reports" rowsPerPage={8} maxRows={40} isLoading={tableLoading} theme="cf" />
      </ReportSection>
    </div>
  );
}
