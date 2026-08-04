import 'server-only';
import type { Report } from '@/types';

// SUPER_ADMIN/ANALYST see everything; STAFF_CABANG-tier roles see only their
// own submissions; MANAGER_CABANG is scoped to their station.
//
// DIVISI_*/PARTNER_* previously scoped to `target_division`, but that column is
// unpopulated in the data, so the filter emptied every analytics/embed result.
// Division scoping via target_division is removed (matches the main dashboard,
// which already stopped scoping by this unpopulated column) — these roles now
// see the full report set like the dashboards they open the embeds from.
export function applyReportsRbacFilter(
    reports: Report[],
    role: string,
    userId: string,
    stationId: string | null,
    email: string
): Report[] {
    const normalizedRole = role.trim().toUpperCase();

    if (normalizedRole === 'STAFF_CABANG' || normalizedRole === 'CABANG' || normalizedRole === 'EMPLOYEE') {
        return reports.filter((r) =>
            r.user_id === userId ||
            (email && String(r.reporter_email || '').toLowerCase() === email)
        );
    }

    if (normalizedRole === 'MANAGER_CABANG' && stationId) {
        return reports.filter((r) => r.station_id === stationId || r.branch === stationId);
    }

    if (
        normalizedRole === 'SUPER_ADMIN' ||
        normalizedRole === 'ANALYST' ||
        normalizedRole.startsWith('DIVISI_') ||
        normalizedRole.startsWith('PARTNER_')
    ) {
        return reports;
    }

    return [];
}
