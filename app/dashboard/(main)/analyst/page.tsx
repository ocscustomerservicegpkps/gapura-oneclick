import { cookies } from 'next/headers';
import { readSessionPayload } from '@/lib/auth-utils';
import { OCSDivisionDashboardClientLoader } from '@/components/dashboard/ocs/OCSDivisionDashboardClientLoader';
import { DivisionAnalystDashboard } from '@/components/dashboard/DivisionAnalystDashboard';
import { getDashboardOverview } from '@/lib/dashboard/dashboard-overview';
import { DIVISIONS } from '@/lib/constants/divisions';

export const dynamic = 'force-dynamic';

export default async function AnalystPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const session = token ? await readSessionPayload(token) : null;

    if (session?.division === 'OCS') {
        return <OCSDivisionDashboardClientLoader division={DIVISIONS.OCS} />;
    }

    // Exact server-side KPIs, filter options, and tab populations across every
    // eligible report. Analyst has full visibility, so no station scope.
    const initialOverview = await getDashboardOverview().catch(() => undefined);

    return (
        <DivisionAnalystDashboard
            division={DIVISIONS.ANALYST}
            realDivisionCode={session?.division}
            initialOverview={initialOverview}
        />
    );
}
