
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import {
  parseReportSyncFields,
  reportsService,
  type ReportQueryFilters,
} from '@/lib/services/reports-service';
import { applyReportsRbacFilter } from '@/lib/reports-rbac';

// Columns the public /embed/* chart components request (the union of their
// CORE_FIELDS constants). Anonymous callers may select exactly this set and
// nothing else — the remaining REPORT_SYNC_FIELDS are reporter identity /
// internal columns (reporter_email, user_id, evidence_file_ids, ...) and
// require a session plus the RBAC filter below.
// Chart dimensions only. This endpoint answers unauthenticated requests for the
// public /embed/* dashboards and is CDN-cached, so anything listed here is
// effectively published: one crawler walking it dumps that column for the whole
// corpus. Narrative columns (root cause, action taken, KPS remarks) describe
// incidents in free text and evidence_url(s) are live Google Drive links — no
// chart needs either, and both were readable by anyone with the URL.
const PUBLIC_ANALYTICS_FIELDS = [
  'id', 'date_of_event', 'created_at', 'hub', 'branch', 'reporting_branch',
  'station_code', 'area', 'terminal_area_category', 'apron_area_category',
  'general_category', 'airlines', 'airline', 'main_category', 'category',
  'irregularity_complain_category',
  'source_sheet', 'incident_date', 'station_id',
] as const;

const PUBLIC_ANALYTICS_FIELD_SET = new Set<string>(PUBLIC_ANALYTICS_FIELDS);

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
    // `refresh=true` bypasses the 5-minute server cache and re-reads the whole
    // corpus. Honouring it for anonymous callers meant anyone with the public
    // embed URL could force that work on every request.
    const refresh = searchParams.get('refresh') === 'true' && Boolean(session);

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

    const isAnonymous = !session;

    // Anonymous viewers (public /embed/* dashboards) may only select the
    // public chart columns above — fail closed on anything else instead of
    // returning reporter identity / internal fields.
    if (isAnonymous && parsedFields && !parsedFields.fields.every((field) => PUBLIC_ANALYTICS_FIELD_SET.has(field))) {
      return NextResponse.json(
        { error: 'Forbidden: requested fields are not available without a session' },
        { status: 403 }
      );
    }

    const allReports = await reportsService.getReports({
      refresh,
      filters,
      // Anonymous: force the public projection (the default `list` projection
      // includes reporter_name). Authenticated callers keep today's behavior.
      fields: parsedFields?.fields ?? (isAnonymous ? [...PUBLIC_ANALYTICS_FIELDS] : undefined),
      projection: parsedFields || isAnonymous ? undefined : 'list',
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
            // The body depends on the session cookie: without this, a cache that
            // keyed on URL alone could hand one user's filtered set to another,
            // or the public projection to a signed-in caller.
            'Vary': 'Cookie',
          }
        : {
            'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
            'Vary': 'Cookie',
          }
    });

  } catch (err) {
    console.error('Analytics API error:', err);
    // The upstream message can name tables, columns and connection details, and
    // this endpoint answers anonymous callers.
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
