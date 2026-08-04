
import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildReportFingerprint, resolveReportCategory } from '@/lib/report-fingerprint';
import type { Report } from '@/types';
import { v5 as uuidv5 } from 'uuid';

// Must match ReportsService.getReportUuid so a row's stored id equals
// uuidv5(sheet_id) — the id the app derives from the live Google Sheet.
const IRRS_NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// user_id is read straight off the "User ID" sheet column, which is free text
// (often blank, a name, or garbage) — not guaranteed to be the UUID the
// user_id FK column requires. A single bad row here fails the whole batch
// upsert and silently drops every report in it.
function sanitizeUserId(value: unknown): string | null {
    const str = typeof value === 'string' ? value.trim() : '';
    return UUID_PATTERN.test(str) ? str : null;
}

function toIsoOrNow(value: unknown): string {
    if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }

    return new Date().toISOString();
}

function normalizeTextArray(value: unknown, separator = /\s*(?:\||;|\n+)\s*/): string[] | null {
    const values = Array.isArray(value)
        ? value.flatMap((item) => normalizeTextArray(item, separator) || [])
        : typeof value === 'string'
            ? value.split(separator).map((item) => item.trim()).filter(Boolean)
            : [];

    return values.length > 0 ? [...new Set(values)] : null;
}

function resolveReportSheetId(report: Partial<Report>): string | null {
    const sheetId = report.sheet_id || report.original_id || report.id;
    if (!sheetId) return null;

    const trimmed = String(sheetId).trim();
    return trimmed || null;
}

function resolveReportSourceFingerprint(report: Partial<Report>): string {
    return String(report.source_fingerprint || buildReportFingerprint(report));
}

export function buildReportsSyncRow(report: Partial<Report>): Record<string, unknown> {
    const sheetId = resolveReportSheetId(report);
    if (!sheetId) {
        throw new Error('Cannot build reports_sync row without sheet_id/original_id');
    }

    const createdAt = toIsoOrNow(report.created_at);
    const updatedAt = toIsoOrNow(report.updated_at);
    const normalizedCategory = resolveReportCategory(report);

    return {
        // ponytail: pin the deterministic id; without it Postgres assigns a random
        // v4 default that never matches the uuidv5(sheet_id) the app looks up by.
        id: uuidv5(sheetId, IRRS_NAMESPACE_UUID),
        sheet_id: sheetId,
        user_id: sanitizeUserId(report.user_id),
        title: report.title || report.report || null,
        description: report.description || report.report || null,
        location: report.location || null,
        reporter_email: report.reporter_email || null,
        evidence_url: report.evidence_url || null,
        evidence_urls: normalizeTextArray(report.evidence_urls) || normalizeTextArray(report.evidence_url),
        evidence_file_ids: normalizeTextArray(report.evidence_file_ids, /\s*[|,\n]\s*/) || null,
        evidence_submission_id: report.evidence_submission_id || null,
        status: report.status || 'OPEN',
        severity: report.severity || 'low',
        priority: report.priority || 'medium',

        flight_number: report.flight_number || null,
        aircraft_reg: report.aircraft_reg || null,
        is_flight_related: report.is_flight_related || false,

        gse_number: report.gse_number || null,
        gse_name: report.gse_name || null,
        is_gse_related: report.is_gse_related || false,

        station_id: report.station_id || null,
        unit_id: report.unit_id || null,
        location_id: report.location_id || null,
        incident_type_id: report.incident_type_id || null,
        category: report.category || normalizedCategory || null,
        main_category: report.main_category || normalizedCategory || null,

        investigator_notes: report.investigator_notes || null,
        manager_notes: report.manager_notes || null,
        partner_response_notes: report.partner_response_notes || null,
        validation_notes: report.validation_notes || null,
        partner_evidence_urls: normalizeTextArray(report.partner_evidence_urls),

        source_sheet: report.source_sheet || null,
        source_fingerprint: resolveReportSourceFingerprint(report),
        original_id: report.original_id || sheetId,
        row_number: report.row_number || null,

        created_at: createdAt,
        updated_at: updatedAt,
        resolved_at: report.resolved_at || null,
        sla_deadline: report.sla_deadline || null,
        incident_date: report.incident_date || report.date_of_event || null,
        date_of_event: report.date_of_event || report.incident_date || null,

        reporting_branch: report.reporting_branch || null,
        hub: report.hub || null,
        route: report.route || null,
        branch: report.branch || report.reporting_branch || report.station_code || null,
        station_code: report.station_code || null,
        reporter_name: report.reporter_name || null,

        specific_location: report.specific_location || null,
        airlines: report.airlines || report.airline || null,
        airline: report.airline || report.airlines || null,
        jenis_maskapai: report.jenis_maskapai || null,
        reference_number: report.reference_number || null,
        root_caused: report.root_caused || report.root_cause || null,
        root_cause: report.root_cause || report.root_caused || null,
        action_taken: report.action_taken || null,
        immediate_action: report.immediate_action || null,
        kps_remarks: report.kps_remarks || null,
        remarks_by: report.remarks_by || null,
        gapura_kps_action_taken: report.gapura_kps_action_taken || null,
        preventive_action: report.preventive_action || null,
        remarks_gapura_kps: report.remarks_gapura_kps || null,
        area: report.area || null,
        terminal_area_category: report.terminal_area_category || null,
        apron_area_category: report.apron_area_category || null,
        general_category: report.general_category || null,
        week_in_month: report.week_in_month || null,
        report: report.report || report.description || null,
        irregularity_complain_category: report.irregularity_complain_category || null,
        service_business_type: report.service_business_type || null,
        remarks_case: report.remarks_case || null,
        case_category: report.case_category || null,
        severity_level: report.severity_level || report.severity || null,
        case_cgo: report.case_cgo || null,
        supporting_evidence: report.supporting_evidence || null,
        category_case_joumpa: report.category_case_joumpa || null,
        reservation_scheduling: report.reservation_scheduling || null,
        pax_assistance_staff_service_performance: report.pax_assistance_staff_service_performance || null,
        baggage_delivery_baggage_assistance: report.baggage_delivery_baggage_assistance || null,
        administration_payment_documentation_marketing: report.administration_payment_documentation_marketing || null,
        gse_available_requirement: report.gse_available_requirement || null,
        gse_requirement: report.gse_requirement || null,
        gse_motorized: report.gse_motorized || null,
        gse_non_motorized: report.gse_non_motorized || null,
        category_case_gse: report.category_case_gse || null,
        category_case_cargo: report.category_case_cargo || null,
        kode_cabang: report.kode_cabang || null,
        kode_hub: report.kode_hub || null,
        maskapai_lookup: report.maskapai_lookup || null,
        case_classification: report.case_classification || null,
        lokal_mpa_lookup: report.lokal_mpa_lookup || null,

        dom_inter: report.dom_inter || null,
        kode_inter: report.kode_inter || null,
        identification_of_root: report.identification_of_root || null,
        final_remarks: report.final_remarks || null,
        customer_joumpa: report.customer_joumpa || null,
        detail_customer_joumpa: report.detail_customer_joumpa || null,
        corporate: report.corporate || null,
        customer_company_profile_corporate: report.customer_company_profile_corporate || null,
        non_corporate: report.non_corporate || null,
        customer_background_non_corporate: report.customer_background_non_corporate || null,
        detail_customer_non_corporate: report.detail_customer_non_corporate || null,
        joumpa_compliment_report_excellent_service: report.joumpa_compliment_report_excellent_service || null,

        delay_code: report.delay_code || null,
        delay_duration: report.delay_duration || null,

        primary_tag: report.primary_tag || null,
        sub_category_note: report.sub_category_note || null,

        synced_at: new Date().toISOString(),
        sync_version: 1,
    };
}

async function upsertReportsSyncRow(payload: Record<string, unknown>) {
    try {
        const { error } = await supabaseAdmin
            .from('ground_handling_irregularity_report')
            .upsert(payload, {
                onConflict: 'sheet_id',
                ignoreDuplicates: false,
            });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.warn('[ReportPersistence] reports_sync upsert failed (non-blocking):', error);
    }
}

export async function persistReportMetadata(
    report: Partial<Report>,
    options?: { userId?: string | null }
) {
    const syncRow = buildReportsSyncRow(report);
    // report.user_id comes straight off the sheet's free-text "User ID"
    // column and is usually not a valid UUID, so buildReportsSyncRow's own
    // sanitizeUserId(report.user_id) leaves it null most of the time. Callers
    // that know the acting/authenticated user pass it here as a fallback —
    // previously this only ever reached the dead legacy `reports` table, so
    // the live row's user_id silently stayed null even when a caller supplied one.
    if (!syncRow.user_id && options?.userId) {
        const fallbackUserId = sanitizeUserId(options.userId);
        if (fallbackUserId) syncRow.user_id = fallbackUserId;
    }

    await upsertReportsSyncRow(syncRow);
}
