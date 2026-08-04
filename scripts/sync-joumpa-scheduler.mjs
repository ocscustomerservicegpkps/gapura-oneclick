#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import crypto from 'crypto';

const DRY_RUN = Boolean(process.env.DRY_RUN);
const SHEET_ID = process.env.JOUMPA_SHEET_ID;
const SHEET_NAME = process.env.JOUMPA_SHEET_NAME || 'Form Responses 1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const UPSERT_BATCH = 100;
const DELETE_BATCH = 500;

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY,
  JOUMPA_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: GOOGLE_EMAIL,
  GOOGLE_PRIVATE_KEY: GOOGLE_KEY,
};

const missingEnv = Object.entries(REQUIRED).filter(([, value]) => !value).map(([key]) => key);
if (missingEnv.length > 0) {
  console.error(`[FATAL] Missing environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const auth = new google.auth.JWT({
  email: GOOGLE_EMAIL,
  key: GOOGLE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheetsApi = google.sheets({ version: 'v4', auth });

function log(level, message, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`${ts} [${level}] ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(`${ts} [${level}] ${message}`);
  }
}

function clean(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const low = text.toLowerCase();
  return ['', '-', '#n/a', 'n/a', 'null', 'undefined', 'nil'].includes(low) ? '' : text;
}

function normalizeKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCategory(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('accident') || normalized.includes('incident') || normalized.includes('insiden')) return 'Accident / Incident';
  if (normalized.includes('occurrence') || normalized.includes('occurence')) return 'Occurrence';
  if (normalized.includes('compliment')) return 'Compliment';
  if (normalized.includes('complaint') || normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('irregular')) return 'Irregularity';
  return normalized.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function normalizeStatus(value) {
  const normalized = normalizeKey(value).toUpperCase();
  if (!normalized) return 'OPEN';
  if (['CLOSED', 'SELESAI', 'DONE', 'RESOLVED'].includes(normalized)) return 'CLOSED';
  return 'OPEN';
}

function normalizeSeverity(value) {
  const normalized = normalizeKey(value).toUpperCase();
  if (!normalized) return 'LOW';
  if (normalized.includes('TOP RISK')) return 'TOP RISK';
  if (normalized.includes('HIGH')) return 'HIGH';
  if (normalized.includes('MEDIUM')) return 'MEDIUM';
  if (normalized.includes('CRITICAL') || normalized.includes('URGENT')) return 'CRITICAL';
  return 'LOW';
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400000));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = clean(value);
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const date = new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const iso = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) {
    const date = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function isoDate(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function isoTimestamp(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function evidenceUrls(value) {
  const raw = clean(value);
  if (!raw) return null;
  const urls = raw.match(/https?:\/\/[^\s|;,]+/gi) || [];
  return urls.length ? Array.from(new Set(urls)) : null;
}

const CANDIDATES = {
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
  supporting_evidence: ['Supporting Evidence (Photos/Documents)', 'Supporting Evidence (Photos/Documents)  ', 'Supporting Evidence'],
  severity_level: ['Severity Level of Case Report', 'Severity Level'],
  status: ['Status of Case Report', 'Status'],
  final_remarks: ['Final Remarks'],
  customer_satisfaction_score: ["Based on the passenger’s feedback, how satisfied was the passenger with Joumpa service?", "Based on the passenger's feedback, how satisfied was the passenger with Joumpa service?"],
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

function buildColumnMap(headers) {
  const normalizedHeaders = headers.map(normalizeKey);
  const map = {};
  for (const [prop, candidates] of Object.entries(CANDIDATES)) {
    const idx = candidates
      .map(normalizeKey)
      .map((candidate) => normalizedHeaders.indexOf(candidate))
      .find((index) => index !== -1);
    if (idx !== undefined) map[prop] = idx;
  }
  return map;
}

function buildFingerprint(row) {
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
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function parseRow(raw, headers, colMap, rowIndex) {
  const rowNumber = rowIndex + 2;
  const get = (prop) => {
    const idx = colMap[prop];
    return idx === undefined ? '' : clean(raw[idx]);
  };
  const rawData = {};
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

  const row = {
    sheet_id: `${SHEET_NAME}!row_${rowNumber}`,
    source_sheet: SHEET_NAME,
    source_spreadsheet_id: SHEET_ID,
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
    title: get('report') || '(Tanpa Judul)',
    description: get('report') || null,
    root_caused: get('root_caused') || null,
    root_cause: get('root_caused') || null,
    action_taken: get('action_taken') || null,
    immediate_action: get('action_taken') || null,
    preventive_action: get('preventive_action') || null,
    final_remarks: get('final_remarks') || null,
    kps_remarks: get('final_remarks') || null,
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

async function fetchSheetRows() {
  log('INFO', `Fetching Joumpa rows from "${SHEET_NAME}"...`);
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!A1:AZ`,
  });
  const values = res.data.values || [];
  if (values.length === 0) return [];
  const headers = (values[0] || []).map((header) => clean(header));
  const colMap = buildColumnMap(headers);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => clean(cell)))
    .map((row, idx) => parseRow(row, headers, colMap, idx));
}

async function upsertRows(rows) {
  if (DRY_RUN) {
    log('INFO', `[DRY RUN] Would upsert ${rows.length} Joumpa rows`);
    return 0;
  }
  let errors = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from('joumpa_reports_sync')
      .upsert(batch, { onConflict: 'sheet_id', ignoreDuplicates: false });
    if (error) {
      errors += batch.length;
      log('ERROR', `Joumpa upsert failed: ${error.message}`);
    }
  }
  return errors;
}

async function deleteOrphans(rows) {
  const currentSheetIds = new Set(rows.map((row) => row.sheet_id));
  const { data, error } = await supabase
    .from('joumpa_reports_sync')
    .select('id, sheet_id');
  if (error) {
    log('WARN', `Could not fetch Joumpa rows for orphan cleanup: ${error.message}`);
    return 0;
  }
  const orphans = (data || []).filter((row) => !currentSheetIds.has(row.sheet_id));
  if (DRY_RUN) {
    log('INFO', `[DRY RUN] Would delete ${orphans.length} Joumpa orphan rows`);
    return 0;
  }
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    const ids = orphans.slice(i, i + DELETE_BATCH).map((row) => row.id);
    const { data: removed, error: removeError } = await supabase
      .from('joumpa_reports_sync')
      .delete()
      .in('id', ids)
      .select('id');
    if (removeError) {
      log('WARN', `Could not delete Joumpa orphan rows: ${removeError.message}`);
    } else {
      deleted += removed?.length || 0;
    }
  }
  return deleted;
}

async function verify(rows) {
  const { count, error } = await supabase
    .from('joumpa_reports_sync')
    .select('*', { count: 'exact', head: true });
  if (error) {
    log('WARN', `Could not verify Joumpa count: ${error.message}`);
    return;
  }
  log(count === rows.length ? 'INFO' : 'WARN', `Joumpa count: sheet=${rows.length}, db=${count || 0}`);
}

async function main() {
  const started = Date.now();
  const rows = await fetchSheetRows();
  const errors = await upsertRows(rows);
  const deleted = await deleteOrphans(rows);
  await verify(rows);
  log('INFO', 'Joumpa sync complete', {
    rows: rows.length,
    errors,
    deleted,
    durationMs: Date.now() - started,
  });
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  log('ERROR', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
