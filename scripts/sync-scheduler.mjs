#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { v5 as uuidv5 } from 'uuid';
import { buildReportFingerprint } from '../lib/report-fingerprint.ts';
import { formatWibDate, parseDate } from '../lib/wib-date.ts';
import { checkOrphanDeletion, diffAgainstStored, stripAppOwnedColumns } from '../lib/report-sync-guard.ts';

// Must match ReportsService.getReportUuid / buildReportsSyncRow — a stored
// row's id has to equal uuidv5(sheet_id) or the app cannot find it.
const IRRS_NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const DRY_RUN = Boolean(process.env.DRY_RUN);
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const REPORT_SHEETS = ['NON CARGO', 'CGO'];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const PAGE_SIZE = 1000;
const UPSERT_BATCH = 100;
const DELETE_BATCH = 500;

const VALID_COLUMNS = new Set([
  'sheet_id','user_id','title','description','location','reporter_email',
  'evidence_url','evidence_urls','status','severity','priority',
  'flight_number','aircraft_reg','is_flight_related','gse_number','gse_name',
  'is_gse_related','station_id','unit_id','location_id','incident_type_id',
  'category','main_category','investigator_notes','manager_notes',
  'partner_response_notes','validation_notes','partner_evidence_urls',
  'source_sheet','original_id','row_number','created_at','updated_at',
  'resolved_at','sla_deadline','incident_date','date_of_event',
  'reporting_branch','hub','route','branch','station_code','reporter_name',
  'specific_location','airlines','airline','jenis_maskapai',
  'reference_number','root_caused','root_cause','action_taken',
  'immediate_action','kps_remarks','gapura_kps_action_taken',
  'preventive_action','remarks_gapura_kps','area',
  'terminal_area_category','apron_area_category','general_category',
  'week_in_month','report','irregularity_complain_category',
  'service_business_type','remarks_case','case_category','severity_level',
  'case_cgo','supporting_evidence','category_case_joumpa',
  'reservation_scheduling','pax_assistance_staff_service_performance',
  'baggage_delivery_baggage_assistance',
  'administration_payment_documentation_marketing',
  'gse_available_requirement','gse_requirement','gse_motorized',
  'gse_non_motorized','category_case_gse','category_case_cargo',
  'kode_cabang','kode_hub','maskapai_lookup','case_classification',
  'identification_of_root','accident_incident','issue_caused',
  'breakdown_caused','remarks_by','esklasi_divisi',
  'lokal_mpa_lookup','delay_code','delay_duration',
  'primary_tag','sub_category_note','target_division',
  'synced_at','sync_version','source_fingerprint',
]);

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: GOOGLE_EMAIL,
  GOOGLE_PRIVATE_KEY: GOOGLE_KEY,
};

const missingEnv = Object.entries(REQUIRED).filter(([, v]) => !v).map(([k]) => k);
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

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

function log(level, msg, data) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`${ts} [${level}] ${msg}`, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(`${ts} [${level}] ${msg}`);
  }
}

function normalizeText(val) {
  if (val == null) return '';
  const raw = Array.isArray(val) ? val.join(' ') : String(val);
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// buildReportFingerprint is imported from lib/report-fingerprint, not
// reimplemented here. This script used to carry its own copy, and the copy had
// drifted: it was missing root_caused and action_taken, resolved branch and
// area-category differently, and normalized unparseable dates to ''. Every
// stored fingerprint is written by the app's version, so the copy disagreed
// with all of them — the script saw all 1179 rows as changed on every run, and
// writing them replaced each row's fingerprint with the drifted value, which
// then made the app's own sync see every row as changed too.

// parseDate/formatWibDate likewise come from lib/wib-date. The copy here built
// dates with new Date(y, m, d) — midnight in the *process* timezone — so the
// same sheet cell resolved to a different day in dev (Asia/Jakarta) than on a
// UTC host, and .toISOString().slice(0,10) then stored the UTC day. 50 rows
// were a day behind what the app stored for the same cell.
function toIsoOrNow(val) {
  const d = parseDate(val);
  return d ? d.toISOString() : new Date().toISOString();
}

function normalizeStatus(val) {
  if (!val) return 'OPEN';
  const u = String(val).trim().toUpperCase();
  if (['CLOSED','SELESAI'].includes(u)) return 'CLOSED';
  if (['OPEN','MENUNGGU','ACTIVE'].includes(u)) return 'OPEN';
  if (['ON PROGRESS','ON_PROGRESS','SUDAH_DIVERIFIKASI'].includes(u)) return 'ON PROGRESS';
  return u;
}

function normalizeCategory(val) {
  const n = normalizeText(val);
  if (!n) return '';
  if (n.includes('accident') || n.includes('incident') || n.includes('insiden') || n.includes('kecelakaan')) return 'Accident / Incident';
  if (n.includes('occurrence') || n.includes('occurence')) return 'Occurrence';
  if (n.includes('irregular')) return 'Irregularity';
  if (n.includes('complain') || n.includes('complaint')) return 'Complaint';
  if (n.includes('compliment')) return 'Compliment';
  return n.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

const COLUMN_CANDIDATES = {
  date_of_event: ['Date_of_Event','Date of Event','Date','Tanggal'],
  jenis_maskapai: ['Jenis_Maskapai','Jenis Maskapai'],
  airline: ['Airlines','Airline','Maskapai'],
  airlines: ['Airlines','Airline','Maskapai'],
  flight_number: ['Flight_Number','Flight Number'],
  reporting_branch: ['Reporting_Branch','Reporting Branch'],
  branch: ['Branch','Cabang','Reporting_Branch','Reporting Branch','Station'],
  route: ['Route','Rute'],
  main_category: ['Report_Category','Report Category','Kategori Laporan','Main Category'],
  irregularity_complain_category: ['Irregularity_Complain_Category','Irregularity/Complain Category'],
  accident_incident: ['Accident / Incident','Accident_Incident','Accident Incident'],
  report: ['Report','Laporan','Description','Deskripsi'],
  description: ['Report','Laporan','Description','Deskripsi'],
  root_caused: ['Root_Caused','Root Caused','Root Cause'],
  root_cause: ['Root_Caused','Root Caused','Root Cause'],
  identification_of_root: ['Identification of Root','Identification_of_Root'],
  issue_caused: ['Issue Caused','Issue_Caused'],
  breakdown_caused: ['Breakdown Caused','Breakdown_Caused'],
  action_taken: ['Action_Taken','Action Taken'],
  immediate_action: ['Action_Taken','Action Taken'],
  kps_remarks: ['Gapura_KPS_Remarks','Gapura KPS Remarks','KPS Remarks','Remarks Gapura KPS','Remarks_Gapura_KPS'],
  gapura_kps_action_taken: ['Gapura_KPS_Action_Taken','Gapura KPS Action Taken'],
  preventive_action: ['Preventive Action','Preventive_Action'],
  reporter_name: ['Report_By','Report By','Pelapor','Reporter'],
  reporter_email: ['Reporter Email','Email'],
  specific_location: ['Location of Incident','Location_of_Incident','Specific Location'],
  evidence_url: ['Upload_Irregularity_Photo','Upload Irregularity Photo','Link Open (Be Careful for Sharing)','Link Open','Evidence','Bukti'],
  area: ['Area','Wilayah'],
  terminal_area_category: ['Terminal_Area_Category','Terminal Area Category'],
  apron_area_category: ['Apron_Area_Category','Apron Area Category'],
  general_category: ['General_Category','General Category'],
  status: ['Status'],
  severity_level: ['Severity Level','Severity_Level'],
  week_in_month: ['Per_Week_in_Month','Per Week in Month'],
  kode_cabang: ['KODE_CABANG_VLOOKUP','KODE CABANG (VLOOKUP)'],
  maskapai_lookup: ['MASKAPAI_VLOOKUP','MASKAPAI (VLOOKUP)'],
  lokal_mpa_lookup: ['Lokal_MPA_VLOOKUP','Lokal / MPA (VLOOKUP)'],
  case_classification: ['Case Classification','Case_Classification'],
  case_category: ['Case Category','Case_Category','Category Case GSE','Category Case Cargo (CGO)','Category Case Cargo','Category Case Joumpa'],
  category_case_gse: ['Category Case GSE'],
  gse_available_requirement: ['GSE Available & Requirement','GSE Available Requirement','GSE_Available_Requirement'],
  gse_requirement: ['GSE Requirement','GSE_Requirement'],
  gse_motorized: ['GSE MOTORIZED','GSE Motorized'],
  gse_non_motorized: ['GSE NON - MOTORIZED','GSE NON MOTORIZED','GSE Non-Motorized'],
  category_case_cargo: ['Category Case Cargo (CGO)','Category Case Cargo'],
  supporting_evidence: ['Supporting Evidence','Supporting_Evidence'],
  case_cgo: ['Case CGO'],
  category_case_joumpa: ['Category Case Joumpa'],
  reservation_scheduling: ['Reservation & Scheduling','Reservation Scheduling'],
  pax_assistance_staff_service_performance: ['Pax Assistance / Staff Service Performance','Pax Assistance Staff Service Performance'],
  baggage_delivery_baggage_assistance: ['Baggage Delivery & Baggage Assistance','Baggage Delivery Baggage Assistance'],
  administration_payment_documentation_marketing: ['Administration, Payment, Documentation & Marketing','Administration Payment Documentation Marketing'],
  hub: ['Hub','HUB'],
  kode_hub: ['KODE_HUB_VLOOKUP','KODE HUB (VLOOKUP)'],
  delay_code: ['Delay Code','Delay_Code'],
  delay_duration: ['Delay Duration','Delay_Duration'],
  primary_tag: ['Primary Tag','Primary_Tag'],
  sub_category_note: ['Sub Category Note','Sub_Category_Note'],
  esklasi_divisi: ['ESKLASI DIVISI','ESKLASI_DIVISI'],
  reference_number: ['Reference Number','Reference_Number'],
  remarks_by: ['Remarks By','Remarks_By'],
};

function buildColumnIndexMap(headers) {
  const colMap = {};
  const used = new Set();
  const headerLower = headers.map(h => h.toLowerCase());
  for (const [prop, candidates] of Object.entries(COLUMN_CANDIDATES)) {
    for (const c of candidates) {
      const idx = headerLower.indexOf(c.toLowerCase());
      if (idx !== -1 && !used.has(idx)) { colMap[prop] = idx; used.add(idx); break; }
    }
  }
  return colMap;
}

/** Non-enumerable flag parseRow leaves on a row; never reaches the wire. */
const SHEET_STATUS_MARK = Symbol('hasSheetStatus');

/**
 * Columns this script used to invent rather than read. severity/priority were
 * hardcoded 'low'; is_flight_related and immediate_action were derived from
 * other cells. The app's sync derives all four differently — it stores 'LOW',
 * is_flight_related false, immediate_action null — so every run rewrote them
 * and the app's next run rewrote them back. The sheet is not their source, so
 * this script has no business writing them.
 */
const SCHEDULER_DERIVED_COLUMNS = [
  'severity', 'priority', 'is_flight_related', 'is_gse_related', 'immediate_action',
];

/**
 * Written when creating a row, never overwritten on an existing one.
 *
 * created_at is a creation timestamp — this script derives it from the event
 * date, which is fine for a new row but has no business rewriting an existing
 * one. resolved_at is derived from status rather than read from the sheet, and
 * the app maintains its own. Both are excluded from change detection anyway, so
 * carrying them forward costs nothing.
 *
 * date_of_event / incident_date are deliberately NOT here: those are the
 * sheet's to change, and a mirror that ignored edits to them would be useless.
 */
const SCHEDULER_INSERT_ONLY_COLUMNS = ['created_at', 'resolved_at'];

/**
 * The row as it will actually be written. A null from the sheet is not an
 * instruction to clear a stored value — the parser cannot tell "this sheet has
 * no such column" from "this cell is empty", and for a mirror of the sheet the
 * safe reading of an absent value is "leave what is there". So nulls fall back
 * to the stored value, which also keeps every row's key set identical (parseRow
 * always emits the same keys) — PostgREST pads a batch to the union of its
 * keys, so a row missing one would have it reset to DEFAULT.
 */
function effectivePayload(row, existing) {
  const payload = toPayload(row, existing);
  if (!existing) return payload;

  const merged = {};
  for (const [key, value] of Object.entries(payload)) {
    merged[key] = SCHEDULER_INSERT_ONLY_COLUMNS.includes(key)
      ? existing[key] ?? value
      : value ?? existing[key] ?? null;
  }
  return merged;
}

/**
 * The sheet is authoritative for the columns it actually carries — and only
 * those. Anything the app owns is already gone (stripAppOwnedColumns), and a
 * sheet with no Status column must not reset the workflow status every run, so
 * the stored value is carried forward instead of normalizeStatus's 'OPEN'.
 */
function toPayload(row, existing) {
  if (row[SHEET_STATUS_MARK]) return row;
  return { ...row, status: existing?.status ?? row.status };
}

function parseRow(raw, colMap, sheetName, rowIndex) {
  const rowNumber = rowIndex + 2;
  const sheetId = `${sheetName}!row_${rowNumber}`;

  const get = (prop) => {
    const idx = colMap[prop];
    if (idx === undefined || raw[idx] === undefined || raw[idx] === '') return undefined;
    return String(raw[idx]).trim();
  };

  const eventDate = parseDate(get('date_of_event'));
  // The instant is midnight WIB, which in UTC is 17:00 the day before — so the
  // calendar day has to come from formatWibDate, not from slicing the ISO
  // string. Slicing is what put 50 rows a day behind the app's value.
  const eventInstant = eventDate ? eventDate.toISOString() : null;
  const eventDay = eventDate ? formatWibDate(eventDate) : null;

  const evidenceRaw = get('evidence_url') || '';
  const evidenceUrls = evidenceRaw ? evidenceRaw.split(/\s*(?:\||;|\n+)\s*/).map(s => s.trim()).filter(Boolean) : null;

  let area = get('area') || '';
  if (sheetName === 'CGO' && !area) area = 'CARGO';
  else if (sheetName === 'NON CARGO' && !area) {
    if (get('terminal_area_category')) area = 'TERMINAL';
    else if (get('apron_area_category')) area = 'APRON';
  }

  const mainCat = normalizeCategory(get('main_category') || get('irregularity_complain_category') || get('accident_incident'));
  const sheetStatus = get('status');
  const status = normalizeStatus(sheetStatus);
  const hasJoumpaFields = Boolean(
    get('category_case_joumpa') ||
    get('reservation_scheduling') ||
    get('pax_assistance_staff_service_performance') ||
    get('baggage_delivery_baggage_assistance') ||
    get('administration_payment_documentation_marketing')
  );
  const hasGseFields = Boolean(
    get('category_case_gse') ||
    get('gse_available_requirement') ||
    get('gse_requirement') ||
    get('gse_motorized') ||
    get('gse_non_motorized')
  );
  const hasCargoFields = sheetName === 'CGO' || Boolean(get('case_cgo') || get('category_case_cargo'));
  const serviceBusinessType = hasGseFields
    ? 'GSE Service Performance'
    : hasJoumpaFields
      ? 'Joumpa Service'
      : hasCargoFields
        ? 'Cargo Service'
        : null;
  const domainCaseCategory =
    get('case_category') ||
    get('category_case_gse') ||
    get('category_case_cargo') ||
    get('category_case_joumpa') ||
    get('reservation_scheduling') ||
    get('pax_assistance_staff_service_performance') ||
    get('baggage_delivery_baggage_assistance') ||
    get('administration_payment_documentation_marketing') ||
    get('gse_available_requirement') ||
    get('gse_motorized') ||
    get('gse_non_motorized') ||
    null;

  const esklasi = get('esklasi_divisi');
  const targetDivision = esklasi ? (esklasi.toUpperCase().match(/\b(OT|OP|UQ|OS|HT|HC)\b/)?.[0] || null) : null;

  const dbRow = {
    sheet_id: sheetId,
    source_sheet: sheetName,
    original_id: sheetId,
    row_number: rowNumber,
    source_fingerprint: '',
    title: (get('report') || get('description') || '(Tanpa Judul)').trim(),
    description: get('description') || get('report') || null,
    report: get('report') || get('description') || null,
    location: get('branch') || get('reporting_branch') || get('specific_location') || null,
    reporter_email: get('reporter_email') || null,
    reporter_name: get('reporter_name') || null,
    evidence_url: evidenceUrls ? evidenceUrls[0] : null,
    evidence_urls: evidenceUrls,
    status,
    severity: 'low',
    priority: 'low',
    flight_number: get('flight_number') || null,
    is_flight_related: Boolean(get('flight_number')),
    station_id: get('branch') || get('reporting_branch') || null,
    category: mainCat || null,
    main_category: mainCat || null,
    date_of_event: eventDay,
    incident_date: eventDay,
    created_at: eventInstant || toIsoOrNow(null),
    updated_at: toIsoOrNow(null),
    resolved_at: status === 'CLOSED' ? (eventInstant || toIsoOrNow(null)) : null,
    reporting_branch: get('reporting_branch') || null,
    hub: get('hub') || null,
    route: get('route') || null,
    branch: get('branch') || get('reporting_branch') || null,
    station_code: get('branch') || get('reporting_branch') || null,
    specific_location: get('specific_location') || null,
    airlines: get('airlines') || get('airline') || null,
    airline: get('airline') || get('airlines') || null,
    jenis_maskapai: get('jenis_maskapai') || null,
    area,
    terminal_area_category: get('terminal_area_category') || null,
    apron_area_category: get('apron_area_category') || null,
    general_category: get('general_category') || null,
    root_caused: get('root_caused') || null,
    root_cause: get('root_caused') || null,
    action_taken: get('action_taken') || null,
    immediate_action: get('action_taken') || null,
    kps_remarks: get('kps_remarks') || null,
    gapura_kps_action_taken: get('gapura_kps_action_taken') || null,
    preventive_action: get('preventive_action') || null,
    irregularity_complain_category: get('irregularity_complain_category') || null,
    service_business_type: serviceBusinessType,
    remarks_case: domainCaseCategory || get('supporting_evidence') || null,
    case_category: domainCaseCategory,
    severity_level: get('severity_level') || null,
    case_cgo: get('case_cgo') || null,
    supporting_evidence: get('supporting_evidence') || null,
    category_case_joumpa: get('category_case_joumpa') || null,
    reservation_scheduling: get('reservation_scheduling') || null,
    pax_assistance_staff_service_performance: get('pax_assistance_staff_service_performance') || null,
    baggage_delivery_baggage_assistance: get('baggage_delivery_baggage_assistance') || null,
    administration_payment_documentation_marketing: get('administration_payment_documentation_marketing') || null,
    gse_available_requirement: get('gse_available_requirement') || null,
    gse_requirement: get('gse_requirement') || null,
    gse_motorized: get('gse_motorized') || null,
    gse_non_motorized: get('gse_non_motorized') || null,
    category_case_gse: get('category_case_gse') || null,
    category_case_cargo: get('category_case_cargo') || null,
    week_in_month: get('week_in_month') || null,
    kode_cabang: get('kode_cabang') || null,
    kode_hub: get('kode_hub') || null,
    maskapai_lookup: get('maskapai_lookup') || null,
    case_classification: get('case_classification') || null,
    identification_of_root: get('identification_of_root') || null,
    accident_incident: get('accident_incident') || null,
    issue_caused: get('issue_caused') || null,
    breakdown_caused: get('breakdown_caused') || null,
    remarks_by: get('remarks_by') || null,
    is_gse_related: hasGseFields,
    lokal_mpa_lookup: get('lokal_mpa_lookup') || null,
    reference_number: get('reference_number') || null,
    delay_code: get('delay_code') || null,
    delay_duration: get('delay_duration') || null,
    primary_tag: get('primary_tag') || null,
    sub_category_note: get('sub_category_note') || null,
    target_division: targetDivision,
    esklasi_divisi: esklasi || null,
    synced_at: new Date().toISOString(),
    sync_version: 1,
  };

  dbRow.source_fingerprint = buildReportFingerprint(dbRow);

  const cleaned = stripAppOwnedColumns(dbRow);
  for (const k of SCHEDULER_DERIVED_COLUMNS) delete cleaned[k];
  for (const k of Object.keys(cleaned)) {
    if (!VALID_COLUMNS.has(k)) delete cleaned[k];
  }
  // Not a column: tells toPayload whether `status` above came from the sheet or
  // is just normalizeStatus's 'OPEN' fallback. Stripped before every write.
  Object.defineProperty(cleaned, SHEET_STATUS_MARK, { value: Boolean(sheetStatus), enumerable: false });
  return cleaned;
}

async function fetchSheetRows() {
  log('INFO', `Fetching rows from Google Sheet (${REPORT_SHEETS.join(', ')})...`);
  const batchRes = await sheetsApi.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges: REPORT_SHEETS });
  const rows = [];
  const valueRanges = batchRes.data.valueRanges || [];

  for (let i = 0; i < REPORT_SHEETS.length; i++) {
    const sheetName = REPORT_SHEETS[i];
    const raw = valueRanges[i]?.values || [];
    if (raw.length === 0) { log('WARN', `Sheet "${sheetName}" returned no data`); continue; }

    const headers = (raw[0] || []).map(h => String(h).trim());
    const dataRows = raw.slice(1);
    log('INFO', `Sheet "${sheetName}": ${dataRows.length} data rows, ${headers.length} columns`);

    const colMap = buildColumnIndexMap(headers);
    for (let ri = 0; ri < dataRows.length; ri++) {
      rows.push(parseRow(dataRows[ri], colMap, sheetName, ri));
    }
  }

  log('INFO', `Total parsed rows from Google Sheet: ${rows.length}`);
  return rows;
}

async function fetchSupabaseRecords() {
  log('INFO', 'Fetching records from reports_sync...');
  const records = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ground_handling_irregularity_report')
      // Whole rows: change detection compares the full payload against what is
      // stored, and source_fingerprint alone cannot do that job — it covers 14
      // identity fields, so a sheet edit to status, evidence, preventive_action
      // or any other column leaves it identical.
      .select('*')
      .order('sheet_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase fetch failed at offset ${offset}: ${error.message}`);
    const batch = data || [];
    records.push(...batch);
    hasMore = batch.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  log('INFO', `Fetched ${records.length} records from reports_sync`);
  return records;
}

/**
 * Would writing this payload change anything? Compares it against the stored
 * row projected onto the payload's own columns, so columns this script does not
 * write (and the volatile stamps buildRowContentHash already excludes) cannot
 * make an unchanged row look dirty.
 *
 * Deliberately not the stored content_hash column: that one is written by the
 * app's sync over a different, larger column set, so the two hashes are not
 * comparable and each writer must judge its own payload.
 */
function rowNeedsWrite(payload, existing) {
  const differing = diffAgainstStored(payload, existing);
  if (differing.length === 0) return false;

  if (process.env.SYNC_DEBUG && existing) {
    log('DEBUG', `${payload.sheet_id} differs on: ${differing.join(', ')}`,
      differing.slice(0, 4).map((key) => ({ key, sheet: payload[key], db: existing[key] })));
  }
  return true;
}

function computeDiff(sheetRows, dbRecords) {
  const dbBySheetId = new Map();
  const dbByFingerprint = new Map();

  for (const rec of dbRecords) {
    dbBySheetId.set(rec.sheet_id, rec);
    if (rec.source_fingerprint) {
      if (!dbByFingerprint.has(rec.source_fingerprint)) dbByFingerprint.set(rec.source_fingerprint, []);
      dbByFingerprint.get(rec.source_fingerprint).push(rec);
    }
  }

  const sheetIds = new Set(sheetRows.map(r => r.sheet_id));
  const sheetFingerprints = new Set(sheetRows.map(r => r.source_fingerprint).filter(Boolean));

  const toUpsert = [];
  const relinks = [];

  for (const row of sheetRows) {
    const existing = dbBySheetId.get(row.sheet_id);
    if (existing) {
      if (rowNeedsWrite(effectivePayload(row, existing), existing)) {
        toUpsert.push({ row, kind: 'update', existing });
      }
    } else {
      const fpMatches = row.source_fingerprint ? (dbByFingerprint.get(row.source_fingerprint) || []) : [];
      if (fpMatches.length === 1) {
        relinks.push({
          row,
          existing: fpMatches[0],
          existingId: fpMatches[0].id,
          previousSheetId: fpMatches[0].sheet_id,
        });
      } else {
        toUpsert.push({ row, kind: 'insert', existing: null });
      }
    }
  }

  const orphans = dbRecords.filter(rec => {
    if (sheetIds.has(rec.sheet_id)) return false;
    if (rec.source_fingerprint && sheetFingerprints.has(rec.source_fingerprint)) return false;
    return true;
  });

  return { toUpsert, relinks, orphans };
}

async function writeBatches(rows, label) {
  let errors = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const bn = Math.floor(i / UPSERT_BATCH) + 1;
    const tb = Math.ceil(rows.length / UPSERT_BATCH);
    log('INFO', `Upserting ${label} batch ${bn}/${tb} (${batch.length} rows)...`);

    const { error } = await supabase
      .from('ground_handling_irregularity_report')
      .upsert(batch, { onConflict: 'sheet_id', ignoreDuplicates: false });

    if (error) {
      log('ERROR', `Upsert ${label} batch ${bn} failed: ${error.message}`);
      errors += batch.length;
    }
  }
  return errors;
}

async function executeUpsert(toUpsert, relinks) {
  let inserted = 0, updated = 0, relinked = 0, errors = 0;

  if (toUpsert.length > 0) {
    // Inserts pin id = uuidv5(sheet_id); without it Postgres assigns a random
    // v4 default and the app — which derives a report's id from its sheet
    // position (ReportsService.getReportUuid) — can never find the row.
    // Updates must NOT carry id: the stored row already has the right one, and
    // rewriting a primary key is what strands a report's comments and evidence.
    // Separate batches because PostgREST pads a batch to the union of its keys.
    const insertRows = toUpsert
      .filter(x => x.kind === 'insert')
      .map(x => ({ ...toPayload(x.row, x.existing), id: uuidv5(x.row.sheet_id, IRRS_NAMESPACE_UUID) }));
    const updateRows = toUpsert
      .filter(x => x.kind === 'update')
      .map(x => effectivePayload(x.row, x.existing));

    if (DRY_RUN) {
      log('INFO', `[DRY RUN] Would upsert ${toUpsert.length} rows (${insertRows.length} new, ${updateRows.length} changed)`);
      inserted = insertRows.length;
      updated = updateRows.length;
    } else {
      // Counts have to come from what was written, not what was attempted —
      // a failed batch was previously still reported as inserted/updated in
      // the summary, right next to the error count that contradicted it.
      const insertErrors = await writeBatches(insertRows, 'insert');
      const updateErrors = await writeBatches(updateRows, 'update');
      errors += insertErrors + updateErrors;
      inserted = insertRows.length - insertErrors;
      updated = updateRows.length - updateErrors;
    }
  }

  if (relinks.length > 0 && DRY_RUN) {
    relinked = relinks.length;
    for (const item of relinks) {
      log('INFO', `[DRY RUN] Would relink ${item.previousSheetId} -> ${item.row.sheet_id}`);
    }
  } else if (relinks.length > 0) {
    // The app derives a report's id as uuidv5(sheet_id), so once the sheet_id
    // moves the stored id no longer matches what the app looks up by. Children
    // and row have to move together — and the children of the whole shift in
    // one call, because a sheet insert turns a run of rows into a chain of
    // mappings that, applied one at a time, sweeps each report's children into
    // the next report's id (see relink_report_children_batch).
    const newIdFor = (item) => uuidv5(item.row.sheet_id, IRRS_NAMESPACE_UUID);
    const { error: relinkError } = await supabase.rpc('relink_report_children_batch', {
      p_pairs: relinks.map((item) => ({
        previous_id: item.existingId,
        new_id: newIdFor(item),
        previous_sheet_id: item.previousSheetId,
        new_sheet_id: item.row.sheet_id,
      })),
    });

    if (relinkError) {
      log('ERROR', `Relink of child rows failed, skipping all ${relinks.length} relinks: ${relinkError.message}`);
      errors += relinks.length;
    } else {
      for (const item of relinks) {
        const { error } = await supabase
          .from('ground_handling_irregularity_report')
          .update({ ...effectivePayload(item.row, item.existing), id: newIdFor(item) })
          .eq('id', item.existingId);

        if (error) {
          log('ERROR', `Relink failed ${item.previousSheetId}: ${error.message}`);
          errors++;
        } else {
          relinked++;
        }
      }
    }
  }

  return { inserted, updated, relinked, errors };
}

function groupBySheet(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const sheet = row.source_sheet || 'UNKNOWN';
    if (!grouped.has(sheet)) grouped.set(sheet, []);
    grouped.get(sheet).push(row);
  }
  return grouped;
}

/**
 * Orphans are derived from what the sheet returned, so a sheet that failed to
 * load, was renamed, or came back filtered makes its whole stored history look
 * deletable. Vet each sheet's orphans on its own before deleting anything: one
 * broken tab must not be able to take out the tabs that read fine.
 */
function partitionDeletableOrphans(orphans, sheetRows, dbRecords) {
  const parsedPerSheet = groupBySheet(sheetRows);
  const storedPerSheet = groupBySheet(dbRecords);
  const deletable = [];
  let blocked = 0;

  for (const [sheet, sheetOrphans] of groupBySheet(orphans)) {
    const verdict = checkOrphanDeletion({
      scope: sheet,
      parsedRows: parsedPerSheet.get(sheet)?.length || 0,
      storedRows: storedPerSheet.get(sheet)?.length || 0,
      orphanRows: sheetOrphans.length,
    });
    if (verdict.allowed) {
      log('INFO', `Orphan guard: ${verdict.reason}`);
      deletable.push(...sheetOrphans);
    } else {
      log('ERROR', `Orphan guard BLOCKED ${verdict.reason}`);
      blocked += sheetOrphans.length;
    }
  }

  return { deletable, blocked };
}

async function deleteOrphans(allOrphans, sheetRows, dbRecords) {
  if (allOrphans.length === 0) return { deleted: 0, blocked: 0 };

  const { deletable: orphans, blocked } = partitionDeletableOrphans(allOrphans, sheetRows, dbRecords);
  if (orphans.length === 0) return { deleted: 0, blocked };
  if (DRY_RUN) {
    log('INFO', `[DRY RUN] Would delete ${orphans.length} orphaned records`);
    return { deleted: 0, blocked };
  }

  let totalDeleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    const batch = orphans.slice(i, i + DELETE_BATCH);
    const ids = batch.map(r => r.id);
    const bn = Math.floor(i / DELETE_BATCH) + 1;
    const tb = Math.ceil(orphans.length / DELETE_BATCH);
    log('INFO', `Deleting batch ${bn}/${tb} (${ids.length} records)...`);

    const { data, error } = await supabase
      .from('ground_handling_irregularity_report')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) { log('ERROR', `Delete batch failed: ${error.message}`); continue; }
    totalDeleted += data?.length || 0;
  }
  return { deleted: totalDeleted, blocked };
}

async function verifyConsistency(sheetRows) {
  const { count, error } = await supabase
    .from('ground_handling_irregularity_report')
    .select('*', { count: 'exact', head: true });
  if (error) { log('WARN', `Could not verify final count: ${error.message}`); return; }

  const expected = sheetRows.length;
  const actual = count || 0;
  if (actual === expected) {
    log('INFO', `Consistency verified: ${actual} records match Google Sheet`);
  } else {
    log('WARN', `Count mismatch: expected ${expected}, got ${actual} (delta: ${actual - expected})`);
  }

  const sheetCounts = {};
  for (const r of sheetRows) sheetCounts[r.source_sheet] = (sheetCounts[r.source_sheet] || 0) + 1;

  const { data: dbRows, error: srcErr } = await supabase
    .from('ground_handling_irregularity_report')
    .select('source_sheet');
  if (!srcErr && dbRows) {
    const dbCounts = {};
    for (const r of dbRows) {
      const s = r.source_sheet || 'UNKNOWN';
      dbCounts[s] = (dbCounts[s] || 0) + 1;
    }
    log('INFO', 'Per-sheet:', { sheet: sheetCounts, database: dbCounts });
    for (const s of Object.keys(sheetCounts)) {
      if (sheetCounts[s] !== (dbCounts[s] || 0)) {
        log('WARN', `"${s}" mismatch: sheet=${sheetCounts[s]}, db=${dbCounts[s] || 0}`);
      }
    }
  }
}

function printSummary({ sheetRows, dbRecords, diff, result, deleted, blocked, duration }) {
  console.log('');
  console.log('================================================================');
  console.log(`  SYNC SCHEDULER ${DRY_RUN ? '(DRY RUN) ' : ''}REPORT`);
  console.log('================================================================');
  console.log(`  Google Sheet rows:        ${sheetRows}`);
  console.log(`  Supabase records (pre):   ${dbRecords}`);
  console.log('----------------------------------------------------------------');
  console.log(`  Inserted:                 ${result.inserted}`);
  console.log(`  Updated (fingerprint d):  ${result.updated}`);
  console.log(`  Relinked (row shifted):   ${result.relinked}`);
  console.log(`  Orphans deleted:          ${deleted}`);
  console.log(`  Orphans blocked by guard: ${blocked}`);
  console.log(`  Errors:                   ${result.errors}`);
  console.log(`  Duration:                 ${(duration / 1000).toFixed(2)}s`);
  console.log('================================================================');

  const sampleNew = diff.toUpsert.filter(x => x.kind === 'insert').slice(0, 5);
  if (sampleNew.length) {
    console.log('  New rows:');
    for (const x of sampleNew) console.log(`    + ${x.row.sheet_id} (${x.row.main_category || '?'} | ${x.row.branch || '?'})`);
  }
  const sampleOrphans = diff.orphans.slice(0, 5);
  if (sampleOrphans.length) {
    console.log('  Orphans:');
    for (const o of sampleOrphans) console.log(`    - ${o.sheet_id} (${o.source_sheet || '?'})`);
  }
  console.log('================================================================');
}

async function main() {
  const startTime = Date.now();
  if (DRY_RUN) log('INFO', 'Running in DRY RUN mode');
  log('INFO', 'Starting bidirectional sync scheduler...');

  const sheetRows = await fetchSheetRows();
  const dbRecords = await fetchSupabaseRecords();

  if (sheetRows.length === 0) {
    log('ERROR', 'Google Sheet returned 0 data rows. Aborting.');
    process.exit(1);
  }
  if (dbRecords.length > 0 && sheetRows.length < dbRecords.length * 0.5) {
    log('WARN', `Sheet ${sheetRows.length} rows vs DB ${dbRecords.length} records (>50% gap).`);
  }

  const diff = computeDiff(sheetRows, dbRecords);
  const inserts = diff.toUpsert.filter(x => x.kind === 'insert').length;
  const updates = diff.toUpsert.filter(x => x.kind === 'update').length;
  log('INFO', `Diff: ${inserts} inserts, ${updates} updates, ${diff.relinks.length} relinks, ${diff.orphans.length} orphans`);

  if (diff.orphans.length === dbRecords.length && dbRecords.length > 0) {
    log('ERROR', 'ALL database records are orphans. Aborting.');
    process.exit(1);
  }

  const result = await executeUpsert(diff.toUpsert, diff.relinks);
  const { deleted, blocked } = await deleteOrphans(diff.orphans, sheetRows, dbRecords);

  if (!DRY_RUN) await verifyConsistency(sheetRows);

  const duration = Date.now() - startTime;
  printSummary({
    sheetRows: sheetRows.length,
    dbRecords: dbRecords.length,
    diff,
    result,
    deleted,
    blocked,
    duration,
  });

  if (result.errors > 0 || blocked > 0) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  log('ERROR', `Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
