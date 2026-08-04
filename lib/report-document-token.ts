import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import type { ReportDocumentType } from '@/lib/report-document-contract';

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('[FATAL] JWT_SECRET environment variable is required for report document tokens.');
}

const key = new TextEncoder().encode(secret);
const AUDIENCE = 'report-document-finalization';
const PURPOSE = 'finalize-report-documents';

interface ReportDocumentTokenPayload {
  reportId: string;
  reportType: ReportDocumentType;
}

export async function signReportDocumentToken(payload: ReportDocumentTokenPayload): Promise<string> {
  return new SignJWT({
    purpose: PURPOSE,
    report_id: payload.reportId,
    report_type: payload.reportType,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(key);
}

export async function verifyReportDocumentToken(token: string): Promise<ReportDocumentTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, { audience: AUDIENCE });
    if (
      payload.purpose !== PURPOSE ||
      typeof payload.report_id !== 'string' ||
      (payload.report_type !== 'IRREGULARITY' && payload.report_type !== 'JOUMPA')
    ) {
      return null;
    }
    return {
      reportId: payload.report_id,
      reportType: payload.report_type,
    };
  } catch {
    return null;
  }
}
