'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  fetchBranchByMonth,
  fetchAirlineByMonth,
  fetchAllMonthlyReports,
  fetchAggregatedMonthlyReport,
  fetchReportsFromSheets,
  MonthlySummary,
  DailyDataPoint,
  BranchByMonthData,
  AirlineByMonthData,
  MonthlyReportRecord,
  RollingAveragePoint,
  PeakDayInfo,
  DominantInfo,
  MonthlyKPIs,
  MonthlyTrendData,
} from './data';
import { BarChart, Bar as RechartsBar, LineChart, Line as RechartsLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
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
  month?: string;
  sourceSheet?: string;
  dateFrom?: string;
  dateTo?: string;
}

function AutoInsight({ monthly, peakDay, dominantBranch, dominantAirline }: {
  monthly: MonthlySummary[];
  peakDay: PeakDayInfo;
  dominantBranch: DominantInfo;
  dominantAirline: DominantInfo;
}) {
  if (monthly.length < 2) return null;

  const current = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const growth = prev.total > 0 ? ((current.total - prev.total) / prev.total) * 100 : 0;

  const direction = growth >= 0 ? 'up' : 'down';
  const drivers: string[] = [];

  if (dominantBranch.name !== '-') {
    drivers.push(`${dominantBranch.name} (${dominantBranch.percent.toFixed(0)}%)`);
  }
  if (dominantAirline.name !== '-') {
    drivers.push(`${dominantAirline.name}`);
  }

  const mainInsight = `Reports ${direction} ${Math.abs(growth).toFixed(1)}% MoM${drivers.length > 0 ? `, driven by ${drivers.join(' & ')}` : ''}.`;

  const insightParts = [
    peakDay.date !== '-' ? `Peak day: ${peakDay.date} (${peakDay.dayOfWeek}) with ${peakDay.count} reports.` : null,
    `Irregularity accounts for ${current.irregularityRate.toFixed(1)}% of all reports this period.`,
    current.total > prev.total ? `Volume increased from ${prev.total} to ${current.total}.` : `Volume decreased from ${prev.total} to ${current.total}.`,
  ].filter(Boolean) as string[];

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

function DailyTrendChart({ data }: { data: DailyDataPoint[] }) {
  const rechartsData = data.map(d => ({
    name: d.date,
    Total: d.total,
    Irregularity: d.Irregularity,
    Complaint: d.Complaint,
  }));

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-35} textAnchor="end" height={50} />
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

function RollingAverageChart({ data }: { data: RollingAveragePoint[] }) {
  const rechartsData = data.map(d => ({
    name: d.month,
    Actual: d.actual,
    '3-Month Avg': parseFloat(d.rollingAvg3.toFixed(1)),
    '6-Month Avg': parseFloat(d.rollingAvg6.toFixed(1)),
  }));

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsLegend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          <RechartsLine type="monotone" dataKey="Actual" stroke="var(--cf-teal)" strokeWidth={2} dot={false} />
          <RechartsLine type="monotone" dataKey="3-Month Avg" stroke="var(--cf-amber)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          <RechartsLine type="monotone" dataKey="6-Month Avg" stroke="var(--cf-slate)" strokeWidth={2} strokeDasharray="10 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopBranchesChart({ data }: { data: BranchByMonthData[] }) {
  const topBranches = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.branch) || 0;
      acc.set(curr.branch, existing + curr.count);
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const rechartsData = topBranches.map(([branch, count]) => ({
    name: branch,
    Reports: count,
  }));

  return (
    <div className="h-[220px] sm:h-[260px]">
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

function TopAirlinesChart({ data }: { data: AirlineByMonthData[] }) {
  const topAirlines = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.airline) || 0;
      acc.set(curr.airline, existing + curr.count);
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const rechartsData = topAirlines.map(([airline, count]) => ({
    name: airline,
    Reports: count,
  }));

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <RechartsBar dataKey="Reports" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data, dominantBranch, dominantAirline }: {
  data: MonthlySummary[];
  dominantBranch: DominantInfo;
  dominantAirline: DominantInfo;
}) {
  if (data.length < 2) return null;

  const currentMonth = data[data.length - 1];
  const prevMonth = data[data.length - 2];
  const growth = prevMonth.total > 0 ? ((currentMonth.total - prevMonth.total) / prevMonth.total) * 100 : 0;

  const insights = [
    `Reports ${growth >= 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(1)}% compared to previous month.`,
    `Total of ${currentMonth.total} reports this month vs ${prevMonth.total} last month.`,
    `Irregularity accounts for ${currentMonth.irregularityRate.toFixed(1)}% of all reports.`,
    dominantBranch.name !== '-' ? `Dominant branch: ${dominantBranch.name} with ${dominantBranch.count} reports (${dominantBranch.percent.toFixed(1)}%).` : null,
    dominantAirline.name !== '-' ? `Top airline: ${dominantAirline.name} with ${dominantAirline.count} reports (${dominantAirline.percent.toFixed(1)}%).` : null,
  ].filter(Boolean) as string[];

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

export default function MonthlyReportDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState({
    monthlyData: [] as MonthlySummary[],
    dailyData: [] as DailyDataPoint[],
    branchData: [] as BranchByMonthData[],
    airlineData: [] as AirlineByMonthData[],
    tableData: [] as MonthlyReportRecord[],
    rollingData: [] as RollingAveragePoint[],
    peakDay: { date: '-', count: 0, dayOfWeek: '-' } as PeakDayInfo,
    dominantBranch: { name: '-', count: 0, percent: 0 } as DominantInfo,
    dominantAirline: { name: '-', count: 0, percent: 0 } as DominantInfo,
    kpis: null as MonthlyKPIs | null,
    trendData: [] as MonthlyTrendData[],
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

    async function loadAggregatedData() {
      setLoading(true);
      setError(null);

      try {
        const aggregated = await fetchAggregatedMonthlyReport(filters, controller.signal);

        if (aggregated && aggregated.summary) {
          setChartData(prev => ({
            ...prev,
            monthlyData: aggregated.summary,
            dailyData: aggregated.dailyData || [],
            rollingData: aggregated.rollingData || [],
            peakDay: aggregated.peakDay || { date: '-', count: 0, dayOfWeek: '-' },
            dominantBranch: aggregated.dominantBranch || { name: '-', count: 0, percent: 0 },
            dominantAirline: aggregated.dominantAirline || { name: '-', count: 0, percent: 0 },
            kpis: aggregated.kpis,
            trendData: (aggregated.trend || []) as unknown as MonthlyTrendData[],
          }));
        } else {
          throw new Error('Invalid aggregated monthly data');
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        console.error('Failed to load aggregated monthly data:', err);
        setError('Failed to load primary dashboard data.');
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
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.month, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    let cancelled = false;

    async function loadDeferredData() {
      try {
        // Fetch the raw report set exactly once, then derive every deferred
        // view (station breakdown, airline breakdown, investigative table)
        // from that single array instead of each view re-fetching the same
        // data independently.
        const reports = await fetchReportsFromSheets(filters);
        if (cancelled) return;

        const branch = fetchBranchByMonth(reports, filters);
        const airline = fetchAirlineByMonth(reports, filters);
        const table = fetchAllMonthlyReports(reports, filters);

        setChartData(prev => ({
          ...prev,
          branchData: branch,
          airlineData: airline,
          tableData: table,
        }));
      } catch (err) {
        if (!cancelled) console.error('Failed to load deferred monthly data:', err);
      }
    }

    loadDeferredData();
    return () => { cancelled = true; };
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.month, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  if (loading) return <ReportLoading label="Loading monthly report…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const totalCurrentReports = chartData.monthlyData.reduce((s, m) => s + m.total, 0);
  const totalPrevReports = chartData.monthlyData.reduce((s, m) => s + m.prevMonthTotal, 0);
  const totalPrevYearReportsSelection = chartData.monthlyData.reduce((s, m) => s + (m.prevYearTotal || 0), 0);

  const overallMomGrowth = totalPrevReports > 0 ? ((totalCurrentReports - totalPrevReports) / totalPrevReports) * 100 : 0;
  const overallYoyGrowth = totalPrevYearReportsSelection > 0 ? ((totalCurrentReports - totalPrevYearReportsSelection) / totalPrevYearReportsSelection) * 100 : undefined;

  const totalReportsSum = chartData.monthlyData.reduce((sum, m) => sum + m.total, 0);
  const totalIrregSum = chartData.monthlyData.reduce((sum, m) => sum + m.irregularity, 0);
  const totalComplaintSum = chartData.monthlyData.reduce((sum, m) => sum + (m.complaint || 0), 0);
  const totalComplimentSum = chartData.monthlyData.reduce((sum, m) => sum + (m.compliment || 0), 0);

  const overallIrregRate = totalReportsSum > 0 ? (totalIrregSum / totalReportsSum) * 100 : 0;
  const overallNetSentiment = (totalComplimentSum + totalComplaintSum) > 0
    ? ((totalComplimentSum - totalComplaintSum) / (totalComplimentSum + totalComplaintSum)) * 100
    : 0;

  const trendColumns: CompactColumn<MonthlySummary>[] = [
    { key: 'month', label: 'Month' },
    { key: 'total', label: 'Total', align: 'right', numeric: true, render: (r) => r.total.toLocaleString('id-ID') },
    { key: 'irregularity', label: 'Irreg.', align: 'right', numeric: true, hideBelow: 'sm' },
    { key: 'complaint', label: 'Complaint', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'compliment', label: 'Compliment', align: 'right', numeric: true, hideBelow: 'md' },
    { key: 'irregularityRate', label: 'Irreg. Rate', align: 'right', numeric: true, hideBelow: 'lg', render: (r) => `${r.irregularityRate.toFixed(1)}%` },
    {
      key: 'netSentiment', label: 'Net Sentiment', align: 'right', numeric: true, hideBelow: 'lg',
      render: (r) => (
        <span className={r.netSentiment >= 0 ? 'text-[var(--cf-lime)]' : 'text-[var(--cf-coral)]'}>
          {r.netSentiment >= 0 ? '+' : ''}{r.netSentiment.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'momGrowth', label: 'MoM', align: 'right', numeric: true, hideBelow: 'sm',
      render: (r) => (
        <span className={r.momGrowth > 0 ? 'text-[var(--cf-coral)]' : r.momGrowth < 0 ? 'text-[var(--cf-lime)]' : 'text-[var(--cf-ink-3)]'}>
          {r.momGrowth > 0 ? '+' : ''}{r.momGrowth.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'yoyGrowth', label: 'YoY', align: 'right', numeric: true, hideBelow: 'lg',
      render: (r) => r.yoyGrowth !== undefined ? (
        <span className={r.yoyGrowth > 0 ? 'text-[var(--cf-coral)]' : r.yoyGrowth < 0 ? 'text-[var(--cf-lime)]' : 'text-[var(--cf-ink-3)]'}>
          {r.yoyGrowth > 0 ? '+' : ''}{r.yoyGrowth.toFixed(1)}%
        </span>
      ) : <span className="text-[var(--cf-ink-3)]">-</span>,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoInsight
        monthly={chartData.monthlyData}
        peakDay={chartData.peakDay}
        dominantBranch={chartData.dominantBranch}
        dominantAirline={chartData.dominantAirline}
      />

      {chartData.kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReportStatCard label="Current Month" value={chartData.kpis.currentMonthTotal} tone="teal" />
          <ReportStatCard label="Previous Month" value={chartData.kpis.previousMonthTotal} tone="slate" />
          <ReportStatCard
            label="MoM Change"
            value={`${chartData.kpis.momChange > 0 ? '+' : ''}${chartData.kpis.momChange}%`}
            trend={chartData.kpis.momChange}
            tone={chartData.kpis.momChange > 0 ? 'coral' : 'lime'}
          />
          <ReportStatCard label="Highest Peak" value={chartData.kpis.highestPeakMonth.month} subtitle={`${chartData.kpis.highestPeakMonth.count} reports`} tone="amber" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard
          label="Growth (MoM)"
          value={`${overallMomGrowth >= 0 ? '+' : ''}${overallMomGrowth.toFixed(1)}%`}
          subtitle={`${totalCurrentReports} vs ${totalPrevReports}`}
          trend={overallMomGrowth}
          tone={overallMomGrowth > 0 ? 'coral' : 'lime'}
        />
        {overallYoyGrowth !== undefined && (
          <ReportStatCard
            label="Growth (YoY)"
            value={`${overallYoyGrowth >= 0 ? '+' : ''}${overallYoyGrowth.toFixed(1)}%`}
            subtitle={`${totalCurrentReports} vs ${totalPrevYearReportsSelection}`}
            trend={overallYoyGrowth}
            tone={overallYoyGrowth > 0 ? 'coral' : 'lime'}
          />
        )}
        <ReportStatCard label="Dominant Station" value={chartData.dominantBranch.name} subtitle={`${chartData.dominantBranch.count} (${chartData.dominantBranch.percent.toFixed(0)}%)`} tone="teal" />
        <ReportStatCard label="Dominant Airline" value={chartData.dominantAirline.name} subtitle={`${chartData.dominantAirline.count} (${chartData.dominantAirline.percent.toFixed(0)}%)`} tone="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Total Reports" value={totalReportsSum.toLocaleString('id-ID')} tone="teal" />
        <ReportStatCard label="Irregularity Rate" value={`${overallIrregRate.toFixed(1)}%`} tone="coral" />
        <ReportStatCard label="Net Sentiment" value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`} tone={overallNetSentiment > 0 ? 'lime' : 'coral'} />
      </div>

      {chartData.trendData.length > 0 && (
        <ReportSection index={1} title="Category Trends Over Time" subtitle="Monthly report category trend (Irregularity, Complaint, Compliment)" tone="teal">
          <div className="h-[240px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.trendData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
                <RechartsLegend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <RechartsLine type="monotone" dataKey="irregularity" stroke="var(--cf-coral)" strokeWidth={2} name="Irregularity" />
                <RechartsLine type="monotone" dataKey="complaint" stroke="var(--cf-amber)" strokeWidth={2} name="Complaint" />
                <RechartsLine type="monotone" dataKey="compliment" stroke="var(--cf-lime)" strokeWidth={2} name="Compliment" />
                <RechartsLine type="monotone" dataKey="total" stroke="var(--cf-teal)" strokeWidth={2} strokeDasharray="5 5" name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ReportSection>
      )}

      <ReportSection index={2} title="Monthly Trend" subtitle={`${chartData.monthlyData.length} months — red is rising, green is falling`} tone="teal" bodyClassName="p-0">
        <CompactTable columns={trendColumns} rows={[...chartData.monthlyData].reverse()} rowKey="month" />
      </ReportSection>

      <ReportSection index={3} title="Daily Timeline" subtitle="Daily report distribution — tall peaks mark incident spikes" tone="slate">
        <DailyTrendChart data={chartData.dailyData} />
      </ReportSection>

      <ReportSection index={4} title="Historical Context" subtitle="Comparison against the last 3 and 6 month averages" tone="amber">
        <RollingAverageChart data={chartData.rollingData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={5} title="Top Contributing Stations" subtitle="Stations with the highest report contribution" tone="teal">
          <TopBranchesChart data={chartData.branchData} />
        </ReportSection>
        <ReportSection index={6} title="Top Contributing Airlines" subtitle="Airlines with the highest report contribution" tone="amber">
          <TopAirlinesChart data={chartData.airlineData} />
        </ReportSection>
      </div>

      <ReportSection index={7} title="Management Summary" tone="teal">
        <ManagementSummary data={chartData.monthlyData} dominantBranch={chartData.dominantBranch} dominantAirline={chartData.dominantAirline} />
      </ReportSection>

      <ReportSection index={8} title="Investigative Table" subtitle="Monthly reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title="Investigative Table - Monthly Reports"
          rowsPerPage={5}
          maxRows={40}
          theme="cf"
        />
      </ReportSection>
    </div>
  );
}
