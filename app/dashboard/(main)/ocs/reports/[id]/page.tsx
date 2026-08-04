'use client';

import { useParams } from 'next/navigation';
import { AppleReportPage } from '@/components/dashboard/AppleReportPage';

export default function OCSReportDetailPage() {
    const params = useParams();
    return (
        <AppleReportPage
            reportId={params.id as string}
            backTo="/dashboard/ocs/reports"
            divisionColor="#6366f1"
        />
    );
}
