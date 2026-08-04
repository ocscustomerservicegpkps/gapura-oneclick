'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Report } from '@/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Sparkles } from 'lucide-react';
import { InvestigativeTable } from '@/components/chart-detail/InvestigativeTable';
import {
  ReportSection,
  ReportStatCard,
  ReportLoading,
  ReportError,
} from '@/components/chart-detail/ReportDetailKit';
import type { QueryResult } from '@/types/builder';

type CategoryField = 'terminal_area_category' | 'apron_area_category' | 'general_category';

interface FilterParams {
  hub?: string;
  branch?: string;
  airlines?: string;
  area?: string;
  sourceSheet?: 'NON CARGO' | 'CGO';
  dateFrom?: string;
  dateTo?: string;
}

interface AreaSubCategoryDetailProps {
  filters: FilterParams;
  categoryField: CategoryField;
  title: string;
  subtitle: string;
}

const INVALID_VALUES = new Set(['', '-', 'nil', 'none', 'unknown', 'n/a', '#n/a', 'null']);
const CATEGORY_COLORS = [
  'var(--cf-teal)',
  'var(--cf-coral)',
  'var(--cf-amber)',
  'var(--cf-lime)',
  'var(--cf-slate)',
  'var(--cf-teal-deep)',
];
const CONTEXT_META: Record<
  CategoryField,
  {
    singular: string;
    plural: string;
    insightLabel: string;
    footerLabel: string;
  }
> = {
  terminal_area_category: {
    singular: 'terminal area category',
    plural: 'terminal area categories',
    insightLabel: 'Terminal Insight',
    footerLabel: 'Total filtered terminal-area records',
  },
  apron_area_category: {
    singular: 'apron area category',
    plural: 'apron area categories',
    insightLabel: 'Apron Insight',
    footerLabel: 'Total filtered apron-area records',
  },
  general_category: {
    singular: 'general category',
    plural: 'general categories',
    insightLabel: 'General Insight',
    footerLabel: 'Total filtered general-category records',
  },
};

function cleanLabel(value: unknown): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidLabel(value: unknown): boolean {
  const normalized = cleanLabel(value).toLowerCase();
  return normalized.length > 0 && !INVALID_VALUES.has(normalized);
}

function monthKey(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function displayMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function normalizeMainCategory(value: unknown): 'Irregularity' | 'Complaint' | 'Compliment' | 'Other' {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('irregular')) return 'Irregularity';
  if (normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('compliment')) return 'Compliment';
  return 'Other';
}

function parseEventDate(report: Report): number {
  const d = new Date(String(report.date_of_event || report.incident_date || report.created_at || ''));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function HeatCell({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? value / max : 0;
  const alpha = value === 0 ? 0.07 : Math.min(0.95, 0.2 + ratio * 0.75);
  const background = `rgba(15, 118, 110, ${alpha})`;
  const color = alpha > 0.55 ? '#ffffff' : 'var(--cf-ink)';

  return (
    <div
      className="h-8 rounded-md flex items-center justify-center text-[11px] font-bold"
      style={{ background, color }}
      title={`${value}`}
    >
      {value || '-'}
    </div>
  );
}

function CategoryInsight({
  insightLabel,
  singular,
  plural,
  topCategory,
  topCategoryShare,
}: {
  insightLabel: string;
  singular: string;
  plural: string;
  topCategory?: { category: string; count: number; share: number };
  topCategoryShare: number;
}) {
  const message = topCategory
    ? `${topCategory.category} leads ${plural} with ${topCategory.count.toLocaleString('id-ID')} reports (${topCategoryShare.toFixed(1)}%).`
    : `No ${singular} data available for the current filter.`;

  return (
    <div className="cf-card p-4 sm:p-5" style={{ '--cf-spine': 'var(--cf-amber)' } as CSSProperties}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fef3c7] text-[var(--cf-amber)]">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <h3 className="cf-eyebrow mb-2">
            <span>{insightLabel}</span>
            <span className="cf-eyebrow-rule" />
          </h3>
          <p className="cf-display text-[15px] font-medium leading-snug text-[var(--cf-ink)]">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function AreaSubCategoryDetail({
  filters,
  categoryField,
  title,
  subtitle,
}: AreaSubCategoryDetailProps) {
  const contextMeta = CONTEXT_META[categoryField];
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string>('');
  const hasAutoSelected = useRef(false);
  // Guards against a slower, earlier filter combination's response landing
  // after a newer one's and overwriting fresher `reports` state.
  const fetchReportsSeqRef = useRef(0);

  useEffect(() => {
    const requestSeq = ++fetchReportsSeqRef.current;
    const fetchReports = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) query.append('dateTo', filters.dateTo);
        if (filters.hub && filters.hub !== 'all') query.append('hub', filters.hub);
        if (filters.branch && filters.branch !== 'all') query.append('branch', filters.branch);
        if (filters.area && filters.area !== 'all') query.append('area', filters.area);
        if (filters.airlines && filters.airlines !== 'all') query.append('airlines', filters.airlines);
        if (filters.sourceSheet) query.append('sourceSheet', filters.sourceSheet);

        const fields = [
          'id', 'date_of_event', 'incident_date', 'created_at', 'hub', 'branch',
          'reporting_branch', 'station_code', 'airlines', 'airline', 'area',
          categoryField, 'main_category', 'category', 'irregularity_complain_category',
          'severity', 'status', 'root_caused', 'action_taken', 'source_sheet'
        ];
        query.append('fields', fields.join(','));

        const response = await fetch(`/api/reports/analytics?${query.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        const data = await response.json();
        if (fetchReportsSeqRef.current !== requestSeq) return;
        setReports(data.reports || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (fetchReportsSeqRef.current !== requestSeq) return;
        setError(err.message || 'Failed to load data');
      } finally {
        if (fetchReportsSeqRef.current === requestSeq) setLoading(false);
      }
    };
    fetchReports();
  }, [filters.hub, filters.branch, filters.airlines, filters.area, filters.sourceSheet, filters.dateFrom, filters.dateTo, categoryField]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const sourceSheet = filters.sourceSheet || 'NON CARGO';
      if (sourceSheet === 'CGO') {
        if (r.source_sheet !== 'CGO') return false;
      } else if (r.source_sheet === 'CGO') {
        return false;
      }

      if (filters.hub && filters.hub !== 'all' && cleanLabel(r.hub) !== filters.hub) return false;
      if (filters.branch && filters.branch !== 'all' && cleanLabel(r.branch) !== filters.branch) return false;

      const airline = cleanLabel(r.airlines || r.airline);
      if (filters.airlines && filters.airlines !== 'all' && airline !== filters.airlines) return false;

      if (filters.area && filters.area !== 'all' && cleanLabel(r.area) !== filters.area) return false;

      return isValidLabel(r[categoryField]);
    });
  }, [reports, filters, categoryField]);

  const categoryRanking = useMemo(() => {
    const map = new Map<string, number>();
    filteredReports.forEach((r) => {
      const key = cleanLabel(r[categoryField]);
      if (!isValidLabel(key)) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const total = filteredReports.length || 1;
    return Array.from(map.entries())
      .map(([category, count]) => ({
        category,
        count,
        share: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReports, categoryField]);

  const topCategory = categoryRanking[0];
  const topCategoryShare = topCategory ? topCategory.share : 0;

  useEffect(() => {
    if (!focusedCategory && categoryRanking.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      setFocusedCategory(categoryRanking[0].category);
      return;
    }
    if (focusedCategory && !categoryRanking.some((c) => c.category === focusedCategory)) {
      hasAutoSelected.current = false;
      setFocusedCategory(categoryRanking[0]?.category || '');
    }
  }, [categoryRanking, focusedCategory]);

  const topCategories = useMemo(() => categoryRanking.slice(0, 3).map((c) => c.category), [categoryRanking]);

  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();
    filteredReports.forEach((r) => {
      const cat = cleanLabel(r[categoryField]);
      if (!topCategories.includes(cat)) return;
      const key = monthKey(r.date_of_event || r.incident_date || r.created_at);
      if (!key) return;
      if (!monthMap.has(key)) monthMap.set(key, {});
      const obj = monthMap.get(key)!;
      obj[cat] = (obj[cat] || 0) + 1;
    });

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, bucket]) => ({
        month,
        monthLabel: displayMonth(month),
        ...topCategories.reduce<Record<string, number>>((acc, c) => {
          acc[c] = bucket[c] || 0;
          return acc;
        }, {}),
      }));
  }, [filteredReports, categoryField, topCategories]);

  const branchHeatmap = useMemo(() => {
    const branchMap = new Map<string, number>();
    filteredReports.forEach((r) => {
      const branch = cleanLabel(r.branch || r.reporting_branch || r.station_code);
      if (!isValidLabel(branch)) return;
      branchMap.set(branch, (branchMap.get(branch) || 0) + 1);
    });

    const topBranches = Array.from(branchMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([branch]) => branch);

    const cols = categoryRanking.slice(0, 6).map((c) => c.category);
    const cells = new Map<string, number>();
    let max = 0;

    filteredReports.forEach((r) => {
      const branch = cleanLabel(r.branch || r.reporting_branch || r.station_code);
      const category = cleanLabel(r[categoryField]);
      if (!topBranches.includes(branch) || !cols.includes(category)) return;
      const key = `${branch}::${category}`;
      const next = (cells.get(key) || 0) + 1;
      cells.set(key, next);
      if (next > max) max = next;
    });

    return { branches: topBranches, categories: cols, cells, max };
  }, [filteredReports, categoryRanking, categoryField]);

  const airlineContribution = useMemo(() => {
    const airlineMap = new Map<string, number>();
    filteredReports.forEach((r) => {
      const airline = cleanLabel(r.airlines || r.airline);
      if (!isValidLabel(airline)) return;
      airlineMap.set(airline, (airlineMap.get(airline) || 0) + 1);
    });

    const topAirlines = Array.from(airlineMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([airline]) => airline);

    return topAirlines.map((airline) => {
      const row: Record<string, string | number> = { airline };
      topCategories.forEach((cat) => {
        row[cat] = filteredReports.filter((r) => cleanLabel(r[categoryField]) === cat && cleanLabel(r.airlines || r.airline) === airline).length;
      });
      row.total = topCategories.reduce((sum, cat) => sum + Number(row[cat] || 0), 0);
      return row;
    });
  }, [filteredReports, topCategories, categoryField]);

  const focusedReports = useMemo(() => {
    if (!focusedCategory) return filteredReports;
    return filteredReports.filter((r) => cleanLabel(r[categoryField]) === focusedCategory);
  }, [filteredReports, focusedCategory, categoryField]);

  const queryResult = useMemo<QueryResult>(() => {
    const columns = [
      'date_of_event',
      'branch',
      'airlines',
      categoryField,
      'category',
      'severity',
      'status',
      'root_caused',
      'action_taken',
    ];

    const rows = [...focusedReports]
      .sort((a, b) => parseEventDate(b) - parseEventDate(a))
      .map((r) => ({
        date_of_event: String(r.date_of_event || r.incident_date || r.created_at || ''),
        branch: cleanLabel(r.branch || r.reporting_branch || r.station_code),
        airlines: cleanLabel(r.airlines || r.airline),
        [categoryField]: cleanLabel(r[categoryField]),
        category: normalizeMainCategory(
          r.main_category || r.category || r.irregularity_complain_category,
        ),
        severity: cleanLabel(r.severity || ''),
        status: cleanLabel(r.status || ''),
        root_caused: cleanLabel(r.root_caused) || '-',
        action_taken: cleanLabel(r.action_taken) || '-',
      }));

    return { columns, rows, rowCount: rows.length, executionTimeMs: 0 };
  }, [focusedReports, categoryField]);

  const irregularityCount = useMemo(
    () => filteredReports.filter((r) => normalizeMainCategory(r.main_category || r.category || r.irregularity_complain_category) === 'Irregularity').length,
    [filteredReports]
  );
  const complaintCount = useMemo(
    () => filteredReports.filter((r) => normalizeMainCategory(r.main_category || r.category || r.irregularity_complain_category) === 'Complaint').length,
    [filteredReports]
  );

  if (loading) return <ReportLoading label={`Loading ${title} detail…`} />;
  if (error) return <ReportError message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="cf-display text-xl font-semibold text-[var(--cf-ink)] tracking-tight">{title}</h2>
        <p className="mt-1 text-[11px] font-medium text-[var(--cf-ink-3)]">{subtitle}</p>
      </div>

      <CategoryInsight
        insightLabel={contextMeta.insightLabel}
        singular={contextMeta.singular}
        plural={contextMeta.plural}
        topCategory={topCategory}
        topCategoryShare={topCategoryShare}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Total Reports" value={filteredReports.length.toLocaleString('id-ID')} tone="teal" />
        <ReportStatCard
          label="Distinct Stations"
          value={new Set(filteredReports.map((r) => cleanLabel(r.branch || r.reporting_branch || r.station_code)).filter(isValidLabel)).size.toLocaleString('id-ID')}
          tone="slate"
        />
        <ReportStatCard
          label="Distinct Airlines"
          value={new Set(filteredReports.map((r) => cleanLabel(r.airlines || r.airline)).filter(isValidLabel)).size.toLocaleString('id-ID')}
          tone="amber"
        />
        <ReportStatCard
          label="Irregularity Rate"
          value={`${filteredReports.length ? ((irregularityCount / filteredReports.length) * 100).toFixed(1) : '0.0'}%`}
          tone="coral"
        />
      </div>

      <ReportSection index={1} title={`${contextMeta.singular} Ranking (Top 10)`} tone="teal">
        <div className="h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryRanking.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 20, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <YAxis type="category" dataKey="category" width={140} tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
              <Bar dataKey="count" fill="var(--cf-teal)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>

      <ReportSection index={2} title="Monthly Trend" subtitle={`Top 3 ${contextMeta.plural}`} tone="teal">
        <div className="h-[220px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              {topCategories.map((cat, idx) => (
                <Line key={cat} type="monotone" dataKey={cat} stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>

      <ReportSection index={3} title={`Station x ${contextMeta.singular} Hotspot`} tone="slate">
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[var(--cf-card)] text-left text-[9px] font-black uppercase tracking-[0.12em] text-[var(--cf-ink-3)] min-w-[120px]">Station</th>
                {branchHeatmap.categories.map((cat) => (
                  <th key={cat} className="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--cf-ink-3)] min-w-[90px] max-w-[140px] whitespace-normal break-words">
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branchHeatmap.branches.map((branch) => (
                <tr key={branch}>
                  <td className="sticky left-0 bg-[var(--cf-card)] text-[11px] font-semibold text-[var(--cf-ink-2)]">{branch}</td>
                  {branchHeatmap.categories.map((cat) => {
                    const value = branchHeatmap.cells.get(`${branch}::${cat}`) || 0;
                    return (
                      <td key={cat}>
                        <HeatCell value={value} max={branchHeatmap.max} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection index={4} title="Airline Contribution (Top 8)" tone="teal">
        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={airlineContribution} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-line)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <YAxis type="category" dataKey="airline" width={130} tick={{ fontSize: 10, fill: 'var(--cf-ink-3)' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--cf-line)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {topCategories.map((cat, idx) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} radius={idx === topCategories.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>

      {categoryRanking.length > 0 && (
        <ReportSection index={5} title={`Filter by ${contextMeta.singular}`} tone="amber">
          <div className="flex flex-wrap gap-2">
            {categoryRanking.length > 1 && (
              <button
                type="button"
                aria-pressed={focusedCategory === ''}
                onClick={() => setFocusedCategory('')}
                className={focusedCategory === '' ? 'cf-btn cf-btn-primary px-4 py-2' : 'cf-btn cf-btn-ghost px-4 py-2'}
              >
                All · {filteredReports.length.toLocaleString('id-ID')}
              </button>
            )}

            {categoryRanking.map(({ category, count }) => (
              <button
                key={category}
                type="button"
                aria-pressed={focusedCategory === category}
                onClick={() => setFocusedCategory(category)}
                className={focusedCategory === category ? 'cf-btn cf-btn-primary px-4 py-2' : 'cf-btn cf-btn-ghost px-4 py-2'}
              >
                {category} · {count.toLocaleString('id-ID')}
              </button>
            ))}
          </div>
        </ReportSection>
      )}

      <ReportSection
        index={6}
        title="Investigative Table"
        subtitle={`Full data table${focusedCategory ? ` — ${focusedCategory}` : ''}`}
        bodyClassName="p-0"
      >
        <InvestigativeTable title={focusedCategory || title} data={queryResult} theme="cf" />
      </ReportSection>

      <div className="text-[11px] font-medium text-[var(--cf-ink-3)]">
        {contextMeta.footerLabel}: {filteredReports.length.toLocaleString('id-ID')} | Complaint: {complaintCount.toLocaleString('id-ID')}
      </div>
    </div>
  );
}
