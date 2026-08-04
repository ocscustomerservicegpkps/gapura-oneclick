
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { reportsService, type ReportQueryFilters } from '@/lib/services/reports-service';
import { AnalyticsProcessor } from '@/lib/services/analytics-processor';
import { applyReportsRbacFilter } from '@/lib/reports-rbac';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    // no cookie at all = an anonymous viewer of a public /embed/* dashboard,
    // which already exposes this same unfiltered report set via the
    // dashboard's own data path — served here too so per-chart "detail"
    // drill-downs work. An expired/invalid cookie still 401s (internal users
    // should be prompted to re-login rather than silently downgraded).
    const session = token ? await verifySession(token) : null;
    if (token && !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const refresh = searchParams.get('refresh') === 'true';

    if (!view) {
      return NextResponse.json({ error: 'Missing "view" parameter' }, { status: 400 });
    }

    const filters: ReportQueryFilters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      hub: searchParams.get('hub') || undefined,
      branch: searchParams.get('branch') || undefined,
      area: searchParams.get('area') || undefined,
      airlines: searchParams.get('airlines') || undefined,
      sourceSheet: searchParams.get('sourceSheet') || undefined,
      esklasiRegex: searchParams.get('esklasiRegex') || searchParams.get('esklasi_regex') || undefined,
      gseOnly: searchParams.get('gseOnly') === 'true',
    };

    const allReports = await reportsService.getReports({
      refresh,
      filters,
      projection: 'analytics',
      source: 'sync',
    });

    const reports = session
      ? applyReportsRbacFilter(
          allReports,
          String(session.role || '').trim().toUpperCase(),
          session.id as string,
          (session.station_id as string | null) ?? null,
          String(session.email || '').trim().toLowerCase(),
        )
      : allReports;

    let aggregatedData: unknown = {};

    switch (view) {
      case 'case-category':
        aggregatedData = AnalyticsProcessor.processCaseCategory(reports);
        break;
      case 'monthly':
        aggregatedData = AnalyticsProcessor.processMonthlyReport(reports);
        break;
      case 'area-report':
        aggregatedData = AnalyticsProcessor.processAreaReport(reports);
        break;
      case 'airline-report':
        aggregatedData = AnalyticsProcessor.processAirlineReport(reports);
        break;
      case 'branch-report':
        aggregatedData = AnalyticsProcessor.processBranchReport(reports);
        break;
      case 'hub-report':
        aggregatedData = AnalyticsProcessor.processHubReport(reports);
        break;
      default:
        return NextResponse.json({ error: `Unsupported view: ${view}` }, { status: 400 });
    }

    return NextResponse.json({
      timestamp: Date.now(),
      view,
      count: reports.length,
      data: aggregatedData
    }, {
      headers: session
        ? {
            // `private` keeps RBAC-filtered data out of shared/CDN caches; the short
            // max-age lets the user's browser reuse pre-aggregated views instantly on
            // re-navigation without a fresh round-trip.
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
          }
        : {
            'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
          }
    });

  } catch (err) {
    console.error('Aggregated Analytics API error:', err);
    return NextResponse.json({ 
      error: 'Failed to aggregate reports',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
