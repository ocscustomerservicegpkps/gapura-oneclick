
export type UserRole = 'SUPER_ADMIN' | 'DIVISI_ESKALASI' | 'DIVISI_OCS' | 'DIVISI_OS' | 'DIVISI_OP' | 'DIVISI_OT' | 'DIVISI_UQ' | 'DIVISI_HC' | 'DIVISI_HT' | 'ANALYST' | 'MANAGER_CABANG' | 'STAFF_CABANG';

export type ReportStatus = 'OPEN' | 'ON PROGRESS' | 'CLOSED';

export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ReportSeverity = 'TOP RISK' | 'HIGH RISK' | 'MEDIUM' | 'LOW';

export type DivisionType = 'OCS' | 'OS' | 'OP' | 'OT' | 'UQ' | 'HC' | 'HT' | 'GENERAL';

export interface SessionPayload {

    id: string;

    email: string;

    role: string;

    full_name?: string;

    division?: string;

    station_id?: string;

    station_code?: string;

    station_name?: string;

    unit_id?: string;

    position_id?: string;

    sid?: string;
}

export interface User {

    id: string;

    email: string;

    full_name: string;

    role: UserRole;

    status: 'pending' | 'active' | 'rejected' | 'suspended';

    nik?: string;

    phone?: string;

    station_id?: string;

    unit_id?: string;

    position_id?: string;

    created_at: string;

    updated_at: string;

    division?: string;

    station?: {
        id: string;
        code: string;
        name: string;
    } | null;
}

export interface Station {

    id: string;

    code: string;

    name: string;
}

export interface Unit {

    id: string;

    name: string;

    description?: string;
}

export interface Position {

    id: string;

    name: string;

    level: number;
}

export interface IncidentType {

    id: string;

    name: string;

    default_severity: ReportSeverity;
}

export interface Location {

    id: string;

    station_id: string;

    name: string;

    area?: string;
}

export interface Report {

    id: string;

    user_id: string;

    title: string;

    description: string;

    location: string;

    reporter_email?: string;

    evidence_url?: string;

    evidence_urls?: string[];

    evidence_file_ids?: string[];

    evidence_submission_id?: string;

    video_url?: string;

    video_urls?: string[];

    status: ReportStatus;

    severity: ReportSeverity;

    priority?: ReportPriority;

    flight_number?: string;

    aircraft_reg?: string;

    is_flight_related?: boolean;

    gse_number?: string;

    gse_name?: string;

    is_gse_related?: boolean;

    station_id?: string;

    unit_id?: string;

    location_id?: string;

    incident_type_id?: string;

    category?: string;

    main_category?: string;

    investigator_notes?: string;

    manager_notes?: string;

    partner_response_notes?: string;

    validation_notes?: string;

    partner_evidence_urls?: string[];

    source_sheet?: string;

    source_spreadsheet_id?: string;

    sheet_id?: string;

    source_fingerprint?: string;

    original_id?: string;

    row_number?: number;

    created_at: string;

    updated_at: string;

    resolved_at?: string;

    sla_deadline?: string;

    incident_date?: string;

    reporting_branch?: string;

    hub?: string;

    route?: string;

    branch?: string;

    station_code?: string;

    reporter_name?: string;

    date_of_event?: string;

    event_date?: string;

    specific_location?: string;

    airlines?: string;

    airline?: string;

    jenis_maskapai?: string;

    reference_number?: string;

    root_caused?: string;

    root_cause?: string;

    action_taken?: string;

    immediate_action?: string;

    kps_remarks?: string;

    remarks_by?: string;

    gapura_kps_action_taken?: string;

    preventive_action?: string;

    remarks_gapura_kps?: string;

    area?: string;

    terminal_area_category?: string;

    apron_area_category?: string;

    general_category?: string;

    week_in_month?: string;

    report?: string;

    service_business_type?: string;

    remarks_case?: string;

    gse_available_requirement?: string;

    gse_requirement?: string;

    gse_motorized?: string;

    gse_non_motorized?: string;

    category_case_gse?: string;

    category_case_cargo?: string;

    category_case_joumpa?: string;

    joumpa_compliment_report_excellent_service?: string;

    supporting_evidence?: string;

    case_cgo?: string;

    reservation_scheduling?: string;

    pax_assistance_staff_service_performance?: string;

    baggage_delivery_baggage_assistance?: string;

    administration_payment_documentation_marketing?: string;

    case_joumpa?: string;

    final_remarks?: string;

    customer_satisfaction_score?: string;

    customer_satisfaction_label?: string;

    customer_joumpa?: string;

    detail_customer_joumpa?: string;

    corporate?: string;

    customer_company_profile_corporate?: string;

    detail_customer_corporate?: string;

    non_corporate?: string;

    customer_background_non_corporate?: string;

    detail_customer_non_corporate?: string;

    airport_name?: string;

    airport_code?: string;

    branch_code?: string;

    case_category?: string;

    irregularity_complain_category?: string;

    kode_cabang?: string;

    kode_hub?: string;

    maskapai_lookup?: string;

    case_classification?: string;

    identification_of_root?: string;

    accident_incident?: string;

    issue_caused?: string;

    breakdown_caused?: string;

    lokal_mpa_lookup?: string;

    dom_inter?: string;

    kode_inter?: string;

    delay_code?: string;

    delay_duration?: string;

    primary_tag?: string;

    sub_category_note?: string;

    esklasi_divisi?: string;

    stations?: { code: string; name: string };

    users?: { full_name: string; email: string; role?: string };

    comments?: {
        id: string;
        content: string;
        created_at: string;
        sheet_id?: string;
        users: { full_name: string; avatar_url?: string };
        attachments?: string[];
        is_system_message?: boolean;
    }[];

    [key: string]: unknown;
}

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {

    id: string;

    title: string;

    event_date: string;

    event_end_date?: string | null;

    event_time?: string | null;

    notes?: string | null;

    meeting_minutes_link?: string | null;

    calendar_type: CalendarType;

    is_recurring: boolean;

    recurrence_pattern?: RecurrencePattern | null;

    recurrence_end_date?: string | null;

    parent_event_id?: string | null;

    created_by: string;

    created_by_name?: string;

    created_at: string;

    updated_at: string;

    deleted_at?: string | null;
}

export type CalendarType = 'event' | 'meeting';

export interface CreateCalendarEventInput {

    title: string;

    event_date: string;

    event_end_date?: string | null;

    event_time?: string | null;

    notes?: string | null;

    meeting_minutes_link?: string | null;

    is_recurring?: boolean;

    recurrence_pattern?: RecurrencePattern | null;

    recurrence_end_date?: string | null;

    calendar_type?: CalendarType;
}

export type DivisionDocumentDivision = 'HC' | 'HT' | 'ANALYST';

export type DivisionDocumentCategory =
    | 'SAM_HANDBOOK'
    | 'EDARAN_DIREKSI'
    | 'MATERI_SOSIALISASI'
    | 'NOTULENSI_RAPAT'
    | 'TRAINING_MATERIAL'
    | 'DOKUMEN_LAIN'
    | 'NOTICE'
    | 'MANUAL';

export type DivisionDocumentSourceType = 'upload' | 'link';

export type DivisionDocumentVisibilityScope = 'all' | 'stations' | 'roles' | 'targeted';

export interface DivisionDocument {

    id: string;

    division: DivisionDocumentDivision;

    category: DivisionDocumentCategory;

    title: string;

    description?: string | null;

    meeting_title?: string | null;

    meeting_date?: string | null;

    activity_pic?: string | null;

    activity_location?: string | null;

    station_id?: string | null;

    station_code?: string | null;

    station_name?: string | null;

    airline?: string | null;

    participants?: string | null;

    materi_url?: string | null;

    materi_title?: string | null;

    attendance_url?: string | null;

    recording_url?: string | null;

    material_links?: { title: string; url: string }[] | null;

    audience_label?: string | null;

    source_type: DivisionDocumentSourceType;

    file_url?: string | null;

    file_name?: string | null;

    file_size?: number | null;

    mime_type?: string | null;

    external_url?: string | null;

    drive_file_id?: string | null;

    drive_folder_id?: string | null;

    drive_web_url?: string | null;

    drive_content_url?: string | null;

    uploaded_at?: string | null;

    visibility_scope: DivisionDocumentVisibilityScope;

    audience_station_ids: string[];

    audience_roles: string[];

    created_by: string;

    updated_by?: string | null;

    created_at: string;

    updated_at: string;

    created_by_name?: string | null;
}

export interface PerformanceLink {
    id: string;
    title: string;
    url: string;
    description?: string | null;
    thumbnail_url?: string | null;
    category: 'ground-handling' | 'joumpa';
    sort_order: number;
    created_by: string;
    created_by_name?: string | null;
    created_at: string;
    updated_at: string;
}

export interface UpdateCalendarEventInput {

    title?: string;

    event_date?: string;

    event_end_date?: string | null;

    event_time?: string | null;

    notes?: string | null;

    meeting_minutes_link?: string | null;

    is_recurring?: boolean;

    recurrence_pattern?: RecurrencePattern | null;

    recurrence_end_date?: string | null;

    edit_scope?: 'single' | 'all';
}

export interface AnalyticsData {

    summary: {
        totalReports: number;
        resolvedReports: number;
        pendingReports: number;
        highSeverity: number;
        avgResolutionRate: number;
        slaBreachCount?: number;
    };

    stationData: Array<{ station: string; total: number; resolved: number }>;

    statusData: Array<{ name: string; value: number; color: string }>;

    trendData: Array<{ month: string; total: number; resolved: number }>;

    divisionData?: Array<{ division: string; count: number }>;

    categoryData?: Array<{ category: string; count: number }>;
}

export interface ComparisonMetric {

    label: string;

    current: number;

    previous: number;

    momDelta: number;

    currentMonth?: string;

    previousMonth?: string;

    yoyCurrent?: number;

    yoyPrevious?: number;

    yoyDelta?: number;
}

export interface MonthlyBucket {

    month: string;

    total: number;

    irregularity: number;

    complaint: number;

    compliment: number;

    [key: string]: string | number;
}

export interface ComparisonData {

    monthlyTrend: MonthlyBucket[];

    overallMetrics: ComparisonMetric[];

    branchMoM: Record<string, string | number>[];

    branchMetrics: ComparisonMetric[];

    airlineMoM: Record<string, string | number>[];

    airlineMetrics: ComparisonMetric[];

    topBranches: string[];

    topAirlines: string[];

    areaMetrics: ComparisonMetric[];
}
