import 'server-only';

import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { canViewReport } from '@/lib/report-access';
import { inferReportDocumentType, type ReportDocumentType } from '@/lib/report-document-contract';
import { reportsService } from '@/lib/services/reports-service';
import type { Report, SessionPayload } from '@/types';

type AccessResult =
  | { ok: true; payload: SessionPayload; report: Report }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function authorizeReportDocumentRead(
  reportType: ReportDocumentType,
  reportId: string,
): Promise<AccessResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  const payload = await verifySession(token);
  if (!payload) return { ok: false, status: 401, error: 'Invalid session' };

  const report = await reportsService.getReportById(reportId);
  if (!report) return { ok: false, status: 404, error: 'Report not found' };
  if (inferReportDocumentType(report as unknown as Record<string, unknown>) !== reportType) {
    return { ok: false, status: 404, error: 'Report not found' };
  }
  if (!canViewReport(payload, report)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, payload, report };
}
