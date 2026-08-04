'use client';

import { useParams } from 'next/navigation';
import { AppleReportPage } from '@/components/dashboard/AppleReportPage';

export default function AnalystReportDetailPage() {
    const params = useParams();
    return (
        <AppleReportPage
            reportId={params.id as string}
            backTo="/dashboard/analyst/reports"
            divisionColor="#10b981"
        />
    );
}
