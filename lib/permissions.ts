
import { UserRole } from '@/types';

const canExportData = (role: UserRole): boolean =>
    role === 'DIVISI_OCS' || role === 'DIVISI_OS' || role === 'DIVISI_ESKALASI' || role === 'ANALYST' || role === 'SUPER_ADMIN';

// Where to send a user after finishing the "create report" flow, when no
// originating page was captured. Unlike getLoginRedirectPath, division roles
// go straight to their own dashboard rather than the eskalasi chooser.
export const getReportReturnPath = (role: UserRole | string | null | undefined): string => {
    const map: Record<string, string> = {
        SUPER_ADMIN: '/dashboard/admin',
        ANALYST: '/dashboard/analyst',
        MANAGER_CABANG: '/dashboard/manager',
        STAFF_CABANG: '/dashboard/employee',
        CABANG: '/dashboard/employee',
        DIVISI_OCS: '/dashboard/ocs',
        PARTNER_OCS: '/dashboard/ocs',
        DIVISI_OS: '/dashboard/os',
        PARTNER_OS: '/dashboard/os',
        DIVISI_OP: '/dashboard/op',
        PARTNER_OP: '/dashboard/op',
        DIVISI_OT: '/dashboard/op',
        PARTNER_OT: '/dashboard/op',
        DIVISI_UQ: '/dashboard/op',
        PARTNER_UQ: '/dashboard/op',
        DIVISI_HT: '/dashboard/ht',
        PARTNER_HT: '/dashboard/ht',
        DIVISI_HC: '/dashboard/hc',
        PARTNER_HC: '/dashboard/hc',
        DIVISI_ESKALASI: '/dashboard/eskalasi/select',
        PARTNER_ESKALASI: '/dashboard/eskalasi/select',
    };
    return map[String(role ?? '').trim().toUpperCase()] || '/dashboard/employee';
};

export const canEditReport = (
    role: UserRole,
    userId: string,
    reportUserId: string,
    userStationId?: string,
    reportStationId?: string
): boolean => {

    if (role === 'ANALYST' || role === 'SUPER_ADMIN') return true;

    if (role.startsWith('DIVISI_')) return true;

    if (role === 'MANAGER_CABANG' && userStationId && userStationId === reportStationId) return true;

    if (role === 'STAFF_CABANG' && userId === reportUserId) return true;

    return false;
};

export const canExportBranchData = (role: UserRole): boolean =>
    role === 'MANAGER_CABANG' || canExportData(role);

export const canApproveStaff = (
    role: UserRole,
    userStationId?: string,
    staffStationId?: string
): boolean => {
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'MANAGER_CABANG' && userStationId && userStationId === staffStationId) return true;
    return false;
};

