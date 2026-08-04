'use client';

import dynamic from 'next/dynamic';

const PublicReportWizard = dynamic(
  () => import('@/components/public-report/PublicReportWizard').then((mod) => mod.PublicReportWizard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-[oklch(0.40_0.02_200)]">Loading report wizard...</p>
        </div>
      </div>
    ),
  },
);

export function PublicReportLoader() {
  return <PublicReportWizard />;
}
