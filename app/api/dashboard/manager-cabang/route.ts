import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDashboardOverview } from '@/lib/dashboard/dashboard-overview';

// Narrowed column lists (verified against the live schema) instead of
// select('*'): both tables carry dozens of columns (GSE/JOUMPA-specific
// customer fields, sync bookkeeping, etc.) that neither the breakdown maps
// below nor the DrilldownDrawer UI ever reads. joumpa_reports_sync doesn't
// have several ground-handling-only columns (terminal_area_category,
// kode_cabang, primary_tag, ...), so the two tables get distinct lists.
const GROUND_FIELDS = [
    'id', 'sheet_id', 'original_id', 'status', 'severity', 'severity_level',
    'main_category', 'category', 'irregularity_complain_category',
    'area', 'terminal_area_category', 'apron_area_category', 'general_category',
    'airline', 'airlines', 'maskapai_lookup', 'hub', 'kode_hub',
    'branch', 'station_code', 'reporting_branch', 'kode_cabang',
    'case_classification', 'case_category', 'remarks_case',
    'category_case_gse', 'category_case_joumpa', 'category_case_cargo',
    'identification_of_root', 'root_cause', 'root_caused',
    'report', 'description', 'title', 'flight_number', 'route',
    'date_of_event', 'incident_date', 'created_at',
    'delay_code', 'delay_duration', 'action_taken', 'immediate_action', 'preventive_action',
    'final_remarks', 'kps_remarks', 'evidence_url', 'evidence_urls', 'supporting_evidence',
    'primary_tag', 'service_business_type',
].join(',');

const JOUMPA_FIELDS = [
    'id', 'sheet_id', 'status', 'severity', 'severity_level',
    'main_category', 'category', 'area', 'airline', 'airlines', 'hub',
    'branch', 'station_code',
    'case_classification', 'case_category', 'remarks_case', 'category_case_joumpa',
    'identification_of_root', 'root_cause', 'root_caused',
    'report', 'description', 'title', 'flight_number', 'route',
    'date_of_event', 'incident_date', 'created_at',
    'delay_code', 'action_taken', 'immediate_action', 'preventive_action',
    'final_remarks', 'kps_remarks', 'evidence_url', 'evidence_urls', 'supporting_evidence',
    'service_business_type',
].join(',');

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, role, station_id')
        .eq('id', session.id)
        .single();

    if (!user || (user.role !== 'MANAGER_CABANG' && user.role !== 'SUPER_ADMIN' && user.role !== 'ANALYST')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stationId = user.station_id;
    if (!stationId) {
        return NextResponse.json({ error: 'No station assigned' }, { status: 400 });
    }

    // station and the ground-handling rows both only depend on stationId (not
    // on each other), so they can be fetched concurrently.
    const [{ data: station }, groundResult] = await Promise.all([
        supabaseAdmin
            .from('stations')
            .select('code, name')
            .eq('id', stationId)
            .single(),
        supabaseAdmin
            .from('ground_handling_irregularity_report')
            .select(GROUND_FIELDS)
            .eq('station_id', stationId),
    ]);
    // The select() column list is built at runtime (a joined string, not a
    // literal), so supabase-js can't statically infer the row shape from it —
    // cast explicitly, same as the equivalent dynamic-select pattern in
    // reports-service.ts's fetchReportsFromSync.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = groundResult.data as any[] | null;
    const error = groundResult.error;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stationCode = station?.code || stationId;

    // The exact-aggregate RPC only covers ground_handling_irregularity_report,
    // so its summary is combined below with a JOUMPA count computed from the
    // same narrowed rows fetched for the breakdowns (no separate count-only
    // round trip needed since we already need those rows for the charts).
    const [overview, joumpaResult] = await Promise.all([
        getDashboardOverview([stationCode]),
        supabaseAdmin
            .from('joumpa_reports_sync')
            .select(JOUMPA_FIELDS)
            .or(`station_code.eq.${stationCode},station.eq.${stationCode}`),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const joumpaRows = joumpaResult.data as any[] | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reports: any[] = [...(rows || []), ...(joumpaRows || [])];

    let joumpaOpen = 0;
    let joumpaClosed = 0;
    (joumpaRows || []).forEach((r) => {
        if (r.status === 'OPEN') joumpaOpen++;
        else if (r.status === 'CLOSED') joumpaClosed++;
    });

    const total = overview.summary.total + (joumpaRows?.length || 0);
    const openCount = overview.summary.pending + joumpaOpen;
    const closedCount = overview.summary.resolved + joumpaClosed;
    const resolutionRate = total > 0 ? Math.round((closedCount / total) * 100) : 0;

    const categoryMap: Record<string, number> = {};
    const severityMap: Record<string, number> = {};
    const areaMap: Record<string, number> = {};
    const airlineMap: Record<string, number> = {};
    const monthlyMap: Record<string, { total: number; Irregularity: number; Complaint: number; Compliment: number }> = {};

    for (const r of reports) {
        const cat = r.main_category || r.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;

        const sev = r.severity || 'UNKNOWN';
        severityMap[sev] = (severityMap[sev] || 0) + 1;

        const area = r.area || 'Unknown';
        areaMap[area] = (areaMap[area] || 0) + 1;

        const airline = r.airline || r.airlines || 'Unknown';
        airlineMap[airline] = (airlineMap[airline] || 0) + 1;

        const dateStr = r.date_of_event || r.created_at;
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyMap[monthKey]) {
                    monthlyMap[monthKey] = { total: 0, Irregularity: 0, Complaint: 0, Compliment: 0 };
                }
                monthlyMap[monthKey].total++;
                if (cat === 'Irregularity' || cat === 'Complaint' || cat === 'Compliment') {
                    monthlyMap[monthKey][cat]++;
                }
            }
        }
    }

    const categoryDistribution = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const severityDistribution = Object.entries(severityMap)
        .map(([name, value]) => {
            const order: Record<string, number> = { 'TOP RISK': 0, 'HIGH RISK': 1, MEDIUM: 2, LOW: 3 };
            return { name, value, _order: order[name] ?? 99 };
        })
        .sort((a, b) => a._order - b._order)
        .map(({ name, value }) => ({ name, value }));

    const areaDistribution = Object.entries(areaMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topAirlines = Object.entries(airlineMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const monthlyTrend = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => {
            const [y, m] = month.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
                month: `${monthNames[parseInt(m) - 1]} ${y}`,
                rawMonth: month,
                ...data,
            };
        });

    const statusDistribution = [
        { name: 'Open', value: openCount },
        { name: 'Closed', value: closedCount },
    ].filter(d => d.value > 0);

    return NextResponse.json({
        station: { code: station?.code || stationId, name: station?.name || stationId },
        summary: { total, open: openCount, closed: closedCount, resolutionRate },
        categoryDistribution,
        severityDistribution,
        areaDistribution,
        topAirlines,
        monthlyTrend,
        statusDistribution,
        rows: reports,
    });
}
