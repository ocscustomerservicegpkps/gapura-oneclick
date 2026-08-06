'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ALL_TABS, SHARE_TAB_LABELS } from '@/lib/share/types';
import type { PublicShareData } from '@/lib/share/public-data';
import type { OcsRecord, OcsRecordsTab } from '@/components/dashboard/ocs/OCSRecordsTabs';
import type { Report } from '@/types';

// Read-only workspaces, loaded lazily — same components the authenticated
// dashboards render, driven by the publish-time scope instead of live UI state.
const AnalystCharts = dynamic(
  () => import('@/components/dashboard/analyst/AnalystCharts'),
  { ssr: false, loading: () => <ShareLoading /> }
);
const OCSRecordsTabs = dynamic(
  () => import('@/components/dashboard/ocs/OCSRecordsTabs'),
  { ssr: false, loading: () => <ShareLoading /> }
);

function ShareLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--surface-4)] border-t-[var(--brand-primary)]" />
    </div>
  );
}

export function PublicShareView({ data }: { data: PublicShareData }) {
  const { dashboardKey, tab, name, scope, reports, joumpaReports, ocsRecords, availableOptions } = data;

  const globalFilters = useMemo(
    () => ({
      hubs: scope.hubs,
      branches: scope.stations,
      airlines: scope.airlines,
      categories: scope.categories,
    }),
    [scope],
  );

  const title = name || SHARE_TAB_LABELS[tab] || 'Shared Dashboard';
  const isWholeDashboard = tab === ALL_TABS;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-black tracking-tight text-[var(--text-primary)] sm:text-2xl">
          {title}
        </h1>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {isWholeDashboard ? 'All sections' : SHARE_TAB_LABELS[tab] || 'Dashboard'}
          {' · '}Read-only view
        </p>
      </header>

      {dashboardKey === 'ocs' ? (
        <OCSRecordsTabs
          readOnly
          lockedTab={tab === ALL_TABS ? null : (tab as OcsRecordsTab)}
          initialRecords={ocsRecords as OcsRecord[]}
        />
      ) : (
        <AnalystCharts
          readOnly
          lockedTab={tab === ALL_TABS ? null : tab}
          filteredReports={reports as Report[]}
          joumpaReports={joumpaReports as Report[]}
          globalFilters={globalFilters}
          setGlobalFilters={() => {}}
          availableOptions={availableOptions}
          showDelayCodeTab={dashboardKey === 'op'}
        />
      )}
    </div>
  );
}
