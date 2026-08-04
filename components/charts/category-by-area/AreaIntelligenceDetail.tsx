'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  fetchAreaOverview,
  fetchCategoryBreakdownByArea,
  fetchBranchWithinArea,
  fetchAirlineWithinArea,
  fetchMonthlyTrendForArea,
  fetchRootCauseForArea,
  fetchBranchCategoryHeatmap,
  fetchAllAreaIntelReports,
  AreaSummary,
  AreaCategoryBreakdown,
  BranchWithinAreaData,
  AirlineWithinAreaData,
  TrendDataPoint,
  RootCauseParetoData,
  HeatmapMatrix,
  AreaReportRecord,
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

function AutoInsight({ data }: { data: AreaSummary[] }) {
  if (data.length === 0) return null;

  const topArea = data[0];
  const highRiskAreas = data.filter((a) => a.riskIndex >= 50);
  const totalReports = data.reduce((s, a) => s + a.total, 0);
  const irregTotal = data.reduce((s, a) => s + a.irregularity, 0);
  const overallIrregRate = totalReports > 0 ? (irregTotal / totalReports) * 100 : 0;

  const topAreaContribution = topArea.contribution.toFixed(0);

  const insightParts: string[] = [];
  insightParts.push(
    `${topArea.area} area accounts for ${topAreaContribution}% of irregularities, dominating the report landscape.`,
  );
  if (highRiskAreas.length > 0) {
    insightParts.push(
      `${highRiskAreas.length} area${highRiskAreas.length > 1 ? 's' : ''} flagged as high risk (${highRiskAreas.map((a) => a.area).join(', ')}).`,
    );
  }
  insightParts.push(`Overall irregularity rate: ${overallIrregRate.toFixed(1)}% across ${data.length} areas.`);

  const mainInsight = `Area-specific risk analysis across ${data.length} operational zones. ${topArea.area} identifies as the primary risk vector.`;

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

function CategoryBreakdownChart({ data }: { data: AreaCategoryBreakdown[] }) {
  const sliced = data.slice(0, 12);
  const rechartsData = sliced.map((d) => ({
    name: d.area,
    Irregularity: d.Irregularity,
    Complaint: d.Complaint,
    Compliment: d.Compliment,
  }));

  return (
    <div className="h-[260px] sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} interval={0} angle={-20} textAnchor="end" height={50} />
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

function BranchDistributionChart({ data }: { data: BranchWithinAreaData[] }) {
  const rechartsData = data.slice(0, 12).map((d) => ({ name: d.branch, Reports: d.count }));

  return (
    <div className="h-[220px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Bar dataKey="Reports" fill="var(--cf-teal)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AirlineDistributionChart({ data }: { data: AirlineWithinAreaData[] }) {
  const rechartsData = data.slice(0, 12).map((d) => ({ name: d.airline, Reports: d.count }));

  return (
    <div className="h-[220px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Bar dataKey="Reports" fill="var(--cf-slate)" radius={[4, 4, 0, 0]} />
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

function HeatmapTable({ matrix }: { matrix: HeatmapMatrix }) {
  const maxValue = Math.max(...(Array.from(matrix.cells.values()) as number[]), 1);

  function getCellStyles(value: number) {
    if (value === 0) return { className: 'text-[var(--cf-ink-3)]', style: { background: 'var(--cf-canvas-2)' } };
    const intensity = value / maxValue;
    return {
      className: 'font-black',
      style: {
        backgroundColor: `rgba(15, 118, 110, ${0.15 + intensity * 0.75})`,
        color: intensity > 0.5 ? '#ffffff' : 'var(--cf-ink)',
      },
    };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--cf-line)]">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-[var(--cf-line)] bg-[var(--cf-canvas-2)]">
              <th className="sticky left-0 z-10 whitespace-nowrap bg-[var(--cf-canvas-2)] px-3 py-2 text-left text-[9px] font-black uppercase tracking-[0.12em] text-[var(--cf-ink-3)]">
                Station / Sector
              </th>
              {matrix.cols.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-[var(--cf-ink-3)]">
                  {col}
                </th>
              ))}
              <th className="whitespace-nowrap bg-[var(--cf-teal-tint)] px-3 py-2 text-center text-[9px] font-black uppercase tracking-[0.1em] text-[var(--cf-teal)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--cf-line-soft)]">
            {matrix.rows.map((row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--cf-card)] px-3 py-2 text-[10px] font-bold uppercase tracking-tight text-[var(--cf-ink)]">
                  {row}
                </td>
                {matrix.cols.map((col) => {
                  const value = matrix.cells.get(`${row}|||${col}`) || 0;
                  const { className, style } = getCellStyles(value);
                  return (
                    <td key={col} className={`px-3 py-2 text-center transition-colors ${className}`} style={style}>
                      {value || '-'}
                    </td>
                  );
                })}
                <td className="bg-[var(--cf-canvas-2)] px-3 py-2 text-center font-bold text-[var(--cf-ink)]">
                  {matrix.rowTotals.get(row) || 0}
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--cf-canvas-2)]">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--cf-canvas-2)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--cf-teal)]">
                Totals
              </td>
              {matrix.cols.map((col) => (
                <td key={col} className="px-3 py-2 text-center font-bold text-[var(--cf-ink)]">
                  {matrix.colTotals.get(col) || 0}
                </td>
              ))}
              <td className="bg-[var(--cf-teal)] px-3 py-2 text-center font-black text-white">{matrix.grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManagementSummary({ data }: { data: AreaSummary[] }) {
  if (data.length === 0) return null;

  const topArea = data[0];
  const highRiskCount = data.filter((a) => a.riskIndex >= 50).length;
  const avgIrregRate = data.reduce((sum, a) => sum + a.irregularityRate, 0) / data.length;
  const totalReports = data.reduce((sum, a) => sum + a.total, 0);

  const insights = [
    `${topArea.area} leads with ${topArea.total} reports (${topArea.contribution.toFixed(1)}% of total).`,
    `${highRiskCount} area${highRiskCount !== 1 ? 's' : ''} identified as high risk (risk index >= 50).`,
    `Average irregularity rate across areas: ${avgIrregRate.toFixed(1)}%.`,
    `Total volume: ${totalReports.toLocaleString('id-ID')} reports across ${data.length} areas.`,
    topArea.momGrowth !== 0
      ? `${topArea.area} trending ${topArea.momGrowth > 0 ? 'upward' : 'downward'} (${topArea.momGrowth > 0 ? '+' : ''}${topArea.momGrowth.toFixed(1)}% MoM).`
      : null,
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

export default function AreaIntelligenceDetail({ filters = {} }: { filters?: FilterParams }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<AreaSummary[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<AreaCategoryBreakdown[]>([]);
  const [branchData, setBranchData] = useState<BranchWithinAreaData[]>([]);
  const [airlineData, setAirlineData] = useState<AirlineWithinAreaData[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [, setParetoData] = useState<RootCauseParetoData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapMatrix>({ rows: [], cols: [], cells: new Map(), rowTotals: new Map(), colTotals: new Map(), grandTotal: 0 });
  const [tableData, setTableData] = useState<AreaReportRecord[]>([]);
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
        const [areas, catBreakdown, branches, airlines, trend, pareto, heatmap, table] = await Promise.all([
          fetchAreaOverview(filters),
          fetchCategoryBreakdownByArea(filters),
          fetchBranchWithinArea(filters),
          fetchAirlineWithinArea(filters),
          fetchMonthlyTrendForArea(filters),
          fetchRootCauseForArea(filters),
          fetchBranchCategoryHeatmap(filters),
          fetchAllAreaIntelReports(filters),
        ]);

        if (requestId !== requestIdRef.current) return;

        setAreaData(areas);
        setCategoryBreakdown(catBreakdown);
        setBranchData(branches);
        setAirlineData(airlines);
        setTrendData(trend);
        setParetoData(pareto);
        setHeatmapData(heatmap);
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

  if (loading) return <ReportLoading label="Loading area intelligence…" />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const totalReports = areaData.reduce((sum: number, a: any) => sum + a.total, 0);
  const totalIrreg = areaData.reduce((sum: number, a: any) => sum + a.irregularity, 0);
  const totalComplaint = areaData.reduce((sum: number, a: any) => sum + a.complaint, 0);
  const totalCompliment = areaData.reduce((sum: number, a: any) => sum + a.compliment, 0);

  const topArea = areaData[0];

  const overallIrregRate = totalReports > 0 ? (totalIrreg / totalReports) * 100 : 0;
  const overallComplaintRate = totalReports > 0 ? (totalComplaint / totalReports) * 100 : 0;
  const overallComplimentRate = totalReports > 0 ? (totalCompliment / totalReports) * 100 : 0;
  const overallNetSentiment = (totalCompliment + totalComplaint) > 0
    ? ((totalCompliment - totalComplaint) / (totalCompliment + totalComplaint)) * 100
    : 0;

  const avgRiskIndex = areaData.length > 0 ? areaData.reduce((sum: number, a: any) => sum + a.riskIndex, 0) / areaData.length : 0;

  const rankColumns: CompactColumn<AreaSummary>[] = [
    { key: 'rank', label: '#', align: 'left', numeric: true, render: (r) => `#${r.rank}` },
    { key: 'area', label: 'Area' },
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
      <AutoInsight data={areaData} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Total Reports" value={totalReports.toLocaleString('id-ID')} subtitle={`Across ${areaData.length} areas`} tone="teal" />
        <ReportStatCard label="% of System" value={topArea ? `${topArea.percentOfSystem.toFixed(1)}%` : '-'} subtitle={topArea ? `Top: ${topArea.area}` : ''} tone="teal" />
        <ReportStatCard label="Rank" value={topArea ? `#${topArea.rank}` : '-'} subtitle={topArea ? topArea.area : ''} tone="amber" />
        <ReportStatCard label="Overall Irreg. %" value={`${overallIrregRate.toFixed(1)}%`} subtitle="Weighted total" tone={overallIrregRate > 50 ? 'coral' : 'amber'} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Overall Complaint %" value={`${overallComplaintRate.toFixed(1)}%`} subtitle="Weighted total" tone="amber" />
        <ReportStatCard label="Overall Compliment %" value={`${overallComplimentRate.toFixed(1)}%`} subtitle="Weighted total" tone="lime" />
        <ReportStatCard
          label="Overall Net Sentiment"
          value={`${overallNetSentiment >= 0 ? '+' : ''}${overallNetSentiment.toFixed(1)}%`}
          subtitle="Weighted total"
          tone={overallNetSentiment > 0 ? 'lime' : 'coral'}
        />
        <ReportStatCard
          label="Risk Score Index"
          value={avgRiskIndex.toFixed(1)}
          subtitle="Avg (Irreg*2 + Complaint)"
          trend={topArea?.momGrowth}
          tone={avgRiskIndex >= 50 ? 'coral' : avgRiskIndex >= 20 ? 'amber' : 'lime'}
        />
      </div>

      <ReportSection index={1} title="Category Dispersion" subtitle="Relative distribution of operational events" tone="teal">
        <CategoryBreakdownChart data={categoryBreakdown} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={2} title="Station Distribution" subtitle="Regional output volume" tone="teal">
          <BranchDistributionChart data={branchData} />
        </ReportSection>
        <ReportSection index={3} title="Airline Distribution" subtitle="Provider contribution scale" tone="slate">
          <AirlineDistributionChart data={airlineData} />
        </ReportSection>
      </div>

      <ReportSection index={4} title="Monthly Trend" subtitle="14-month rolling operational trend" tone="teal">
        <MonthlyTrendChart data={trendData} />
      </ReportSection>

      <ReportSection index={5} title="Area Performance Ranking" tone="teal">
        <CompactTable columns={rankColumns} rows={areaData} rowKey="area" maxRows={15} />
      </ReportSection>

      <ReportSection index={6} title="Spatial Density Grid" subtitle="Station performance across categories" tone="slate">
        <HeatmapTable matrix={heatmapData} />
      </ReportSection>

      <ReportSection index={7} title="Management Summary" tone="teal">
        <ManagementSummary data={areaData} />
      </ReportSection>

      <ReportSection index={8} title="Investigative Table" subtitle="Area reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable data={investigativeData} title="Investigative Table - Area Intelligence" rowsPerPage={8} maxRows={40} theme="cf" />
      </ReportSection>
    </div>
  );
}
