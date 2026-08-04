'use client';

import { DivisionAnalystDashboard } from '@/components/dashboard/DivisionAnalystDashboard';
import { DIVISIONS } from '@/lib/constants/divisions';
import type { DashboardOverview } from '@/lib/dashboard/contracts';
import type { Report, AnalyticsData } from '@/types';

interface OPDashboardClientProps {
  initialReports?: Report[];
  initialAnalytics?: AnalyticsData | null;
  initialOverview?: DashboardOverview;
  lockedBranches?: string[];
}

export function OPDashboardClient({ initialReports, initialAnalytics, initialOverview, lockedBranches }: OPDashboardClientProps) {
  return (
    <DivisionAnalystDashboard
      division={DIVISIONS.OP}
      initialReports={initialReports}
      initialAnalytics={initialAnalytics}
      initialOverview={initialOverview}
      lockedBranches={lockedBranches}
    />
  );
}
