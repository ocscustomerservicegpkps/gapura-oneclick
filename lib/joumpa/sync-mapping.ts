// Shared mapping from `joumpa_reports_sync` rows to Report objects.
// Extracted from the /api/joumpa route so the public share pipeline can reuse
// the exact same projection without duplicating it.
import type { Report } from '@/types';

export type JoumpaSyncRow = Record<string, unknown>;

export function rowText(row: JoumpaSyncRow, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function rowToReport(row: JoumpaSyncRow): Report {
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
