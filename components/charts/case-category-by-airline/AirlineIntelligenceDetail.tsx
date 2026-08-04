'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  fetchAirlineOverview,
  fetchCategoryCompositionByAirline,
  fetchBranchDistributionByAirline,
  fetchAreaBreakdownByAirline,
  fetchMonthlyTrendByAirline,
  fetchRootCauseByAirline,
  fetchAllAirlineIntelReports,
  AirlineOverview,
  CategoryCompositionData,
  BranchDistributionData,
  AreaBreakdownData,
  TrendDataPoint,
  RootCauseData,
  AirlineIntelReportRecord,
} from './data';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

function AutoInsight({ data }: { data: AirlineOverview[] }) {
  if (data.length === 0) return null;

  const topAirline = data[0];
  const riskLeader = data.reduce((max, a) => (a.riskIndex > max.riskIndex ? a : max), data[0]);
  const highRiskAirlines = data.filter((a) => a.riskIndex >= 50);
  const negSentimentAirlines = data.filter((a) => a.netSentiment < 0);

  const insightParts: string[] = [];

  insightParts.push(
    `${topAirline.airline} contributes ${topAirline.contribution.toFixed(1)}% of total reports with Net Sentiment ${topAirline.netSentiment >= 0 ? '+' : ''}${topAirline.netSentiment.toFixed(1)}%, dominated by ${topAirline.dominantCategory}.`,
  );

  if (highRiskAirlines.length > 0) {
    insightParts.push(
      `${highRiskAirlines.length} airline${highRiskAirlines.length > 1 ? 's' : ''} flagged as high risk (Risk Index >= 50): ${highRiskAirlines.slice(0, 3).map((a) => a.airline).join(', ')}${highRiskAirlines.length > 3 ? ` +${highRiskAirlines.length - 3} more` : ''}.`,
    );
  }

  if (negSentimentAirlines.length > 0) {
    insightParts.push(
      `${negSentimentAirlines.length} airline${negSentimentAirlines.length > 1 ? 's' : ''} show negative net sentiment, indicating complaint dominance.`,
    );
  }

  const mainInsight = `Operational intelligence overview across ${data.length} airlines. ${riskLeader.airline} currently represents the highest risk profile.`;

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

function CategoryCompositionChart({ data }: { data: CategoryCompositionData[] }) {
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.airline, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));

  return (
    <div className="h-[260px] sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <Bar dataKey="Irregularity" stackId="composition" fill="var(--cf-coral)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Complaint" stackId="composition" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Compliment" stackId="composition" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BranchDistributionChart({ data }: { data: BranchDistributionData[] }) {
  const branchTotals = Array.from(
    data.reduce((acc, curr) => {
      const existing = acc.get(curr.branch) || 0;
      acc.set(curr.branch, existing + curr.count);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const rechartsData = branchTotals.map(([branch, count]) => ({ name: branch, Reports: count }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Bar dataKey="Reports" fill="var(--cf-teal)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AreaBreakdownChart({ data }: { data: AreaBreakdownData[] }) {
  const airlineSet = new Set<string>();
  const areaSet = new Set<string>();
  data.forEach((d) => {
    airlineSet.add(d.airline);
    areaSet.add(d.area);
  });

  const airlines = Array.from(airlineSet).slice(0, 10);
  const areas = Array.from(areaSet);

  const colorPalette = ['var(--cf-teal)', 'var(--cf-amber)', 'var(--cf-coral)', 'var(--cf-lime)', 'var(--cf-slate)'];
  const areaColors: Record<string, string> = {};
  areas.forEach((area, idx) => {
    areaColors[area] = colorPalette[idx % colorPalette.length];
  });

  const dataMap = new Map<string, Map<string, number>>();
  data.forEach((d) => {
    if (!dataMap.has(d.airline)) dataMap.set(d.airline, new Map());
    dataMap.get(d.airline)!.set(d.area, d.count);
  });

  const rechartsData = airlines.map((airline) => {
    const obj: Record<string, string | number> = { name: airline };
    areas.forEach((area) => {
      obj[area] = dataMap.get(airline)?.get(area) || 0;
    });
    return obj;
  });

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          {areas.map((area) => (
            <Bar key={area} dataKey={area} fill={areaColors[area]} radius={[4, 4, 0, 0]} />
          ))}
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
          <Line type="monotone" dataKey="Total" stroke="var(--cf-teal)" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ManagementSummary({ data }: { data: AirlineOverview[] }) {
  if (data.length === 0) return null;

  const topAirline = data[0];
  const highRiskCount = data.filter((a) => a.riskIndex >= 50).length;
  const avgIrregRate = data.reduce((sum, a) => sum + a.irregularityRate, 0) / data.length;
  const totalReports = data.reduce((sum, a) => sum + a.total, 0);
  const improvingAirlines = data.filter((a) => a.momGrowth < 0).length;
  const worseningAirlines = data.filter((a) => a.momGrowth > 0).length;

  const insights = [
    `${topAirline.airline} leads with ${topAirline.total} reports (${topAirline.contribution.toFixed(1)}% of total), dominated by ${topAirline.dominantCategory}.`,
    `${highRiskCount} airline${highRiskCount !== 1 ? 's' : ''} identified as high risk (Risk Index >= 50).`,
    `Average irregularity rate across airlines: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports across ${data.length} airlines.`,
    `Performance trend: ${improvingAirlines} improving, ${worseningAirlines} worsening (month-over-month).`,
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

export default function AirlineIntelligenceDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [airlineData, setAirlineData] = useState<AirlineOverview[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryCompositionData[]>([]);
  const [branchData, setBranchData] = useState<BranchDistributionData[]>([]);
  const [areaData, setAreaData] = useState<AreaBreakdownData[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rootCauseData, setRootCauseData] = useState<RootCauseData[]>([]);
  const [tableData, setTableData] = useState<AirlineIntelReportRecord[]>([]);
  const requestIdRef = useRef(0);
  const investigativeData: QueryResult = useMemo(() => {
    const rows = tableData as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: 0,
    };
  }, [tableData]);

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const [airline, category, branch, area, trend, rootCause, table] = await Promise.all([
        fetchAirlineOverview(filters),
        fetchCategoryCompositionByAirline(filters),
        fetchBranchDistributionByAirline(filters),
        fetchAreaBreakdownByAirline(filters),
        fetchMonthlyTrendByAirline(filters),
        fetchRootCauseByAirline(filters),
        fetchAllAirlineIntelReports(filters),
      ]);

      if (requestId !== requestIdRef.current) return;

      setAirlineData(airline);
      setCategoryData(category);
      setBranchData(branch);
      setAreaData(area);
      setTrendData(trend);
      setRootCauseData(rootCause);
      setTableData(table);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
    // filters is destructured to primitive fields so this callback doesn't
    // change identity on every parent re-render when filters gets a new
    // object identity but the same values. All fields the fetch calls
    // actually read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <ReportLoading label="Loading airline intelligence…" />;
  if (error) return <ReportError message={error} onRetry={loadData} />;

  const totalReports = airlineData.reduce((sum, a) => sum + a.total, 0);
  const totalIrreg = airlineData.reduce((sum, a) => sum + a.irregularity, 0);
  const totalComplaint = airlineData.reduce((sum, a) => sum + a.complaint, 0);
  const totalCompliment = airlineData.reduce((sum, a) => sum + a.compliment, 0);

  const topAirline = airlineData[0];

  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;
  const overallComplaintRate = totalReports > 0 ? (totalComplaint / totalReports) * 100 : 0;
  const overallNetSentiment = (totalCompliment + totalComplaint) > 0
    ? ((totalCompliment - totalComplaint) / (totalCompliment + totalComplaint)) * 100
    : 0;

  const avgRiskIndex = airlineData.length > 0 ? airlineData.reduce((sum, b) => sum + b.riskIndex, 0) / airlineData.length : 0;

  const rankColumns: CompactColumn<AirlineOverview>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'airline', label: 'Airline' },
    { key: 'total', label: 'Total', align: 'right', numeric: true, render: (r) => r.total.toLocaleString('id-ID') },
    { key: 'irregularityRate', label: 'Irreg. Rate', align: 'right', numeric: true, hideBelow: 'sm', render: (r) => `${r.irregularityRate.toFixed(1)}%` },
    { key: 'complaintRate', label: 'Compl. Rate', align: 'right', numeric: true, hideBelow: 'md', render: (r) => `${r.complaintRate.toFixed(1)}%` },
    { key: 'netSentiment', label: 'Net Sent.', align: 'right', numeric: true, hideBelow: 'lg', render: (r) => `${r.netSentiment >= 0 ? '+' : ''}${r.netSentiment.toFixed(1)}%` },
    { key: 'dominantCategory', label: 'Dominant', hideBelow: 'lg' },
    {
      key: 'riskIndex',
      label: 'Risk',
      align: 'center',
      render: (r) => {
        const tone = r.riskIndex >= 50
          ? { label: 'High', cls: 'bg-[#fee2e2] text-[var(--cf-coral)]' }
          : r.riskIndex >= 20
            ? { label: 'Medium', cls: 'bg-[#fef3c7] text-[var(--cf-amber)]' }
            : { label: 'Low', cls: 'bg-[#ecfccb] text-[var(--cf-lime)]' };
        return <span className={`cf-chip ${tone.cls}`}>{tone.label}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoInsight data={airlineData} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Total Reports" value={totalReports.toLocaleString('id-ID')} subtitle={`Across ${airlineData.length} airlines`} tone="teal" />
        <ReportStatCard label="Top Airline" value={topAirline?.airline || '-'} subtitle={topAirline ? `${topAirline.contribution.toFixed(1)}% of system` : '-'} tone="coral" />
        <ReportStatCard label="Rank #1 Volume" value={topAirline?.total ?? 0} subtitle={topAirline ? `${topAirline.airline}` : '-'} tone="amber" />
        <ReportStatCard
          label="Dominant Category"
          value={topAirline?.dominantCategory || '-'}
          subtitle={topAirline ? `for ${topAirline.airline}` : '-'}
          tone={topAirline?.dominantCategory === 'Irregularity' ? 'coral' : topAirline?.dominantCategory === 'Complaint' ? 'amber' : 'lime'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Overall Irreg. %" value={`${overallIrregRate.toFixed(1)}%`} tone={overallIrregRate >= 5 ? 'coral' : 'lime'} />
        <ReportStatCard label="Overall Complaint %" value={`${overallComplaintRate.toFixed(1)}%`} tone="amber" />
        <ReportStatCard
          label="Overall Net Sentiment"
          value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`}
          subtitle="(Compliment - Complaint)"
          tone={overallNetSentiment > 0 ? 'lime' : 'coral'}
        />
        <ReportStatCard
          label="Avg Risk Score"
          value={avgRiskIndex.toFixed(1)}
          subtitle="(Irreg x2) + Complaint"
          tone={avgRiskIndex >= 50 ? 'coral' : avgRiskIndex >= 20 ? 'amber' : 'lime'}
        />
      </div>

      <ReportSection index={1} title="Airline Intelligence Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={airlineData} rowKey="airline" maxRows={15} />
      </ReportSection>

      <ReportSection index={2} title="Category Composition by Airline" subtitle="Stacked Irregularity / Complaint / Compliment per airline (top 10)" tone="amber">
        <CategoryCompositionChart data={categoryData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={3} title="Station Distribution" subtitle="Are reports concentrated in one station, or systemic across the network?" tone="slate">
          <BranchDistributionChart data={branchData} />
        </ReportSection>
        <ReportSection index={4} title="Area Breakdown" subtitle="Terminal / Apron / General per airline" tone="slate">
          <AreaBreakdownChart data={areaData} />
        </ReportSection>
      </div>

      <ReportSection index={5} title="Monthly Trend" subtitle="Airline volume over time — is performance improving or declining?" tone="teal">
        <MonthlyTrendChart data={trendData} />
      </ReportSection>

      <ReportSection index={6} title="Management Summary" tone="teal">
        <ManagementSummary data={airlineData} />
      </ReportSection>

      <ReportSection index={7} title="Investigative Table" subtitle="Airline reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title="Investigative Table - Airline Intelligence"
          rowsPerPage={5}
          maxRows={40}
          theme="cf"
        />
      </ReportSection>
    </div>
  );
}
