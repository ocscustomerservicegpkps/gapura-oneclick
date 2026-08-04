'use client';

import dynamic from 'next/dynamic';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

const EskalasiDocumentsViewerPage = dynamic(
    () => import('@/components/analyst/EskalasiDocumentsViewerPage').then((m) => m.EskalasiDocumentsViewerPage),
    {
        ssr: false,
        loading: () => (
            <DashboardWorkspaceSkeleton
                title="Document Meeting"
                subtitle="Loading meeting records for your branch."
            />
        ),
    }
);

export default function EmployeeDocumentsPage() {
    return <EskalasiDocumentsViewerPage hideNav />;
}
