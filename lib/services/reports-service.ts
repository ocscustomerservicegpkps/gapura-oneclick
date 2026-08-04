import 'server-only';
import { getGoogleSheets } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Report, Station, Unit, Position, IncidentType } from '@/types';
import { calculateSlaDeadline } from '@/lib/constants/report-status';
import { v5 as uuidv5 } from 'uuid';

import { buildReportFingerprint } from '@/lib/report-fingerprint';
import { escapeSpreadsheetCell } from '@/lib/security/sanitize';
import {
  resolveCaseClassification,
  resolveReportCategory,
  resolveReportSeverity,
  resolveReportStatus,
  resolveRootCause,
} from '@/lib/report-normalization';

export const IRRS_NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

interface CacheEntry { data: unknown; ts: number; version?: number }
const ttlCache = new Map<string, CacheEntry>();
const inflightReportFetches = new Map<string, Promise<Report[]>>();
let reportCacheEpoch = 0;
const MAX_CACHE_ENTRIES = 100;

function getCache<T>(key: string, ttl: number): T | null {
  const entry = ttlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    ttlCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  if (ttlCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = ttlCache.keys().next().value;
    if (oldest) ttlCache.delete(oldest);
  }
  ttlCache.set(key, { data, ts: Date.now() });
}

// getCache/setCache above are a plain per-process TTL cache: on Vercel, each
// warm serverless instance holds its own copy, so invalidateCache() only
// clears the instance that happened to run a sync. Other instances kept
// serving up to CACHE_TTL-old report lists regardless of how fast Supabase
// itself was updated. sync_state.sync_version is already the shared,
// cross-instance freshness signal (bumped by every report mutation and sync
// path — see lib/sync-state.ts) — gate the report-list cache on it too, with
// its own short local TTL so this doesn't add a DB round trip per request.
let sharedSyncVersionCache: { version: number; ts: number } | null = null;
const SHARED_VERSION_CHECK_TTL = 5000;

async function getSharedSyncVersion(): Promise<number> {
  if (sharedSyncVersionCache && Date.now() - sharedSyncVersionCache.ts < SHARED_VERSION_CHECK_TTL) {
    return sharedSyncVersionCache.version;
  }
  try {
    const { getSyncState } = await import('@/lib/sync-state');
    const state = await getSyncState('reports');
    const version = Number(state.sync_version) || 0;
    sharedSyncVersionCache = { version, ts: Date.now() };
    return version;
  } catch (error) {
    // Don't let a hiccup in the freshness check take reads down — fall back
    // to whatever we last knew (or 0, which just forces a cache miss).
    console.warn('[ReportsService] Failed to read shared sync version:', error);
    return sharedSyncVersionCache?.version ?? 0;
  }
}

async function getVersionedCache<T>(key: string, ttl: number): Promise<T | null> {
  const entry = ttlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    ttlCache.delete(key);
    return null;
  }
  const currentVersion = await getSharedSyncVersion();
  if (entry.version !== currentVersion) {
    ttlCache.delete(key);
    return null;
  }
  return entry.data as T;
}

async function setVersionedCache(key: string, data: unknown): Promise<void> {
  const version = await getSharedSyncVersion();
  if (ttlCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = ttlCache.keys().next().value;
    if (oldest) ttlCache.delete(oldest);
  }
  ttlCache.set(key, { data, ts: Date.now(), version });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const REPORT_SHEETS = ['NON CARGO', 'CGO'];
const SHEET_IDS: Record<string, number> = {};

const PROP_TO_HEADER: Partial<Record<keyof Report, string[]>> = {

  date_of_event: ['Date_of_Event', 'Date of Event', 'Date', 'Tanggal', 'Tanggal Kejadian', 'Incident Date'],
  jenis_maskapai: ['Jenis_Maskapai', 'Jenis Maskapai'],
  airline: ['Airlines', 'Airline', 'Maskapai'],
  airlines: ['Airlines', 'Airline', 'Maskapai'],
  flight_number: ['Flight_Number', 'Flight Number', 'No Penerbangan'],
  reporting_branch: ['Reporting_Branch', 'Reporting Branch'],
  branch: ['Branch', 'Cabang', 'Reporting_Branch', 'Reporting Branch', 'Station', 'Branch '],
  station_code: ['Station', 'Branch', 'Cabang', 'Reporting_Branch', 'Reporting Branch', 'KODE_CABANG_VLOOKUP', 'KODE CABANG (VLOOKUP)'],
  route: ['Route', 'Rute'],
  main_category: ['Report_Category', 'Report Category', 'Kategori Laporan', 'Main Category', 'Irregularity_Complain_Category'],
  category: ['Report_Category', 'Report Category', 'Kategori Laporan', 'Main Category', 'Irregularity_Complain_Category'],
  irregularity_complain_category: ['Irregularity_Complain_Category', 'Irregularity/Complain Category', 'Report_Category'],
  description: ['Report', 'Laporan', 'Description', 'Deskripsi'],
  root_caused: ['Root_Caused', 'Root Caused', 'Akar Masalah', 'Root Cause'],
  action_taken: ['Action_Taken', 'Action Taken', 'Tindakan'],
  kps_remarks: ['Final Remarks', 'Gapura_KPS_Remarks', 'Gapura KPS Remarks', 'KPS Remarks', 'Remarks Gapura KPS', 'Remarks_Gapura_KPS'],
  remarks_by: ['Remarks By', 'Remarks_By'],
  gapura_kps_action_taken: ['Gapura_KPS_Action_Taken', 'Gapura KPS Action Taken'],
  preventive_action: ['Preventive Action', 'Preventive_Action'],
  reporter_name: ['Report_By', 'Report By', 'Pelapor', 'Reporter'],
  reporter_email: ['Reporter Email', 'Email'],
  specific_location: ['Location of Incident', 'Location_of_Incident', 'Specific Location', 'Location'],
  evidence_url: ['Upload_Irregularity_Photo', 'Upload Irregularity Photo', 'Evidence', 'Bukti'],
  evidence_urls: ['Upload_Irregularity_Photo', 'Upload Irregularity Photo', 'Link Open (Be Careful for Sharing)', 'Link Open', 'Evidence', 'Bukti', 'Lampiran'],
  evidence_file_ids: ['Evidence File IDs', 'Evidence_File_IDs'],
  evidence_submission_id: ['Evidence Submission ID', 'Evidence_Submission_ID'],
  video_url: ['Upload_Irregularity_Photo', 'Upload Irregularity Photo', 'Evidence', 'Bukti'],
  video_urls: ['Upload_Irregularity_Photo', 'Upload Irregularity Photo', 'Evidence', 'Bukti'],
  area: ['Area', 'Wilayah'],
  terminal_area_category: ['Terminal_Area_Category', 'Terminal Area Category'],
  apron_area_category: ['Apron_Area_Category', 'Apron Area Category'],
  general_category: ['General_Category', 'General Category'],
  status: ['Status', 'Report Status', 'Case Status'],
  week_in_month: ['Per_Week_in_Month', 'Per Week in Month'],
  kode_cabang: ['KODE_CABANG_VLOOKUP', 'KODE CABANG (VLOOKUP)'],
  maskapai_lookup: ['MASKAPAI_VLOOKUP', 'MASKAPAI (VLOOKUP)'],
  lokal_mpa_lookup: ['Lokal_MPA_VLOOKUP', 'Lokal / MPA (VLOOKUP)'],
  case_classification: ['Case Classification', 'Case_Classification', 'case_classification'],
  hub: ['Hub', 'HUB'],
  kode_hub: ['KODE_HUB_VLOOKUP', 'KODE HUB (VLOOKUP)', 'Kode Hub'],
  delay_code: ['Delay Code', 'Delay_Code', 'Kode Delay'],
  delay_duration: ['Delay Duration', 'Delay_Duration', 'Durasi Delay'],
  identification_of_root: ['Identification of Root', 'Identification_of_Root', 'identifikasi_akar_masalah'],
  accident_incident: ['Accident / Incident', 'Accident_Incident', 'Kecelakaan / Insiden'],
  issue_caused: ['Issue Caused', 'Issue_Caused', 'Masalah Penyebab'],
  breakdown_caused: ['Breakdown Caused', 'Breakdown_Caused', 'Breakdown Penyebab'],
  remarks_case: ['Remarks Case', 'Remarks_Case'],
  gse_available_requirement: ['GSE Available & Requirement', 'GSE Available Requirement', 'GSE_Available_Requirement'],
  gse_requirement: ['GSE Requirement', 'GSE_Requirement'],
  case_category: ['Case Category', 'Case_Category', 'Category Case GSE', 'Category Case Cargo (CGO)', 'Category Case Joumpa'],
  service_business_type: ['Service Business Type', 'Service_Business_Type', 'Jenis Layanan'],
  severity_level: ['Severity Level', 'Severity_Level'],
  case_cgo: ['Case CGO'],
  supporting_evidence: ['Supporting Evidence', 'Supporting_Evidence'],
  category_case_joumpa: ['Category Case Joumpa'],
  reservation_scheduling: ['Reservation & Scheduling', 'Reservation Scheduling'],
  pax_assistance_staff_service_performance: ['Pax Assistance / Staff Service Performance', 'Pax Assistance Staff Service Performance'],
  baggage_delivery_baggage_assistance: ['Baggage Delivery & Baggage Assistance', 'Baggage Delivery Baggage Assistance'],
  administration_payment_documentation_marketing: ['Administration, Payment, Documentation & Marketing', 'Administration Payment Documentation Marketing'],
  gse_motorized: ['GSE MOTORIZED', 'GSE Motorized'],
  gse_non_motorized: ['GSE NON - MOTORIZED', 'GSE NON MOTORIZED', 'GSE Non-Motorized'],
  category_case_gse: ['Category Case GSE'],
  category_case_cargo: ['Category Case Cargo (CGO)', 'Category Case Cargo'],

  dom_inter: ['DOM/INTER', 'DOM / INTER', 'DOM_INTER'],
  kode_inter: ['Kode INTER', 'KODE INTER', 'Kode_INTER'],
  final_remarks: ['Final Remarks', 'Final_Remarks'],
  customer_joumpa: ['Customer Joumpa'],
  detail_customer_joumpa: ['Detail Customer Joumpa'],
  corporate: ['Corporate'],
  customer_company_profile_corporate: ['Customer Company Profile Corporate'],
  non_corporate: ['Non - Corporate', 'Non-Corporate', 'Non Corporate'],
  customer_background_non_corporate: ['Customer Background Non - Corporate', 'Customer Background Non-Corporate'],
  detail_customer_non_corporate: ['Detail Customer Non - Corporate', 'Detail Customer Non-Corporate'],
  joumpa_compliment_report_excellent_service: ['Joumpa Compliment Report Excellent Service'],

  primary_tag: ['Primary Tag', 'Primary_Tag', 'Area Category', 'Area_Category'],
  sub_category_note: ['Sub Category Note', 'Sub_Category_Note', 'Sub Category', 'Additional Note'],
  esklasi_divisi: ['ESKLASI DIVISI', 'ESKLASI_DIVISI'],

  id: ['ID'],
  user_id: ['User ID for One Click', 'User ID', 'User_ID'],
  title: ['Title', 'Judul'],
  location: ['Location', 'Lokasi'],
  severity: ['Severity', 'Severity Level', 'Tingkat Keparahan'],
  priority: ['Priority', 'Prioritas'],
  created_at: ['Created_At', 'Created At'],
  updated_at: ['Updated_At', 'Updated At'],
  report: ['Report', 'Judul Laporan'],

};

const CACHE_KEY_ALL_REPORTS = 'reports:all:v3';
const CACHE_TTL = 1000 * 60 * 5;
const GSE_KEYWORDS = [
  'gse',
  'ground support equipment',
  'belt loader',
  'baggage tractor',
  'tow tractor',
  'pushback',
  'push back',
  'gpu',
  'ground power unit',
  'lavatory truck',
  'water truck',
  'air starter',
  'forklift',
  'cargo loader',
  'ambulift',
  'tld',
  'conveyor',
  'uld',
];

export interface ReportQueryFilters {
  dateFrom?: string;
  dateTo?: string;
  hub?: string;
  branch?: string;
  /** Multi-station scope, OR-matched across branch/station_code/reporting_branch. */
  branchIn?: string[];
  area?: string;
  airlines?: string;
  sourceSheet?: string;
  esklasiRegex?: string;
  gseOnly?: boolean;
  status?: string;
}

const REPORT_SYNC_FIELDS = [
  'id',
  'user_id',
  'title',
  'description',
  'location',
  'reporter_email',
  'evidence_url',
  'evidence_urls',
  'evidence_file_ids',
  'evidence_submission_id',
  'status',
  'severity',
  'severity_level',
  'priority',
  'flight_number',
  'aircraft_reg',
  'gse_number',
  'gse_name',
  'station_id',
  'category',
  'main_category',
  'source_sheet',
  'sheet_id',
  'source_fingerprint',
  'original_id',
  'row_number',
  'created_at',
  'updated_at',
  'resolved_at',
  'sla_deadline',
  'incident_date',
  'reporting_branch',
  'hub',
  'route',
  'branch',
  'station_code',
  'reporter_name',
  'date_of_event',
  'specific_location',
  'airlines',
  'airline',
  'jenis_maskapai',
  'reference_number',
  'root_caused',
  'root_cause',
  'action_taken',
  'immediate_action',
  'kps_remarks',
  'remarks_by',
  'preventive_action',
  'remarks_gapura_kps',
  'area',
  'terminal_area_category',
  'apron_area_category',
  'general_category',
  'report',
  'service_business_type',
  'remarks_case',
  'gse_available_requirement',
  'gse_requirement',
  'gse_motorized',
  'gse_non_motorized',
  'category_case_gse',
  'category_case_cargo',
  'category_case_joumpa',
  'case_cgo',
  'supporting_evidence',
  'case_category',
  'case_classification',
  'irregularity_complain_category',
  'identification_of_root',
  'kode_cabang',
  'kode_hub',
  'maskapai_lookup',
  'primary_tag',
] as const;

type ReportSyncField = typeof REPORT_SYNC_FIELDS[number];

/**
 * Any selectable column on a Report. Projections/fetches may read columns that
 * aren't part of the (narrower) sheet-sync field set, so they use this type.
 */
type ReportColumn = keyof Report;

const REPORT_PROJECTIONS = {
  list: [
    'id',
    'sheet_id',
    'original_id',
    'title',
    'location',
    'status',
    'severity',
    'flight_number',
    'station_id',
    'main_category',
    'source_sheet',
    'created_at',
    'hub',
    'branch',
    'station_code',
    'reporter_name',
    'date_of_event',
    'incident_date',
    'airlines',
    'airline',
    'jenis_maskapai',
    'category',
    'area',
    'service_business_type',
    'case_classification',
    'irregularity_complain_category',
    'primary_tag',
    'kode_cabang',
    'kode_hub',
    'reference_number',
    'terminal_area_category',
    'apron_area_category',
    'general_category',
    'category_case_gse',
    'category_case_cargo',
    'category_case_joumpa',
    'supporting_evidence',
    'gse_available_requirement',
    'gse_requirement',
    'gse_motorized',
    'gse_non_motorized',
    'reservation_scheduling',
    'pax_assistance_staff_service_performance',
    'baggage_delivery_baggage_assistance',
    'administration_payment_documentation_marketing',
    'delay_code',
    'delay_duration',
    'case_cgo',
    'remarks_case',
    'root_cause',
    'root_caused',
    'identification_of_root',
    'report',
    'description',
    'action_taken',
    'immediate_action',
    'gapura_kps_action_taken',
    'preventive_action',
    'specific_location',
    'aircraft_reg',
    'route',
  ],
  analytics: [
    'id',
    'user_id',
    'reporter_email',
    'status',
    'severity',
    'priority',
    'station_id',
    'source_sheet',
    'created_at',
    'date_of_event',
    'incident_date',
    'branch',
    'reporting_branch',
    'station_code',
    'hub',
    'kode_hub',
    'airline',
    'airlines',
    'maskapai_lookup',
    'area',
    'terminal_area_category',
    'apron_area_category',
    'general_category',
    'main_category',
    'category',
    'irregularity_complain_category',
    'identification_of_root',
    'root_caused',
    'root_cause',
    'remarks_case',
    'category_case_gse',
    'category_case_cargo',
  ],
  filterOptions: [
    'id',
    'hub',
    'branch',
    'reporting_branch',
    'station_code',
    'airline',
    'airlines',
    'main_category',
    'category',
    'area',
    'severity',
    'status',
    'jenis_maskapai',
    'date_of_event',
    'created_at',
  ],
  embed: [
    'id',
    'title',
    'status',
    'severity',
    'airline',
    'airlines',
    'main_category',
    'category',
    'irregularity_complain_category',
    'area',
    'branch',
    'reporting_branch',
    'station_code',
    'hub',
    'terminal_area_category',
    'apron_area_category',
    'general_category',
    'case_classification',
    'date_of_event',
    'incident_date',
    'created_at',
    'sla_deadline',
    'source_sheet',
  ],
  adminStats: [
    'id',
    'sheet_id',
    'original_id',
    'title',
    'description',
    'report',
    'primary_tag',
    'location',
    'station_code',
    'branch',
    'status',
    'severity',
    'priority',
    'sla_deadline',
    'reporter_name',
    'created_at',
    'date_of_event',
  ],
} as const satisfies Record<string, readonly ReportColumn[]>;

type ReportProjectionName = keyof typeof REPORT_PROJECTIONS;
export type ProjectedReport<P extends ReportProjectionName> = Pick<
  Report,
  'id' | typeof REPORT_PROJECTIONS[P][number]
>;

const REPORT_SYNC_FIELD_SET = new Set<string>(REPORT_SYNC_FIELDS);

function isReportSyncField(value: string): value is ReportSyncField {
  return REPORT_SYNC_FIELD_SET.has(value);
}

export function parseReportSyncFields(values: readonly string[]): {
  fields: ReportSyncField[];
  invalid: string[];
} {
  const normalized = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return {
    fields: normalized.filter(isReportSyncField),
    invalid: normalized.filter((value) => !isReportSyncField(value)),
  };
}

interface GetReportsOptions {
  refresh?: boolean;
  filters?: ReportQueryFilters;
  fields?: readonly ReportColumn[];
  projection?: ReportProjectionName;
  source?: 'auto' | 'sheets' | 'sync';
  /**
   * Upper bound on how many 1000-row pages fetchReportsFromSync() will pull
   * for an unfiltered/lightly-filtered 'sync'/'auto' call. Defaults to a
   * generous cap so existing full-table callers (reports/sync, ai-generate)
   * keep working unchanged at today's data volume; raise it explicitly for a
   * genuine full-export need larger than that.
   */
  maxSyncBatches?: number;
}

const MonthMap: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, ags: 7, agt: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, 
  november: 10, nov: 10,
  desember: 11, des: 11
};

export function parseDate(dateStr: string | number | Date): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  if (typeof dateStr === 'number') {
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  const parts = str.toLowerCase().split(/[\s,/-]+/);
  if (parts.length >= 2) {
    let day = 1;
    let month = -1;
    let year = -1;

    const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
    if (yearIdx !== -1) {
      year = parseInt(parts[yearIdx]);
      for (let i = 0; i < parts.length; i++) {
        if (i === yearIdx) continue;
        if (MonthMap[parts[i]] !== undefined) {
          month = MonthMap[parts[i]];
          const dayCandidates = [parts[i-1], parts[i+1]].filter(p => p && /^\d{1,2}$/.test(p));
          if (dayCandidates.length > 0) {
            day = parseInt(dayCandidates[0]);
          }
          break;
        }
      }
    }

    if (year !== -1 && month !== -1) {
      return new Date(year, month, day);
    }
  }

  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1; 
    const year = parseInt(ddmmyyyy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function syncEscalationDivisionAliases<T extends Partial<Report>>(report: T): T {
  if (typeof report.esklasi_divisi === 'string' && report.esklasi_divisi.trim()) {
    report.esklasi_divisi = report.esklasi_divisi.trim();
  } else {
    delete report.esklasi_divisi;
  }

  return report;
}

function matchesEsklasiRegex(report: Partial<Report>, pattern?: string): boolean {
  if (!pattern) return true;
  const rawEsklasi = String(report.esklasi_divisi || '').trim();
  if (!rawEsklasi) return false;

  try {
    return new RegExp(pattern, 'i').test(rawEsklasi);
  } catch {
    return rawEsklasi.toLowerCase().includes(pattern.toLowerCase());
  }
}

function isGseRelatedReport(report: Partial<Report>): boolean {
  if (report.is_gse_related) return true;
  if (report.gse_number || report.gse_name) return true;
  if (report.gse_available_requirement || report.gse_requirement || report.gse_motorized || report.gse_non_motorized || report.category_case_gse) return true;

  const textBlob = [
    report.esklasi_divisi,
    report.primary_tag,
    report.sub_category_note,
    report.main_category,
    report.category,
    report.irregularity_complain_category,
    report.report,
    report.description,
    report.title,
    report.root_caused,
    report.root_cause,
    report.action_taken,
    report.preventive_action,
    report.specific_location,
    report.location,
    report.area,
    report.terminal_area_category,
    report.apron_area_category,
    report.general_category,
    report.gse_available_requirement,
    report.gse_requirement,
    report.gse_motorized,
    report.gse_non_motorized,
    report.category_case_gse,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(' ');

  if (!textBlob) return false;
  if (/\bgse\b/.test(textBlob)) return true;
  return GSE_KEYWORDS.some((keyword) => textBlob.includes(keyword));
}

function hasMeaningfulSheetValue(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' &&
    normalized !== '-' &&
    normalized !== '#n/a' &&
    normalized !== '#n/a ()' &&
    normalized !== 'null' &&
    normalized !== 'undefined' &&
    normalized !== 'nil';
}

function firstMeaningfulSheetValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (hasMeaningfulSheetValue(value)) return String(value).trim();
  }
  return undefined;
}

class ReportsService {

  private hubMap: Record<string, string> = {};
  private hubMapTs = 0;

  private async getSheets() {
    return await getGoogleSheets();
  }

  private getReportUuid(sourceId: string): string {
      return uuidv5(sourceId, IRRS_NAMESPACE_UUID);
  }

  private async getHubMappingFromSheet(): Promise<Record<string, string>> {
    const now = Date.now();
    if (Object.keys(this.hubMap).length && now - this.hubMapTs < 1000 * 60 * 60) {
      return this.hubMap;
    }
    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Data for Vlookup'",
    });
    const rows = res.data.values || [];
    if (!rows.length) return {};
    let dataStart = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let headers = (rows[0] || []).map((h: any) => String(h).trim().toLowerCase());
    let codeIdx = headers.findIndex(h => /kode|code|station|branch/.test(h));
    let hubIdx = headers.findIndex(h => /hub/.test(h));

    if (codeIdx === -1 && hubIdx === -1) {

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = (rows[i] || []).map((h: any) => String(h).trim().toLowerCase());
        const bIdx = r.findIndex(h => /^branch$|^station$|^kode/.test(h));
        const hIdx = r.findIndex(h => /^hub$/.test(h));
        if (bIdx !== -1 || hIdx !== -1) {
          codeIdx = bIdx !== -1 ? bIdx : codeIdx;
          hubIdx = hIdx !== -1 ? hIdx : hubIdx;
          dataStart = i + 1;
          headers = r;
          break;
        }
      }
    }

    if (codeIdx === -1 && hubIdx === -1) {
      codeIdx = 1;
      hubIdx = 2;
      dataStart = 1;
    } else {
      if (codeIdx === -1) codeIdx = 0;
      if (hubIdx === -1) hubIdx = Math.max(1, codeIdx + 1);
    }
    const map: Record<string, string> = {};
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[codeIdx] || '').trim().toUpperCase();
      const hub = String(row[hubIdx] || '').trim();
      if (code) map[code] = hub || '';
    }
    this.hubMap = map;
    this.hubMapTs = now;
    return map;
  }

  public async resolveHubForStation(stationCode?: string | null): Promise<string | null> {
    if (!stationCode) return null;
    try {
      const map = await this.getHubMappingFromSheet();
      const code = String(stationCode).trim().toUpperCase();
      return map[code] || null;
    } catch {
      return null;
    }
  }

  private buildColumnMapping(headers: string[]): Record<string, number> {
    const columnMapping: Record<string, number> = {};
    const lowerHeaders = headers.map(h => h.trim().toLowerCase());
    (Object.keys(PROP_TO_HEADER) as Array<keyof Report>).forEach((prop) => {
        const headerNames = PROP_TO_HEADER[prop];
        if (headerNames) {
            const lowerNames = headerNames.map(n => n.trim().toLowerCase());
            const colIdx = lowerHeaders.findIndex(lh => lowerNames.includes(lh));
            if (colIdx !== -1) {
                columnMapping[prop as string] = colIdx;
            }
        }
    });
    return columnMapping;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRowToReport(row: any[], columnMapping: Record<string, number>, sheetName: string, rowIndex: number): Report {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report: any = {
      _source: 'SHEETS',
      _sheet: sheetName,
      row_number: rowIndex + 2
    };

    Object.entries(columnMapping).forEach(([prop, colIdx]) => {
        if (row[colIdx] !== undefined) {
            let val = row[colIdx];

            if (typeof val === 'string') {
                val = val.trim();

                const areaProps = ['terminal_area_category', 'apron_area_category', 'general_category'];
                if (areaProps.includes(prop)) {
                    const lowVal = val.toLowerCase();

                    if (lowVal.startsWith('http') || 
                        lowVal.includes('www.') || 
                        val.length > 100 ||
                        lowVal === 'null' ||
                        lowVal === 'undefined') {
                        val = '';
                    }
                }
            }

            report[prop] = val;
        }
    });

    const parseUrlField = (pluralKey: keyof Report, singularKey: keyof Report) => {
      const val = report[pluralKey] || report[singularKey];
      if (val && typeof val === 'string') {
        const parts = val.split(/\s*(?:\||;|\n+)\s*/).map(s => s.trim()).filter(Boolean);
        if (parts.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          report[pluralKey] = parts as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          report[singularKey] = parts[0] as any;
        }
      } else if (report[singularKey] && typeof report[singularKey] === 'string' && !report[pluralKey]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        report[pluralKey] = [report[singularKey]] as any;
      }
    };

    parseUrlField('evidence_urls', 'evidence_url');
    parseUrlField('video_urls', 'video_url');

    if (report.row_number) {
        const sourceId = `${sheetName}!row_${report.row_number}`;
        report.original_id = sourceId;
        report.id = this.getReportUuid(sourceId);
    }
    report.source_sheet = sheetName;

    if (report.report && report.report.trim()) {
        report.title = report.report.trim();
    }

    const parsedEventDate = parseDate(report.date_of_event as string);
    if (parsedEventDate) {
      report.date_of_event = parsedEventDate.toISOString();
      if (!report.created_at) report.created_at = report.date_of_event;
    } else if (report.created_at) {
      const parsedCreated = parseDate(report.created_at as string);
      if (parsedCreated) {
        report.created_at = parsedCreated.toISOString();
      } else {
        report.created_at = new Date().toISOString();
      }
    } else {
      report.created_at = new Date().toISOString();
    }

    if (report.resolved_at) {
      const parsedResolved = parseDate(report.resolved_at as string);
      if (parsedResolved) {
        report.resolved_at = parsedResolved.toISOString();
      }
    }

    const statusMapping: Record<string, string> = {
      'Closed': 'CLOSED', 'Open': 'OPEN', 'OPEN': 'OPEN',
      'CLOSED': 'CLOSED', 'closed': 'CLOSED', 'open': 'OPEN',
      'Selesai': 'CLOSED', 'selesai': 'CLOSED', 'Menunggu': 'OPEN',
      'menunggu': 'OPEN', 'On Progress': 'ON PROGRESS', 'ON PROGRESS': 'ON PROGRESS'
    };

    if (report.status) {
      let normalizedStatus = resolveReportStatus(report);
      normalizedStatus = statusMapping[normalizedStatus] || normalizedStatus;

      if (normalizedStatus === 'SELESAI' || normalizedStatus === 'CLOSED') {
          normalizedStatus = 'CLOSED';
      } else if (normalizedStatus === 'OPEN' || normalizedStatus === 'MENUNGGU' || normalizedStatus === 'ACTIVE' || normalizedStatus === 'MENUNGGU_FEEDBACK' || normalizedStatus === 'MENUNGGU FEEDBACK') {
          normalizedStatus = 'OPEN';
      } else if (normalizedStatus === 'ON PROGRESS' || normalizedStatus === 'ON_PROGRESS' || normalizedStatus === 'SUDAH_DIVERIFIKASI' || normalizedStatus === 'SUDAH DIVERIFIKASI') {
          normalizedStatus = 'ON PROGRESS';
      }
      report.status = normalizedStatus;
    } else {
      report.status = 'OPEN';
    }

    if (!report.severity && report.severity_level) report.severity = report.severity_level;
    if (report.severity || report.severity_level || report.priority) {
      const severityMap: Record<string, string> = {
        'CRITICAL': 'CRITICAL', 'Critical': 'CRITICAL', 'critical': 'CRITICAL',
        'TOP RISK': 'TOP RISK', 'Top Risk': 'TOP RISK', 'top risk': 'TOP RISK',
        'HIGH': 'HIGH', 'High': 'HIGH', 'high': 'HIGH',
        'HIGH RISK': 'HIGH', 'High Risk': 'HIGH',
        'MEDIUM': 'MEDIUM', 'Medium': 'MEDIUM', 'medium': 'MEDIUM',
        'LOW': 'LOW', 'Low': 'LOW', 'low': 'LOW',
        'URGENT': 'CRITICAL', 'Urgent': 'CRITICAL', 'urgent': 'CRITICAL',
      };
      const severity = resolveReportSeverity(report);
      report.severity = severityMap[severity] || severityMap[severity.toUpperCase()] || 'LOW';
    } else {
      report.severity = 'LOW';
    }

    if (!report.priority) report.priority = 'low';

    if (!report.main_category && report.irregularity_complain_category) report.main_category = report.irregularity_complain_category;
    if (report.main_category && !report.category) report.category = report.main_category;
    if (report.category && !report.main_category) report.main_category = report.category;

    const gseCategory = firstMeaningfulSheetValue(
      report.category_case_gse,
      report.gse_available_requirement,
      report.gse_motorized,
      report.gse_non_motorized
    );
    const cgoCategory = firstMeaningfulSheetValue(report.category_case_cargo, report.supporting_evidence);
    const joumpaCategory = firstMeaningfulSheetValue(
      report.category_case_joumpa,
      report.reservation_scheduling,
      report.pax_assistance_staff_service_performance,
      report.baggage_delivery_baggage_assistance,
      report.administration_payment_documentation_marketing
    );

    if (!report.case_category) report.case_category = firstMeaningfulSheetValue(gseCategory, cgoCategory, joumpaCategory);
    if (!report.remarks_case) report.remarks_case = firstMeaningfulSheetValue(gseCategory, cgoCategory, joumpaCategory);
    if (!report.case_classification) report.case_classification = resolveCaseClassification(report);
    if (!report.identification_of_root) report.identification_of_root = resolveRootCause(report);

    if (!report.service_business_type) {
      if (gseCategory) report.service_business_type = 'GSE Service Performance';
      else if (joumpaCategory) report.service_business_type = 'Joumpa Service';
      else if (sheetName === 'CGO' || cgoCategory || report.case_cgo) report.service_business_type = 'Cargo Service';
    }
    if (gseCategory) report.is_gse_related = true;

    const normalizedCategory = resolveReportCategory(report);
    if (normalizedCategory) {
      report.main_category = normalizedCategory;
      report.category = normalizedCategory;
    }

    if (report.airline && !report.airlines) report.airlines = report.airline;
    if (report.airlines && !report.airline) report.airline = report.airlines;

    if (!report.branch && report.reporting_branch) report.branch = report.reporting_branch;
    if (!report.branch && report.station_code) report.branch = report.station_code;
    if (!report.station_code && report.branch) report.station_code = report.branch;

    if (report.branch) {
        report.station_id = report.branch;
        report.stations = { code: report.branch as string, name: report.branch as string };
        if (!report.location) report.location = report.branch;
    }

    if (!report.sla_deadline && report.created_at) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        report.sla_deadline = calculateSlaDeadline(report.created_at as string, report.priority as any).toISOString();
      } catch {
        report.sla_deadline = undefined;
      }
    }

    if (sheetName === 'CGO' && !report.area) report.area = 'CARGO';
    else if (sheetName === 'NON CARGO' && !report.area) {
         if (report.terminal_area_category) report.area = 'TERMINAL';
         else if (report.apron_area_category) report.area = 'APRON';
    }

    if (report.status === 'CLOSED' && !report.resolved_at) {
        report.resolved_at = report.date_of_event || report.created_at || new Date().toISOString();
    }

    syncEscalationDivisionAliases(report);

    report.source_fingerprint = buildReportFingerprint(report);

    return report as Report;
  }

  private getTargetSheet(reportData: Partial<Report>): string {
    let targetSheet = 'NON CARGO';
    const category = String(reportData.category || reportData.main_category || '').toLowerCase();
    const area = String(reportData.area || '').toLowerCase();
    const primaryTag = String(reportData.primary_tag || '').toUpperCase();

    if (
      area === 'cargo' ||
      category.includes('cargo') ||
      reportData.is_gse_related ||
      primaryTag === 'CGO' ||
      primaryTag === 'CARGO'
    ) {
      targetSheet = 'CGO';
    }

    return targetSheet;
  }

  private buildWritableReport(reportData: Partial<Report>, targetSheet: string): Report {
    const newReport: Report = {
      ...reportData,
      created_at: reportData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: reportData.status || 'OPEN',
      severity: reportData.severity || 'low',
      priority: reportData.priority || 'medium',
      title: reportData.title || reportData.report || 'Untitled',
      description: reportData.description || reportData.report || '',
      location: reportData.location || '',
      source_sheet: targetSheet,
    } as Report;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(newReport as any).root_caused && (newReport as any).root_cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newReport as any).root_caused = (newReport as any).root_cause;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(newReport as any).action_taken && (newReport as any).immediate_action) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newReport as any).action_taken = (newReport as any).immediate_action;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(newReport as any).airline && (newReport as any).airlines) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newReport as any).airline = (newReport as any).airlines;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(newReport as any).airlines && (newReport as any).airline) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newReport as any).airlines = (newReport as any).airline;
    }

    const normalizedCategory = resolveReportCategory(newReport);
    if (normalizedCategory) {
      newReport.main_category = normalizedCategory;
      newReport.category = normalizedCategory;
    }

    syncEscalationDivisionAliases(newReport);

    return newReport;
  }

  private assignSheetIdentity(report: Report, targetSheet: string, rowNumber: number | null): Report {
    if (rowNumber) {
      const originalId = `${targetSheet}!row_${rowNumber}`;
      report.original_id = originalId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      report.sheet_id = originalId as any;
      report.id = this.getReportUuid(originalId);
      report.row_number = rowNumber;
    } else {
      const fallbackId = `${targetSheet}!row_pending_${Date.now()}`;
      report.original_id = fallbackId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      report.sheet_id = fallbackId as any;
      report.id = this.getReportUuid(fallbackId);
      report.row_number = undefined;
    }

    report.source_sheet = targetSheet;
    report.source_fingerprint = buildReportFingerprint(report);

    if (report.id && report.original_id) {
        setCache(`uuid_to_original:${report.id}`, report.original_id);
    }

    return report;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildSheetRow(headers: string[], report: Report): any[] {
    // Every cell is escaped against CSV/formula injection before it reaches
    // Sheets (writes use valueInputOption USER_ENTERED). See escapeSpreadsheetCell.
    return headers.map((header: string) => escapeSpreadsheetCell(this.buildSheetCell(header, report)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildSheetCell(header: string, report: Report): any {
    const normalizedHeader = header.trim().toLowerCase();

      // A single header can be the target of several props (e.g. `category`
      // + `main_category` both map to "Report Category"). Pick the first prop
      // that actually carries a value so a report never blanks a column just
      // because the create route populated a synonym field. ponytail: fixes
      // Report Category / Severity Level / Airlines mapping in one place.
      const candidateProps = Object.entries(PROP_TO_HEADER)
        .filter(([, names]) => (names as string[]).some(name => name.toLowerCase() === normalizedHeader))
        .map(([prop]) => prop as keyof Report);

      for (const prop of candidateProps) {
        if (prop === 'evidence_url' || prop === 'evidence_urls') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const urls = Array.isArray((report as any).evidence_urls)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (report as any).evidence_urls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : ((report as any).evidence_url ? [(report as any).evidence_url] : []);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoUrls = Array.isArray((report as any).video_urls)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (report as any).video_urls
            : [];

          const allUrls = [...urls, ...videoUrls].filter(Boolean);
          if (allUrls.length) return allUrls.join(' | ');
          continue;
        }

        if (prop === 'severity' || prop === 'severity_level') {
          const normalizedSeverity = String(report.severity || report.severity_level || '').trim().toLowerCase();
          if (!normalizedSeverity) continue;
          if (normalizedSeverity === 'urgent' || normalizedSeverity === 'high') return 'TOP RISK';
          if (normalizedSeverity === 'medium') return 'MEDIUM';
          if (normalizedSeverity === 'low') return 'LOW';
          return report.severity || report.severity_level || 'LOW';
        }

        if (prop === 'status') {
          return String(report.status || 'OPEN').trim().toUpperCase() || 'OPEN';
        }

        const val = report[prop];
        if (val === undefined || val === null || val === '') continue;
        if (Array.isArray(val)) return val.join(' | ');
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((report as any)[header]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = (report as any)[header];
        if (Array.isArray(v)) return v.join(' | ');
        if (v && typeof v === 'object') return JSON.stringify(v);
        return v;
      }
      return '';
  }

  private async getSheetIdByName(sheetName: string): Promise<number | null> {
    if (SHEET_IDS[sheetName] !== undefined) {
        return SHEET_IDS[sheetName];
    }
    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId ?? null;
  }

  private async getHeaderRow(sheetName: string): Promise<string[]> {
    const cacheKey = `headers:${sheetName}`;
    const cached = getCache<string[]>(cacheKey, 1000 * 60 * 60);
    if (cached) return cached;

    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = (response.data.values?.[0] || []).map((h: any) => String(h).trim());
    setCache(cacheKey, headers);
    return headers;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchSheetWithRetry(sheetName: string, retries = 3, delay = 1000): Promise<any[][]> {
      const sheets = await this.getSheets();
      if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
      for (let i = 0; i < retries; i++) {
          try {
              const response = await sheets.spreadsheets.values.get({
                  spreadsheetId: SPREADSHEET_ID,
                  range: sheetName,
              });
              return response.data.values || [];
          } catch (error) {
              if (i === retries - 1) throw error;
              console.warn(`Retry ${i + 1}/${retries} fetching sheet ${sheetName}:`, error);
              await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
          }
      }
      return [];
  }

  public invalidateCache() {
    reportCacheEpoch += 1;
    const keys = Array.from(ttlCache.keys());
    keys.forEach((k) => {
      if (k.startsWith(CACHE_KEY_ALL_REPORTS)) ttlCache.delete(k);
    });
  }

  async getReports(options?: GetReportsOptions): Promise<Report[]> {
    const { filters, source = 'auto' } = options || {};
    const fields = options?.projection
      ? REPORT_PROJECTIONS[options.projection]
      : options?.fields;
    const normalizedFilterEntries = Object.entries(filters || {})
      .filter(([, value]) => (
        value !== undefined
        && value !== null
        && value !== false
        && value !== ''
        && value !== 'all'
      ))
      .sort(([left], [right]) => left.localeCompare(right));
    const canUseProjectionCache = source !== 'sheets' && !options?.refresh;
    const projectionCacheKey = `${CACHE_KEY_ALL_REPORTS}:${fields?.join(',') || 'full'}:${JSON.stringify(normalizedFilterEntries)}:${options?.maxSyncBatches ?? 'default'}`;
    const cacheEpochAtStart = reportCacheEpoch;

    let selectedReports: Report[] = [];

    if (source === 'sheets') {
      try {
        selectedReports = await this.fetchGoogleSheetsReports();
      } catch (err) {
        console.error('[ReportsService] Google Sheets fetch failed (forced):', err);
        selectedReports = [];
      }
    } else {
      const cachedReports = canUseProjectionCache
        ? await getVersionedCache<Report[]>(projectionCacheKey, CACHE_TTL)
        : null;
      if (cachedReports) {
        selectedReports = cachedReports.map((report) => ({ ...report }));
      } else {
        let inflight = inflightReportFetches.get(projectionCacheKey);
        if (!inflight) {
          inflight = this.fetchReportsFromSync(filters, fields, options?.maxSyncBatches);
          inflightReportFetches.set(projectionCacheKey, inflight);
        }
        try {
          selectedReports = await inflight;
        } finally {
          if (inflightReportFetches.get(projectionCacheKey) === inflight) {
            inflightReportFetches.delete(projectionCacheKey);
          }
        }
        if (canUseProjectionCache && cacheEpochAtStart === reportCacheEpoch) {
          await setVersionedCache(projectionCacheKey, selectedReports.map((report) => ({ ...report })));
        }
      }
    }

    // fetchReportsFromSync's buildQuery() already pushes dateFrom/dateTo, hub,
    // branch/branchIn, area, airlines, sourceSheet and status down to Postgres
    // (as .eq()/.gte()/.lte()/.or() predicates) and already orders by
    // date_of_event desc — and the projection cache above stores exactly what
    // that query returned. So for every source except 'sheets' (which has no
    // pushdown at all — fetchGoogleSheetsReports() returns the full,
    // unfiltered, unsorted sheet), re-checking those same fields and
    // re-sorting here would just repeat work Postgres already did, on rows
    // that already satisfy it. esklasiRegex/gseOnly have no DB equivalent and
    // always need the JS check regardless of source.
    const isDbPushedDown = source !== 'sheets';

    const filteredReports = selectedReports.filter(report => {

        if (filters) {

          if (!isDbPushedDown) {
            if (filters.dateFrom || filters.dateTo) {
              const reportDate = parseDate(report.date_of_event || report.created_at);
              if (!reportDate) return false;

              if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                if (reportDate < fromDate) return false;
              }

              if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (reportDate > toDate) return false;
              }
            }

            if (filters.status && filters.status !== 'all' && (report.status !== filters.status)) return false;

            if (filters.hub && filters.hub !== 'all' && (report.hub !== filters.hub)) return false;

            if (filters.branch && filters.branch !== 'all') {
              const reportBranch = report.branch || report.reporting_branch || report.station_code;
              if (reportBranch !== filters.branch) return false;
            }

            if (filters.branchIn && filters.branchIn.length > 0) {
              const reportStations = [report.branch, report.reporting_branch, report.station_code]
                .filter((value): value is NonNullable<typeof value> => Boolean(value))
                .map(String);
              if (!reportStations.some((station) => filters.branchIn!.includes(station))) return false;
            }

            if (filters.area && filters.area !== 'all') {
              const reportArea = report.area || report.terminal_area_category || report.apron_area_category || report.general_category || '';
              if (reportArea !== filters.area) return false;
            }

            if (filters.airlines && filters.airlines !== 'all' && report.airlines !== filters.airlines) return false;

            if (filters.sourceSheet && report.source_sheet !== filters.sourceSheet) return false;
          }

          if (filters.esklasiRegex && !matchesEsklasiRegex(report, filters.esklasiRegex)) return false;

          if (filters.gseOnly && !isGseRelatedReport(report)) return false;
        }
        return true;
    });

    if (!isDbPushedDown) {
      filteredReports.sort((a, b) => {
        const dateA = a.date_of_event ? new Date(a.date_of_event).getTime() : 0;
        const dateB = b.date_of_event ? new Date(b.date_of_event).getTime() : 0;
        return dateB - dateA;
      });
    }

    const finalReports = fields && fields.length > 0
      ? filteredReports.map((report) => {
          const projected: Record<string, unknown> = { id: report.id };
          fields.forEach((field) => {
            if (report[field] !== undefined) projected[field] = report[field];
          });
          return projected as Report;
        })
      : filteredReports;
    return finalReports;
  }

  async getProjectedReports<P extends ReportProjectionName>(
    projection: P,
    options?: Omit<GetReportsOptions, 'fields' | 'projection'>,
  ): Promise<Array<ProjectedReport<P>>> {
    const reports = await this.getReports({ ...options, projection });
    return reports as Array<ProjectedReport<P>>;
  }

  public async fetchSheetsReports(): Promise<Report[]> {
    return this.fetchGoogleSheetsReports();
  }

  // Scoped counterpart to fetchGoogleSheetsReports() for the edit webhook: one
  // Sheets read for the row (getHeaderRow() is hour-cached, so a warm sheet
  // costs nothing extra) instead of pulling every row on every edit.
  public async fetchSingleReportFromSheet(sheetName: string, rowNumber: number): Promise<Report | null> {
    if (!REPORT_SHEETS.includes(sheetName)) return null;
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    if (!Number.isFinite(rowNumber) || rowNumber < 2) return null;

    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${rowNumber}:${rowNumber}`,
    });

    const row = response.data.values?.[0];
    const isBlankRow = !row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
    if (isBlankRow) return null;

    const headers = await this.getHeaderRow(sheetName);
    const columnMapping = this.buildColumnMapping(headers);
    return this.mapRowToReport(row, columnMapping, sheetName, rowNumber - 2);
  }

  private async fetchGoogleSheetsReports(): Promise<Report[]> {
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    const sheets = await this.getSheets();

    const ranges = REPORT_SHEETS.map(name => `${name}`);
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
    });

    const allReports: Report[] = [];
    const valueRanges = batchRes.data.valueRanges || [];

    for (let i = 0; i < REPORT_SHEETS.length; i++) {
      const sheetName = REPORT_SHEETS[i];
      const data = valueRanges[i]?.values || [];
      if (data.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headers = (data[0] || []).map((h: any) => String(h).trim());
      const rows = data.slice(1);
      const columnMapping = this.buildColumnMapping(headers);

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const isBlankRow = !row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
        if (isBlankRow) continue;
        const report = this.mapRowToReport(row, columnMapping, sheetName, index);
        allReports.push(report);
      }
    }
    return allReports;
  }

  private async fetchReportsFromSync(
    filters?: ReportQueryFilters,
    fields?: readonly ReportColumn[],
    maxBatches: number = 100,
  ): Promise<Report[]> {
    try {
      const requiredFields = new Set<ReportColumn>([
        'id',
        'date_of_event',
        'incident_date',
        'created_at',
        'status',
        'severity',
        'priority',
        'station_id',
      ]);
      fields?.forEach((field) => requiredFields.add(field));

      if (filters?.hub) requiredFields.add('hub');
      if (filters?.branch || filters?.branchIn?.length) {
        requiredFields.add('branch');
        requiredFields.add('reporting_branch');
        requiredFields.add('station_code');
      }
      if (filters?.area) {
        requiredFields.add('area');
        requiredFields.add('terminal_area_category');
        requiredFields.add('apron_area_category');
        requiredFields.add('general_category');
      }
      if (filters?.airlines) requiredFields.add('airlines');
      if (filters?.sourceSheet) requiredFields.add('source_sheet');
      if (filters?.esklasiRegex) {
        requiredFields.add('esklasi_divisi');
      }
      if (filters?.gseOnly) {
        [
          'service_business_type',
          'remarks_case',
          'gse_available_requirement',
          'gse_requirement',
          'gse_motorized',
          'gse_non_motorized',
          'category_case_gse',
          'case_category',
          'main_category',
          'category',
          'description',
          'report',
        ].forEach((field) => requiredFields.add(field as ReportColumn));
      }

      const selectFields = fields && fields.length > 0
        ? Array.from(requiredFields).join(',')
        : '*';

      const buildQuery = () => {
        let q = supabaseAdmin
          .from('ground_handling_irregularity_report')
          .select(selectFields)
          .order('date_of_event', { ascending: false });
        if (filters?.hub && filters.hub !== 'all') q = q.eq('hub', filters.hub);
        if (filters?.branch && filters.branch !== 'all') q = q.eq('branch', filters.branch);
        if (filters?.branchIn && filters.branchIn.length > 0) {
          // Station data is inconsistently stored across branch/station_code/
          // reporting_branch, so match any of the three. Only pass through
          // simple station-code tokens — never interpolate arbitrary text
          // into a raw PostgREST .or() filter string.
          const safeCodes = filters.branchIn.filter((code) => /^[A-Za-z0-9_-]+$/.test(code));
          if (safeCodes.length > 0) {
            const list = safeCodes.join(',');
            q = q.or(`branch.in.(${list}),station_code.in.(${list}),reporting_branch.in.(${list})`);
          }
        }
        if (filters?.area && filters.area !== 'all') q = q.eq('area', filters.area);
        if (filters?.airlines && filters.airlines !== 'all') q = q.eq('airlines', filters.airlines);
        if (filters?.dateFrom) q = q.gte('date_of_event', filters.dateFrom);
        if (filters?.dateTo) {
          const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)
            ? filters.dateTo + 'T23:59:59.999Z'
            : filters.dateTo;
          q = q.lte('date_of_event', dateTo);
        }
        if (filters?.sourceSheet) q = q.eq('source_sheet', filters.sourceSheet);
        if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
        return q;
      };

      const allReports: Record<string, unknown>[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      let batchCount = 0;

      while (hasMore) {
        if (batchCount >= maxBatches) {
          console.warn(
            `[ReportsService] reports_sync fetch stopped at the ${maxBatches}-batch cap (${allReports.length} rows) — pass a narrower filter or a larger maxSyncBatches if this call genuinely needs more.`
          );
          break;
        }
        batchCount++;

        const { data, error } = await buildQuery().range(offset, offset + batchSize - 1);

        if (error) {
          console.warn('[ReportsService] reports_sync fetch error:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allReports.push(...(data as unknown as Record<string, unknown>[]));
          hasMore = data.length === batchSize;
          offset += batchSize;
        }
      }

      if (allReports.length === 0) {
        return [];
      }


      return allReports.map((row) => syncEscalationDivisionAliases({
        ...row,
        id: String(row.id || ''),
        evidence_urls: row.evidence_urls || (row.evidence_url ? [row.evidence_url] : undefined),
        status: row.status || 'OPEN',
        severity: row.severity || 'LOW',
        priority: row.priority || 'low',
        date_of_event: row.date_of_event || row.incident_date || row.created_at,
        created_at: row.created_at || new Date().toISOString(),
        stations: row.station_id
          ? { code: String(row.station_id), name: String(row.station_id) }
          : undefined,
      } as Partial<Report>)) as Report[];
    } catch (error) {
      console.error('[ReportsService] reports_sync fetch exception:', error);
      return [];
    }
  }

  async getStations(): Promise<Station[]> {
    const cacheKey = 'stations:all:v1';
    const cached = getCache<Station[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;

    try {
      const { data, error } = await supabaseAdmin.from('stations').select('id, code, name').order('code');
      if (!error && Array.isArray(data) && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stationsDb: Station[] = data.map((row: any) => ({
          id: row.id,
          code: row.code,
          name: row.name,
        }));
        setCache(cacheKey, stationsDb);
        return stationsDb;
      }
    } catch (err) {
      console.warn('[ReportsService] Stations DB fetch failed, falling back to reports:', err);
    }

    const reports = await this.getReports();
    const branchNames = Array.from(new Set(reports.map(r => r.branch).filter(Boolean)));
    let stations: Station[] = branchNames.map((name) => ({
      id: String(name),
      code: String(name),
      name: String(name),
    }));

    if (stations.length === 0) {
      const fallbackCodes = [
        'KPS',

        'CGK', 'DPS', 'SUB',

        'UPG', 'KNO', 'BPN',

        'JOG', 'SOC', 'SRG', 'BDO', 'MLG', 'YIA',

        'MDC', 'PDG', 'PKU', 'BTH', 'PLM', 'TKG', 'BKS', 'DJB', 'PGK', 'SBG', 'TNJ',

        'PNK', 'BJM', 'TRK', 'AAP',

        'PLW', 'GTO', 'KDI', 'MKS',

        'LOP', 'KOE', 'BMU',

        'AMQ', 'TTE', 'SOR', 'TIM', 'DJJ', 'MKQ',
      ];
      stations = fallbackCodes.map(code => ({ id: code, code, name: code }));
    }

    setCache(cacheKey, stations);
    return stations;
  }

  async getUnits(): Promise<Unit[]> {
    const { data } = await supabaseAdmin.from('units').select('*').order('name');
    return data || [];
  }

  async getPositions(): Promise<Position[]> {
    const { data } = await supabaseAdmin.from('positions').select('*').order('level');
    return data || [];
  }

  async getIncidentTypes(): Promise<IncidentType[]> {
    const { data } = await supabaseAdmin.from('incident_types').select('*').order('name');
    return data || [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getLocations(stationCode?: string): Promise<any[]> {
    let query = supabaseAdmin.from('locations').select('*').order('name');
    if (stationCode) {
      query = query.eq('station_id', stationCode);
    }
    const { data } = await query;
    return data || [];
  }

  async createReport(reportData: Partial<Report>): Promise<Report> {
    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');

    const targetSheet = this.getTargetSheet(reportData);
    const headers = await this.getHeaderRow(targetSheet);
    const newReport = this.buildWritableReport(reportData, targetSheet);
    const row = this.buildSheetRow(headers, newReport);

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${targetSheet}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    this.invalidateCache();

    let updatedRowNumber: string | null = null;
    const updatedRange = appendRes.data.updates?.updatedRange || null;
    if (updatedRange) {
        const match = updatedRange.match(/!A(\d+)/);
        if (match && match[1]) {
            updatedRowNumber = match[1];
        }
    }
    if (!updatedRowNumber) {
        try {

            const colA = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${targetSheet}!A:A`,
                majorDimension: 'COLUMNS',
            });
            const totalRows = (colA.data.values?.[0] || []).length;
            if (totalRows && totalRows > 1) {
                updatedRowNumber = String(totalRows);
            }
        } catch (err) {
            console.warn('[ReportsService] Row count fallback failed:', err);
        }
    }

    if (!updatedRowNumber) {
        return this.assignSheetIdentity(newReport, targetSheet, null);
    }

    return this.assignSheetIdentity(newReport, targetSheet, parseInt(updatedRowNumber, 10));
  }

  // Every single-report read used to also live-fetch the row from Google
  // Sheets by default (only opting out via skipLiveFetch), which meant every
  // report detail page view, evidence lookup, admin read, etc. paid a Sheets
  // API round trip on top of the Supabase read. The DB row is kept in sync
  // already, so DB-only is now the default — callers that specifically need
  // the freshest possible data (e.g. a merge just before overwriting the
  // sheet) opt in with forceLiveFetch: true. skipLiveFetch is still accepted
  // for existing explicit-skip call sites; it's just a no-op now.
  async getReportById(
    id: string,
    options: { skipLiveFetch?: boolean; forceLiveFetch?: boolean } = {},
  ): Promise<Report | null> {
    const safeId = `"${id.replace(/"/g, '""')}"`;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabaseAdmin.from('ground_handling_irregularity_report').select('*').limit(1);

    if (isUuid) {
        query = query.or(`id.eq.${safeId},original_id.eq.${safeId},sheet_id.eq.${safeId}`);
    } else {
        query = query.or(`original_id.eq.${safeId},sheet_id.eq.${safeId}`);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const dbRow = data[0];

      const originalId = dbRow.sheet_id || dbRow.original_id;
      if (options.forceLiveFetch && originalId && originalId.includes('!row_')) {
          try {
              const liveData = await this.fetchLiveFromSheet(originalId);
              if (liveData) {

                  const resolvedStatus = String(liveData.status || '').trim()
                      || String(dbRow.status || '').trim()
                      || 'OPEN';

                  return syncEscalationDivisionAliases({
                      ...dbRow,
                      ...liveData,
                      id: dbRow.id,
                      sheet_id: originalId,
                      status: resolvedStatus,
                      source_fingerprint: dbRow.source_fingerprint || buildReportFingerprint(dbRow),
                  } as Report);
              }
          } catch (err) {
              console.warn(`[ReportsService] Failed to fetch live data for ${originalId}, falling back to DB:`, err);
          }
      }

      return syncEscalationDivisionAliases({
        ...dbRow,
        id: dbRow.id,
        sheet_id: dbRow.sheet_id,
        source_fingerprint: dbRow.source_fingerprint || buildReportFingerprint(dbRow),
        evidence_urls: dbRow.evidence_urls || (dbRow.evidence_url ? [dbRow.evidence_url] : []),
        status: dbRow.status || 'OPEN',
        severity: dbRow.severity || 'low',
        priority: dbRow.priority || 'low',
        date_of_event: dbRow.date_of_event || dbRow.incident_date || dbRow.created_at,
        created_at: dbRow.created_at || new Date().toISOString(),
        stations: dbRow.station_id ? { code: dbRow.station_id, name: dbRow.station_id } : undefined,
      } as Report);
    }

    // JOUMPA reports live in a separate synced table. The row is already a
    // complete copy, so we return it directly — no live Google Sheets fetch
    // (that round-trip was the >10s stall + "Report not found" for JOUMPA).
    const jpFilter = isUuid
        ? `id.eq.${safeId},sheet_id.eq.${safeId}`
        : `sheet_id.eq.${safeId}`;
    const { data: jpData } = await supabaseAdmin
        .from('joumpa_reports_sync')
        .select('*')
        .or(jpFilter)
        .limit(1);

    if (jpData && jpData.length > 0) {
        const row = jpData[0];
        return syncEscalationDivisionAliases({
            ...row,
            id: row.id,
            sheet_id: row.sheet_id,
            source_fingerprint: row.source_fingerprint || buildReportFingerprint(row),
            evidence_urls: row.evidence_urls || (row.evidence_url ? [row.evidence_url] : []),
            status: row.status || 'OPEN',
            severity: row.severity || 'low',
            priority: row.priority || 'low',
            date_of_event: row.date_of_event || row.created_at,
            created_at: row.created_at || new Date().toISOString(),
            stations: row.station_id ? { code: row.station_id, name: row.station_id } : undefined,
        } as Report);
    }

    return null;
  }

  private async fetchLiveFromSheet(originalId: string): Promise<Partial<Report> | null> {
    const info = this.parseId(originalId);
    if (!info) return null;

    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${info.sheetName}!${info.rowIndex}:${info.rowIndex}`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    // getHeaderRow() is cached for an hour — this used to re-fetch the header
    // row live on every call, doubling this method's Sheets API read cost.
    const headers = await this.getHeaderRow(info.sheetName);

    return this.mapLiveRowToReport(rows[0], headers);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapLiveRowToReport(row: any[], headers: string[]): Partial<Report> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report: any = {};

    const headerToProp: Record<string, keyof Report> = {};
    Object.entries(PROP_TO_HEADER).forEach(([prop, hList]) => {
        hList!.forEach(h => {
            headerToProp[h.toLowerCase()] = prop as keyof Report;
        });
    });

    headers.forEach((header, index) => {
        const prop = headerToProp[header.toLowerCase()];
        if (prop) {
            let value = row[index];

            if (prop === 'date_of_event' && value) {
                try {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) value = d.toISOString().split('T')[0];
                } catch {}
            }
            report[prop] = value;
        }
    });

    if (report.root_caused && !report.root_cause) report.root_cause = report.root_caused;
    if (report.root_cause && !report.root_caused) report.root_caused = report.root_cause;

    return report;
  }

  private parseId(id: string): { sheetName: string, rowIndex: number } | null {
    if (!id.includes('!row_')) return null;
    const [sheetName, rowPart] = id.split('!row_');
    const index = parseInt(rowPart, 10);
    if (isNaN(index)) return null;
    return { sheetName, rowIndex: index };
  }

  private async resolveIdToOriginal(id: string): Promise<string | null> {
    if (id.includes('!row_')) return id;

    const cached = getCache<string>(`uuid_to_original:${id}`, 1000 * 60 * 5);
    if (cached) return cached;

    const report = await this.getReportById(id);
    return report?.original_id || null;
  }

  async updateReport(id: string, updates: Partial<Report>, options: { skipLiveFetch?: boolean } = {}): Promise<Report | null> {
    const originalId = await this.resolveIdToOriginal(id);
    if (!originalId) {
        console.error('Invalid ID format for update:', id);
        return null; 
    }

    const parsed = this.parseId(originalId);
    if (!parsed) return null;

    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');
    const { sheetName, rowIndex } = parsed;

    if (updates.primary_tag === 'CGO' && sheetName !== 'CGO') {
        // Recreates this report as a brand-new row on the CGO sheet below, so
        // it genuinely needs the freshest possible data to avoid losing a
        // live out-of-band edit when the old row gets deleted.
        const currentReport = await this.getReportById(id, { forceLiveFetch: true });
        if (currentReport) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newReportPayload: any = {
                ...currentReport,
                ...updates,
            };
            delete newReportPayload.id;
            newReportPayload.primary_tag = 'CGO';

            const newReport = await this.createReport(newReportPayload);
            if (newReport) {
                await this.deleteReport(originalId);
                return newReport;
            }
        }
    }

    const headers = await this.getHeaderRow(sheetName);

    const getColLetter = (index: number): string => {
        let col = '';
        let n = index;
        while (n >= 0) {
            col = String.fromCharCode(65 + (n % 26)) + col;
            n = Math.floor(n / 26) - 1;
        }
        return col;
    };

    const effectiveUpdates: Partial<Report> = { ...updates };

    if ('esklasi_divisi' in effectiveUpdates) {
      syncEscalationDivisionAliases(effectiveUpdates);
    }

    if (['evidence_urls', 'evidence_url', 'video_urls', 'video_url'].some(k => k in effectiveUpdates)) {
        // Callers pushing a full DB row (the sync push-back loop) always have
        // these keys present, even when null — so those explicitly pass
        // skipLiveFetch: true to avoid a live Sheets read on every dirty row
        // regardless of whether evidence actually changed. Callers pushing
        // genuine partial edits (user-facing PATCH routes) don't set
        // skipLiveFetch, so this still force-fetches live to merge and guard
        // against clobbering a URL someone just pasted directly into the sheet.
        const currentReport = await this.getReportById(id, { forceLiveFetch: options.skipLiveFetch !== true });
        if (currentReport) {
            const existingUrls = [
                ...(Array.isArray(currentReport.evidence_urls) ? currentReport.evidence_urls : []),
                ...(currentReport.evidence_url && !Array.isArray(currentReport.evidence_urls) ? [currentReport.evidence_url] : []),
                ...(Array.isArray(currentReport.video_urls) ? currentReport.video_urls : []),
                ...(currentReport.video_url && !Array.isArray(currentReport.video_urls) ? [currentReport.video_url] : [])
            ];
            const newUrls = [
                ...(Array.isArray(effectiveUpdates.evidence_urls) ? effectiveUpdates.evidence_urls : []),
                ...(effectiveUpdates.evidence_url ? [effectiveUpdates.evidence_url] : []),
                ...(Array.isArray(effectiveUpdates.video_urls) ? effectiveUpdates.video_urls : []),
                ...(effectiveUpdates.video_url ? [effectiveUpdates.video_url] : [])
            ];

            const hasNewEditedDocx = newUrls.some(u => {
                const dec = decodeURIComponent(String(u||'')).toUpperCase();
                return dec.includes('IRREGULARITY_REPORT_EDITED') && dec.includes('.DOCX');
            });

            let filteredExisting = existingUrls;
            if (hasNewEditedDocx) {
                 filteredExisting = existingUrls.filter(u => {
                    const dec = decodeURIComponent(String(u||'')).toUpperCase();
                    return !(dec.includes('IRREGULARITY_REPORT_EDITED') && dec.includes('.DOCX'));
                 });
            }

            effectiveUpdates.evidence_urls = [...new Set([...filteredExisting, ...newUrls])].filter(Boolean);
        }
    }

    const batchData: { range: string; values: string[][] }[] = [];

    for (const [key, value] of Object.entries(effectiveUpdates)) {
        if (value === undefined) continue;
        if (key === 'evidence_url' || key === 'video_url' || key === 'video_urls') continue;

        let colIndex = -1;
        const propHeaders = PROP_TO_HEADER[key as keyof Report];

        if (propHeaders) {
            colIndex = headers.findIndex(h => 
                propHeaders.some(name => h.trim().toLowerCase() === name.trim().toLowerCase())
            );
        }

        if (colIndex === -1) {
            colIndex = headers.findIndex((h: string) => {
                const trimmedH = h.trim().toLowerCase();
                return trimmedH === key.toLowerCase() || trimmedH === key.replace(/_/g, ' ').toLowerCase();
            });
        }

        if (colIndex === -1) continue;

        const colLetter = getColLetter(colIndex);
        const cellRange = `${sheetName}!${colLetter}${rowIndex}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let stringValue: any = value;
        if (value === null || value === undefined) stringValue = '';
        else if (Array.isArray(value)) stringValue = value.join('\n');
        else if (typeof value === 'object') stringValue = JSON.stringify(value);
        else stringValue = String(value);

        batchData.push({ range: cellRange, values: [[stringValue]] });
    }

    if (batchData.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                data: batchData,
                valueInputOption: 'USER_ENTERED',
            },
        });
    }

    this.invalidateCache();
    // We just wrote effectiveUpdates to the sheet ourselves, so there's nothing
    // fresher to protect against by reading it live back — that round-trip was
    // costing every caller (notably the up-to-50-row sync push-back loop) 2
    // extra Google Sheets API reads per report for a return value most callers
    // don't even use, and was blowing through the per-minute read quota.
    const existing = await this.getReportById(id, { skipLiveFetch: true });
    if (existing) {
        return syncEscalationDivisionAliases({ ...existing, ...effectiveUpdates });
    }

    return {
        id: id,
        original_id: originalId,
        sheet_id: originalId,
        ...effectiveUpdates
    } as Report;
  }

  async deleteReport(id: string): Promise<boolean> {
    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');

    const parsed = this.parseId(id);
    if (!parsed) return false;
    const { sheetName, rowIndex } = parsed;

    const sheetId = await this.getSheetIdByName(sheetName);
    if (sheetId === null) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    this.invalidateCache();
    return true;
  }

  async batchCreateReports(reports: Partial<Report>[]): Promise<Report[]> {
    if (!reports.length) return [];
    const sheets = await this.getSheets();
    if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID is not defined');

    const grouped: Record<string, Array<{ index: number; report: Report }>> = {
      'NON CARGO': [],
      'CGO': []
    };

    reports.forEach((reportData, index) => {
      const targetSheet = this.getTargetSheet(reportData);
      grouped[targetSheet].push({
        index,
        report: this.buildWritableReport(reportData, targetSheet),
      });
    });

    const createdReports = new Array<Report>(reports.length);

    for (const [targetSheet, reportsInSheet] of Object.entries(grouped)) {
      if (!reportsInSheet.length) continue;

      const headers = await this.getHeaderRow(targetSheet);
      const existingColumn = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${targetSheet}!A:A`,
      });
      const previousRowCount = (existingColumn.data.values || []).length;

      const rows = reportsInSheet.map(({ report }) => this.buildSheetRow(headers, report));

      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${targetSheet}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });

      let startRow = previousRowCount + 1;
      const updatedRange = appendRes.data.updates?.updatedRange || '';
      const match = updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)/);
      if (match && match[1]) {
        startRow = parseInt(match[1], 10);
      }

      reportsInSheet.forEach(({ index, report }, offset) => {
        createdReports[index] = this.assignSheetIdentity(report, targetSheet, startRow + offset);
      });
    }

    this.invalidateCache();
    return createdReports.filter((report): report is Report => Boolean(report));
  }
}

export const reportsService = new ReportsService();
