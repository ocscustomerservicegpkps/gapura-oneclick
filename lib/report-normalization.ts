import type { Report } from '@/types';

export type CanonicalReportCategory =
  | 'Irregularity'
  | 'Complaint'
  | 'Compliment'
  | 'Occurrence'
  | 'Accident / Incident';

const EMPTY_VALUES = new Set(['', '-', '#n/a', '#n/a ()', 'null', 'undefined', 'nil']);

function cleanReportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(' ') : String(value);
  const normalized = text.trim();
  return EMPTY_VALUES.has(normalized.toLowerCase()) ? '' : normalized;
}

export function hasReportValue(value: unknown): boolean {
  return cleanReportValue(value).length > 0;
}

export function normalizeReportKey(value: unknown): string {
  return cleanReportValue(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function firstReportValue(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanReportValue(value);
    if (cleaned) return cleaned;
  }
  return '';
}

export function normalizeReportCategory(value: unknown): CanonicalReportCategory | string {
  const raw = cleanReportValue(value);
  const normalized = normalizeReportKey(raw);
  if (!normalized) return '';
  if (normalized.includes('accident') || normalized.includes('incident') || normalized.includes('insiden') || normalized.includes('kecelakaan')) {
    return 'Accident / Incident';
  }
  if (normalized.includes('occurrence') || normalized.includes('occurence')) return 'Occurrence';
  if (normalized.includes('compliment')) return 'Compliment';
  if (normalized.includes('complaint') || normalized.includes('complain')) return 'Complaint';
  if (normalized.includes('irregular')) return 'Irregularity';
  return toTitleCase(normalized);
}

export function resolveReportCategory(report: Partial<Report>): string {
  return normalizeReportCategory(
    firstReportValue(
      report.main_category,
      report.category,
      report.irregularity_complain_category,
      report.accident_incident
    )
  );
}

export function resolveReportStatus(report: Partial<Report>): string {
  const raw = firstReportValue(report.status, (report as Record<string, unknown>).case_status);
  const normalized = normalizeReportKey(raw).toUpperCase();
  if (!normalized) return 'OPEN';
  if (['CLOSED', 'SELESAI', 'DONE', 'RESOLVED'].includes(normalized)) return 'CLOSED';
  if (normalized.includes('PROGRESS')) return 'ON PROGRESS';
  if (['OPEN', 'ACTIVE', 'MENUNGGU'].includes(normalized)) return 'OPEN';
  return raw.toUpperCase();
}

export function resolveReportSeverity(report: Partial<Report>): string {
  const raw = firstReportValue(report.severity_level, report.severity, report.priority);
  const normalized = normalizeReportKey(raw).toUpperCase();
  if (!normalized) return 'LOW';
  if (normalized.includes('TOP RISK')) return 'TOP RISK';
  if (normalized.includes('HIGH RISK')) return 'HIGH RISK';
  if (normalized.includes('CRITICAL') || normalized.includes('URGENT')) return 'TOP RISK';
  if (normalized.includes('HIGH')) return 'HIGH RISK';
  if (normalized.includes('MEDIUM')) return 'MEDIUM';
  if (normalized.includes('LOW')) return 'LOW';
  return raw.toUpperCase();
}

export function resolveReportBranch(report: Partial<Report>): string {
  return firstReportValue(
    report.branch,
    report.reporting_branch,
    report.station_code,
    report.stations?.code,
    report.kode_cabang,
    report.station_id
  ).toUpperCase();
}

export function resolveReportHub(report: Partial<Report>): string {
  return firstReportValue(report.hub, report.kode_hub).toUpperCase();
}

export function resolveReportAirline(report: Partial<Report>): string {
  return firstReportValue(report.airlines, report.airline, report.maskapai_lookup);
}

export function resolveCaseClassification(report: Partial<Report>): string {

  return firstReportValue(
    report.case_classification,
    report.case_category,
    report.joumpa_compliment_report_excellent_service,
    report.case_joumpa,
    report.reservation_scheduling,
    report.pax_assistance_staff_service_performance,
    report.baggage_delivery_baggage_assistance,
    report.administration_payment_documentation_marketing,
    report.remarks_case,
    report.category_case_cargo,
    report.category_case_gse,
    report.category_case_joumpa
  );
}

export function resolveRootCause(report: Partial<Report>): string {
  return firstReportValue(
    report.identification_of_root,
    report.root_caused,
    report.root_cause,
    report.issue_caused,
    report.breakdown_caused,
    report.remarks_case,
    report.category_case_gse,
    report.category_case_cargo
  );
}

export function isGseServiceReport(report: Partial<Report>): boolean {
  const service = normalizeReportKey(report.service_business_type);
  if (service.includes('gse')) return true;
  return [
    report.gse_available_requirement,
    report.gse_requirement,
    report.gse_motorized,
    report.gse_non_motorized,
    report.category_case_gse,
  ].some(hasReportValue);
}

export function isJoumpaServiceReport(report: Partial<Report>): boolean {
  const service = normalizeReportKey(report.service_business_type);
  if (service.includes('joumpa')) return true;
  return [
    report.category_case_joumpa,
    report.reservation_scheduling,
    report.pax_assistance_staff_service_performance,
    report.baggage_delivery_baggage_assistance,
    report.administration_payment_documentation_marketing,
  ].some(hasReportValue);
}

export function isCargoReport(report: Partial<Report>): boolean {
  const source = normalizeReportKey(report.source_sheet);
  const area = normalizeReportKey(report.area);
  return source.includes('cgo') ||
    hasReportValue(report.case_cgo) ||
    hasReportValue(report.category_case_cargo) ||
    area.includes('cargo');
}

export function resolveAreaType(report: Partial<Report>): string {
  const area = normalizeReportKey(report.area);
  if (hasReportValue(report.terminal_area_category) || area.includes('terminal') || area.includes('landside')) return 'Terminal Area';
  if (hasReportValue(report.apron_area_category) || area.includes('apron') || area.includes('airside')) return 'Apron Area';
  if (hasReportValue(report.general_category) || area.includes('general')) return 'General';
  if (isGseServiceReport(report)) return 'GSE Availability';
  if (isCargoReport(report)) return 'Cargo (CGO)';
  if (isJoumpaServiceReport(report)) return 'Joumpa';
  return firstReportValue(report.area, report.primary_tag, 'General');
}

function resolveAreaCategory(report: Partial<Report>): string {
  return firstReportValue(
    report.terminal_area_category,
    report.apron_area_category,
    report.general_category,
    report.category_case_cargo,
    report.supporting_evidence,
    report.category_case_gse,
    report.gse_available_requirement,
    report.gse_motorized,
    report.gse_non_motorized,
    report.category_case_joumpa,
    report.reservation_scheduling,
    report.pax_assistance_staff_service_performance,
    report.baggage_delivery_baggage_assistance,
    report.administration_payment_documentation_marketing,
    report.remarks_case,
    report.case_category
  );
}

export function resolveGseRequirement(report: Partial<Report>): string {
  return firstReportValue(
    report.gse_available_requirement,
    report.gse_requirement,
    report.gse_motorized,
    report.gse_non_motorized,
    report.gse_name
  );
}

export function resolveGseCategory(report: Partial<Report>): string {
  return firstReportValue(report.remarks_case, report.category_case_gse, report.case_category, resolveAreaCategory(report));
}

export function resolveGseRoot(report: Partial<Report>): string {
  return firstReportValue(resolveRootCause(report), report.category_case_gse, report.gse_available_requirement);
}

export function resolveJoumpaCategory(report: Partial<Report>): string {
  return firstReportValue(report.category_case_joumpa, report.remarks_case, report.case_category);
}

export function resolveJoumpaDetailCategory(report: Partial<Report>): string {
  return firstReportValue(
    report.case_joumpa,
    report.joumpa_compliment_report_excellent_service,
    report.reservation_scheduling,
    report.pax_assistance_staff_service_performance,
    report.baggage_delivery_baggage_assistance,
    report.administration_payment_documentation_marketing,
    report.case_classification,
    report.case_category
  );
}

export function resolveCargoCategory(report: Partial<Report>): string {
  return firstReportValue(
    report.category_case_cargo,
    report.supporting_evidence,
    report.apron_area_category,
    report.case_category,
    report.remarks_case,
    report.main_category,
    report.category
  );
}

export function resolveEvidenceLinks(report: Partial<Report>): string[] {
  const values = [
    ...(Array.isArray(report.evidence_urls) ? report.evidence_urls : []),
    report.evidence_url,
    report.supporting_evidence,
    ...(Array.isArray(report.partner_evidence_urls) ? report.partner_evidence_urls : []),
    (report as Record<string, unknown>).link,
    (report as Record<string, unknown>).url,
    (report as Record<string, unknown>).see_details,
    (report as Record<string, unknown>).see_detail,
  ];

  const links = values
    .flatMap((value) => {
      const raw = cleanReportValue(value);
      if (!raw) return [];
      const urls = raw.match(/https?:\/\/[^\s|;,]+/gi);
      if (urls?.length) return urls;
      return raw
        .split(/\s*(?:\||;|\n+|,)\s*/)
        .filter((part) => /^www\./i.test(part))
        .map((part) => `https://${part}`);
    })
    .filter((value) => value.startsWith('http'));

  return Array.from(new Set(links));
}
