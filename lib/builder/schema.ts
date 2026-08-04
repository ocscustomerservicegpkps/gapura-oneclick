
import type { TableDef, JoinDef, FieldDef } from '@/types/builder';

export const TABLES: TableDef[] = [
  {
    name: 'reports',
    label: 'Laporan',
    fields: [
      { name: 'id', label: 'ID Laporan', type: 'uuid' },
      { name: 'title', label: 'Judul', type: 'string' },
      { name: 'status', label: 'Status', type: 'string', enumValues: ['OPEN', 'ON PROGRESS', 'CLOSED'] },
      { name: 'severity', label: 'Severity', type: 'string', enumValues: ['low', 'medium', 'high'] },
      { name: 'priority', label: 'Prioritas', type: 'string', enumValues: ['low', 'medium', 'high', 'urgent'] },
      { name: 'category', label: 'Kategori Utama', type: 'string', enumValues: ['Irregularity', 'Complaint', 'Compliment'] },
      { name: 'irregularity_complain_category', label: 'Kategori Irregularity/Complain', type: 'string' },
      { name: 'terminal_area_category', label: 'Kategori Area Terminal', type: 'string' },
      { name: 'apron_area_category', label: 'Kategori Area Apron', type: 'string' },
      { name: 'general_category', label: 'Kategori Umum', type: 'string' },
      { name: 'area', label: 'Area', type: 'string', enumValues: ['APRON', 'TERMINAL', 'GENERAL', 'Terminal Area', 'Apron Area'] },
      { name: 'airlines', label: 'Maskapai', type: 'string' },
      { name: 'station_code', label: 'Kode Bandara', type: 'string' },
      { name: 'station', label: 'Station', type: 'string' },
      { name: 'branch', label: 'Cabang', type: 'string' },
      { name: 'route', label: 'Rute', type: 'string' },
      { name: 'flight_number', label: 'Nomor Penerbangan', type: 'string' },
      { name: 'aircraft_reg', label: 'Registrasi Pesawat', type: 'string' },
      { name: 'gse_number', label: 'Nomor GSE', type: 'string' },
      { name: 'location', label: 'Lokasi (jarang terisi)', type: 'string' },
      { name: 'specific_location', label: 'Lokasi Spesifik', type: 'string' },
      { name: 'description', label: 'Deskripsi Insiden', type: 'string' },
      { name: 'root_caused', label: 'Akar Masalah', type: 'string' },
      { name: 'action_taken', label: 'Tindakan yang Diambil', type: 'string' },
      { name: 'gapura_kps_action_taken', label: 'Gapura KPS Action Taken', type: 'string' },
      { name: 'immediate_action', label: 'Tindakan Segera', type: 'string' },
      { name: 'evidence_urls', label: 'Link Evidence', type: 'string' },
      { name: 'evidence_url', label: 'Evidence URL (Legacy)', type: 'string' },
      { name: 'reporter_name', label: 'Nama Pelapor', type: 'string' },
      { name: 'reference_number', label: 'Nomor Referensi', type: 'string' },
      { name: 'is_flight_related', label: 'Terkait Penerbangan', type: 'boolean' },
      { name: 'is_gse_related', label: 'Terkait GSE', type: 'boolean' },
      { name: 'date_of_event', label: 'Tanggal Insiden', type: 'date' },
      { name: 'incident_time', label: 'Waktu Insiden', type: 'string' },
      { name: 'event_date', label: 'Tanggal Kejadian', type: 'datetime' },
      { name: 'created_at', label: 'Tanggal Dibuat', type: 'datetime' },
      { name: 'updated_at', label: 'Tanggal Diperbarui', type: 'datetime' },
      { name: 'resolved_at', label: 'Tanggal Diselesaikan', type: 'datetime' },
      { name: 'acknowledged_at', label: 'Tanggal Diakui', type: 'datetime' },
      { name: 'validated_at', label: 'Tanggal Divalidasi', type: 'datetime' },
      { name: 'started_at', label: 'Tanggal Mulai', type: 'datetime' },
      { name: 'sla_deadline', label: 'Batas SLA', type: 'datetime' },
      { name: 'csv_id', label: 'ID Form', type: 'number' },
      { name: 'hub', label: 'Hub', type: 'string' },
      { name: 'jenis_maskapai', label: 'Jenis Maskapai', type: 'string', enumValues: ['Lokal', 'MPA', 'Garuda Indonesia', 'Citilink', 'Pelita Air', 'Non Airline Case'] },
      { name: 'report', label: 'Isi Laporan', type: 'string' },
      { name: 'kps_remarks', label: 'Gapura KPS Remarks', type: 'string' },
      { name: 'reporting_branch', label: 'Report Branch From', type: 'string' },
      { name: 'week_in_month', label: 'Minggu ke-', type: 'number' },
      { name: 'reporter_email', label: 'Email Pelapor', type: 'string' },
      { name: 'form_submitted_at', label: 'Waktu Submit Form', type: 'datetime' },
      { name: 'form_completed_at', label: 'Waktu Selesai Form', type: 'datetime' },
      { name: 'user_id', label: 'ID User Pelapor', type: 'uuid' },
      { name: 'station_id', label: 'ID Bandara', type: 'uuid' },
      { name: 'unit_id', label: 'ID Unit', type: 'uuid' },
      { name: 'incident_type_id', label: 'ID Tipe Insiden', type: 'uuid' },
      { name: 'location_id', label: 'ID Lokasi', type: 'uuid' },
      { name: 'source_sheet', label: 'Source Sheet', type: 'string' },
      { name: 'kode_cabang', label: 'Kode Cabang (Lookup)', type: 'string' },
      { name: 'kode_hub', label: 'Kode Hub (Lookup)', type: 'string' },
      { name: 'maskapai_lookup', label: 'Maskapai (Lookup)', type: 'string' },
      { name: 'lokal_mpa_lookup', label: 'Lokal / MPA (Lookup)', type: 'string' },
      { name: 'service_business_type', label: 'Service Business Type', type: 'string' },
      { name: 'remarks_case', label: 'Remarks Case', type: 'string' },
      { name: 'case_category', label: 'Case Category', type: 'string' },
      { name: 'case_cgo', label: 'Case CGO', type: 'string' },
      { name: 'supporting_evidence', label: 'Supporting Evidence', type: 'string' },
      { name: 'category_case_joumpa', label: 'Category Case Joumpa', type: 'string' },
      { name: 'reservation_scheduling', label: 'Reservation & Scheduling', type: 'string' },
      { name: 'pax_assistance_staff_service_performance', label: 'Pax Assistance / Staff Service Performance', type: 'string' },
      { name: 'baggage_delivery_baggage_assistance', label: 'Baggage Delivery & Baggage Assistance', type: 'string' },
      { name: 'administration_payment_documentation_marketing', label: 'Administration, Payment, Documentation & Marketing', type: 'string' },
      { name: 'gse_available_requirement', label: 'GSE Available & Requirement', type: 'string' },
      { name: 'gse_requirement', label: 'GSE Requirement', type: 'string' },
      { name: 'gse_motorized', label: 'GSE Motorized', type: 'string' },
      { name: 'gse_non_motorized', label: 'GSE Non-Motorized', type: 'string' },
      { name: 'category_case_gse', label: 'Category Case GSE', type: 'string' },
      { name: 'category_case_cargo', label: 'Category Case Cargo (CGO)', type: 'string' },

      { name: 'year', label: 'Tahun', type: 'number' },
      { name: 'month', label: 'Bulan', type: 'string' },
      { name: 'day', label: 'Hari', type: 'string' },
      { name: 'quarter', label: 'Kuartal', type: 'string' },
    ],
  },
  {
    name: 'users',
    label: 'Pengguna',
    fields: [
      { name: 'id', label: 'ID Pengguna', type: 'uuid' },
      { name: 'full_name', label: 'Nama Lengkap', type: 'string' },
      { name: 'email', label: 'Email', type: 'string' },
      { name: 'role', label: 'Role', type: 'string', enumValues: ['SUPER_ADMIN', 'DIVISI_OS', 'DIVISI_OP', 'DIVISI_HC', 'DIVISI_HT', 'ANALYST', 'MANAGER_CABANG', 'STAFF_CABANG'] },
      { name: 'division', label: 'Divisi', type: 'string', enumValues: ['GENERAL', 'OS', 'OP', 'HC', 'HT'] },
      { name: 'department', label: 'Departemen', type: 'string' },
      { name: 'status', label: 'Status Akun', type: 'string', enumValues: ['pending', 'active', 'rejected', 'suspended'] },
      { name: 'created_at', label: 'Tanggal Daftar', type: 'datetime' },
    ],
  },
  {
    name: 'stations',
    label: 'Bandara',
    fields: [
      { name: 'id', label: 'ID Bandara', type: 'uuid' },
      { name: 'code', label: 'Kode Bandara', type: 'string' },
      { name: 'name', label: 'Nama Bandara', type: 'string' },
    ],
  },
  {
    name: 'report_logs',
    label: 'Log Laporan',
    fields: [
      { name: 'id', label: 'ID Log', type: 'uuid' },
      { name: 'report_id', label: 'ID Laporan', type: 'uuid' },
      { name: 'user_id', label: 'ID User', type: 'uuid' },
      { name: 'action', label: 'Aksi', type: 'string' },
      { name: 'note', label: 'Catatan', type: 'string' },
      { name: 'previous_status', label: 'Status Sebelumnya', type: 'string' },
      { name: 'new_status', label: 'Status Baru', type: 'string' },
      { name: 'created_at', label: 'Waktu Dibuat', type: 'datetime' },
    ],
  },
  {
    name: 'report_comments',
    label: 'Komentar Laporan',
    fields: [
      { name: 'id', label: 'ID Komentar', type: 'uuid' },
      { name: 'report_id', label: 'ID Laporan', type: 'uuid' },
      { name: 'user_id', label: 'ID User', type: 'uuid' },
      { name: 'content', label: 'Konten', type: 'string' },
      { name: 'is_system_message', label: 'Pesan Sistem', type: 'boolean' },
      { name: 'created_at', label: 'Waktu Dibuat', type: 'datetime' },
    ],
  },
  {
    name: 'incident_types',
    label: 'Tipe Insiden',
    fields: [
      { name: 'id', label: 'ID Tipe', type: 'uuid' },
      { name: 'name', label: 'Nama Tipe', type: 'string' },
      { name: 'default_severity', label: 'Severity Default', type: 'string', enumValues: ['low', 'medium', 'high'] },
    ],
  },
  {
    name: 'locations',
    label: 'Lokasi',
    fields: [
      { name: 'id', label: 'ID Lokasi', type: 'uuid' },
      { name: 'name', label: 'Nama Lokasi', type: 'string' },
      { name: 'area', label: 'Area', type: 'string' },
    ],
  },
  {
    name: 'units',
    label: 'Unit',
    fields: [
      { name: 'id', label: 'ID Unit', type: 'uuid' },
      { name: 'name', label: 'Nama Unit', type: 'string' },
      { name: 'description', label: 'Deskripsi Unit', type: 'string' },
    ],
  },
  {
    name: 'positions',
    label: 'Jabatan',
    fields: [
      { name: 'id', label: 'ID Jabatan', type: 'uuid' },
      { name: 'name', label: 'Nama Jabatan', type: 'string' },
      { name: 'level', label: 'Level', type: 'number' },
    ],
  },
];

export const JOINS: JoinDef[] = [
  {
    key: 'reports_users',
    from: 'reports',
    fromField: 'user_id',
    to: 'users',
    toField: 'id',
    label: 'Pelapor',
  },
  {
    key: 'reports_stations',
    from: 'reports',
    fromField: 'station_id',
    to: 'stations',
    toField: 'id',
    label: 'Bandara',
  },
  {
    key: 'reports_units',
    from: 'reports',
    fromField: 'unit_id',
    to: 'units',
    toField: 'id',
    label: 'Unit',
  },
  {
    key: 'reports_incident_types',
    from: 'reports',
    fromField: 'incident_type_id',
    to: 'incident_types',
    toField: 'id',
    label: 'Tipe Insiden',
  },
  {
    key: 'reports_locations',
    from: 'reports',
    fromField: 'location_id',
    to: 'locations',
    toField: 'id',
    label: 'Lokasi Detail',
  },
  {
    key: 'reports_report_logs',
    from: 'reports',
    fromField: 'id',
    to: 'report_logs',
    toField: 'report_id',
    label: 'Log Aktivitas',
  },
  {
    key: 'reports_report_comments',
    from: 'reports',
    fromField: 'id',
    to: 'report_comments',
    toField: 'report_id',
    label: 'Komentar',
  },
  {
    key: 'report_logs_users',
    from: 'report_logs',
    fromField: 'user_id',
    to: 'users',
    toField: 'id',
    label: 'Pelaku Log',
  },
];

const tableMap = new Map(TABLES.map(t => [t.name, t]));
const joinMap = new Map(JOINS.map(j => [j.key, j]));

export function getFieldsForTable(tableName: string): FieldDef[] {
  return tableMap.get(tableName)?.fields ?? [];
}

export function getFieldDef(tableName: string, fieldName: string): FieldDef | undefined {
  return tableMap.get(tableName)?.fields.find(f => f.name === fieldName);
}

export function getJoinsForSource(source: string): JoinDef[] {
  return JOINS.filter(j => j.from === source);
}

export function getJoinDef(key: string): JoinDef | undefined {
  return joinMap.get(key);
}

export function isValidField(table: string, field: string): boolean {
  if (table === 'reports' && field === 'month') return true;
  const t = TABLES.find(t => t.name === table);
  return !!t?.fields.some(f => f.name === field);
}

export function isValidTable(table: string): boolean {
  return tableMap.has(table);
}

