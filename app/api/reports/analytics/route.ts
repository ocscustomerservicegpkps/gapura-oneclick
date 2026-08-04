
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import {
  parseReportSyncFields,
  reportsService,
  type ReportQueryFilters,
} from '@/lib/services/reports-service';
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
    const refresh = searchParams.get('refresh') === 'true';

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

    const fieldsParam = searchParams.get('fields');
    const parsedFields = fieldsParam
      ? parseReportSyncFields(fieldsParam.split(','))
      : null;
    if (parsedFields?.invalid.length) {
      return NextResponse.json(
        { error: 'Invalid report fields', fields: parsedFields.invalid },
        { status: 400 }
      );
    }

    const sourceParam = searchParams.get('source');
    const source: 'sheets' | 'sync' = sourceParam === 'sheets' ? 'sheets' : 'sync';

    const allReports = await reportsService.getReports({
      refresh,
      filters,
      fields: parsedFields?.fields,
      projection: parsedFields ? undefined : 'list',
      source,
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

    return NextResponse.json({
      timestamp: Date.now(),
      count: reports.length,
      reports
    }, {
      headers: session
        ? {
            // Per-session RBAC-filtered data must never touch a shared/CDN cache, so
            // keep `private`. A short max-age lets the user's OWN browser reuse the
            // response across chart re-mounts / quick re-navigation (server already
            // caches the row set 5 min, so 30s browser reuse is strictly tighter).
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
          }
        : {
            'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
          }
    });

  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ 
      error: 'Failed to fetch reports',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
