import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DivisionAnalystDashboard } from '@/components/dashboard/DivisionAnalystDashboard';
import { DIVISIONS } from '@/lib/constants/divisions';
import { verifySession } from '@/lib/auth-utils';
import { getStationLock } from '@/lib/get-station-lock';
import { queryReportPage } from '@/lib/server/report-page-query';
import type { Report } from '@/types';

// This page embeds per-user, station-scoped report data directly into the
// server-rendered HTML via `initialReports`. ISR (`revalidate`) would cache
// that personalized payload and serve it to every subsequent visitor
// regardless of their own role/station, so it must always render fresh.
export const dynamic = 'force-dynamic';

export default async function ManagerAllReportsPage() {
    const token = (await cookies()).get('session')?.value;
    const payload = token ? await verifySession(token) : null;
    if (!payload?.id) redirect('/auth/login');

    const stationCode = await getStationLock(payload.id, payload.role ?? '');
    if (!stationCode) redirect('/dashboard/manager');

    let initialReports: Report[];
    try {
        const page = await queryReportPage({
            session: payload,
            scope: 'admin',
            limit: 50,
            filters: { station: stationCode },
        });
        initialReports = Array.from(page.reports) as Report[];
    } catch {
        initialReports = [];
    }

    return (
        <DivisionAnalystDashboard
            division={DIVISIONS.OP}
            initialReports={initialReports}
            lockedBranches={[stationCode]}
            forceView="reports"
        />
    );
}
