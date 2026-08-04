import type { Report, SessionPayload } from '@/types';

function normalized(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function canViewReport(payload: SessionPayload, report: Report): boolean {
  if (payload.role === 'STAFF_CABANG') {
    const payloadEmail = normalized(payload.email);
    return Boolean(
      report.user_id === payload.id ||
      (payload.station_id && report.station_id === payload.station_id) ||
      (payloadEmail && normalized(report.reporter_email) === payloadEmail)
    );
  }

  if (payload.role === 'MANAGER_CABANG') {
    return Boolean(payload.station_id && report.station_id === payload.station_id);
  }

  const normalizedRole = normalized(payload.role);
  return (
    normalizedRole === 'super_admin' ||
    normalizedRole === 'analyst' ||
    normalizedRole.startsWith('divisi_') ||
    normalizedRole.startsWith('partner_')
  );
}
