"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition, type Dispatch, type SetStateAction, type ReactNode, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useData } from '@/lib/swr';
import { ChevronUp, Link as LinkIcon } from 'lucide-react';

import { ResponsiveHeader } from '@/components/dashboard/analyst/ResponsiveHeader';
import { ReportFilterBar } from '@/components/dashboard/analyst/ReportFilterBar';
import { ResponsiveStatsGrid } from '@/components/dashboard/analyst/ResponsiveStatsGrid';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { type StatusUpdateDetails } from '@/components/dashboard/ReportDetailView';

import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { useJoumpaReports } from '@/lib/hooks/useJoumpaReports';
import { fetchCompleteDashboardReports } from '@/lib/dashboard/client';
import type { DashboardOverview } from '@/lib/dashboard/contracts';
import { mergeReportUpdate } from '@/lib/report-cache';
import { getLinkUrl } from '@/lib/external-links';
import { ReportSourceToggle, matchesReportSource, type ReportSourceValue } from '@/components/dashboard/analyst/ReportSourceToggle';
import {
  buildReportFilterOptions,
  cleanReportValue,
  reportDateValue,
  reportMatchesSeverity,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCaseClassification,
  resolveReportSeverity,
  resolveReportSource,
} from '@/lib/reports-export';
import type { Report, AnalyticsData, UserRole } from '@/types';
import { useReportsData } from '@/hooks/use-reports-cache';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';

const ReportsTableSection = dynamic(
  () =>
    import('@/components/dashboard/analyst/ReportsTableSection').then(
      (mod) => mod.ReportsTableSection
    ),
  {
    ssr: false,
    loading: () => (
      <PresentationSlide
        title="Today's Reports"
        subtitle="Loading latest report list"
        className="animate-fade-in-up"
      >
        <div className="space-y-3 rounded-[24px] border border-[var(--surface-3)] bg-[var(--surface-1)] p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-[var(--surface-2)]"
            />
          ))}
        </div>
      </PresentationSlide>
    ),
  }
);

const ReportsDetailTable = dynamic(
  () => import('@/components/dashboard/analyst/ReportsDetailTable').then((mod) => mod.ReportsDetailTable),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)] p-8 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--surface-4)', borderTopColor: 'var(--brand-emerald-500,#10b981)' }} />
      </div>
    ),
  }
);

const ReportDetailModal = dynamic(
  () => import('@/components/dashboard/ReportDetailModal').then((mod) => mod.ReportDetailModal),
  { ssr: false }
);

const ReportsExportModal = dynamic(
  () => import('@/components/dashboard/analyst/ReportsExportModal').then((mod) => mod.ReportsExportModal),
  { ssr: false }
);

const CustomerFeedbackFilterModal = dynamic(
  () =>
    import('@/components/dashboard/analyst/CustomerFeedbackFilterModal').then(
      (mod) => mod.CustomerFeedbackFilterModal
    ),
  { ssr: false }
);

const DashboardLinkModals = dynamic(
  () => import('@/components/dashboard/analyst/DashboardLinkModals').then(
    (mod) => mod.DashboardLinkModals
  ),
  { ssr: false }
);

const ChartSection = dynamic(
  () => import('@/components/dashboard/analyst/ChartSection').then((mod) => mod.ChartSection),
  { ssr: false }
);

interface DivisionAnalystDashboardProps {
  division: DivisionConfig;
  realDivisionCode?: string;
}

type DashboardView = 'dashboard' | 'reports';

const DeferredChartRegion = memo(function DeferredChartRegion({
  children,
  onVisible,
}: {
  children: ReactNode;
  onVisible?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          onVisible?.();
          observer.disconnect();
        }
      },
      {

        rootMargin: '100px 0px',
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible, onVisible]);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        children
      ) : (
        <section
          aria-label="Loading analytics charts"
          className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]"
        >
          <div className="space-y-4 rounded-[28px] border border-[var(--surface-3)] bg-[var(--surface-1)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" />
                <div className="h-8 w-56 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              </div>
              <div className="h-10 w-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-[24px] bg-[var(--surface-2)]" />
              ))}
            </div>
          </div>
          <aside className="space-y-4 rounded-[28px] border border-[var(--surface-3)] bg-[var(--surface-1)] p-5 shadow-sm">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" />
            <div className="h-8 w-44 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[24px] bg-[var(--surface-2)]" />
            ))}
          </aside>
        </section>
      )}
    </div>
  );
});

export function DivisionAnalystDashboard({
  division,
  realDivisionCode,
  initialReports,
  initialAnalytics,
  initialOverview,
  lockedBranches,
  forceView,
}: DivisionAnalystDashboardProps & {
  initialReports?: Report[];
  initialAnalytics?: AnalyticsData | null;
  initialOverview?: DashboardOverview;

  lockedBranches?: string[];

  forceView?: DashboardView;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const externalLinks = useExternalLinks();

  const isScopeLocked = Boolean(lockedBranches && lockedBranches.length > 0);

  const view: DashboardView = forceView
    ? forceView
    : searchParams.get('view') === 'reports'
      ? 'reports'
      : 'dashboard';
  const isDashboardView = view === 'dashboard';

  const [refreshing, setRefreshing] = useState(false);
  const [shouldLoadCompleteReports, setShouldLoadCompleteReports] = useState(false);
  const [showReportsExportModal, setShowReportsExportModal] = useState(false);
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | { from: string; to: string }>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  const [cfLoading, setCfLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [listFilter, setListFilter] = useState('all');
  const [listSeverity, setListSeverity] = useState('all');
  const [listStartDate, setListStartDate] = useState('');
  const [listEndDate, setListEndDate] = useState('');
  const [listHub, setListHub] = useState('');
  const [listBranch, setListBranch] = useState('');
  const [listAirline, setListAirline] = useState('');
  const [listCategory, setListCategory] = useState('');
  const [listCaseClassification, setListCaseClassification] = useState('');
  const [listArea, setListArea] = useState('');
  const [listSource, setListSource] = useState<ReportSourceValue>('all');
  const [listSearch, setListSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showOSDashboardModal, setShowOSDashboardModal] = useState(false);
  const [osDashboardLink, setOsDashboardLink] = useState<string>(() => {
    if (typeof window === 'undefined') return getLinkUrl(externalLinks, 'os-dashboard-analyst');
    try {
      return localStorage.getItem('os_dashboard_link') || getLinkUrl(externalLinks, 'os-dashboard-analyst');
    } catch {
      return getLinkUrl(externalLinks, 'os-dashboard-analyst');
    }
  });

  const needsCustomerFeedbackData = realDivisionCode === 'OS' && showFilterModal;

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  type GlobalFilters = {
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  };
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    hubs: [],
    branches: lockedBranches ?? [],
    airlines: [],
    categories: [],
  });

  // Date-range and global-filter changes recompute `filteredReports`/`filteredStats`
  // and re-render the chart + table subtree. Marking those state updates as
  // transitions lets React keep the clicked control responsive (better INP)
  // instead of blocking the interaction on the downstream render.
  const [, startFilterTransition] = useTransition();
  const applyDateRange = useCallback(
    (next: typeof dateRange) => startFilterTransition(() => setDateRange(next)),
    []
  );
  const applyGlobalFilters = useCallback<Dispatch<SetStateAction<GlobalFilters>>>(
    (next) => startFilterTransition(() => setGlobalFilters(next)),
    []
  );

  // Full rows are not part of the critical route. They are fetched once the
  // section workspace is actually reached, and the endpoint rejects partial
  // populations before any tab is allowed to calculate.
  const {
    data: completeReports,
    error: completeReportsError,
    isLoading: completeReportsLoading,
    mutate: mutateReports,
  } = useSWR<Report[]>(
    isDashboardView && shouldLoadCompleteReports ? '/api/dashboard/reports' : null,
    fetchCompleteDashboardReports,
    { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
  );
  const reports = useMemo(
    () => completeReports ?? initialReports ?? [],
    [completeReports, initialReports]
  );
  const hasCompleteReports = Array.isArray(completeReports);
  const reportsLoading = shouldLoadCompleteReports && completeReportsLoading;

  // All Reports view uses server-side cursor pagination (50/page, "Load More").
  const {
    reports: pagedReports,
    hasMore: pagedHasMore,
    isLoadingMore: pagedLoadingMore,
    isLoading: pagedLoading,
    loadMore: loadMorePaged,
    refresh: refreshPaged,
    updateReport: updatePagedReport,
  } = useReportsData('/api/admin/reports', {
    enabled: !isScopeLocked && view === 'reports',
    initialPage: null,
  });

  // The previous /api/admin/analytics response was never consumed by the
  // rendered charts and returned 403 for division roles. Do not place it on
  // the critical path.
  const analytics = initialAnalytics ?? null;

  const { data: dashboardsData } = useData<{ dashboards: Array<{ folder?: string | null }> }>(
    needsCustomerFeedbackData ? '/api/dashboards' : null
  );

  const savedDashboards = useMemo(
    () => dashboardsData?.dashboards ?? [],
    [dashboardsData]
  );

  const loading = view === 'reports' && pagedLoading;
  const {
    reports: joumpaReports,
    refresh: refreshJoumpaReports,
    patchReport: patchJoumpaReport,
  } = useJoumpaReports(view === 'reports');

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...(shouldLoadCompleteReports ? [mutateReports()] : []),
        ...(view === 'reports' ? [refreshJoumpaReports()] : []),
        ...(view === 'reports' ? [refreshPaged()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [shouldLoadCompleteReports, view, mutateReports, refreshJoumpaReports, refreshPaged]);

  const handleUpdateStatus = useCallback(async (
    reportId: string,
    status: string,
    notes?: string,
    evidenceUrl?: string,
    details?: StatusUpdateDetails
  ) => {
    const res = await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        action_taken: notes,
        evidence_urls: evidenceUrl ? [evidenceUrl] : undefined,
        kps_remarks: details?.finalRemarks,
        final_remarks: details?.finalRemarks,
        remarks_by: details?.remarksBy,
      }),
    });

    const responsePayload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(responsePayload?.error || 'Failed to update report status');
    }

    const updatedReport = responsePayload?.data as Report | undefined;
    if (updatedReport?.id) {
      await Promise.all([
        mutateReports((current) => mergeReportUpdate(current, updatedReport), false),
        updatePagedReport(updatedReport.id, updatedReport),
        patchJoumpaReport(updatedReport),
      ]);
    }

    await refreshData();
  }, [mutateReports, updatePagedReport, patchJoumpaReport, refreshData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(listSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [listSearch]);

  useEffect(() => {
    if (lockedBranches && lockedBranches.length > 0 && listBranch !== lockedBranches[0]) {
      setListBranch(lockedBranches[0]);
    }
  }, [lockedBranches, listBranch]);

  // Warm the heavy chart chunks as soon as the charts view mounts, in parallel
  // with hydration/data — otherwise they load as a serial waterfall only after
  // the DeferredChartRegion scrolls in (skeleton → OPAnalystCharts chunk →
  // SummaryReportTab chunk), which is the "loading ends, then blank, then the
  // whole tab bar + charts appear at once" gap.
  useEffect(() => {
    if (!isDashboardView) return;
    import('@/components/dashboard/analyst/OPAnalystCharts').catch(() => {});
    import('@/components/dashboard/tabs/SummaryReportTab').catch(() => {});
  }, [isDashboardView]);

  const filterReportsByDateRange = useCallback((list: Report[], range: typeof dateRange) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let cutoffDate: Date;
    let explicitEndDate: Date | null = null;

    if (typeof range === 'object') {
      cutoffDate = new Date(range.from);
      cutoffDate.setHours(0, 0, 0, 0);
      explicitEndDate = new Date(range.to);
      explicitEndDate.setHours(23, 59, 59, 999);
    } else if (range === 'all') {
      cutoffDate = new Date(0);
    } else if (range === 'month') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    }

    const endDate = explicitEndDate || today;

    const safeReports = Array.isArray(list) ? list : [];
    return safeReports.filter((r) => {
      const dateStr = r.date_of_event || r.created_at;
      if (!dateStr) return false;

      let d: Date;
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, day] = dateStr.split('-').map(Number);
        d = new Date(y, m - 1, day);
      } else {
        d = new Date(dateStr);
      }

      return d >= cutoffDate && d <= endDate;
    });
  }, []);

  const filteredReports = useMemo(() => {
    let result = filterReportsByDateRange(reports, dateRange);

    if (lockedBranches && lockedBranches.length > 0) {
      const allowed = new Set(lockedBranches.map((b) => b.toUpperCase()));
      result = result.filter((r) => {
        const branchCode = (r.stations?.code || r.branch || '').toString().toUpperCase();
        return allowed.has(branchCode);
      });
    }

    if (globalFilters.hubs.length > 0) {
      result = result.filter(r => globalFilters.hubs.includes(r.hub || ''));
    }
    if (globalFilters.branches.length > 0) {
      result = result.filter(r => {
        const branchCode = r.stations?.code || r.branch || '';
        return globalFilters.branches.includes(branchCode);
      });
    }
    if (globalFilters.airlines.length > 0) {
      result = result.filter(r => {
        const airlineCode = r.airlines || r.airline || '';
        return globalFilters.airlines.includes(airlineCode);
      });
    }
    if (globalFilters.categories.length > 0) {
      result = result.filter(r => globalFilters.categories.includes(r.main_category || ''));
    }

    return result;
  }, [reports, dateRange, globalFilters, lockedBranches, filterReportsByDateRange]);

  const listGroundReportsDateFiltered = useMemo(
    () => isScopeLocked ? filteredReports : filterReportsByDateRange(pagedReports, dateRange),
    [isScopeLocked, filteredReports, pagedReports, dateRange, filterReportsByDateRange]
  );
  // Filter dropdowns reflect the reports currently loaded in the list view.
  const listFilterSource = listGroundReportsDateFiltered;
  const listFilterOptions = useMemo(() => {
    const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      ...buildReportFilterOptions(listFilterSource),
      hubs: uniqueSorted(listFilterSource.map((report) => cleanReportValue(report.hub) || cleanReportValue(report.kode_hub))),
      categories: uniqueSorted(listFilterSource.map((report) => cleanReportValue(report.main_category) || cleanReportValue(report.category) || cleanReportValue(report.irregularity_complain_category))),
      areas: uniqueSorted(listFilterSource.map((report) => cleanReportValue(report.area) || cleanReportValue(report.specific_location))),
    };
  }, [listFilterSource]);
  const resetListFilters = useCallback(() => {
    setListSearch('');
    setDebouncedSearch('');
    setListFilter('all');
    setListSeverity('all');
    setListStartDate('');
    setListEndDate('');
    setListHub('');
    setListBranch('');
    setListAirline('');
    setListCategory('');
    setListCaseClassification('');
    setListArea('');
    setListSource('all');
  }, []);
  const scopedJoumpaReports = useMemo(() => {
    let result = filterReportsByDateRange(joumpaReports, dateRange);
    if (lockedBranches && lockedBranches.length > 0) {
      const allowed = new Set(lockedBranches.map((b) => b.toUpperCase()));
      result = result.filter((r) => allowed.has((r.stations?.code || r.branch || '').toString().toUpperCase()));
    }
    return result;
  }, [joumpaReports, lockedBranches, dateRange, filterReportsByDateRange]);
  // Ground reports for the list come from the paginated source (server-side
  // cursor pagination), filtered by the header's date range tab.
  const listGroundReports = listGroundReportsDateFiltered;
  const listReportsBase = useMemo(
    () => [...listGroundReports, ...scopedJoumpaReports],
    [listGroundReports, scopedJoumpaReports]
  );
  const listReports = useMemo(() => {
    const s = debouncedSearch.toLowerCase();
    const start = listStartDate ? new Date(`${listStartDate}T00:00:00`) : null;
    const end = listEndDate ? new Date(`${listEndDate}T23:59:59`) : null;
    return listReportsBase.filter(r => {
      if (!matchesReportSource(r, listSource)) return false;
      const reportDate = reportDateValue(r);
      if (start && reportDate && reportDate < start) return false;
      if (end && reportDate && reportDate > end) return false;
      const reportHub = cleanReportValue(r.hub) || cleanReportValue(r.kode_hub);
      const reportCategory = cleanReportValue(r.main_category) || cleanReportValue(r.category) || cleanReportValue(r.irregularity_complain_category);
      const reportArea = cleanReportValue(r.area) || cleanReportValue(r.specific_location);
      if (listHub && reportHub !== listHub) return false;
      if (listBranch && resolveReportBranch(r) !== listBranch) return false;
      if (listAirline && resolveReportAirline(r) !== listAirline) return false;
      if (listCategory && reportCategory !== listCategory) return false;
      if (listCaseClassification && resolveReportCaseClassification(r) !== listCaseClassification) return false;
      if (listArea && reportArea !== listArea) return false;
      if (listFilter !== 'all' && cleanReportValue(r.status).toUpperCase() !== listFilter.toUpperCase()) return false;
      if (!reportMatchesSeverity(r, listSeverity === 'all' ? '' : listSeverity)) return false;
      if (!s) return true;
      const haystack = [
        r.id,
        r.reference_number,
        r.title,
        r.report,
        r.description,
        r.location,
        r.flight_number,
        r.route,
        r.users?.full_name,
        r.reporter_name,
        r.stations?.name,
        r.stations?.code,
        reportHub,
        resolveReportBranch(r),
        resolveReportAirline(r),
        reportCategory,
        resolveReportCaseClassification(r),
        reportArea,
        resolveReportSeverity(r),
        resolveReportSource(r),
      ].map(cleanReportValue).join(' ').toLowerCase();
      return haystack.includes(s);
    });
  }, [
    listReportsBase,
    listSource,
    listStartDate,
    listEndDate,
    listHub,
    listBranch,
    listAirline,
    listCategory,
    listCaseClassification,
    listArea,
    listFilter,
    listSeverity,
    debouncedSearch,
  ]);
  // ponytail: memoized so this element's reference stays stable across
  // unrelated re-renders (e.g. opening the detail dialog), letting
  // ReportsDetailTable's memo() actually skip re-rendering the report list.
  const reportsToolbarFilter = useMemo(() => (
    <ReportFilterBar
      search={listSearch}
      onSearch={setListSearch}
      startDate={listStartDate}
      onStartDate={setListStartDate}
      endDate={listEndDate}
      onEndDate={setListEndDate}
      hub={listHub}
      onHub={setListHub}
      branch={listBranch}
      onBranch={setListBranch}
      airline={listAirline}
      onAirline={setListAirline}
      category={listCategory}
      onCategory={setListCategory}
      caseClassification={listCaseClassification}
      onCaseClassification={setListCaseClassification}
      area={listArea}
      onArea={setListArea}
      status={listFilter}
      onStatus={setListFilter}
      severity={listSeverity}
      onSeverity={setListSeverity}
      options={listFilterOptions}
      totalCount={listReportsBase.length}
      filteredCount={listReports.length}
      refreshing={refreshing}
      onRefresh={refreshData}
      onReset={resetListFilters}
    />
  ), [
    listSearch, listStartDate, listEndDate, listHub, listBranch, listAirline,
    listCategory, listCaseClassification, listArea, listFilter, listSeverity,
    listFilterOptions, listReportsBase.length, listReports.length, refreshing,
    refreshData, resetListFilters,
  ]);
  const setView = useCallback(
    (nextView: DashboardView) => {
      const basePath = `/dashboard/${division.code.toLowerCase()}`;
      const sp = new URLSearchParams(searchParams.toString());

      if (nextView === 'reports') {
        sp.set('view', 'reports');
      } else {
        sp.delete('view');
      }

      const query = sp.toString();
      router.push(query ? `${basePath}?${query}` : basePath);
    },
    [division.code, router, searchParams]
  );

  const filteredStats = useMemo(() => {
    const overviewMatchesFilters = Boolean(initialOverview)
      && dateRange === 'all'
      && globalFilters.hubs.length === 0
      && globalFilters.airlines.length === 0
      && globalFilters.categories.length === 0
      && (
        globalFilters.branches.length === 0
        || globalFilters.branches.every((branch) => lockedBranches?.includes(branch))
      );
    if (!hasCompleteReports && overviewMatchesFilters) return initialOverview!.summary;

    const total = filteredReports.length;
    const resolved = filteredReports.filter((r) => cleanReportValue(r.status).toUpperCase() === 'CLOSED').length;
    const pending = filteredReports.filter(
      (r) => cleanReportValue(r.status).toUpperCase() === 'OPEN'
    ).length;
    const highSeverity = filteredReports.filter((r) => {
      const severity = cleanReportValue(r.severity || r.severity_level).toUpperCase();
      return severity === 'TOP RISK' || severity === 'HIGH RISK';
    }).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const years = Array.from(
      new Set(
        filteredReports
          .map((r) => {
            const d = reportDateValue(r);
            return d ? new Date(d).getFullYear() : null;
          })
          .filter((y): y is number => y !== null && !Number.isNaN(y))
      )
    ).sort((a, b) => a - b);
    return { total, resolved, pending, highSeverity, resolutionRate, years };
  }, [dateRange, filteredReports, globalFilters, hasCompleteReports, initialOverview, lockedBranches]);

  const drilldownUrl = (type: string, value: string) =>
    `/dashboard/analyst/drilldown?type=${type}&value=${encodeURIComponent(
      value
    )}&period=${dateRange}`;

  const availableOptions = useMemo(() => {
    if (!hasCompleteReports && initialOverview) return initialOverview.filterOptions;

    const hubs = new Set<string>();
    const branches = new Set<string>();
    const airlines = new Set<string>();
    const categories = new Set<string>();

    (Array.isArray(reports) ? reports : []).forEach((r) => {
      if (r.hub) hubs.add(r.hub);
      if (r.stations?.code) branches.add(r.stations.code);
      else if (r.branch) branches.add(r.branch);
      if (r.airlines) airlines.add(r.airlines);
      else if (r.airline) airlines.add(r.airline);
      if (r.main_category) categories.add(r.main_category);
    });

    return {
      hubs: Array.from(hubs).sort(),
      branches: Array.from(branches).sort(),
      airlines: Array.from(airlines).sort(),
      categories: Array.from(categories).sort(),
    };
  }, [hasCompleteReports, initialOverview, reports]);

  const handleCustomerFeedbackShortcut = useCallback(async () => {
    setCfLoading(true);
    try {
      const cachedSlug = localStorage.getItem('cf_dashboard_slug');

      if (cachedSlug) {
        const checkRes = await fetch(`/api/dashboards?slug=${cachedSlug}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.dashboards?.length > 0) {
            router.push(`/embed/custom/${cachedSlug}`);
            return;
          }
        }
        localStorage.removeItem('cf_dashboard_slug');
      }

      const res = await fetch('/api/dashboards/customer-feedback-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to generate dashboard');

      const data = await res.json();
      if (data.dashboard?.slug) {
        localStorage.setItem('cf_dashboard_slug', data.dashboard.slug);
        router.push(`/embed/custom/${data.dashboard.slug}`);
      } else {
        throw new Error('No slug returned');
      }
    } catch (err) {
      console.error('Customer Feedback shortcut error:', err);
      alert('Failed to open Customer Feedback Dashboard. Please try again.');
    } finally {
      setCfLoading(false);
    }
  }, [router]);

  const existingFolders = useMemo(
    () =>
      Array.from(
        new Set(
          savedDashboards
            .map((d) => d.folder)
            .filter((f): f is string => !!f)
        )
      ),
    [savedDashboards]
  );

  const handleApplyFilter = async (filterData: unknown) => {
    setFilterLoading(true);
    try {
      const res = await fetch('/api/dashboards/customer-feedback-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterData),
      });

      if (!res.ok) throw new Error('Failed to generate dashboard');

      const data = await res.json();
      if (data.dashboard?.slug) {
        router.push(`/embed/custom/${data.dashboard.slug}`);
      }
    } catch (err) {
      console.error('Filter apply error:', err);
      alert('Failed to apply filter');
    } finally {
      setFilterLoading(false);
      setShowFilterModal(false);
    }
  };

  const exportToExcel = async () => {
    setShowReportsExportModal(true);
  };

  const exportToPDF = async () => {
    setShowReportsExportModal(true);
  };

  const [pendingStatClick, setPendingStatClick] = useState<string | null>(null);

  const runStatClick = useCallback((type: string) => {
    const open = (items: Report[], title: string) => {
      openDrilldown(items, title);
    };

    switch (type) {
      case 'total':
        open(filteredReports, 'Total Reports All Years');
        break;
      case 'resolved':
        open(filteredReports.filter((report) => cleanReportValue(report.status).toUpperCase() === 'CLOSED'), 'Closed Reports');
        break;
      case 'pending':
        open(filteredReports.filter((report) => cleanReportValue(report.status).toUpperCase() === 'OPEN'), 'Open Reports');
        break;
      case 'high':
        open(
          filteredReports.filter((report) => {
            const severity = cleanReportValue(report.severity || report.severity_level).toUpperCase();
            return severity === 'TOP RISK' || severity === 'HIGH RISK';
          }),
          'Top Risk & High Risk Reports'
        );
        break;
    }
  }, [filteredReports, openDrilldown]);

  const handleStatClick = (type: string) => {
    if (!hasCompleteReports) {
      setPendingStatClick(type);
      setShouldLoadCompleteReports(true);
      return;
    }
    runStatClick(type);
  };

  useEffect(() => {
    if (hasCompleteReports && pendingStatClick) {
      runStatClick(pendingStatClick);
      setPendingStatClick(null);
    }
  }, [hasCompleteReports, pendingStatClick, runStatClick]);

  const isOpDivision = division.code === 'OP';
  // ANALYST reuses this component (previously it was routed through
  // OPDashboardClient, which hardcoded division={DIVISIONS.OP} and leaked
  // "Operations Division" copy onto the Analyst dashboard). Give it the same
  // executive header treatment as OP, but with its own copy.
  const isExecutiveDivision = isOpDivision || division.code === 'ANALYST';

  if (loading) {
    return (
      <DashboardWorkspaceSkeleton
        title={`Preparing ${division.name} dashboard`}
        subtitle="Loading above-the-fold analytics with reserved layout slots."
      />
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `
          linear-gradient(oklch(0.65 0.18 160 / 0.03) 1px, transparent 1px),
          linear-gradient(90deg, oklch(0.65 0.18 160 / 0.03) 1px, transparent 1px),
          radial-gradient(circle at 0% 0%, oklch(0.65 0.18 160 / 0.08) 0%, transparent 40%),
          radial-gradient(circle at 100% 100%, oklch(0.58 0.2 162 / 0.06) 0%, transparent 40%)
        `,
        backgroundSize: '24px 24px, 24px 24px, 100% 100%, 100% 100%',
        backgroundPosition: '0 0, 0 0, 0 0, 0 0',
        backgroundColor: 'var(--surface-0)',
      }}
    >
      <div className="space-y-4 sm:space-y-6 md:space-y-8 pb-24 pt-0 px-3 sm:px-4 md:px-6 w-full max-w-none min-w-0 overflow-x-hidden">
        <PresentationSlide className="!p-3 sm:!p-4 md:!p-5 !min-h-0 !bg-[var(--surface-1)] !shadow-sm !border !border-[var(--surface-3)] rounded-xl sm:rounded-2xl md:rounded-[24px] !overflow-visible">
          <ResponsiveHeader
            dateRange={dateRange}
            onDateRangeChange={applyDateRange}
            onRefresh={refreshData}
            refreshing={refreshing}
            onCustomerFeedback={realDivisionCode === 'OS' ? handleCustomerFeedbackShortcut : undefined}
            cfLoading={realDivisionCode === 'OS' ? cfLoading : false}
            onFilterClick={realDivisionCode === 'OS' ? () => setShowFilterModal(true) : undefined}
            onExportExcel={exportToExcel}
            onExportPDF={exportToPDF}
            exporting={null}
            divisionDashboardActions={undefined}
            onSwitchDivision={() => router.push('/dashboard/eskalasi/select')}
            variant={isExecutiveDivision && !isScopeLocked ? 'op-executive' : 'default'}
            title={
              isScopeLocked
                ? `Station Reports — ${lockedBranches![0]}`
                : isExecutiveDivision
                  ? 'Analytics Center'
                  : undefined
            }
            subtitle={
              isScopeLocked
                ? 'Reports for your assigned station only'
                : isExecutiveDivision
                  ? isOpDivision
                    ? 'Operational summary and quick access for Operations Division'
                    : 'Company-wide analytics and reporting overview'
                  : undefined
            }
            activeView={undefined}
            onViewChange={undefined}
          />
          {!isExecutiveDivision && !forceView && (
            <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => setView('reports')}
                aria-label="View all reports"
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 ${view === 'reports' ? 'bg-[var(--brand-primary)] text-[var(--text-on-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'}`}
              >
                <span className="truncate max-w-[140px] sm:max-w-none">All Reports</span>
              </button>
            </div>
          )}
          {view === 'dashboard' && realDivisionCode === 'OS' && (
            <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => window.open(getLinkUrl(externalLinks, 'analyst-joumpa'), '_blank', 'noopener,noreferrer')}
                aria-label="Open JOUMPA Dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                <span>JOUMPA</span>
              </button>
              <button
                onClick={() => setShowOSDashboardModal(true)}
                aria-label="Open OS Dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              >
                <LinkIcon size={14} aria-hidden="true" />
                <span>OS Dashboard</span>
              </button>
              <button
                onClick={() => window.open(getLinkUrl(externalLinks, 'analyst-op-weekly'), '_blank')}
                aria-label="Open Survey Dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <span>Survey</span>
              </button>
              <button
                onClick={() => window.open(getLinkUrl(externalLinks, 'analyst-sla-dashboard'), '_blank', 'noopener,noreferrer')}
                aria-label="Open SLA Dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                <span>SLA</span>
              </button>
              <button
                onClick={() => router.push('/dashboard/ocs/wsn')}
                aria-label="Open WSN Dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><path d="M14 3h7v5h-7z"/><path d="M14 12h7v9h-7z"/></svg>
                <span>WSN</span>
              </button>
              {realDivisionCode === 'OS' && (
                <button
                  onClick={() => window.open(getLinkUrl(externalLinks, 'analyst-branch-perf'), '_blank')}
                  aria-label="About OS"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shadow-sm hover:shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h3.5a2 2 0 0 1 1.4.6L12 5"/></svg>
                  <span>About OS</span>
                </button>
              )}
            </div>
          )}
        </PresentationSlide>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-2">
              <PresentationSlide className="!p-0 !min-h-0 !bg-transparent !shadow-none !border-0">
                <ResponsiveStatsGrid
                  stats={filteredStats}
                  onStatClick={handleStatClick}
                  compact
                />
              </PresentationSlide>
            </div>
            <div className="lg:col-span-3">
              <ReportsTableSection
                reports={filteredReports}
                dateRange={dateRange}
                onViewReport={setSelectedReport}
                drilldownUrl={drilldownUrl}
              />
            </div>
          </div>
        )}
        {view === 'reports' && (
          <div className="max-w-[1700px] mx-auto w-full">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full animate-pulse bg-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Report List</h2>
              </div>
              <p className="text-xs font-bold text-[var(--text-muted)] bg-[var(--surface-3)] px-3 py-1 rounded-full uppercase tracking-tighter">
                <span className="font-mono tabular-nums">{listReports.length}</span> reports
              </p>
            </div>
            <div className="mb-4">
              <ReportSourceToggle value={listSource} onChange={setListSource} />
            </div>
            <ReportsDetailTable
              reports={listReports}
              onReportClick={setSelectedReport}
              onStatusUpdate={isScopeLocked ? undefined : handleUpdateStatus}
              loading={loading || refreshing}
              fullHeight
              toolbarFilter={reportsToolbarFilter}
            />
            {!isScopeLocked && pagedHasMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => { void loadMorePaged(); }}
                  disabled={pagedLoadingMore}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--surface-4)] bg-white px-6 py-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition-all hover:shadow-md hover:bg-[var(--surface-2)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  {pagedLoadingMore ? 'Loading…' : 'Load More Reports'}
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'dashboard' && (
          <DeferredChartRegion onVisible={() => setShouldLoadCompleteReports(true)}>
            {completeReportsError ? (
              <section role="alert" className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center text-sm font-semibold text-red-700">
                Complete report data could not be loaded. No partial section totals are shown.
                <button
                  type="button"
                  onClick={() => { void mutateReports(); }}
                  className="ml-3 rounded-xl bg-red-700 px-4 py-2 text-white"
                >
                  Retry
                </button>
              </section>
            ) : reportsLoading || !hasCompleteReports ? (
              <section aria-label="Loading complete report calculations" className="min-h-[40vh] rounded-[28px] border border-[var(--surface-3)] bg-[var(--surface-1)] p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[var(--surface-4)] border-t-[var(--brand-primary)]" />
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">Calculating every eligible report…</p>
                </div>
              </section>
            ) : (
              <ChartSection
                division={division}
                filteredReports={filteredReports}
                reports={reports}
                analytics={analytics}
                globalFilters={globalFilters}
                setGlobalFilters={applyGlobalFilters}
                availableOptions={availableOptions}
                drilldownUrl={drilldownUrl}
                onDrilldown={(url) => router.push(url)}
              />
            )}
          </DeferredChartRegion>
        )}

        {division.code === 'OP' && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleScrollToTop}
              aria-label="Back to top"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--surface-4)] bg-white px-5 py-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition-all hover:shadow-md hover:bg-[var(--surface-2)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <ChevronUp size={18} />
              <span>Back to Top</span>
            </button>
          </div>
        )}

        {showOSDashboardModal && (
          <DashboardLinkModals
            showOS
            osLink={osDashboardLink}
            onOsLinkChange={setOsDashboardLink}
            onCloseOS={() => setShowOSDashboardModal(false)}
            onSaveOS={() => {
              try { localStorage.setItem('os_dashboard_link', osDashboardLink); } catch {}
              setShowOSDashboardModal(false);
            }}
            onResetOS={() => {
              setOsDashboardLink(getLinkUrl(externalLinks, 'os-dashboard-analyst'));
            }}
          />
        )}

        {selectedReport && (
          <ReportDetailModal
            isOpen
            onClose={() => setSelectedReport(null)}
            report={selectedReport}
            userRole={`DIVISI_${division.code}` as UserRole}
            onUpdateStatus={handleUpdateStatus}
            onRefresh={refreshData}
          />
        )}

        {showFilterModal && (
          <CustomerFeedbackFilterModal
            isOpen
            onClose={() => setShowFilterModal(false)}
            onApply={handleApplyFilter}
            loading={filterLoading}
            availableHubs={availableOptions.hubs}
            availableBranches={availableOptions.branches}
            availableAirlines={availableOptions.airlines}
            availableCategories={availableOptions.categories}
            existingFolders={existingFolders}
          />
        )}

        {showReportsExportModal && (
          <ReportsExportModal
            open
            reports={filteredReports.length > 0 ? filteredReports : reports}
            onClose={() => setShowReportsExportModal(false)}
          />
        )}

        <DrilldownRenderer />

      </div>
    </div>
  );
}
