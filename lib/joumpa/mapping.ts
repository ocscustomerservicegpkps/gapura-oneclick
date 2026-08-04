import 'server-only';

import { createHash } from 'crypto';
import { v5 as uuidv5 } from 'uuid';
import { escapeSpreadsheetCell } from '@/lib/security/sanitize';

// Shared JOUMPA sheet <-> Supabase mapping. Ported from the proven
// scripts/sync-joumpa-scheduler.mjs so the in-app two-way sync and the
// standalone scheduler stay byte-for-byte compatible.

export const JOUMPA_SHEET_ID = process.env.JOUMPA_SHEET_ID || '1X4KN3ukUtMsd4udL-e2OdNIMheJqutXp0IbfE-Cwwsw';
export const JOUMPA_SHEET_NAME = process.env.JOUMPA_SHEET_NAME || 'Form Responses 1';

// Same namespace the rest of the app uses so id === uuidv5(sheet_id).
const IRRS_NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function joumpaIdFromSheetId(sheetId: string): string {
  return uuidv5(sheetId, IRRS_NAMESPACE_UUID);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JoumpaRow = Record<string, any>;

export function clean(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const low = text.toLowerCase();
  return ['', '-', '#n/a', 'n/a', 'null', 'undefined', 'nil'].includes(low) ? '' : text;
}

function normalizeKey(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCategory(value: unknown): string {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('accident') || normalized.includes('incident') || normalized.includes('insiden')) return 'Accident / Incident';
  if (normalized.includes('occurrence') || normalized.includes('occurence')) return 'Occurrence';
  if (normalized.includes('compliment')) return 'Compliment';
  if (normalized.includes('complaint') || normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('irregular')) return 'Irregularity';
  return normalized.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function normalizeStatus(value: unknown): string {
  const normalized = normalizeKey(value).toUpperCase();
  if (!normalized) return 'OPEN';
  if (['CLOSED', 'SELESAI', 'DONE', 'RESOLVED'].includes(normalized)) return 'CLOSED';
  return 'OPEN';
}

function normalizeSeverity(value: unknown): string {
  const normalized = normalizeKey(value).toUpperCase();
  if (!normalized) return 'LOW';
  if (normalized.includes('TOP RISK')) return 'TOP RISK';
  if (normalized.includes('HIGH')) return 'HIGH RISK';
  if (normalized.includes('MEDIUM')) return 'MEDIUM';
  if (normalized.includes('CRITICAL') || normalized.includes('URGENT')) return 'TOP RISK';
  return 'LOW';
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400000));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = clean(value);
  if (!raw) return null;
  // UTC-based construction: new Date(y, m, d) builds local midnight, which
  // isoDate()'s toISOString() then converts to UTC — shifting the calendar
  // day for any host timezone with a non-zero offset (e.g. WIB, UTC+7,
  // pushes local midnight back to the previous UTC day). Date.UTC keeps the
  // parsed calendar day host-timezone-independent.
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const date = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const iso = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) {
    const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function isoDate(value: unknown): string | null {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function isoTimestamp(value: unknown): string | null {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function evidenceUrls(value: unknown): string[] | null {
  const raw = clean(value);
  if (!raw) return null;
  const urls = raw.match(/https?:\/\/[^\s|;,]+/gi) || [];
  return urls.length ? Array.from(new Set(urls)) : null;
}

// prop (Supabase column) -> possible sheet headers. Used for both read and write.
const CANDIDATES: Record<string, string[]> = {
  no: ['No'],
  timestamp_raw: ['Timestamp'],
  date_of_event: ['Date of Event'],
  report_by: ['Report By'],
  jenis_maskapai: ['Jenis Maskapai'],
  airlines: ['Airlines'],
  flight_number: ['Flight Number'],
  station: ['Station (cth: CGK, UPG, DPS)', 'Station'],
  hub: ['HUB', 'Hub'],
  route: ['Route'],
  delay_code: ['Delay Code'],
  category_report: ['Category Report', 'Report Category'],
  area: ['Area'],
  report: ['Report'],
  root_caused: ['Root Caused', 'Root Cause'],
  action_taken: ['Action Taken'],
  preventive_action: ['Preventive Action'],
  email_address: ['Email Address'],
  category_case_joumpa: ['Category Case Joumpa'],
  joumpa_compliment_report_excellent_service: ['Joumpa Compliment Report Excellent Service'],
  reservation_scheduling: ['Reservation & Scheduling', 'Reservation Scheduling'],
  pax_assistance_staff_service_performance: ['Pax Assistance / Staff Service Performance', 'Pax Assistance Staff Service Performance'],
  baggage_delivery_baggage_assistance: ['Baggage Delivery & Baggage Assistance', 'Baggage Delivery Baggage Assistance'],
  administration_payment_documentation_marketing: ['Administration, Payment, Documentation & Marketing', 'Administration Payment Documentation Marketing'],
  supporting_evidence: ['Supporting Evidence (Photos/Documents)', 'Supporting Evidence'],
  severity_level: ['Severity Level of Case Report', 'Severity Level'],
  status: ['Status of Case Report', 'Status'],
  final_remarks: ['Final Remarks'],
  remarks_by: ['Remarks By'],
  customer_satisfaction_score: ['Based on the passenger’s feedback, how satisfied was the passenger with Joumpa service?', "Based on the passenger's feedback, how satisfied was the passenger with Joumpa service?"],
  customer_joumpa: ['Customer Joumpa'],
  detail_customer_joumpa: ['Detail Customer Joumpa'],
  corporate: ['Corporate'],
  customer_company_profile_corporate: ['Customer Company Profile Corporate'],
  detail_customer_corporate: ['Detail Customer Corporate'],
  non_corporate: ['Non - Corporate', 'Non Corporate'],
  customer_background_non_corporate: ['Customer Background Non - Corporate', 'Customer Background Non Corporate'],
  detail_customer_non_corporate: ['Detail Customer Non - Corporate', 'Detail Customer Non Corporate'],
  customer_satisfaction_label: ['Rating Rata-Rata', 'Rating Rata Rata'],
  case_joumpa: ['Case Joumpa'],
  airport_name: ['Nama Bandara / Airport Name', 'Airport Name', 'Nama Bandara'],
  airport_code: ['Kode Bandara', 'Airport Code'],
  branch_code: ['Kode Cabang', 'Branch Code'],
};

export function buildColumnMap(headers: string[]): Record<string, number> {
  const normalizedHeaders = headers.map(normalizeKey);
  const map: Record<string, number> = {};
  for (const [prop, candidates] of Object.entries(CANDIDATES)) {
    const idx = candidates
      .map(normalizeKey)
      .map((candidate) => normalizedHeaders.indexOf(candidate))
      .find((index) => index !== -1);
    if (idx !== undefined) map[prop] = idx;
  }
  return map;
}

function buildFingerprint(row: JoumpaRow): string {
  const parts = [
    row.source_spreadsheet_id,
    row.source_sheet,
    row.date_of_event,
    row.branch,
    row.airlines,
    row.flight_number,
    row.category,
    row.case_category,
    row.report,
    row.reporter_email,
  ].map((part) => normalizeKey(part));
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

// Derive the full Supabase row from the raw sheet columns of a single row.
export function parseSheetRowValues(raw: string[], headers: string[], colMap: Record<string, number>, rowIndex: number): JoumpaRow {
  const rowNumber = rowIndex + 2;
  const get = (prop: string) => {
    const idx = colMap[prop];
    return idx === undefined ? '' : clean(raw[idx]);
  };
  const rawData: Record<string, string> = {};
  headers.forEach((header, idx) => {
    rawData[header] = clean(raw[idx]);
  });

  const category = normalizeCategory(get('category_report'));
  const station = get('station').toUpperCase();
  const evidence = evidenceUrls(get('supporting_evidence'));
  const broadCategory = get('category_case_joumpa') || '';
  const detailCategory = [
    get('case_joumpa'),
    get('joumpa_compliment_report_excellent_service'),
    get('reservation_scheduling'),
    get('pax_assistance_staff_service_performance'),
    get('baggage_delivery_baggage_assistance'),
    get('administration_payment_documentation_marketing'),
  ].find(Boolean) || '';
  const caseCategory = detailCategory || broadCategory;
  const inferredBroadCategory = broadCategory || [
    get('category_case_joumpa'),
    get('reservation_scheduling') ? 'Reservation & Scheduling' : '',
    get('pax_assistance_staff_service_performance') ? 'Pax Assistance / Staff Service Performance' : '',
    get('baggage_delivery_baggage_assistance') ? 'Baggage Delivery & Baggage Assistance' : '',
    get('administration_payment_documentation_marketing') ? 'Administration, Payment, Documentation & Marketing' : '',
    get('joumpa_compliment_report_excellent_service') ? 'Joumpa Compliment Excellent Service' : '',
  ].find(Boolean) || '';
  const severityLevel = get('severity_level');

  const sheetId = `${JOUMPA_SHEET_NAME}!row_${rowNumber}`;
  const row: JoumpaRow = {
    id: joumpaIdFromSheetId(sheetId),
    sheet_id: sheetId,
    source_sheet: JOUMPA_SHEET_NAME,
    source_spreadsheet_id: JOUMPA_SHEET_ID,
    row_number: rowNumber,
    no: get('no') || null,
    timestamp_raw: get('timestamp_raw') || null,
    form_timestamp: isoTimestamp(get('timestamp_raw')),
    date_of_event: isoDate(get('date_of_event')),
    incident_date: isoDate(get('date_of_event')),
    report_by: get('report_by') || null,
    reporter_name: get('report_by') || null,
    email_address: get('email_address') || null,
    reporter_email: get('email_address') || null,
    jenis_maskapai: get('jenis_maskapai') || null,
    airlines: get('airlines') || null,
    airline: get('airlines') || null,
    flight_number: get('flight_number') || null,
    station: station || null,
    station_code: station || null,
    branch: station || null,
    hub: get('hub') || null,
    route: get('route') || null,
    delay_code: get('delay_code') || null,
    category_report: get('category_report') || null,
    category: category || null,
    main_category: category || null,
    area: get('area') || null,
    service_business_type: 'Joumpa Service',
    status: normalizeStatus(get('status')),
    severity: normalizeSeverity(severityLevel),
    severity_level: severityLevel || null,
    report: get('report') || null,
    title: get('report') || null,
    description: get('report') || null,
    root_caused: get('root_caused') || null,
    root_cause: get('root_caused') || null,
    action_taken: get('action_taken') || null,
    immediate_action: get('action_taken') || null,
    preventive_action: get('preventive_action') || null,
    final_remarks: get('final_remarks') || null,
    kps_remarks: get('final_remarks') || null,
    remarks_by: get('remarks_by') || null,
    category_case_joumpa: inferredBroadCategory || null,
    joumpa_compliment_report_excellent_service: get('joumpa_compliment_report_excellent_service') || null,
    reservation_scheduling: get('reservation_scheduling') || null,
    pax_assistance_staff_service_performance: get('pax_assistance_staff_service_performance') || null,
    baggage_delivery_baggage_assistance: get('baggage_delivery_baggage_assistance') || null,
    administration_payment_documentation_marketing: get('administration_payment_documentation_marketing') || null,
    case_joumpa: get('case_joumpa') || null,
    case_category: caseCategory || null,
    remarks_case: inferredBroadCategory || null,
    case_classification: detailCategory || inferredBroadCategory || null,
    identification_of_root: get('root_caused') || null,
    supporting_evidence: get('supporting_evidence') || null,
    evidence_url: evidence?.[0] || null,
    evidence_urls: evidence,
    customer_satisfaction_score: get('customer_satisfaction_score') || null,
    customer_satisfaction_label: get('customer_satisfaction_label') || null,
    customer_joumpa: get('customer_joumpa') || null,
    detail_customer_joumpa: get('detail_customer_joumpa') || null,
    corporate: get('corporate') || null,
    customer_company_profile_corporate: get('customer_company_profile_corporate') || null,
    detail_customer_corporate: get('detail_customer_corporate') || null,
    non_corporate: get('non_corporate') || null,
    customer_background_non_corporate: get('customer_background_non_corporate') || null,
    detail_customer_non_corporate: get('detail_customer_non_corporate') || null,
    airport_name: get('airport_name') || null,
    airport_code: get('airport_code') || null,
    branch_code: get('branch_code') || null,
    raw_data: rawData,
    synced_at: new Date().toISOString(),
    sync_version: 1,
  };

  row.source_fingerprint = buildFingerprint(row);
  return row;
}

// Supabase row -> sheet cell values (positional, sized to the live headers).
// Reuses CANDIDATES so read and write share one source of truth. VLOOKUP /
// form-only columns we don't own are left blank in the backup mirror.
export function buildSheetRowValues(headers: string[], row: JoumpaRow): string[] {
  const colMap = buildColumnMap(headers);
  const values = new Array<string>(headers.length).fill('');
  for (const [prop, idx] of Object.entries(colMap)) {
    const value = row[prop];
    if (value == null) continue;
    const cell = Array.isArray(value) ? value.filter(Boolean).join(' | ') : String(value);
    values[idx] = escapeSpreadsheetCell(cell);
  }
  return values;
}

// Build a full Supabase row from create-form input (before we know the sheet
// row number). Mirrors parseSheetRowValues' derivations.
export interface JoumpaFormInput {
  date_of_event?: string;
  airlines?: string;
  flight_number?: string;
  station?: string;
  route?: string;
  category_report?: string;
  customer_joumpa?: string;
  corporate?: string;
  customer_company_profile_corporate?: string;
  detail_customer_corporate?: string;
  non_corporate?: string;
  customer_background_non_corporate?: string;
  detail_customer_non_corporate?: string;
  category_case_joumpa?: string;
  joumpa_compliment_report_excellent_service?: string;
  reservation_scheduling?: string;
  pax_assistance_staff_service_performance?: string;
  baggage_delivery_baggage_assistance?: string;
  administration_payment_documentation_marketing?: string;
  report?: string;
  root_caused?: string;
  action_taken?: string;
  preventive_action?: string;
  severity_level?: string;
  status?: string;
  report_by?: string;
  email_address?: string;
  evidence_urls?: string[];
  user_id?: string;
}

export function buildRecordFromForm(input: JoumpaFormInput): JoumpaRow {
  const category = normalizeCategory(input.category_report);
  const station = clean(input.station).toUpperCase();
  const evidence = (input.evidence_urls || []).map((u) => clean(u)).filter(Boolean);
  const broadCategory = clean(input.category_case_joumpa) || '';
  const detailCategory = [
    input.joumpa_compliment_report_excellent_service,
    input.reservation_scheduling,
    input.pax_assistance_staff_service_performance,
    input.baggage_delivery_baggage_assistance,
    input.administration_payment_documentation_marketing,
  ].map(clean).find(Boolean) || '';
  const severityLevel = clean(input.severity_level);
  const nowIso = new Date().toISOString();
  const eventIso = isoDate(input.date_of_event);
  const report = clean(input.report);

  const row: JoumpaRow = {
    source_sheet: JOUMPA_SHEET_NAME,
    source_spreadsheet_id: JOUMPA_SHEET_ID,
    timestamp_raw: nowIso,
    form_timestamp: nowIso,
    date_of_event: eventIso,
    incident_date: eventIso,
    report_by: clean(input.report_by) || null,
    reporter_name: clean(input.report_by) || null,
    email_address: clean(input.email_address) || null,
    reporter_email: clean(input.email_address) || null,
    user_id: clean(input.user_id) || null,
    airlines: clean(input.airlines) || null,
    airline: clean(input.airlines) || null,
    flight_number: clean(input.flight_number) || null,
    station: station || null,
    station_code: station || null,
    branch: station || null,
    route: clean(input.route) || null,
    category_report: clean(input.category_report) || null,
    category: category || null,
    main_category: category || null,
    service_business_type: 'Joumpa Service',
    status: normalizeStatus(input.status),
    severity: normalizeSeverity(severityLevel),
    severity_level: severityLevel || null,
    report: report || null,
    title: report || null,
    description: report || null,
    root_caused: clean(input.root_caused) || null,
    root_cause: clean(input.root_caused) || null,
    action_taken: clean(input.action_taken) || null,
    immediate_action: clean(input.action_taken) || null,
    preventive_action: clean(input.preventive_action) || null,
    category_case_joumpa: broadCategory || null,
    joumpa_compliment_report_excellent_service: clean(input.joumpa_compliment_report_excellent_service) || null,
    reservation_scheduling: clean(input.reservation_scheduling) || null,
    pax_assistance_staff_service_performance: clean(input.pax_assistance_staff_service_performance) || null,
    baggage_delivery_baggage_assistance: clean(input.baggage_delivery_baggage_assistance) || null,
    administration_payment_documentation_marketing: clean(input.administration_payment_documentation_marketing) || null,
    case_category: (detailCategory || broadCategory) || null,
    remarks_case: broadCategory || null,
    case_classification: (detailCategory || broadCategory) || null,
    identification_of_root: clean(input.root_caused) || null,
    supporting_evidence: evidence.join(' | ') || null,
    evidence_url: evidence[0] || null,
    evidence_urls: evidence.length ? evidence : null,
    customer_joumpa: clean(input.customer_joumpa) || null,
    corporate: clean(input.corporate) || null,
    customer_company_profile_corporate: clean(input.customer_company_profile_corporate) || null,
    detail_customer_corporate: clean(input.detail_customer_corporate) || null,
    non_corporate: clean(input.non_corporate) || null,
    customer_background_non_corporate: clean(input.customer_background_non_corporate) || null,
    detail_customer_non_corporate: clean(input.detail_customer_non_corporate) || null,
    detail_customer_joumpa: clean(input.corporate ? input.detail_customer_corporate : input.detail_customer_non_corporate) || null,
    synced_at: nowIso,
    sync_version: 1,
  };
  row.source_fingerprint = buildFingerprint(row);
  return row;
}
