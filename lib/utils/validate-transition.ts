
import { REPORT_STATUS, canChangeReportStatus, type ReportStatus } from '@/lib/constants/report-status';

const TRANSITION_RULES: Record<ReportStatus, ReportStatus[]> = {
    OPEN: ['ON PROGRESS', 'CLOSED'],
    'ON PROGRESS': ['CLOSED'],
    CLOSED: ['OPEN'],
};

const ACTION_TO_STATUS: Record<string, ReportStatus> = {
    update_progress: 'ON PROGRESS',
    close: 'CLOSED',
    reopen: 'OPEN',
};

interface ValidationResult {
    valid: boolean;
    error?: string;
    newStatus?: ReportStatus;
}

export function validateStatusTransition(
    currentStatus: string,
    action: string,
    userRole: string
): ValidationResult {
    const targetStatus = ACTION_TO_STATUS[action];
    if (!targetStatus) {
        return {
            valid: false,
            error: `Invalid action: ${action}. Allowed: ${Object.keys(ACTION_TO_STATUS).join(', ')}`
        };
    }

    const normalizedCurrentStatus = String(currentStatus || '')
        .trim()
        .toUpperCase()
        .replace(/_/g, ' ') || REPORT_STATUS.OPEN;

    if (!Object.values(REPORT_STATUS).includes(normalizedCurrentStatus as ReportStatus)) {
        return {
            valid: false,
            error: `Invalid current status: ${currentStatus}`
        };
    }

    if (!canChangeReportStatus(userRole)) {
        return {
            valid: false,
            error: `Role ${userRole} cannot change report status`
        };
    }

    const allowedForRole = TRANSITION_RULES[normalizedCurrentStatus as ReportStatus];

    if (!allowedForRole.includes(targetStatus)) {
        return {
            valid: false,
            error: `Cannot transition from ${normalizedCurrentStatus} to ${targetStatus} with role ${userRole}. Allowed: ${allowedForRole.join(', ')}`
        };
    }

    return { valid: true, newStatus: targetStatus };
}

export function getTimestampFieldForStatus(status: ReportStatus): string | null {
    const fieldMap: Partial<Record<ReportStatus, string>> = {
        'ON PROGRESS': 'validated_at',
        CLOSED: 'resolved_at',
    };
    return fieldMap[status] || null;
}

export function getUserFieldForStatus(status: ReportStatus): string | null {
    const fieldMap: Partial<Record<ReportStatus, string>> = {
        'ON PROGRESS': 'validated_by',
        CLOSED: 'resolved_by',
    };
    return fieldMap[status] || null;
}
