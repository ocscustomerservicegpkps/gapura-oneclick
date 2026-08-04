import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';

type DuplicateCandidate = {
  id: string;
  title: string;
  status: string;
  date_of_event: string | null;
  station_id: string | null;
  airline: string | null;
  flight_number: string | null;
  similarity: number;
};

type DuplicateReportRow = {
  id: string;
  title?: string | null;
  report?: string | null;
  description?: string | null;
  status?: string | null;
  date_of_event?: string | null;
  incident_date?: string | null;
  station_id?: string | null;
  station_code?: string | null;
  branch?: string | null;
  airline?: string | null;
  airlines?: string | null;
  flight_number?: string | null;
  area?: string | null;
  category?: string | null;
  main_category?: string | null;
  irregularity_complain_category?: string | null;
  terminal_area_category?: string | null;
  apron_area_category?: string | null;
  general_category?: string | null;
  created_at?: string | null;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(left: unknown, right: unknown): number {
  const leftTokens = new Set(normalizeText(left).split(' ').filter((token) => token.length > 2));
  const rightTokens = new Set(normalizeText(right).split(' ').filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function sameDay(value: unknown, target: string): boolean {
  if (!value || !target) return false;
  return String(value).slice(0, 10) === target.slice(0, 10);
}

export async function POST(request: Request) {
  try {
    // No auth required by design (used by the unauthenticated public report
    // wizard), so rate-limit per IP to prevent scraping incident metadata.
    const ip = getClientIpFromRequest(request);
    const rateLimit = checkRateLimit(`duplicates-check:${ip}`, 20, 60_000);
    if (!rateLimit.success) {
      return NextResponse.json({ candidates: [] }, { status: 429 });
    }

    const body = await request.json();
    const incidentDate = String(body.incident_date || body.date_of_event || '').slice(0, 10);
    const stationId = String(body.station_id || body.station_code || '').trim();
    const airline = String(body.airline || body.airlines || '').trim();
    const flightNumber = String(body.flight_number || '').trim().toUpperCase().replace(/\s+/g, '');
    const area = String(body.area || '').trim();
    const category = String(body.area_category || body.incident_type_id || body.category || '').trim();
    const description = String(body.description || body.report || '').trim();

    if (!incidentDate || !stationId || !airline || !flightNumber) {
      return NextResponse.json({ candidates: [] });
    }

    const dateFrom = `${incidentDate}T00:00:00+00:00`;
    const dateTo = `${incidentDate}T23:59:59+00:00`;

    const selectFields = 'id,title,report,description,status,date_of_event,incident_date,station_id,station_code,branch,airline,airlines,flight_number,area,category,main_category,irregularity_complain_category,terminal_area_category,apron_area_category,general_category,created_at';
    const [dateOfEventResult, incidentDateResult, createdAtResult] = await Promise.all([
      supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select(selectFields)
        .gte('date_of_event', dateFrom)
        .lte('date_of_event', dateTo)
        .limit(50),
      supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select(selectFields)
        .eq('incident_date', incidentDate)
        .limit(50),
      supabaseAdmin
        .from('ground_handling_irregularity_report')
        .select(selectFields)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .limit(50),
    ]);

    const queryErrors = [dateOfEventResult.error, incidentDateResult.error, createdAtResult.error].filter(Boolean);
    if (queryErrors.length > 0) {
      console.warn('[DUPLICATE_CHECK] Query failed:', queryErrors);
      return NextResponse.json({ candidates: [] });
    }

    const rowsById = new Map<string, DuplicateReportRow>();
    for (const row of [
      ...(dateOfEventResult.data || []),
      ...(incidentDateResult.data || []),
      ...(createdAtResult.data || []),
    ] as DuplicateReportRow[]) {
      rowsById.set(String(row.id), row);
    }

    const normalizedFlight = flightNumber.replace(/-/g, '');
    const normalizedAirline = normalizeText(airline);
    const normalizedStation = stationId.toLowerCase();
    const normalizedArea = normalizeText(area);
    const normalizedCategory = normalizeText(category);

    const candidates: DuplicateCandidate[] = Array.from(rowsById.values())
      .filter((report) => sameDay(report.date_of_event || report.incident_date || report.created_at, incidentDate))
      .map((report) => {
        const reportStation = String(report.station_id || report.station_code || report.branch || '').toLowerCase();
        const reportFlight = String(report.flight_number || '').toUpperCase().replace(/[\s-]/g, '');
        const reportAirline = normalizeText(report.airline || report.airlines);
        const reportArea = normalizeText(report.area);
        const reportCategory = normalizeText(
          report.category ||
          report.main_category ||
          report.irregularity_complain_category ||
          report.terminal_area_category ||
          report.apron_area_category ||
          report.general_category
        );

        let score = 0;
        score += 0.2;
        if (reportStation === normalizedStation) score += 0.2;
        if (reportFlight && reportFlight === normalizedFlight) score += 0.2;
        if (reportAirline && reportAirline === normalizedAirline) score += 0.15;
        if (normalizedArea && reportArea === normalizedArea) score += 0.1;
        if (normalizedCategory && reportCategory === normalizedCategory) score += 0.1;
        score += tokenSimilarity(description, report.description || report.report || report.title) * 0.25;

        return {
          id: String(report.id),
          title: String(report.title || report.report || 'Laporan tanpa judul'),
          status: String(report.status || 'OPEN'),
          date_of_event: report.date_of_event || report.incident_date || report.created_at || null,
          station_id: report.station_id || report.station_code || report.branch || null,
          airline: report.airline || report.airlines || null,
          flight_number: report.flight_number || null,
          similarity: Number(score.toFixed(2)),
        };
      })
      .filter((candidate) => candidate.similarity >= 0.55)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5);

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('[DUPLICATE_CHECK] Unexpected error:', error);
    return NextResponse.json({ candidates: [] });
  }
}
