'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  fetchAllReports,
  fetchAggregatedCaseCategory,
  CategoryData,
  TrendDataPoint,
  BranchCategoryData,
  AirlineCategoryData,
  ReportRecord,
  CategoryKPIs,
} from './data';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Sparkles } from 'lucide-react';
import { InvestigativeTable } from '@/components/chart-detail/InvestigativeTable';
import { DrilldownDrawer } from '@/components/chart-detail/DrilldownDrawer';
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

function AutoInsight({ categoryData }: { categoryData: CategoryData[] }) {
  if (categoryData.length === 0) return null;

  const irregularity = categoryData.find(d => d.name === 'Irregularity');
  const complaint = categoryData.find(d => d.name === 'Complaint');
  const compliment = categoryData.find(d => d.name === 'Compliment');

  const insightParts: string[] = [];
  if (irregularity && irregularity.count > 0) {
    insightParts.push(`Irregularity represents ${(irregularity.percentage).toFixed(1)}% of total volume`);
  }
  if (complaint && complaint.count > 0) {
    insightParts.push(`Complaint rate stands at ${(complaint.percentage).toFixed(1)}%`);
  }
  if (compliment && compliment.count > 0) {
    insightParts.push(`Positive feedback (Compliment) at ${(compliment.percentage).toFixed(1)}%`);
  }

  const mainInsight = (irregularity?.percentage || 0) > 50
    ? 'High Irregularity: Operational focus recommended.'
    : 'Balanced Categories: General feedback distribution is within normal ranges.';

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

const CATEGORY_COLORS: Record<string, string> = {
  Irregularity: 'var(--cf-coral)',
  Complaint: 'var(--cf-amber)',
  Compliment: 'var(--cf-lime)',
};

function CategoryBarChart({ data, onBarClick }: { data: CategoryData[], onBarClick: (name: string) => void }) {
  const rechartsData = data.map(d => ({
    name: d.name,
    Count: d.count,
    fill: CATEGORY_COLORS[d.name] || 'var(--cf-slate)',
  }));

  return (
    <div className="h-[220px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Bar
            dataKey="Count"
            radius={[6, 6, 0, 0]}
            onClick={(data) => onBarClick(data.name)}
            cursor="pointer"
          >
            {rechartsData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyTrendChart({ data }: { data: TrendDataPoint[] }) {
  const rechartsData = data.map(d => ({
    name: d.month,
    Irregularity: d.Irregularity,
    Complaint: d.Complaint,
    Compliment: d.Compliment,
  }));

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          <Line type="monotone" dataKey="Irregularity" stroke="var(--cf-coral)" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Complaint" stroke="var(--cf-amber)" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Compliment" stroke="var(--cf-lime)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BranchStackedBar({ data, onBarClick }: { data: BranchCategoryData[], onBarClick: (category: string, branch: string) => void }) {
  const rechartsData = data.slice(0, 8).map(d => ({
    name: d.branch,
    Irregularity: d.Irregularity,
    Complaint: d.Complaint,
    Compliment: d.Compliment,
  }));

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <Bar dataKey="Irregularity" stackId="a" fill="var(--cf-coral)" radius={[0, 0, 0, 0]} onClick={(data) => onBarClick('Irregularity', data.name)} cursor="pointer" />
          <Bar dataKey="Complaint" stackId="a" fill="var(--cf-amber)" radius={[0, 0, 0, 0]} onClick={(data) => onBarClick('Complaint', data.name)} cursor="pointer" />
          <Bar dataKey="Compliment" stackId="a" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} onClick={(data) => onBarClick('Compliment', data.name)} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AirlineTop10Chart({ data, onBarClick }: { data: AirlineCategoryData[], onBarClick: (category: string, airline: string) => void }) {
  const rechartsData = data.map(d => ({
    name: d.airline,
    Irregularity: d.Irregularity,
    Complaint: d.Complaint,
    Compliment: d.Compliment,
  }));

  return (
    <div className="h-[260px] sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--cf-ink-3)' }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
          <Bar dataKey="Irregularity" stackId="a" fill="var(--cf-coral)" radius={[0, 0, 0, 0]} onClick={(data) => onBarClick('Irregularity', data.name)} cursor="pointer" />
          <Bar dataKey="Complaint" stackId="a" fill="var(--cf-amber)" radius={[0, 0, 0, 0]} onClick={(data) => onBarClick('Complaint', data.name)} cursor="pointer" />
          <Bar dataKey="Compliment" stackId="a" fill="var(--cf-lime)" radius={[4, 4, 0, 0]} onClick={(data) => onBarClick('Compliment', data.name)} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function getManagementSummaryInsights(
  categoryData: CategoryData[],
  branchData: BranchCategoryData[],
): string[] {
  const irregularity = categoryData.find(d => d.name === 'Irregularity');
  const compliment = categoryData.find(d => d.name === 'Compliment');

  const topBranch = branchData[0];
  const totalIrregularities = irregularity?.count ?? 0;
  const topBranchPct = topBranch && totalIrregularities > 0
    ? (topBranch.Irregularity / totalIrregularities) * 100
    : 0;

  return [
    irregularity && `${irregularity.name} dominates ${irregularity.percentage.toFixed(1)}% of total reports.`,
    topBranch && `${topBranch.branch} contributes ${topBranchPct.toFixed(0)}% of total irregularity.`,
    compliment && compliment.percentage < 5 && `Compliment rate remains at ${compliment.percentage.toFixed(1)}% — improvement opportunity.`,
  ].filter(Boolean) as string[];
}

function ManagementSummary({
  categoryData,
  branchData
}: {
  categoryData: CategoryData[];
  branchData: BranchCategoryData[];
}) {
  const insights = getManagementSummaryInsights(categoryData, branchData);

  if (insights.length === 0) return null;

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

export default function ReportByCaseCategoryDetail({
  filters = {},
  dateRange
}: {
  filters?: FilterParams;
  dateRange?: { from: string; to: string };
}) {

  // Depend on primitive fields, not the `filters`/`dateRange` object identity:
  // a default `filters = {}` (or any inline object literal) gets a new
  // identity every parent re-render, which would otherwise retrigger the
  // fetch effects below on every render instead of only on real changes.
  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...(dateRange?.from ? { dateFrom: dateRange.from } : {}),
    ...(dateRange?.to ? { dateTo: dateRange.to } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    filters.hub,
    filters.branch,
    filters.airlines,
    filters.area,
    filters.sourceSheet,
    filters.dateFrom,
    filters.dateTo,
    dateRange?.from,
    dateRange?.to,
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [branchData, setBranchData] = useState<BranchCategoryData[]>([]);
  const [airlineData, setAirlineData] = useState<AirlineCategoryData[]>([]);
  const [tableData, setTableData] = useState<ReportRecord[]>([]);
  const [kpis, setKpis] = useState<CategoryKPIs | null>(null);

  const [drilldownData, setDrilldownData] = useState<ReportRecord[]>([]);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');

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
    const controller = new AbortController();

    async function loadAggregatedData() {
      setLoading(true);
      setError(null);

      try {
        const aggregated = await fetchAggregatedCaseCategory(effectiveFilters, controller.signal);
        if (controller.signal.aborted) return;

        setCategoryData(aggregated.categoryData);
        setTrendData(aggregated.trendData);
        setBranchData(aggregated.branchData);
        setAirlineData(aggregated.airlineData);
        setKpis(aggregated.kpis);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to load aggregated data:', err);
        setError('Failed to load primary chart data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAggregatedData();
    return () => controller.abort();
  }, [effectiveFilters]);

  useEffect(() => {
    let active = true;

    async function loadTableData() {
      try {
        const table = await fetchAllReports(effectiveFilters);
        if (active) setTableData(table);
      } catch (err) {
        console.error('Failed to load table data:', err);
      }
    }

    loadTableData();
    return () => { active = false; };
  }, [effectiveFilters]);

  if (loading) return <ReportLoading label="Loading case category report…" />;

  const handleCategoryDrilldown = (categoryName: string) => {
    const filtered = tableData.filter(d => String(d.Category || d['Case Classification']) === categoryName);
    setDrilldownData(filtered);
    setDrilldownTitle(`Detailed Reports: ${categoryName}`);
    setIsDrilldownOpen(true);
  };

  const handleBranchDrilldown = (categoryName: string, branchName: string) => {
    const filtered = tableData.filter(d =>
      String(d.Category || d['Case Classification']) === categoryName &&
      (String(d.Branch) === branchName || String(d.Bandara) === branchName)
    );
    setDrilldownData(filtered);
    setDrilldownTitle(`Station: ${branchName} - ${categoryName}`);
    setIsDrilldownOpen(true);
  };

  const handleAirlineDrilldown = (categoryName: string, airlineName: string) => {
    const filtered = tableData.filter(d =>
      String(d.Category || d['Case Classification']) === categoryName &&
      String(d.Airlines) === airlineName
    );
    setDrilldownData(filtered);
    setDrilldownTitle(`Airline: ${airlineName} - ${categoryName}`);
    setIsDrilldownOpen(true);
  };

  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  const total = categoryData.reduce((sum, d) => sum + d.count, 0);
  const irregularity = categoryData.find(d => d.name === 'Irregularity');

  const irregularityRate = irregularity && total > 0
    ? ((irregularity.count / total) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 sm:space-y-8">
      <DrilldownDrawer
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        title={drilldownTitle}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={drilldownData as any[]}
      />

      <AutoInsight categoryData={categoryData} />

      {kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReportStatCard label="Total Reports" value={kpis.totalReports.toLocaleString('id-ID')} tone="teal" />
          <ReportStatCard label="Most Affected Station" value={kpis.mostAffectedBranch.name} subtitle={`${kpis.mostAffectedBranch.count} reports`} tone="coral" />
          <ReportStatCard label="Top Airline" value={kpis.topAirline.name} subtitle={`${kpis.topAirline.count} reports`} tone="amber" />
          <ReportStatCard label="Irregularity Rate" value={`${irregularityRate}%`} tone={irregularity && irregularity.percentage > 50 ? 'coral' : 'lime'} />
        </div>
      )}

      <ReportSection index={1} title="Category Breakdown" tone="teal">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CategoryBarChart data={categoryData} onBarClick={handleCategoryDrilldown} />
          </div>
          <div className="space-y-2">
            {categoryData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-[var(--cf-line)] bg-[var(--cf-canvas-2)] p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[item.name] || 'var(--cf-slate)' }} />
                  <span className="truncate text-[12px] font-semibold text-[var(--cf-ink)]">{item.name}</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="cf-tabular text-[13px] font-bold text-[var(--cf-ink)]">{item.count.toLocaleString('id-ID')}</div>
                  <div className="text-[10px] text-[var(--cf-ink-3)]">{item.percentage.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ReportSection>

      <ReportSection index={2} title="Monthly Trend Analysis" tone="teal">
        <MonthlyTrendChart data={trendData} />
      </ReportSection>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <ReportSection index={3} title="Category by Station" tone="amber">
          <BranchStackedBar data={branchData} onBarClick={handleBranchDrilldown} />
        </ReportSection>
        <ReportSection index={4} title="Category by Airline (Top 10)" tone="slate">
          <AirlineTop10Chart data={airlineData} onBarClick={handleAirlineDrilldown} />
        </ReportSection>
      </div>

      {getManagementSummaryInsights(categoryData, branchData).length > 0 && (
        <ReportSection index={5} title="Management Summary" tone="teal">
          <ManagementSummary categoryData={categoryData} branchData={branchData} />
        </ReportSection>
      )}

      <ReportSection index={6} title="Investigative Table" subtitle="Case category reports — expand a row for full case detail" bodyClassName="p-0">
        <InvestigativeTable
          data={investigativeData}
          title="Investigative Table - Case Category Reports"
          rowsPerPage={5}
          maxRows={40}
          theme="cf"
        />
      </ReportSection>
    </div>
  );
}
