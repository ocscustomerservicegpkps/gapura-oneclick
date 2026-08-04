
import 'server-only';

import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';

interface WorkspaceUser {

    id: string;

    email: string;

    role: string;

    division?: string | null;

    full_name?: string | null;

    station_id?: string | null;

    station_code?: string | null;

    station_name?: string | null;
}

const BRANCH_ROLES = ['MANAGER_CABANG', 'STAFF_CABANG', 'CABANG', 'EMPLOYEE'] as const;

const SHARED_DOCUMENT_MANAGER_ROLES = [
    'SUPER_ADMIN',
    'ANALYST',
    'DIVISI_HC',
    'DIVISI_HT',
    'DIVISI_OCS',
    'DIVISI_OS',
    'DIVISI_OP',
    'DIVISI_ESKALASI',
] as const;

export function normalizeRole(role: string | null | undefined): string {
    return String(role || '').trim().toUpperCase();
}

export function isBranchRole(role: string | null | undefined): boolean {
    return BRANCH_ROLES.some((item) => item === normalizeRole(role));
}

export function canManageDivisionDocuments(role: string | null | undefined, division: 'HC' | 'HT' | 'ANALYST'): boolean {
    const normalized = normalizeRole(role);
    if (normalized === 'SUPER_ADMIN' || normalized === 'ANALYST') return true;
    // Circulars & Materials (division='ANALYST') is shared across the central
    // roles that can reach /dashboard/eskalasi/documents, not just analysts.
    // Explicit allowlist so new/unrecognized roles require deliberate inclusion.
    if (division === 'ANALYST') {
        return SHARED_DOCUMENT_MANAGER_ROLES.some((item) => item === normalized);
    }
    return normalized === `DIVISI_${division}` || normalized === `PARTNER_${division}`;
}

export function canManagePerformanceLinks(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'ANALYST' || normalized === 'SUPER_ADMIN';
}

export function canViewPerformanceLinks(role: string | null | undefined): boolean {
    // Any authenticated user can view survey links; only ANALYST/SUPER_ADMIN can manage
    const normalized = normalizeRole(role);
    return Boolean(normalized);
}

export function canViewAudienceScopedItem(
    user: Pick<WorkspaceUser, 'role' | 'station_id'>,
    visibilityScope: 'all' | 'stations' | 'roles' | 'targeted',
    audienceStationIds: string[],
    audienceRoles: string[]
): boolean {
    const normalizedRole = normalizeRole(user.role);

    if (visibilityScope === 'all') return true;

    const matchesStation = audienceStationIds.length > 0
        ? Boolean(user.station_id) && audienceStationIds.includes(String(user.station_id))
        : false;
    const matchesRole = audienceRoles.length > 0
        ? audienceRoles.includes(normalizedRole)
        : false;

    if (visibilityScope === 'stations') return matchesStation;
    if (visibilityScope === 'roles') return matchesRole;

    const stationAllowed = audienceStationIds.length > 0 ? matchesStation : true;
    const roleAllowed = audienceRoles.length > 0 ? matchesRole : true;
    return stationAllowed && roleAllowed;
}

export async function getWorkspaceUser(): Promise<WorkspaceUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;

    // verifySession() already resolves role/division/station via a DB-verified
    // join (or the trusted header proxy.ts forwards) — no separate query needed.
    const payload = await verifySession(token);
    if (!payload) return null;

    return {
        id: String(payload.id),
        email: String(payload.email || ''),
        role: normalizeRole(String(payload.role || '')),
        division: payload.division || null,
        full_name: payload.full_name || null,
        station_id: payload.station_id || null,
        station_code: payload.station_code || null,
        station_name: payload.station_name || null,
    };
}
