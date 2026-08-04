import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v5 as uuidv5 } from 'uuid';
import { verifySession } from '@/lib/auth-utils';
import { getGoogleSheets } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { IRRS_NAMESPACE_UUID, parseDate } from '@/lib/services/reports-service';
import { JoumpaSyncService } from '@/lib/services/joumpa-sync-service';
import type { JoumpaFormInput } from '@/lib/joumpa/mapping';
import type { Report } from '@/types';
import { enrichReportsWithComments } from '@/lib/server/report-comments';

interface JoumpaRecord {
  timestamp: string;
  email: string;
  date: string;
  airlines: string;
  flightNumber: string;
  branch: string;
  serviceType: string;
  category: string;
  evidence: string;
  evidence_urls?: string[];
  report: string;
  reportBy: string;
  reportType: string;
  satisfactionRating: string;
  averageRating: string;
  customerType?: string;
  customerDetail?: string;
  finalRemarks?: string;
  airportName?: string;
  airportCode?: string;
  branchCode?: string;
  route?: string;
}

type JoumpaSyncRow = Record<string, unknown>;

const JOUMPA_SHEET_ID = process.env.JOUMPA_SHEET_ID || '1X4KN3ukUtMsd4udL-e2OdNIMheJqutXp0IbfE-Cwwsw';
const SHEET_NAME = process.env.JOUMPA_SHEET_NAME || 'Form Responses 1';

const HEADER_MAP: Record<string, keyof JoumpaRecord> = {
  'timestamp': 'timestamp',
  'email address': 'email',
  'date of event': 'date',
  'airlines': 'airlines',
  'flight number': 'flightNumber',
  'branch (cth: cgk, upg, dps)': 'branch',
  'station (cth: cgk, upg, dps)': 'branch',
  'joumpa service type': 'serviceType',
  'category report': 'category',
  'report': 'report',
  'route': 'route',
  'report by': 'reportBy',
  'report type': 'reportType',
  'case joumpa': 'reportType',
  'rating rata-rata': 'averageRating',
};

function parseRows(headers: string[], rows: string[][]): JoumpaRecord[] {
  const colMap = new Map<keyof JoumpaRecord, number>();

  headers.forEach((h, idx) => {
    const normalized = h.trim().toLowerCase();
    const mapped = HEADER_MAP[normalized];
    if (mapped) {
      colMap.set(mapped, idx);
      return;
    }
    if (normalized.startsWith('supporting evidence')) colMap.set('evidence', idx);
    if (normalized.startsWith('detailed report')) colMap.set('report', idx);
    if (normalized.startsWith('based on the passenger')) colMap.set('satisfactionRating', idx);
  });


  return rows.map(row => {
    const record: Partial<Record<keyof JoumpaRecord, string | string[]>> = {};
    colMap.forEach((colIdx, field) => {
      const val = (row[colIdx] ?? '').toString().trim();
      record[field] = val;

      if (field === 'evidence' && val) {
        record.evidence_urls = val.split(/\s*[|\n,]\s*/).map(s => s.trim()).filter(url => url.startsWith('http'));
      }
    });
    return record as JoumpaRecord;
  });
}

function applyFilters(records: JoumpaRecord[], params: URLSearchParams): JoumpaRecord[] {
  const serviceType = params.get('service_type');
  const airlines = params.get('airlines');
  const category = params.get('category');
  const branch = params.get('branch');

  if (!serviceType && !airlines && !category && !branch) return records;

  return records.filter(r => {
    if (serviceType && r.serviceType !== serviceType) return false;
    if (airlines && r.airlines !== airlines) return false;
    if (category && r.category !== category) return false;
    if (branch && r.branch !== branch) return false;
    return true;
  });
}

function rowText(row: JoumpaSyncRow, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function rowToRecord(row: JoumpaSyncRow): JoumpaRecord {
  const broadCategory = rowText(row, 'category_case_joumpa') || rowText(row, 'remarks_case') || 'Joumpa Service';
  const detailCategory = rowText(row, 'case_joumpa') || rowText(row, 'case_classification') || rowText(row, 'case_category') || rowText(row, 'joumpa_compliment_report_excellent_service');
  const customerDetail = rowText(row, 'detail_customer_joumpa') ||
    rowText(row, 'customer_company_profile_corporate') ||
    rowText(row, 'detail_customer_corporate') ||
    rowText(row, 'customer_background_non_corporate') ||
    rowText(row, 'detail_customer_non_corporate');
  return {
    timestamp: rowText(row, 'timestamp_raw') || rowText(row, 'form_timestamp'),
    email: rowText(row, 'email_address') || rowText(row, 'reporter_email'),
    date: rowText(row, 'date_of_event'),
    airlines: rowText(row, 'airlines') || rowText(row, 'airline'),
    flightNumber: rowText(row, 'flight_number'),
    branch: rowText(row, 'branch') || rowText(row, 'station_code') || rowText(row, 'station'),
    serviceType: broadCategory,
    category: rowText(row, 'category') || rowText(row, 'main_category') || rowText(row, 'category_report'),
    evidence: rowText(row, 'supporting_evidence') || rowText(row, 'evidence_url'),
    evidence_urls: Array.isArray(row.evidence_urls) ? row.evidence_urls.filter((value): value is string => typeof value === 'string' && value.length > 0) : undefined,
    report: rowText(row, 'report') || rowText(row, 'description'),
    reportBy: rowText(row, 'report_by') || rowText(row, 'reporter_name'),
    reportType: detailCategory || broadCategory,
    satisfactionRating: rowText(row, 'customer_satisfaction_score') || rowText(row, 'joumpa_compliment_report_excellent_service'),
    averageRating: rowText(row, 'customer_satisfaction_label'),
    customerType: rowText(row, 'customer_joumpa') || rowText(row, 'corporate') || rowText(row, 'non_corporate'),
    customerDetail,
    finalRemarks: rowText(row, 'final_remarks') || rowText(row, 'kps_remarks'),
    airportName: rowText(row, 'airport_name'),
    airportCode: rowText(row, 'airport_code'),
    branchCode: rowText(row, 'branch_code'),
  };
}

function rowToReport(row: JoumpaSyncRow): Report {
  const branch = (rowText(row, 'branch') || rowText(row, 'station_code') || rowText(row, 'station')).trim();
  const broadCategory = rowText(row, 'category_case_joumpa') || rowText(row, 'remarks_case');
  const detailCategory = rowText(row, 'case_joumpa') || rowText(row, 'case_classification') || rowText(row, 'case_category') || rowText(row, 'joumpa_compliment_report_excellent_service');
  return {
    ...row,
    id: rowText(row, 'id'),
    user_id: rowText(row, 'user_id'),
    title: rowText(row, 'title') || rowText(row, 'report') || '(Tanpa Judul)',
    description: rowText(row, 'description') || rowText(row, 'report'),
    location: rowText(row, 'location') || branch,
    status: rowText(row, 'status') === 'CLOSED' ? 'CLOSED' : 'OPEN',
    severity: rowText(row, 'severity') || 'LOW',
    priority: rowText(row, 'priority') || 'low',
    source_sheet: 'JOUMPA',
    original_id: rowText(row, 'sheet_id'),
    sheet_id: rowText(row, 'sheet_id'),
    date_of_event: rowText(row, 'date_of_event') || rowText(row, 'incident_date') || rowText(row, 'created_at'),
    incident_date: rowText(row, 'incident_date') || rowText(row, 'date_of_event'),
    created_at: rowText(row, 'created_at') || rowText(row, 'form_timestamp') || rowText(row, 'synced_at') || new Date().toISOString(),
    updated_at: rowText(row, 'updated_at') || rowText(row, 'synced_at') || new Date().toISOString(),
    reporter_name: rowText(row, 'reporter_name') || rowText(row, 'report_by'),
    reporter_email: rowText(row, 'reporter_email') || rowText(row, 'email_address'),
    branch,
    station_code: rowText(row, 'station_code') || branch,
    station_id: rowText(row, 'station_code') || branch,
    stations: branch ? { code: branch, name: branch } : undefined,
    airline: rowText(row, 'airline') || rowText(row, 'airlines'),
    airlines: rowText(row, 'airlines') || rowText(row, 'airline'),
    main_category: rowText(row, 'main_category') || rowText(row, 'category') || rowText(row, 'category_report'),
    category: rowText(row, 'category') || rowText(row, 'main_category') || rowText(row, 'category_report'),
    root_cause: rowText(row, 'root_cause') || rowText(row, 'root_caused'),
    root_caused: rowText(row, 'root_caused') || rowText(row, 'root_cause'),
    immediate_action: rowText(row, 'immediate_action') || rowText(row, 'action_taken'),
    action_taken: rowText(row, 'action_taken') || rowText(row, 'immediate_action'),
    kps_remarks: rowText(row, 'kps_remarks') || rowText(row, 'final_remarks'),
    final_remarks: rowText(row, 'final_remarks') || rowText(row, 'kps_remarks'),
    service_business_type: rowText(row, 'service_business_type') || 'Joumpa Service',
    remarks_case: broadCategory || detailCategory,
    category_case_joumpa: broadCategory,
    case_joumpa: rowText(row, 'case_joumpa'),
    case_category: detailCategory || broadCategory,
    case_classification: detailCategory || broadCategory,
    identification_of_root: rowText(row, 'identification_of_root') || rowText(row, 'root_caused') || rowText(row, 'root_cause'),
    evidence_url: rowText(row, 'evidence_url'),
    evidence_urls: Array.isArray(row.evidence_urls) ? row.evidence_urls.filter((value): value is string => typeof value === 'string') : undefined,
    customer_satisfaction_score: rowText(row, 'customer_satisfaction_score'),
    customer_satisfaction_label: rowText(row, 'customer_satisfaction_label'),
    customer_joumpa: rowText(row, 'customer_joumpa'),
    detail_customer_joumpa: rowText(row, 'detail_customer_joumpa'),
    corporate: rowText(row, 'corporate'),
    customer_company_profile_corporate: rowText(row, 'customer_company_profile_corporate'),
    detail_customer_corporate: rowText(row, 'detail_customer_corporate'),
    non_corporate: rowText(row, 'non_corporate'),
    customer_background_non_corporate: rowText(row, 'customer_background_non_corporate'),
    detail_customer_non_corporate: rowText(row, 'detail_customer_non_corporate'),
    airport_name: rowText(row, 'airport_name'),
    airport_code: rowText(row, 'airport_code'),
    branch_code: rowText(row, 'branch_code'),
  } as Report;
}

function recordToReport(record: JoumpaRecord, rowNumber: number): Report {
  const sourceId = `JOUMPA!row_${rowNumber}`;
  const branch = (record.branch || '').trim();
  const category = record.serviceType || record.category;
  const description = record.report || record.reportType;
  const eventIso = parseDate(record.date)?.toISOString();
  const timestampIso = parseDate(record.timestamp)?.toISOString();
  return {
    id: uuidv5(sourceId, IRRS_NAMESPACE_UUID),
    original_id: sourceId,
    sheet_id: sourceId,
    source_sheet: 'JOUMPA',
    row_number: rowNumber,
    title: description || '(Tanpa Judul)',
    report: description,
    description,
    status: 'OPEN',
    severity: 'LOW',
    priority: 'low',
    location: branch,
    branch,
    station_code: branch,
    stations: branch ? { code: branch, name: branch } : undefined,
    airline: record.airlines,
    airlines: record.airlines,
    flight_number: record.flightNumber,
    route: record.route,
    main_category: category,
    category,
    date_of_event: eventIso || timestampIso,
    created_at: timestampIso || eventIso || new Date().toISOString(),
    updated_at: timestampIso || eventIso || new Date().toISOString(),
    reporter_name: record.reportBy,
    reporter_email: record.email,
    service_business_type: 'Joumpa Service',
    case_category: record.reportType || record.serviceType,
    case_classification: record.reportType || record.serviceType,
    remarks_case: record.serviceType,
    evidence_url: record.evidence,
    evidence_urls: record.evidence_urls,
    kps_remarks: record.finalRemarks,
    final_remarks: record.finalRemarks,
  } as Report;
}

// Basic branch staff must only see their own JOUMPA submissions, not the
// customer PII of every submission company-wide. Elevated roles (manager,
// divisional, analyst, admin) keep full access, matching the multi-division
// sharing already baked into the UI (JOUMPA has no division field to scope by).
function isBasicStaffRole(role: string): boolean {
  const normalized = role.trim().toUpperCase();
  return normalized === 'STAFF_CABANG' || normalized === 'CABANG' || normalized === 'EMPLOYEE';
}

// Safety cap on an otherwise-unbounded select('*') — well above the current
// real row count for this table (a single feedback form's worth of
// submissions), so normal callers (including the "export everything" modal)
// see no truncation; it just stops a single request from pulling the whole
// table if the dataset ever grows far beyond today's volume. Bump via the
// optional `limit` query param for a genuine larger export need.
const DEFAULT_SYNC_LIMIT = 5000;
const MAX_SYNC_LIMIT = 20000;

async function fetchFromSync(params: URLSearchParams, ownerEmail: string | null) {
  const requestedLimit = Number(params.get('limit'));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_SYNC_LIMIT)
    : DEFAULT_SYNC_LIMIT;

  let query = supabaseAdmin
    .from('joumpa_reports_sync')
    .select('*')
    .order('date_of_event', { ascending: false, nullsFirst: false })
    .order('row_number', { ascending: false })
    .range(0, limit - 1);

  const airlines = params.get('airlines');
  const branch = params.get('branch');
  const category = params.get('category');
  const serviceType = params.get('service_type');

  if (airlines) query = query.eq('airlines', airlines);
  if (branch) query = query.eq('branch', branch);
  if (category) query = query.eq('category', category);
  if (serviceType) query = query.eq('category_case_joumpa', serviceType);
  if (ownerEmail) query = query.or(`reporter_email.eq.${ownerEmail},email_address.eq.${ownerEmail}`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const reports = await enrichReportsWithComments(rows.map(rowToReport));
  return {
    records: rows.map(rowToRecord),
    reports,
    total: rows.length,
    source: 'sync',
  };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifySession(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role || '').trim().toUpperCase();
    const ownerEmail = isBasicStaffRole(role) ? String(payload.email || '').trim().toLowerCase() : null;

    const { searchParams } = new URL(request.url);
    if (searchParams.get('source') !== 'sheets') {
      const synced = await fetchFromSync(searchParams, ownerEmail);
      if (synced.total > 0 || searchParams.get('source') === 'sync') {
        return NextResponse.json(synced, {
          headers: {
            // Per-session RBAC-filtered data must never be cached in a shared/CDN cache.
            'Cache-Control': 'private, no-store, max-age=0',
          },
        });
      }
    }

    const sheets = await getGoogleSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: JOUMPA_SHEET_ID,
      range: `${SHEET_NAME}!A1:AZ`,
    });

    const allValues = response.data.values || [];
    if (allValues.length === 0) {
      return NextResponse.json({ records: [], total: 0 });
    }

    const headers = allValues[0].map((h: string) => String(h).trim());
    const dataRows = allValues.slice(1).filter(row => row.some(cell => cell?.toString().trim()));
    const records = parseRows(headers, dataRows);
    const reportByRecord = new Map(records.map((record, i) => [record, recordToReport(record, i + 2)]));

    let filtered = applyFilters(records, searchParams);
    if (ownerEmail) {
      filtered = filtered.filter((record) => record.email.trim().toLowerCase() === ownerEmail);
    }
    const filteredReports = filtered
      .map((record) => reportByRecord.get(record))
      .filter((report): report is Report => Boolean(report));
    const reportsWithComments = await enrichReportsWithComments(filteredReports);

    return NextResponse.json(
      { records: filtered, reports: reportsWithComments, total: filtered.length, source: 'sheets' },
      {
        headers: {
          // Per-session RBAC-filtered data must never be cached in a shared/CDN cache.
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[JOUMPA API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const REQUIRED_FIELDS: Array<keyof JoumpaFormInput> = [
  'date_of_event',
  'airlines',
  'flight_number',
  'station',
  'route',
  'category_report',
  'customer_joumpa',
  'category_case_joumpa',
  'report',
  'report_by',
];

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifySession(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as JoumpaFormInput;

    const missing = REQUIRED_FIELDS.filter((field) => !String(body[field] ?? '').trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const input: JoumpaFormInput = {
      ...body,
      email_address: body.email_address || payload.email,
      evidence_urls: Array.isArray(body.evidence_urls) ? body.evidence_urls : [],
    };

    const row = await JoumpaSyncService.createReport(input);
    return NextResponse.json({ success: true, id: row.id, sheet_id: row.sheet_id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[JOUMPA API] Create error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
