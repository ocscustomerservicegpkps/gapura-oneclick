'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  fetchBranchOverview,
  fetchCategoryCompositionByBranch,
  fetchMonthlyTrendByBranch,
  fetchAreaBreakdownByBranch,
  fetchAirlineContributionByBranch,
  fetchRootCauseByBranch,
  fetchAllBranchIntelReports,
  BranchOverview,
  CategoryCompositionData,
  TrendDataPoint,
  AreaBreakdownData,
  AirlineContributionData,
  RootCauseData,
  BranchIntelRecord,
} from './data';
import { Sparkles } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

function AutoInsight({ data }: { data: BranchOverview[] }) {
  if (data.length === 0) return null;

  const topBranch = data[0];
  const highRiskBranches = data.filter((b) => b.riskIndex >= 50);
  const growingBranches = data.filter((b) => b.momGrowth > 10);

  const insightParts: string[] = [];

  insightParts.push(
    `${topBranch.branch} leads risk ranking with ${topBranch.total} reports (${topBranch.contribution.toFixed(1)}% share), primarily driven by ${topBranch.dominantCategory.toLowerCase()} issues.`,
  );

  if (highRiskBranches.length > 0) {
    insightParts.push(
      `${highRiskBranches.length} branch${highRiskBranches.length > 1 ? 'es' : ''} flagged as high risk (${highRiskBranches.map((b) => b.branch).join(', ')}).`,
    );
  }

  if (growingBranches.length > 0) {
    insightParts.push(
      `${growingBranches.length} branch${growingBranches.length > 1 ? 'es' : ''} showing >10% MoM growth (${growingBranches.map((b) => `${b.branch}: +${b.momGrowth.toFixed(0)}%`).join(', ')}).`,
    );
  }

  const mainInsight = `Operational risk analysis across ${data.length} branches. ${topBranch.branch} currently shows the highest risk index.`;

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
  const rechartsData = data.slice(0, 10).map((d) => ({ name: d.branch, Irregularity: d.Irregularity, Complaint: d.Complaint, Compliment: d.Compliment }));

  return (
    <div className="h-[260px] sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <Bar dataKey="Irregularity" fill="var(--cf-coral)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Complaint" fill="var(--cf-amber)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Compliment" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} />
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

function AreaBreakdownChart({ data }: { data: AreaBreakdownData[] }) {
  const branchMap = new Map<string, Map<string, number>>();
  const allAreas = new Set<string>();

  data.forEach((d) => {
    allAreas.add(d.area);
    if (!branchMap.has(d.branch)) branchMap.set(d.branch, new Map());
    branchMap.get(d.branch)!.set(d.area, d.count);
  });

  const topBranches = Array.from(branchMap.entries())
    .map(([branch, areas]) => ({ branch, total: Array.from(areas.values()).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const areas = Array.from(allAreas);
  const colorPalette = ['var(--cf-teal)', 'var(--cf-amber)', 'var(--cf-coral)', 'var(--cf-lime)', 'var(--cf-slate)'];
  const areaColors: Record<string, string> = {};
  areas.forEach((area, idx) => {
    areaColors[area] = colorPalette[idx % colorPalette.length];
  });

  const rechartsData = topBranches.map(({ branch }) => {
    const obj: Record<string, string | number> = { name: branch };
    areas.forEach((area) => {
      obj[area] = branchMap.get(branch)?.get(area) || 0;
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

function AirlineContributionChart({ data }: { data: AirlineContributionData[] }) {
  const rechartsData = data.map((d) => ({ name: d.airline, Reports: d.count }));

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

function ManagementSummary({ data }: { data: BranchOverview[] }) {
  if (data.length === 0) return null;

  const topBranch = data[0];
  const highRiskCount = data.filter((b) => b.riskIndex >= 50).length;
  const avgIrregRate = data.reduce((sum, b) => sum + b.irregularityRate, 0) / data.length;
  const totalReports = data.reduce((sum, b) => sum + b.total, 0);

  const insights = [
    `${topBranch.branch} ranks #1 in risk with ${topBranch.total} reports (${topBranch.contribution.toFixed(1)}% of total), dominated by ${topBranch.dominantCategory}.`,
    `${highRiskCount} branch${highRiskCount !== 1 ? 'es' : ''} identified as high risk (risk index >= 50).`,
    `Average irregularity rate across branches: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports across ${data.length} branches.`,
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

export default function BranchIntelligenceDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchData, setBranchData] = useState<BranchOverview[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryCompositionData[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [areaData, setAreaData] = useState<AreaBreakdownData[]>([]);
  const [airlineData, setAirlineData] = useState<AirlineContributionData[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rootCauseData, setRootCauseData] = useState<RootCauseData[]>([]);
  const [tableData, setTableData] = useState<BranchIntelRecord[]>([]);
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

  useEffect(() => {
    async function loadData() {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const [overview, category, trend, area, airline, rootCause, table] = await Promise.all([
          fetchBranchOverview(filters),
          fetchCategoryCompositionByBranch(filters),
          fetchMonthlyTrendByBranch(filters),
          fetchAreaBreakdownByBranch(filters),
          fetchAirlineContributionByBranch(filters),
          fetchRootCauseByBranch(filters),
          fetchAllBranchIntelReports(filters),
        ]);

        if (requestId !== requestIdRef.current) return;

        setBranchData(overview);
        setCategoryData(category);
        setTrendData(trend);
        setAreaData(area);
        setAirlineData(airline);
        setRootCauseData(rootCause);
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
    // filters is destructured to primitive fields so this effect doesn't
    // re-fire on every parent re-render when filters gets a new object
    // identity but the same values. All fields the fetch calls actually
    // read are listed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo]);

  if (loading) return <ReportLoading label="Loading station intelligence…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const totalReports = branchData.reduce((sum, b) => sum + b.total, 0);
  const totalIrreg = branchData.reduce((sum, b) => sum + b.irregularity, 0);
  const totalComplaint = branchData.reduce((sum, b) => sum + b.complaint, 0);
  const totalCompliment = branchData.reduce((sum, b) => sum + b.compliment, 0);

  const topBranch = branchData[0];

  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;
  const overallNetSentiment = (totalCompliment + totalComplaint) > 0
    ? ((totalCompliment - totalComplaint) / (totalCompliment + totalComplaint)) * 100
    : 0;

  const avgRiskIndex = branchData.length > 0 ? branchData.reduce((sum, b) => sum + b.riskIndex, 0) / branchData.length : 0;

  const rankColumns: CompactColumn<BranchOverview>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'branch', label: 'Station' },
    { key: 'total', label: 'Total', align: 'right', numeric: true, render: (r) => r.total.toLocaleString('id-ID') },
    { key: 'irregularityRate', label: 'Irreg. Rate', align: 'right', numeric: true, hideBelow: 'sm', render: (r) => `${r.irregularityRate.toFixed(1)}%` },
    { key: 'netSentiment', label: 'Net Sent.', align: 'right', numeric: true, hideBelow: 'md', render: (r) => `${r.netSentiment >= 0 ? '+' : ''}${r.netSentiment.toFixed(1)}%` },
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
      <AutoInsight data={branchData} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Total Reports" value={totalReports.toLocaleString('id-ID')} subtitle={`Across ${branchData.length} branches`} tone="teal" />
        <ReportStatCard label="Top Station" value={topBranch?.branch || '-'} subtitle={topBranch ? `${topBranch.contribution.toFixed(1)}% of system` : '-'} tone="coral" />
        <ReportStatCard label="Rank #1 Risk Index" value={topBranch?.riskIndex ?? 0} subtitle={topBranch ? `${topBranch.branch}` : '-'} tone={topBranch && topBranch.riskIndex >= 50 ? 'coral' : 'amber'} />
        <ReportStatCard
          label="Dominant Category"
          value={topBranch?.dominantCategory || '-'}
          subtitle={topBranch ? `at ${topBranch.branch}` : '-'}
          tone={topBranch?.dominantCategory === 'Irregularity' ? 'coral' : topBranch?.dominantCategory === 'Complaint' ? 'amber' : 'lime'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Overall Irreg. Rate" value={`${overallIrregRate.toFixed(1)}%`} tone={overallIrregRate >= 5 ? 'coral' : 'lime'} />
        <ReportStatCard
          label="Overall Net Sentiment"
          value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`}
          tone={overallNetSentiment > 0 ? 'lime' : 'coral'}
        />
        <ReportStatCard
          label="Risk Index (Avg)"
          value={avgRiskIndex.toFixed(1)}
          subtitle="Weighted: Irreg x2 + Complaint"
          tone={avgRiskIndex >= 50 ? 'coral' : avgRiskIndex >= 20 ? 'amber' : 'lime'}
        />
      </div>

      <ReportSection index={1} title="Station Risk Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={branchData} rowKey="branch" maxRows={15} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={2} title="Category Composition" subtitle="Irregularity / Complaint / Compliment per branch (top 10)" tone="amber">
          <CategoryCompositionChart data={categoryData} />
        </ReportSection>
        <ReportSection index={3} title="Monthly Trend" tone="teal">
          <MonthlyTrendChart data={trendData} />
        </ReportSection>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={4} title="Area Breakdown" subtitle="Where inside the station does the problem lie?" tone="slate">
          <AreaBreakdownChart data={areaData} />
        </ReportSection>
        <ReportSection index={5} title="Airline Contribution" subtitle="Top airlines contributing to reports in this station" tone="slate">
          <AirlineContributionChart data={airlineData} />
        </ReportSection>
      </div>

      <ReportSection index={6} title="Management Summary" tone="teal">
        <ManagementSummary data={branchData} />
      </ReportSection>

      <ReportSection index={7} title="Investigative Table" subtitle="Station reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title="Investigative Table - Station Intelligence"
          rowsPerPage={5}
          maxRows={40}
          theme="cf"
        />
      </ReportSection>
    </div>
  );
}
