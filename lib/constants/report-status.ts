
import {
    AlertTriangle,
    AlertCircle,
    Shield,
    CheckCircle2,
    Clock,
    LucideIcon
} from 'lucide-react';

export const REPORT_STATUS = {
    OPEN: 'OPEN',
    'ON PROGRESS': 'ON PROGRESS',
    CLOSED: 'CLOSED',
} as const;

export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS];

export const STATUS_CONFIG: Record<ReportStatus, {

    label: string;

    color: string;

    bgColor: string;

    icon: LucideIcon;

    description: string;

    bgClass?: string;

    textClass?: string;

    borderClass?: string;
}> = {
    OPEN: {
        label: 'Open',
        color: 'oklch(0.65 0.20 240)',
        bgColor: 'oklch(0.65 0.20 240 / 0.1)',
        icon: AlertCircle,
        description: 'New or open report',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
    },
    'ON PROGRESS': {
        label: 'On Progress',
        color: 'oklch(0.65 0.18 85)',
        bgColor: 'oklch(0.65 0.18 85 / 0.1)',
        icon: Clock,
        description: 'Being handled by analyst',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
    },
    CLOSED: {
        label: 'Closed',
        color: 'oklch(0.55 0.18 145)',
        bgColor: 'oklch(0.55 0.18 145 / 0.1)',
        icon: CheckCircle2,
        description: 'Case has been resolved',
        bgClass: 'bg-green-50',
        textClass: 'text-green-700',
        borderClass: 'border-green-200',
    },
};

export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_CONFIG: Record<ReportPriority, {

    label: string;

    labelShort: string;

    color: string;

    bgColor: string;

    slaHours: number;

    description: string;
}> = {
    low: {
        label: 'Low',
        labelShort: 'Low',
        color: 'oklch(0.55 0.18 145)',
        bgColor: 'oklch(0.55 0.18 145 / 0.1)',
        slaHours: 168,
        description: 'Non-urgent, standard handling',
    },
    medium: {
        label: 'Medium',
        labelShort: 'Med',
        color: 'oklch(0.65 0.18 85)',
        bgColor: 'oklch(0.65 0.18 85 / 0.1)',
        slaHours: 72,
        description: 'Requires attention within 3 days',
    },
    high: {
        label: 'High',
        labelShort: 'High',
        color: 'oklch(0.60 0.18 45)',
        bgColor: 'oklch(0.60 0.18 45 / 0.1)',
        slaHours: 24,
        description: 'Urgent action required within 24 hours',
    },
    urgent: {
        label: 'Critical',
        labelShort: 'URGENT',
        color: 'oklch(0.55 0.22 25)',
        bgColor: 'oklch(0.55 0.22 25 / 0.1)',
        slaHours: 4,
        description: 'Critical - immediate response required',
    },
};

export const SEVERITY_CONFIG = {
    'TOP RISK': { label: 'TOP RISK', color: 'oklch(0.55 0.22 25)', bg: 'oklch(0.55 0.22 25 / 0.12)', icon: AlertTriangle },
    'HIGH RISK': { label: 'HIGH RISK', color: 'oklch(0.58 0.2 35)', bg: 'oklch(0.58 0.2 35 / 0.12)', icon: AlertTriangle },
    'MEDIUM': { label: 'MEDIUM', color: 'oklch(0.70 0.14 75)', bg: 'oklch(0.70 0.14 75 / 0.12)', icon: AlertCircle },
    'LOW': { label: 'LOW', color: 'oklch(0.55 0.14 160)', bg: 'oklch(0.55 0.14 160 / 0.12)', icon: Shield },
};

export type SeverityLevel = keyof typeof SEVERITY_CONFIG;

export function normalizeSeverityLevel(value: unknown): string {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw || raw === '-' || raw === '#N/A' || raw === 'N/A' || raw === 'NULL' || raw === 'UNDEFINED') return '';

    if (raw === 'CRITICAL' || raw === 'URGENT' || raw === 'TOP RISK' || raw === 'TOP') return 'TOP RISK';
    if (raw === 'HIGH RISK' || raw === 'HIGH') return 'HIGH RISK';
    if (raw === 'MEDIUM' || raw === 'MED') return 'MEDIUM';
    if (raw === 'LOW') return 'LOW';

    return raw;
}

export function isHighSeverityLevel(value: unknown): boolean {
    const normalized = normalizeSeverityLevel(value);
    return normalized === 'TOP RISK' || normalized === 'HIGH RISK';
}

export function getSeverityConfig(level: unknown) {
    const normalized = normalizeSeverityLevel(level);
    if (!normalized) return SEVERITY_CONFIG.LOW;
    return SEVERITY_CONFIG[normalized as SeverityLevel] || SEVERITY_CONFIG.LOW;
}

export function calculateSlaDeadline(createdAt: Date | string, priority: ReportPriority): Date {
    const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const slaHours = PRIORITY_CONFIG[priority].slaHours;
    return new Date(created.getTime() + slaHours * 60 * 60 * 1000);
}

export function normalizeStatus(status: unknown): ReportStatus {
    if (!status) return 'OPEN';

    const s = String(status).trim().toUpperCase().replace(/\s+/g, '_');

    if ([
        'OPEN', 
        'BARU', 
        'NEW', 
        'BARU/NEW', 
        'MENUNGGU_FEEDBACK', 
        'UNASSIGNED',
        'ACTIVE'
    ].includes(s)) {
        return 'OPEN';
    }

    if ([
        'ON_PROGRESS', 
        'ONPROGRESS', 
        'SUDAH_DIVERIFIKASI', 
        'DIVERIFIKASI',
        'DIKONFIRMASI',
        'PROGRESS'
    ].includes(s)) {
        return 'ON PROGRESS';
    }

    if ([
        'CLOSED', 
        'SELESAI', 
        'NON_ACTIVE'
    ].includes(s)) {
        return 'CLOSED';
    }

    return 'OPEN';
}

const STATUS_CHANGE_BLOCKED_ROLES = new Set(['STAFF_CABANG', 'MANAGER_CABANG']);

export function canChangeReportStatus(userRole: string | null | undefined): boolean {
    const normalizedRole = String(userRole || '').trim().toUpperCase();
    return Boolean(normalizedRole) && !STATUS_CHANGE_BLOCKED_ROLES.has(normalizedRole);
}

export function getAllowedTransitions(
    currentStatus: string | ReportStatus,
    userRole: string
): ReportStatus[] {
    if (!canChangeReportStatus(userRole)) return [];

    const normalized = normalizeStatus(currentStatus);

    switch (normalized) {
        case 'OPEN':
            return ['ON PROGRESS', 'CLOSED'];

        case 'ON PROGRESS':
            return ['CLOSED'];

        case 'CLOSED':
            return ['OPEN'];

        default:
            return [];
    }
}

export function canPerformAction(
    action: 'update_progress' | 'close' | 'reopen' | 'comment',
    currentStatus: string | ReportStatus,
    userRole: string
): boolean {
    const canChangeStatus = canChangeReportStatus(userRole);
    const normalized = normalizeStatus(currentStatus);

    switch (action) {
        case 'update_progress':
            return canChangeStatus && normalized === 'OPEN';

        case 'close':
            return canChangeStatus && (normalized === 'OPEN' || normalized === 'ON PROGRESS');

        case 'reopen':
            return canChangeStatus && normalized === 'CLOSED';

        case 'comment':
            return true;

        default:
            return false;
    }
}
