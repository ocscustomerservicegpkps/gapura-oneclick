'use client';

import dynamic from 'next/dynamic';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

const PerformanceLinksManagementPage = dynamic(
    () => import('@/components/analyst/PerformanceLinksManagementPage').then((m) => m.PerformanceLinksManagementPage),
    {
        ssr: false,
        loading: () => (
            <DashboardWorkspaceSkeleton
                title="Performance Links"
                subtitle="Loading links and QR codes."
            />
        ),
    }
);

export default function AnalystPerformanceLinksPage() {
    return <PerformanceLinksManagementPage />;
}
