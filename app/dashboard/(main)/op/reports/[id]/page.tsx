'use client';

import { useParams } from 'next/navigation';
import { AppleReportPage } from '@/components/dashboard/AppleReportPage';

export default function OPReportDetailPage() {
    const params = useParams();
    return (
        <AppleReportPage
            reportId={params.id as string}
            backTo="/dashboard/op/reports"
            divisionColor="#06b6d4"
        />
    );
}
