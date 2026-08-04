import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { DivisionDashboardClientLoader } from '@/components/dashboard/DivisionDashboardClientLoader';
import { DIVISIONS } from '@/lib/constants/divisions';
import { getStationLock } from '@/lib/get-station-lock';
import { queryReportPage } from '@/lib/server/report-page-query';
import { getDashboardOverview } from '@/lib/dashboard/dashboard-overview';
import type { DashboardOverview } from '@/lib/dashboard/contracts';
import type { Report } from '@/types';

export const dynamic = 'force-dynamic';

export default async function HTDashboard() {
    const token = (await cookies()).get('session')?.value;
    const payload = token ? await verifySession(token) : null;

    let initialReports: Report[] | undefined;
    let lockedBranches: string[] | undefined;
    let initialOverview: DashboardOverview | undefined;

    const stationCode = payload?.id ? await getStationLock(payload.id, payload.role ?? '') : null;

    if (payload) {
        const [overview, page] = await Promise.all([
            getDashboardOverview(stationCode ? [stationCode] : undefined).catch(() => undefined),
            queryReportPage({
                session: payload,
                scope: 'admin',
                limit: stationCode ? 50 : 10,
                filters: stationCode ? { station: stationCode } : undefined,
            }).catch(() => null),
        ]);
        initialOverview = overview;
        initialReports = page ? (Array.from(page.reports) as Report[]) : [];
        if (stationCode) lockedBranches = [stationCode];
    }

    return (
        <DivisionDashboardClientLoader
            division={DIVISIONS.HT}
            initialReports={initialReports}
            initialOverview={initialOverview}
            lockedBranches={lockedBranches}
        />
    );
}
