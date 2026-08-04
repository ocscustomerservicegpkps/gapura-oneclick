
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

function isDemoMode() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('demo_mode') === 'true' || 
           new URLSearchParams(window.location.search).get('demo') === '1';
}

export async function fetchWithDemo(url: string, options: RequestInit = {}) {
    const isDemo = isDemoMode();
    const headers = new Headers(options.headers);

    if (isDemo) {
        headers.set('x-demo', 'true');
    }

    return fetch(url, {
        ...options,
        headers,
    });
}

export function formatDate(dateInput: string | Date | number | undefined | null): string {
    if (!dateInput) return "N/A";

    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "N/A";

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        return `${day} ${month} ${year}`;
    } catch {
        return "N/A";
    }
}

/**
 * Splits a report timestamp into the parts that are real.
 *
 * Reports synced from Google Sheets carry a date-only event date, which the
 * sync widens into a midnight timestamp (`reports-service.ts` falls back to
 * `date_of_event` when the sheet has no Created_At). Rendering that as a clock
 * time printed "00.00" on every synced report — precision the data never had.
 * Reports filed in the app do carry a real submission time, so the time is
 * returned only when it is actually present.
 */
export function splitReportTimestamp(
    value: string | Date | null | undefined,
    locale = 'id-ID'
): { date: string; time: string | null } {
    if (!value) return { date: '—', time: null };

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return { date: typeof value === 'string' ? value : '—', time: null };
    }

    const date = parsed.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });
    const isDateOnly = parsed.getHours() === 0 && parsed.getMinutes() === 0;

    return {
        date,
        time: isDateOnly ? null : parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };
}
