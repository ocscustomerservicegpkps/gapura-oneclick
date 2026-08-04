import type { Report } from '@/types';

interface IrregularityFormOfficer {
  name: string;
  company: string;
  function: string;
}

interface IrregularityFormChronology {
  time: string;
  description: string;
}

interface IrregularityFormData {
  doc_title: string;
  reference_no: string;
  to: string;
  from: string;
  cc: string;
  subject: string;
  attachment: string;
  incident_date: string;
  branch: string;
  flight_number: string;
  aircraft_reg: string;
  route: string;
  std_atd: string;
  pax: string;
  bge: string;
  gate_stand: string;
  delay: string;
  officers: IrregularityFormOfficer[];
  chronology: IrregularityFormChronology[];
  root_cause: string;
  action_taken: string;
  preventive_action: string;
  reporter_name: string;
  reporter_title: string;
  acknowledge_label: string;
}

function firstValue(...values: unknown[]): string {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function toDateOnlyString(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Non-ISO date-only strings (e.g. "March 15, 2026") parse as local
  // midnight. Reading back local Y/M/D — instead of toISOString(), which
  // converts to UTC — avoids shifting to the previous/next day for
  // timezones east/west of UTC.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthName(date: Date): string {
  return ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getMonth()];
}

function generatedReference(report: Record<string, unknown>, eventDate: string, branch: string): string {
  const parsedDate = eventDate ? new Date(eventDate) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return `CABANG ${branch || 'CGK'}/LK/       /       / ${monthName(date)}/${date.getFullYear()}`;
}

function normalizeOfficers(value: unknown): IrregularityFormOfficer[] {
  if (!Array.isArray(value)) return [];
  return value.map((officer) => {
    const item = (officer && typeof officer === 'object') ? officer as Record<string, unknown> : {};
    return {
      name: firstValue(item.name),
      company: firstValue(item.company),
      function: firstValue(item.function),
    };
  });
}

function normalizeChronology(value: unknown): IrregularityFormChronology[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = (entry && typeof entry === 'object') ? entry as Record<string, unknown> : {};
    return {
      time: firstValue(item.time),
      description: firstValue(item.description, item.remark),
    };
  });
}

export function normalizeIrregularityReport(
  input: Report | Record<string, unknown>,
): IrregularityFormData {
  const report = input as Record<string, unknown>;
  const station = report.stations && typeof report.stations === 'object'
    ? report.stations as Record<string, unknown>
    : {};
  const user = report.users && typeof report.users === 'object'
    ? report.users as Record<string, unknown>
    : {};
  const eventDate = toDateOnlyString(firstValue(
    report.incident_date,
    report.date_of_event,
    report.event_date,
    report.created_at,
  ));
  const branch = firstValue(
    report.branch,
    report.reporting_branch,
    report.station_code,
    station.code,
    report.location,
  );
  const airline = firstValue(report.airline, report.airlines, report.jenis_maskapai);
  const category = firstValue(report.main_category, report.category, report.primary_tag);
  const severity = firstValue(report.severity, report.priority);
  const evidenceUrls = Array.isArray(report.evidence_urls)
    ? report.evidence_urls.filter(Boolean)
    : (report.evidence_url ? [report.evidence_url] : []);
  const reporterName = firstValue(report.reporter_name, user.full_name, report.reporter_email);
  const description = firstValue(report.description, report.report, report.title);
  const delay = firstValue(
    report.delay,
    (report.delay_code || report.delay_duration)
      ? `${firstValue(report.delay_code, '-')} / ${firstValue(report.delay_duration, '-')}`
      : '',
    'No Delay / -',
  );

  const officers = normalizeOfficers(report.officers);
  if (officers.length === 0 && reporterName) {
    officers.push({ name: reporterName, company: 'Gapura Angkasa', function: 'Reporter' });
  }

  const chronology = normalizeChronology(report.chronology);
  if (chronology.length === 0 && description) chronology.push({ time: '', description });

  const subjectParts = [
    [airline, firstValue(report.flight_number)].filter(Boolean).join(' '),
    category,
    severity,
  ].filter(Boolean);

  return {
    doc_title: firstValue(report.doc_title, 'IRREGULARITY REPORT FORM'),
    reference_no: firstValue(
      report.reference_no,
      report.reference_number,
      generatedReference(report, eventDate, branch),
    ),
    to: firstValue(report.to, airline ? `SQC ${airline} on duty` : ''),
    from: firstValue(report.from, 'GAPURA OPERATION STAFF'),
    cc: firstValue(report.cc),
    subject: firstValue(report.subject, subjectParts.join(' - '), report.title),
    attachment: firstValue(report.attachment, evidenceUrls.length ? `${evidenceUrls.length} Files` : ''),
    incident_date: eventDate,
    branch,
    flight_number: firstValue(report.flight_number),
    aircraft_reg: firstValue(report.aircraft_reg, '-'),
    route: firstValue(report.route, '-'),
    std_atd: firstValue(report.std_atd),
    pax: firstValue(report.pax),
    bge: firstValue(report.bge),
    gate_stand: firstValue(report.gate_stand, report.specific_location, report.location, '-'),
    delay,
    officers,
    chronology,
    root_cause: firstValue(
      report.root_cause,
      report.root_caused,
      report.identification_of_root,
      report.issue_caused,
    ),
    action_taken: firstValue(
      report.action_taken,
      report.immediate_action,
      report.gapura_kps_action_taken,
    ),
    preventive_action: firstValue(
      report.preventive_action,
      report.remarks_case,
      report.remarks_gapura_kps,
      report.kps_remarks,
    ),
    reporter_name: reporterName,
    reporter_title: firstValue(report.reporter_title, user.position, 'Controller Operation Airside'),
    acknowledge_label: firstValue(report.acknowledge_label, 'Manager of Airside Service'),
  };
}
