'use client';

// ponytail: OS is an independent copy of OCS. It loads its own orchestrator
// (OSDivisionDashboard) so future edits to OCS's shared dashboard don't touch OS.
import dynamic from 'next/dynamic';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';
import type { DashboardOverview } from '@/lib/dashboard/contracts';
import type { Report } from '@/types';

const OSDivisionDashboard = dynamic(
  () => import('@/components/dashboard/os/OSDivisionDashboard').then((mod) => mod.OSDivisionDashboard),
  {
    ssr: false,
    loading: () => (
      <DashboardWorkspaceSkeleton
        title="Preparing dashboard"
        subtitle="Loading analytics data, trends, and latest reports"
      />
    ),
  }
);

interface OSDivisionDashboardClientLoaderProps {
  division: DivisionConfig;
  initialReports?: Report[];
  initialOverview?: DashboardOverview;
  lockedBranches?: string[];
}

export function OSDivisionDashboardClientLoader({ division, initialReports, initialOverview, lockedBranches }: OSDivisionDashboardClientLoaderProps) {
  return (
    <OSDivisionDashboard
      division={division}
      initialReports={initialReports}
      initialOverview={initialOverview}
      lockedBranches={lockedBranches}
    />
  );
}
