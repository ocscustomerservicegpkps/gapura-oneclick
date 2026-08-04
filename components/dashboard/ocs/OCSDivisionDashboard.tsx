"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useData } from '@/lib/swr';
import { ChevronUp } from 'lucide-react';

import { ResponsiveHeader } from '@/components/dashboard/analyst/ResponsiveHeader';
import { ReportFilterBar } from '@/components/dashboard/analyst/ReportFilterBar';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { type StatusUpdateDetails } from '@/components/dashboard/ReportDetailView';

import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { useJoumpaReports } from '@/lib/hooks/useJoumpaReports';
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
import type { Report, UserRole } from '@/types';
import { fetchCompleteDashboardReports } from '@/lib/dashboard/client';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';

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

const OCSRecordsTabs = dynamic(
  () => import('@/components/dashboard/ocs/OCSRecordsTabs'),
  { ssr: false }
);

const OCSQuickLinkCards = dynamic(
  () => import('@/components/dashboard/ocs/OCSQuickLinkCards'),
  { ssr: false }
);

interface OCSDivisionDashboardProps {
  division: DivisionConfig;
}

type DashboardView = 'dashboard' | 'reports';

export function OCSDivisionDashboard({
  division,
  initialReports,
  lockedBranches,
  forceView,
}: OCSDivisionDashboardProps & {
  initialReports?: Report[];

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

  const [refreshing, setRefreshing] = useState(false);
  const [exporting] = useState<'excel' | 'pdf' | null>(null);
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
  const [osDashboardLink, setOsDashboardLink] = useState<string>(getLinkUrl(externalLinks, 'os-dashboard-analyst'));

  const needsCustomerFeedbackData = (division.code === 'OCS' || division.code === 'ANALYST') && showFilterModal;

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [globalFilters] = useState<{
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  }>({
    hubs: [],
    branches: lockedBranches ?? [],
    airlines: [],
    categories: [],
  });

  // OCS renders quick links + records tabs on the dashboard view — it needs no
  // KPI/chart calculations there. The complete report collection is only needed
  // for the report list and the on-intent filter/export modals, so it stays off
  // the initial critical path. The endpoint rejects partial populations.
  const needReports = view === 'reports' || showFilterModal || showReportsExportModal;
  const {
    data: completeReports,
    error: completeReportsError,
    isLoading: completeReportsLoading,
    mutate: mutateReports,
  } = useSWR<Report[]>(
    needReports ? '/api/dashboard/reports' : null,
    fetchCompleteDashboardReports,
    { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
  );
  const reports = useMemo(
    () => completeReports ?? initialReports ?? [],
    [completeReports, initialReports]
  );
  const hasCompleteReports = Array.isArray(completeReports);
  const reportsLoading = needReports && completeReportsLoading && !hasCompleteReports;

  const { data: dashboardsData } = useData<{ dashboards: Array<{ folder?: string | null }> }>(
    needsCustomerFeedbackData ? '/api/dashboards' : null
  );

  const savedDashboards = useMemo(
    () => dashboardsData?.dashboards ?? [],
    [dashboardsData]
  );

  // The former /api/admin/analytics response was never consumed by OCS and is
  // not on the critical path.
  const loading = view === 'reports' && reportsLoading;
  const {
    reports: joumpaReports,
    refresh: refreshJoumpaReports,
    patchReport: patchJoumpaReport,
  } = useJoumpaReports(needReports);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...(needReports ? [mutateReports(), refreshJoumpaReports()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [needReports, mutateReports, refreshJoumpaReports]);

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
        patchJoumpaReport(updatedReport),
      ]);
    }

    await refreshData();
  }, [mutateReports, patchJoumpaReport, refreshData]);

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

  const filteredReports = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let cutoffDate: Date;
    let explicitEndDate: Date | null = null;

    if (typeof dateRange === 'object') {
      cutoffDate = new Date(dateRange.from);
      cutoffDate.setHours(0, 0, 0, 0);
      explicitEndDate = new Date(dateRange.to);
      explicitEndDate.setHours(23, 59, 59, 999);
    } else if (dateRange === 'all') {
      cutoffDate = new Date(0);
    } else if (dateRange === 'month') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    }

    const endDate = explicitEndDate || today;

    const safeReports = Array.isArray(reports) ? reports : [];
    const base = safeReports.filter((r) => {
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

    let result = base;

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
  }, [reports, dateRange, globalFilters, lockedBranches]);
  const listFilterOptions = useMemo(() => {
    const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      ...buildReportFilterOptions(filteredReports),
      hubs: uniqueSorted(filteredReports.map((report) => cleanReportValue(report.hub) || cleanReportValue(report.kode_hub))),
      categories: uniqueSorted(filteredReports.map((report) => cleanReportValue(report.main_category) || cleanReportValue(report.category) || cleanReportValue(report.irregularity_complain_category))),
      areas: uniqueSorted(filteredReports.map((report) => cleanReportValue(report.area) || cleanReportValue(report.specific_location))),
    };
  }, [filteredReports]);
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
    if (!lockedBranches || lockedBranches.length === 0) return joumpaReports;
    const allowed = new Set(lockedBranches.map((b) => b.toUpperCase()));
    return joumpaReports.filter((r) => allowed.has((r.stations?.code || r.branch || '').toString().toUpperCase()));
  }, [joumpaReports, lockedBranches]);
  const listReportsBase = useMemo(
    () => [...filteredReports, ...scopedJoumpaReports],
    [filteredReports, scopedJoumpaReports]
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

  const availableOptions = useMemo(() => {
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
  }, [reports]);

  const handleCustomerFeedbackShortcut = useCallback(async () => {
    setCfLoading(true);
    try {
      const cachedSlug = localStorage.getItem('cf_dashboard_slug');

      if (cachedSlug) {
        const checkRes = await fetch(`/api/dashboards?slug=${encodeURIComponent(cachedSlug)}`);
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

  const handleStatClick = (type: string) => {
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
  };

  const isOpDivision = division.code === 'OP';

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
            onDateRangeChange={setDateRange}
            onRefresh={refreshData}
            refreshing={refreshing}
            onCustomerFeedback={division.code === 'OCS' || division.code === 'ANALYST' ? handleCustomerFeedbackShortcut : undefined}
            cfLoading={division.code === 'OCS' || division.code === 'ANALYST' ? cfLoading : false}
            onFilterClick={division.code === 'OCS' || division.code === 'ANALYST' ? () => setShowFilterModal(true) : undefined}
            onExportExcel={exportToExcel}
            onExportPDF={exportToPDF}
            exporting={exporting}
            divisionDashboardActions={undefined}
            onSwitchDivision={() => router.push('/dashboard/eskalasi/select')}
            variant={isOpDivision && !isScopeLocked ? 'op-executive' : 'default'}
            title={isOpDivision && !isScopeLocked ? 'Analytics Center' : division.code === 'OCS' ? 'Customer Service Division Report' : undefined}
            subtitle={isOpDivision && !isScopeLocked ? 'Operational summary and quick access for Operations Division' : division.code === 'OCS' ? 'Customer Service Division' : undefined}
            activeView={undefined}
            onViewChange={undefined}
            hideDateRangeSelector={division.code === 'OCS'}
            createReportHref={view === 'dashboard' ? '/dashboard/employee/new?type=joumpa' : '/dashboard/employee/new?type=irregularity'}
          />
          {!isOpDivision && !forceView && division.code !== 'OCS' && (
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
        </PresentationSlide>

        {view === 'dashboard' && (division.code === 'OCS' || division.code === 'ANALYST') && (
          <OCSQuickLinkCards />
        )}
        {view === 'reports' && (
          <div className="max-w-[1700px] mx-auto w-full">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full animate-pulse bg-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Report List</h2>
              </div>
              <p className="text-xs font-bold text-[var(--text-muted)] bg-[var(--surface-3)] px-3 py-1 rounded-full uppercase tracking-tighter">
                {listReports.length} reports
              </p>
            </div>
            <div className="mb-4">
              <ReportSourceToggle value={listSource} onChange={setListSource} />
            </div>
            {completeReportsError ? (
              <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
                Complete report data could not be loaded. No partial list is shown.
                <button
                  type="button"
                  onClick={() => { void mutateReports(); }}
                  className="ml-3 rounded-xl bg-red-700 px-4 py-2 text-white"
                >
                  Retry
                </button>
              </section>
            ) : (
              <ReportsDetailTable
                reports={listReports}
                onReportClick={setSelectedReport}
                onStatusUpdate={isScopeLocked ? undefined : handleUpdateStatus}
                loading={loading || refreshing}
                fullHeight
                toolbarFilter={reportsToolbarFilter}
              />
            )}
          </div>
        )}

        {view === 'dashboard' && <OCSRecordsTabs />}

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

        <DashboardLinkModals
          showOS={showOSDashboardModal}
          osLink={osDashboardLink}
          onOsLinkChange={setOsDashboardLink}
          onCloseOS={() => setShowOSDashboardModal(false)}
          onSaveOS={() => {
            try { localStorage.setItem('os_dashboard_link', osDashboardLink); } catch {}
            setShowOSDashboardModal(false);
          }}
          onResetOS={() => {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('os_dashboard_link') : null;
            setOsDashboardLink(saved || getLinkUrl(externalLinks, 'os-dashboard-analyst'));
          }}
        />

        <ReportDetailModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          report={selectedReport}
          userRole={`DIVISI_${division.code}` as UserRole}
          onUpdateStatus={handleUpdateStatus}
          onRefresh={refreshData}
        />

        <CustomerFeedbackFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={handleApplyFilter}
          loading={filterLoading}
          availableHubs={availableOptions.hubs}
          availableBranches={availableOptions.branches}
          availableAirlines={availableOptions.airlines}
          availableCategories={availableOptions.categories}
          existingFolders={existingFolders}
        />

        <ReportsExportModal
          open={showReportsExportModal}
          reports={filteredReports.length > 0 ? filteredReports : reports}
          onClose={() => setShowReportsExportModal(false)}
        />

        <DrilldownRenderer />

      </div>
    </div>
  );
}
