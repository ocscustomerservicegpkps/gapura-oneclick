import 'server-only';

/**
 * Report detail pages are per-workspace, and proxy.ts guards each one by role.
 * A notification must therefore link a recipient to the copy their own role is
 * allowed to open — sending everyone to one path would bounce most of them
 * back to their dashboard and lose the report.
 *
 * Only these workspaces ship a `reports/[id]` route; MANAGER_CABANG and
 * STAFF_CABANG share the employee one, which proxy.ts lets both through
 * (its redirect only fires on the bare `/dashboard/employee` path).
 */
const DETAIL_WORKSPACE: Record<string, string> = {
    SUPER_ADMIN: 'admin',
    ANALYST: 'analyst',

    DIVISI_OCS: 'ocs',
    PARTNER_OCS: 'ocs',

    DIVISI_OS: 'os',
    PARTNER_OS: 'os',

    // The shared operational monitoring workspace, open to every division viewer.
    DIVISI_OP: 'op',
    PARTNER_OP: 'op',
    DIVISI_OT: 'op',
    PARTNER_OT: 'op',
    DIVISI_UQ: 'op',
    PARTNER_UQ: 'op',
    DIVISI_HT: 'op',
    PARTNER_HT: 'op',
    DIVISI_ESKALASI: 'op',

    MANAGER_CABANG: 'employee',
    STAFF_CABANG: 'employee',
    CABANG: 'employee',
};

function appBaseUrl(): string | null {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return null;
    const normalized = raw.startsWith('http') ? raw : `https://${raw}`;
    return normalized.replace(/\/+$/, '');
}

/** Absolute link to the report as this role can open it, or null if unaddressable. */
export function reportDetailUrl(role: string | null | undefined, reportId: string): string | null {
    const base = appBaseUrl();
    if (!base || !reportId) return null;

    const workspace = DETAIL_WORKSPACE[String(role || '').trim().toUpperCase()] || 'employee';
    return `${base}/dashboard/${workspace}/reports/${encodeURIComponent(reportId)}`;
}

/** CTA for a report email, omitted when the app URL is not configured. */
export function reportDetailCta(
    role: string | null | undefined,
    reportId: string,
    label = 'Open report'
): { label: string; url: string } | undefined {
    const url = reportDetailUrl(role, reportId);
    return url ? { label, url } : undefined;
}
