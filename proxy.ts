
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, TRUSTED_SESSION_HEADER } from '@/lib/auth-utils';

// Division roles land on the escalation select screen first; from there they
// navigate to their own dashboard (or the green Customer Service card for OS/OCS).
const ESKALASI_SELECT = '/dashboard/eskalasi/select';

const ROLE_DASHBOARDS: Record<string, string> = {

    SUPER_ADMIN: '/dashboard/admin',

    DIVISI_ESKALASI: ESKALASI_SELECT,

    DIVISI_OCS: ESKALASI_SELECT,

    PARTNER_OCS: ESKALASI_SELECT,

    DIVISI_OS: ESKALASI_SELECT,

    PARTNER_OS: ESKALASI_SELECT,

    DIVISI_OT: ESKALASI_SELECT,

    PARTNER_OT: ESKALASI_SELECT,

    DIVISI_OP: ESKALASI_SELECT,

    PARTNER_OP: ESKALASI_SELECT,

    DIVISI_UQ: ESKALASI_SELECT,

    PARTNER_UQ: ESKALASI_SELECT,

    DIVISI_HC: '/dashboard/hc',

    PARTNER_HC: '/dashboard/hc',

    DIVISI_HT: ESKALASI_SELECT,

    PARTNER_HT: ESKALASI_SELECT,

    ANALYST: '/dashboard/analyst',

    MANAGER_CABANG: '/dashboard/manager',

    STAFF_CABANG: '/dashboard/employee',

    CABANG: '/dashboard/employee',
};

// Roles that may view a division dashboard / the shared escalation screens.
const DIVISION_VIEWER_ROLES = [
    'DIVISI_OCS', 'PARTNER_OCS',
    'DIVISI_OS', 'PARTNER_OS',
    'DIVISI_OP', 'PARTNER_OP',
    'DIVISI_OT', 'PARTNER_OT',
    'DIVISI_UQ', 'PARTNER_UQ',
    'DIVISI_HT', 'PARTNER_HT',
];

// Escalation sub-pages a division user is allowed to open (the rest are eskalasi-only).
const ESKALASI_SHARED_PATHS = [
    '/dashboard/eskalasi/select',
    '/dashboard/eskalasi/performance-links',
    '/dashboard/eskalasi/documents',
];

export default async function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const isLogoutTransition = request.nextUrl.searchParams.get('logout') === '1';
    const webhookSecret = request.headers.get('x-irrs-webhook-secret');
    const hasGoogleSheetsWebhookSecret = webhookSecret === process.env.GOOGLE_SHEETS_WEBHOOK_SECRET && !!process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

    const cookieStore = request.cookies;
    const session = cookieStore.get('session')?.value;

    if (path.startsWith('/embed')) {
        return NextResponse.next();
    }

    const demoEnabled = process.env.DEMO_MODE === 'true';
    const isDemo = demoEnabled && (request.nextUrl.searchParams.get('demo') === '1' || request.headers.get('x-demo') === 'true');

    const isAuthPagePath = path.startsWith('/auth');
    const isAuthApiPath = path.startsWith('/api/auth');
    const isAuthPath = isAuthPagePath || isAuthApiPath;
    const isSyncEndpoint = path === '/api/admin/sync-reports';
    const isGoogleSheetsWebhook = path === '/api/integrations/google-sheets/webhook';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isPublicEmbedPath = path.startsWith('/embed') ||
                             path.startsWith('/api/master-data') ||
                             path.startsWith('/api/reports/public') ||
                             path.startsWith('/api/reports/duplicates/check') ||
                             path.startsWith('/api/uploads/evidence/token') ||
                             path.startsWith('/api/uploads/evidence/public') ||
                             (path === '/api/dashboards' && request.method === 'GET') ||
                             (path.startsWith('/api/reports/analytics') && request.method === 'GET') ||
                             (isGoogleSheetsWebhook && (hasGoogleSheetsWebhookSecret || isDevelopment)) ||

                             (isSyncEndpoint && isDevelopment);
    const isPublicPath = isAuthPath || isPublicEmbedPath || path === '/';

    const payload = session ? await verifySession(session) : null;

    if (session && !payload) {
        if (process.env.NODE_ENV === 'development') console.warn(`[MIDDLEWARE] Invalid session for path: ${path}`);
    }

    // Forward the already-verified payload to the origin function so
    // downstream layouts/pages/route handlers don't each re-verify (JWT +
    // DB) independently. Always strip any client-supplied copy first so a
    // request can never spoof this header — proxy.ts is the only writer.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(TRUSTED_SESSION_HEADER);
    if (payload) {
        requestHeaders.set(TRUSTED_SESSION_HEADER, JSON.stringify(payload));
    }

    if (!isPublicPath && !payload && !isDemo) {

        if (path.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/auth/login', request.url);
        if (path.startsWith('/virtual-assistant')) {
            loginUrl.searchParams.set('next', path);
        }
        return NextResponse.redirect(loginUrl);
    }

    if (isDemo && !payload) {
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (payload) {

        const role = String(payload.role).trim().toUpperCase();
        const division = String(payload.division || '').trim().toUpperCase();

        if (isAuthPagePath && path !== '/api/auth/logout' && !isLogoutTransition) {
            const dashboardUrl = ROLE_DASHBOARDS[role] || '/dashboard/employee';
            return NextResponse.redirect(new URL(dashboardUrl, request.url));
        }

        if (isAuthApiPath) {
            return NextResponse.next({ request: { headers: requestHeaders } });
        }

        if (path === '/dashboard/employee') {
            const correctDashboard = ROLE_DASHBOARDS[role];
            if (correctDashboard && correctDashboard !== '/dashboard/employee') {
                 return NextResponse.redirect(new URL(correctDashboard, request.url));
            }
        }

        const isBranchManagerUserApproval = role === 'MANAGER_CABANG' && path.startsWith('/dashboard/admin/users');
        if (path.startsWith('/dashboard/admin') && role !== 'SUPER_ADMIN' && !isBranchManagerUserApproval) {
            return NextResponse.redirect(new URL(ROLE_DASHBOARDS[role] || '/dashboard/employee', request.url));
        }

        if (path.startsWith('/dashboard/analyst') && !['ANALYST', 'SUPER_ADMIN'].includes(role)) {
             return NextResponse.redirect(new URL('/dashboard/employee', request.url));
        }

        // Only OCS-division analysts may open performance, circulars/documents,
        // import, calendars, meetings and notifications; other analysts are bounced.
        const OCS_ONLY_ANALYST_SEGMENTS = ['ocs', 'calendar', 'meetings', 'notifications', 'performance-links', 'documents', 'import'];
        if (
            role === 'ANALYST' && division !== 'OCS' &&
            OCS_ONLY_ANALYST_SEGMENTS.some((seg) => path.startsWith(`/dashboard/analyst/${seg}`))
        ) {
            return NextResponse.redirect(new URL('/dashboard/analyst', request.url));
        }

        const homeFor = (r: string) => ROLE_DASHBOARDS[r] || '/dashboard/employee';

        // OCS dashboard (renamed from the old shared /dashboard/os).
        if (path.startsWith('/dashboard/ocs') && !['DIVISI_OCS', 'PARTNER_OCS'].includes(role)) {
             return NextResponse.redirect(new URL(homeFor(role), request.url));
        }
        // New OS division: an independent copy of OCS.
        if (path.startsWith('/dashboard/os') && !['DIVISI_OS', 'PARTNER_OS'].includes(role)) {
             return NextResponse.redirect(new URL(homeFor(role), request.url));
        }
        // Shared operational monitoring dashboard (the "blue" card) for every division.
        if (path.startsWith('/dashboard/op') && !DIVISION_VIEWER_ROLES.includes(role)) {
             return NextResponse.redirect(new URL(homeFor(role), request.url));
        }
        if (path.startsWith('/dashboard/hc') && !['DIVISI_HC', 'PARTNER_HC', 'ANALYST', 'SUPER_ADMIN'].includes(role)) {
             return NextResponse.redirect(new URL(homeFor(role), request.url));
        }
        if (path.startsWith('/dashboard/ht') && !['DIVISI_HT', 'PARTNER_HT', ...DIVISION_VIEWER_ROLES].includes(role)) {
             return NextResponse.redirect(new URL(homeFor(role), request.url));
        }
        if (path.startsWith('/dashboard/eskalasi')) {
             const isSharedEskalasiPath = ESKALASI_SHARED_PATHS.some((p) => path.startsWith(p));
             const allowed = role === 'DIVISI_ESKALASI' || (isSharedEskalasiPath && DIVISION_VIEWER_ROLES.includes(role));
             if (!allowed) {
                 return NextResponse.redirect(new URL(homeFor(role), request.url));
             }
        }
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/auth/:path*',
        '/embed/:path*',
        '/virtual-assistant/:path*',
        '/api/:path*',
    ],
};
