'use client';

import dynamic from 'next/dynamic';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

const EskalasiDocumentsViewerPage = dynamic(
    () => import('@/components/analyst/EskalasiDocumentsViewerPage').then((m) => m.EskalasiDocumentsViewerPage),
    {
        ssr: false,
        loading: () => (
            <DashboardWorkspaceSkeleton
                title="Circulars & Materials"
                subtitle="Loading all documents uploaded by the analyst team."
            />
        ),
    }
);

export default function EskalasiDocumentsPage() {
    return <EskalasiDocumentsViewerPage />;
}
