import 'server-only';
import { normalizeStatus } from './mapping';

export interface JoumpaStatusUpdateInput {
  status?: unknown;
  action_taken?: unknown;
  final_remarks?: unknown;
  kps_remarks?: unknown;
  remarks_by?: unknown;
}

interface JoumpaStatusUpdate {
  status?: string;
  action_taken?: string;
  final_remarks?: string;
  kps_remarks?: string;
  remarks_by?: string;
}

interface ReportSourceIdentity {
  source_spreadsheet_id?: unknown;
  source_sheet?: unknown;
  service_business_type?: unknown;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function buildJoumpaStatusUpdate(input: JoumpaStatusUpdateInput): JoumpaStatusUpdate {
  const update: JoumpaStatusUpdate = {};

  if (input.status !== undefined) update.status = normalizeStatus(input.status);
  if (input.action_taken !== undefined) update.action_taken = text(input.action_taken);
  if (input.remarks_by !== undefined) update.remarks_by = text(input.remarks_by);

  const finalRemarks = input.final_remarks !== undefined
    ? input.final_remarks
    : input.kps_remarks;
  if (finalRemarks !== undefined) {
    const normalizedRemarks = text(finalRemarks);
    update.final_remarks = normalizedRemarks;
    update.kps_remarks = normalizedRemarks;
  }

  return update;
}

export function isJoumpaReportSource(
  report: ReportSourceIdentity | null | undefined,
  joumpaSpreadsheetId: string,
  joumpaSheetName: string,
): boolean {
  if (!report) return false;
  if (text(report.source_spreadsheet_id) === joumpaSpreadsheetId) return true;

  return text(report.source_sheet) === joumpaSheetName
    && text(report.service_business_type).toLowerCase() === 'joumpa service';
}
