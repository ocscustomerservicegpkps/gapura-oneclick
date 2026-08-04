'use client';

// ponytail: OCS owns an independent dashboard copy (OCSDivisionDashboard) so it is
// fully decoupled from OS and from the shared DivisionAnalystDashboard (OP/analyst).
import dynamic from 'next/dynamic';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';
import type { Report } from '@/types';

const OCSDivisionDashboard = dynamic(
  () => import('@/components/dashboard/ocs/OCSDivisionDashboard').then((mod) => mod.OCSDivisionDashboard),
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

interface OCSDivisionDashboardClientLoaderProps {
  division: DivisionConfig;
  initialReports?: Report[];
  lockedBranches?: string[];
}

export function OCSDivisionDashboardClientLoader({ division, initialReports, lockedBranches }: OCSDivisionDashboardClientLoaderProps) {
  return <OCSDivisionDashboard division={division} initialReports={initialReports} lockedBranches={lockedBranches} />;
}
