'use client';

import dynamic from 'next/dynamic';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

const PerformanceLinksViewerPage = dynamic(
    () => import('@/components/analyst/PerformanceLinksViewerPage').then((m) => m.PerformanceLinksViewerPage),
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

export default function EskalasiPerformanceLinksPage() {
    return <PerformanceLinksViewerPage />;
}
