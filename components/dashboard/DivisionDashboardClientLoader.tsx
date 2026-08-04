'use client';

import dynamic from 'next/dynamic';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';
import type { DashboardOverview } from '@/lib/dashboard/contracts';
import type { Report } from '@/types';

const DivisionAnalystDashboard = dynamic(
  () => import('@/components/dashboard/DivisionAnalystDashboard').then((mod) => mod.DivisionAnalystDashboard),
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

interface DivisionDashboardClientLoaderProps {
  division: DivisionConfig;
  initialReports?: Report[];
  initialOverview?: DashboardOverview;
  lockedBranches?: string[];
}

export function DivisionDashboardClientLoader({
  division,
  initialReports,
  initialOverview,
  lockedBranches,
}: DivisionDashboardClientLoaderProps) {
  return (
    <DivisionAnalystDashboard
      division={division}
      initialReports={initialReports}
      initialOverview={initialOverview}
      lockedBranches={lockedBranches}
    />
  );
}
