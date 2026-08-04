
import crypto from 'crypto';
import type { Report } from '@/types';

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';

    const raw = Array.isArray(value)
        ? value.join(' ')
        : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : String(value);

    return raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function normalizeDate(value: unknown): string {
    if (!value) return '';

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
        const serialDate = new Date(Math.round((value - 25569) * 86400 * 1000));
        return Number.isNaN(serialDate.getTime()) ? '' : serialDate.toISOString().slice(0, 10);
    }

    const normalized = normalizeText(value);
    if (!normalized) return '';

    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }

    return normalized;
}

function toTitleCase(value: string): string {
    return value
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeReportCategory(value: unknown): string {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (normalized.includes('accident') || normalized.includes('incident') || normalized.includes('insiden') || normalized.includes('kecelakaan')) return 'Accident / Incident';
    if (normalized.includes('occurrence') || normalized.includes('occurence')) return 'Occurrence';
    if (normalized.includes('irregular')) return 'Irregularity';
    if (normalized.includes('complaint') || normalized.includes('complain')) return 'Complaint';
    if (normalized.includes('compliment')) return 'Compliment';
    return toTitleCase(normalized);
}

export function resolveReportCategory(report: Partial<Report>): string {
    return normalizeReportCategory(
        report.main_category ||
        report.category ||
        report.irregularity_complain_category ||
        report.accident_incident
    );
}

export function resolveReportBranch(report: Partial<Report>): string {
    return normalizeText(
        report.branch ||
        report.reporting_branch ||
        report.station_code ||
        report.station_id
    );
}

function resolveReportAirline(report: Partial<Report>): string {
    return normalizeText(report.airline || report.airlines);
}

function resolveAreaCategory(report: Partial<Report>): string {
    const normalizedArea = normalizeText(report.area);

    if (normalizedArea.includes('terminal') && report.terminal_area_category) {
        return normalizeText(report.terminal_area_category);
    }

    if (normalizedArea.includes('apron') && report.apron_area_category) {
        return normalizeText(report.apron_area_category);
    }

    if (normalizedArea.includes('general') && report.general_category) {
        return normalizeText(report.general_category);
    }

    return normalizeText(
        report.terminal_area_category ||
        report.apron_area_category ||
        report.general_category
    );
}

function resolveReportNarrative(report: Partial<Report>): string {
    return normalizeText(report.report || report.description || report.title);
}

export function buildReportFingerprint(report: Partial<Report>): string {
    const parts = [
        normalizeText(report.source_sheet),
        normalizeDate(report.date_of_event || report.incident_date || report.created_at),
        resolveReportBranch(report),
        resolveReportAirline(report),
        normalizeText(report.flight_number),
        normalizeText(report.route),
        resolveReportCategory(report),
        normalizeText(report.irregularity_complain_category),
        normalizeText(report.area),
        resolveAreaCategory(report),
        resolveReportNarrative(report),
        normalizeText(report.reporter_name),
        // The "Report" column (resolveReportNarrative) is a short categorical
        // label (e.g. "DENTED", "TORN"), not free text — distinct incidents on
        // the same flight/day/category routinely share it. Root Caused / Action
        // Taken hold the actual descriptive text and are what usually tells two
        // such incidents apart.
        normalizeText(report.root_caused),
        normalizeText(report.action_taken),
    ];

    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

export function isNewRecordCategory(report: Partial<Report>): boolean {
    const category = resolveReportCategory(report);

    return ['Irregularity', 'Complaint', 'Compliment', 'Occurrence', 'Accident / Incident', '-', ''].includes(category);
}
