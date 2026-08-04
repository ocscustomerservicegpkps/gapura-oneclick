import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';
import { REPORT_STATUS } from '@/lib/constants/report-status';
import { enrichReportsWithComments } from '@/lib/server/report-comments';
import type { Report } from '@/types';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value ?? null;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(token);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (session.role !== 'SUPER_ADMIN' && session.role !== 'ANALYST') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        let dateFrom: Date | null = null;
        let dateTo: Date | null = null;

        if (from && to) {
            dateFrom = new Date(from);
            dateTo = new Date(to);
        } else if (period) {
            const now = new Date();
            dateTo = now;
            switch (period) {
                case '7d':
                    dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '3m':
                    dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    break;
                case '6m':
                    dateFrom = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                    break;
            }
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Push the period/from/to narrowing down to Postgres instead of pulling
        // the whole table and filtering in JS. Note: getReports' dateFrom/dateTo
        // filter narrows on date_of_event (falling back to created_at only when
        // date_of_event is missing) rather than strictly created_at like the old
        // JS filter did — matches the convention the rest of the app already
        // uses for date-range filtering.
        const filteredReports = await reportsService.getReports({
            source: 'sync',
            projection: 'adminStats',
            filters: (dateFrom || dateTo) ? {
                dateFrom: dateFrom ? dateFrom.toISOString() : undefined,
                dateTo: dateTo ? dateTo.toISOString() : undefined,
            } : undefined,
        });

        const totalReports = filteredReports.length;
        let menungguFeedback = 0;
        let sudahDiverifikasi = 0;
        let selesai = 0;
        let criticalSeverity = 0;
        let highSeverity = 0;
        let mediumSeverity = 0;
        let lowSeverity = 0;
        let slaBreachCount = 0;

        for (const r of filteredReports) {
            if (r.status === REPORT_STATUS.OPEN) menungguFeedback++;
            else if (r.status === REPORT_STATUS['ON PROGRESS']) sudahDiverifikasi++;
            else if (r.status === REPORT_STATUS.CLOSED) selesai++;

            if (r.severity === 'TOP RISK') criticalSeverity++;
            else if (r.severity === 'HIGH RISK') highSeverity++;
            else if (r.severity === 'MEDIUM') mediumSeverity++;
            else lowSeverity++;

            if (r.status !== REPORT_STATUS.CLOSED && r.sla_deadline && new Date(r.sla_deadline) < now) {
                slaBreachCount++;
            }
        }

        // Today/week/month trend tiles are intentionally global (not scoped to
        // the page's selected period/from/to), but they only ever need data
        // back to the earliest of the three anchors — never the whole table.
        // Narrowed to a single `created_at` column since only counting matters
        // here (no need for the full adminStats projection).
        const trendWindowStart = new Date(Math.min(startOfWeek.getTime(), startOfMonth.getTime()));
        const { data: trendRows } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select('created_at')
            .gte('created_at', trendWindowStart.toISOString());

        let todayReports = 0;
        let weekReports = 0;
        let monthReports = 0;
        for (const r of trendRows || []) {
            const created = new Date(r.created_at as string).getTime();
            if (created >= startOfDay.getTime()) todayReports++;
            if (created >= startOfWeek.getTime()) weekReports++;
            if (created >= startOfMonth.getTime()) monthReports++;
        }

        const locationBreakdown: Record<string, number> = {};
        filteredReports.forEach(r => {

            const loc = r.station_code || r.branch || r.location || 'Tidak Diketahui';
            locationBreakdown[loc] = (locationBreakdown[loc] || 0) + 1;
        });

        const topLocations = Object.entries(locationBreakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([location, count]) => ({ location, count }));

        // "Most recent reports" is also global — fetched directly with the DB
        // doing the order + limit instead of pulling every row and sorting in JS.
        const { data: recentReportRows } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select('id, sheet_id, original_id, title, description, report, primary_tag, location, station_code, branch, status, severity, priority, sla_deadline, reporter_name, created_at, date_of_event')
            .order('created_at', { ascending: false })
            .limit(5);
        const recentReportsWithComments = await enrichReportsWithComments((recentReportRows || []) as unknown as Report[]);
        const recentReports = recentReportsWithComments
            .map(r => ({
                id: r.id,
                sheet_id: r.sheet_id,
                original_id: r.original_id,
                title: r.title || r.description || 'No Title',
                report: r.report,
                primary_tag: r.primary_tag,
                location: r.location || r.station_code || r.branch,
                status: r.status,
                severity: r.severity,
                created_at: r.created_at,
                priority: r.priority,
                sla_deadline: r.sla_deadline,
                users: r.users ? { full_name: r.users.full_name } : (r.reporter_name ? { full_name: r.reporter_name } : null),
                stations: r.stations ? { code: r.stations.code } : (r.station_code ? { code: r.station_code } : null),
                comments: r.comments || [],
            }));

        const [{ count: pendingUsers }, { count: activeUsers }] = await Promise.all([
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        ]);

        const resolutionRate = totalReports ? Math.round((selesai / totalReports) * 100) : 0;

        return NextResponse.json({
            overview: {
                totalReports,
                menungguFeedback,
                sudahDiverifikasi,
                selesai,
                pendingUsers: pendingUsers || 0,
                activeUsers: activeUsers || 0,
                resolutionRate,
                slaBreachCount,
            },
            severity: {
                'TOP RISK': criticalSeverity,
                'HIGH RISK': highSeverity,
                MEDIUM: mediumSeverity,
                LOW: lowSeverity,
            },
            severityBreakdown: {
                critical: criticalSeverity,
                high: highSeverity,
                medium: mediumSeverity,
                low: lowSeverity
            },
            trends: {
                today: todayReports,
                thisWeek: weekReports,
                thisMonth: monthReports,
            },
            recentReports,
            topLocations,
        }, {
            headers: {
                // `private` keeps per-admin data out of shared caches; a short
                // max-age makes dashboard re-visits instant from the browser cache.
                'Cache-Control': 'private, max-age=20, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
