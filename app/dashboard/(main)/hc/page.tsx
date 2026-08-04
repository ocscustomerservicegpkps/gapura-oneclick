'use client';

import dynamic from 'next/dynamic';
import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

const AnalystDocumentManagementPage = dynamic(
    () => import('@/components/analyst/AnalystDocumentManagementPage').then((m) => m.AnalystDocumentManagementPage),
    {
        ssr: false,
        loading: () => (
            <DashboardWorkspaceSkeleton
                title="Circulars & Socialization Materials"
                subtitle="Loading documents, filters, and audience controls."
            />
        ),
    }
);

export default function HCHomePage() {
    return <AnalystDocumentManagementPage division="HC" />;
}
