'use client';

import { useParams } from 'next/navigation';
import { AppleReportPage } from '@/components/dashboard/AppleReportPage';

export default function OSReportDetailPage() {
    const params = useParams();
    return (
        <AppleReportPage
            reportId={params.id as string}
            backTo="/dashboard/os/reports"
            divisionColor="#f59e0b"
        />
    );
}
