'use client';

import { useParams } from 'next/navigation';
import { AppleReportPage } from '@/components/dashboard/AppleReportPage';

export default function AdminReportDetailPage() {
    const params = useParams();
    return (
        <AppleReportPage
            reportId={params.id as string}
            backTo="/dashboard/admin/reports"
            divisionColor="#0f7c7c"
        />
    );
}
