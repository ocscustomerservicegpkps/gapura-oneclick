
'use client';

import dynamic from 'next/dynamic';

const DivisionAIReportsDashboard = dynamic(
  () => import('@/components/dashboard/ai-reports/DivisionAIReportsDashboard'),
  { loading: () => <div className="h-96 animate-pulse bg-gray-100 rounded-xl" /> }
);

export default function HTAIReportsPage() {
    return <DivisionAIReportsDashboard division="HT" />;
}
