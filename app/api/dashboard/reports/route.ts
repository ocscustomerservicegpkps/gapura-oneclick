import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth-utils';
import { getStationLock } from '@/lib/get-station-lock';
import { resolveReportPageAccess } from '@/lib/report-page';
import { reportsService } from '@/lib/services/reports-service';
import type { CompleteDashboardReportsResponse } from '@/lib/dashboard/contracts';
import type { Report } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

function reportBranch(report: Partial<Report>): string {
  return String(report.station_code || report.branch || report.reporting_branch || '').trim().toUpperCase();
}

export async function GET() {
  const startedAt = performance.now();
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = resolveReportPageAccess(session.role, 'admin');
  if (access.kind === 'forbidden' || access.kind === 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stationCode = await getStationLock(session.id, session.role || '');
  const allReports = await reportsService.getReports({ source: 'sync' });
  const reports = stationCode
    ? allReports.filter((report) => reportBranch(report) === stationCode)
    : allReports;

  const payload: CompleteDashboardReportsResponse = {
    reports,
    source: 'ground_handling',
    eligibleCount: reports.length,
    returnedCount: reports.length,
    generatedAt: new Date().toISOString(),
    completeness: 'complete',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Cookie',
      'Server-Timing': `dashboard-reports;dur=${Math.round(performance.now() - startedAt)}`,
      'X-Dashboard-Completeness': 'complete',
    },
  });
}
