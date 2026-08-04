import { NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { readSessionPayload, evictSessionCache } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAuthBundle } from '@/lib/auth-bundle';
import { logSecurityEvent } from '@/lib/security/event-service';
import { getClientIp } from '@/lib/security/utils';

function getAppOrigin(request: Request) {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_ORIGIN ||
        request.url
    );
}

function resolveLogoutRedirect(request: Request) {
    const url = new URL(request.url);
    const redirect = url.searchParams.get('redirect');
    const appOrigin = getAppOrigin(request);

    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        return new URL(redirect, appOrigin);
    }

    return new URL('/auth/login?logout=1', appOrigin);
}

async function destroySession(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const bundleRaw = cookieStore.get('auth_bundle')?.value;

    const sidsToRevoke: string[] = [];
    let actorId: string | undefined;

    if (token) {
        const payload = await readSessionPayload(token).catch(() => null);
        if (payload?.sid) sidsToRevoke.push(payload.sid);
        if (payload?.id) actorId = payload.id;
    }

    if (bundleRaw) {
        const bundle = parseAuthBundle(bundleRaw);
        if (bundle) {
            for (const [, sessionToken] of Object.entries(bundle.sessions)) {
                const p = await readSessionPayload(sessionToken).catch(() => null);
                if (p?.sid && !sidsToRevoke.includes(p.sid)) {
                    sidsToRevoke.push(p.sid);
                }
            }
        }
    }

    for (const sid of sidsToRevoke) {
        evictSessionCache(sid);
    }

    if (sidsToRevoke.length > 0) {
        await Promise.allSettled(
            sidsToRevoke.map((sid) =>
                supabaseAdmin
                    .from('security_sessions')
                    .update({ is_revoked: true })
                    .eq('session_id', sid)
            )
        );
    }

    after(() => logSecurityEvent({
        source: 'auth-logout-api',
        event_type: 'access',
        severity: 'LOW',
        payload: { sessions_revoked: sidsToRevoke.length },
        ip_address: getClientIp(request),
        actor_id: actorId,
    }).catch(() => undefined));

    const opts = {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
    };

    cookieStore.set('session', '', opts);
    cookieStore.set('auth_bundle', '', opts);
}

export async function POST(request: Request) {
    await destroySession(request);

    const response = NextResponse.redirect(resolveLogoutRedirect(request), { status: 303 });
    response.headers.set('Clear-Site-Data', '"cache", "storage"');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
}

export async function GET(request: Request) {
    await destroySession(request);

    const response = NextResponse.redirect(resolveLogoutRedirect(request), { status: 303 });
    response.headers.set('Clear-Site-Data', '"cache", "storage"');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
}
