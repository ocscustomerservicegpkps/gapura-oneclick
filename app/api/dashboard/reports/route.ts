import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth-utils';
import { getStationLock } from '@/lib/get-station-lock';
import { resolveReportPageAccess } from '@/lib/report-page';
import { reportsService } from '@/lib/services/reports-service';
import { getSyncState } from '@/lib/sync-state';
import type { CompleteDashboardReportsResponse } from '@/lib/dashboard/contracts';
import type { Report } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

function reportBranch(report: Partial<Report>): string {
  return String(report.station_code || report.branch || report.reporting_branch || '').trim().toUpperCase();
}

/**
 * The payload is a ~5 MB snapshot of the whole corpus and only changes when a
 * report is written. Every write path bumps `sync_state.sync_version`, so that
 * counter (plus the caller's station scope) is a sound validator: when it has
 * not moved, the body cannot have moved either. Returning null disables
 * conditional handling and falls back to an unconditional 200.
 */
async function computeEtag(stationCode: string | null): Promise<string | null> {
  try {
    const state = await getSyncState('reports');
    return `W/"r${state.sync_version}-${state.row_count}-${stationCode || 'all'}"`;
  } catch (error) {
    console.warn('[dashboard/reports] sync_state unavailable, skipping ETag:', error);
    return null;
  }
}

/**
 * `If-None-Match` is a *list* of validators (RFC 9110 §13.1.2), and proxies may
 * drop the `W/` prefix — a plain `header === etag` compare missed both cases and
 * answered 200 with the full 5 MB body to a client that already had it.
 */
function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  const bare = (tag: string) => tag.trim().replace(/^W\//, '');
  return header.split(',').some((tag) => tag.trim() === '*' || bare(tag) === bare(etag));
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = resolveReportPageAccess(session.role, 'admin');
  if (access.kind === 'forbidden' || access.kind === 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stationCode = await getStationLock(session.id, session.role || '');

  // Validate before reading the corpus — a hit skips the whole 5 MB fetch.
  const etag = await computeEtag(stationCode);
  if (etag && matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, max-age=0, must-revalidate',
        'Vary': 'Cookie',
        'Server-Timing': `dashboard-reports;dur=${Math.round(performance.now() - startedAt)}`,
        'X-Dashboard-Completeness': 'complete',
      },
    });
  }

  const allReports = await reportsService.getReports({ source: 'sync' });
  const reports = stationCode
    ? allReports.filter((report) => reportBranch(report) === stationCode)
    : allReports;

  const payload: CompleteDashboardReportsResponse = {
    reports,
    source: 'ground_handling',
    eligibleCount: reports.length,
    returnedCount: reports.length,
    completeness: 'complete',
  };

  return NextResponse.json(payload, {
    headers: {
      ...(etag ? { ETag: etag } : {}),
      // max-age=0 + must-revalidate: the browser keeps the body but revalidates
      // on every use, so a stale corpus is never served and a fresh one costs
      // a 304 instead of 5 MB.
      'Cache-Control': etag ? 'private, max-age=0, must-revalidate' : 'private, no-store, max-age=0',
      'Vary': 'Cookie',
      'Server-Timing': `dashboard-reports;dur=${Math.round(performance.now() - startedAt)}`,
      'X-Dashboard-Completeness': 'complete',
    },
  });
}
