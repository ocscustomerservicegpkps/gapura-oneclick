import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import {
    ESCALATION_SESSION_MAX_AGE_SECONDS,
    SWITCHED_DIVISION_SESSION_MAX_AGE_SECONDS,
    registerSession,
    signSession,
    verifySession,
} from '@/lib/auth-utils';
import {
    DIVISION_ROLE_CANDIDATES,
    normalizeDivisionCode,
    parseAuthBundle,
    serializeAuthBundle,
} from '@/lib/auth-bundle';
import { getClientIp, isSameOriginRequest } from '@/lib/security/utils';
import { checkDbRateLimit } from '@/lib/security/rate-limit';

type SwitchableUser = {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    division: string | null;
    status: string;
    created_at?: string | null;
    updated_at?: string | null;
};

function toTimestamp(value: string | null | undefined): number {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function scoreTargetUser(user: SwitchableUser, divisionCode: string, primaryRole: string): number {
    let score = 0;
    const normalizedRole = String(user.role || '').trim().toUpperCase();
    const normalizedDivision = String(user.division || '').trim().toUpperCase();
    const normalizedEmail = String(user.email || '').trim().toLowerCase();

    if (normalizedRole === primaryRole) score += 100;
    if (normalizedDivision === divisionCode) score += 50;
    if (normalizedEmail.startsWith(`divisi.${divisionCode.toLowerCase()}`)) score += 15;
    if (normalizedEmail.startsWith(`partner.${divisionCode.toLowerCase()}`)) score += 10;

    return score;
}

function resolveTargetUser(divisionCode: string, users: SwitchableUser[]): { user?: SwitchableUser; error?: string; status?: number } {
    const roles = DIVISION_ROLE_CANDIDATES[divisionCode] || [];
    const primaryRole = roles[0];
    const eligibleUsers = users.filter((user) => {
        const role = String(user.role || '').trim().toUpperCase();
        const division = String(user.division || '').trim().toUpperCase();
        return roles.includes(role) && (!division || division === divisionCode || division === 'GENERAL');
    });

    if (eligibleUsers.length === 0) {
        return {
            error: `Akun divisi ${divisionCode} belum tersedia atau belum aktif.`,
            status: 404,
        };
    }

    const rankedUsers = [...eligibleUsers].sort((left, right) => {
        const scoreDelta = scoreTargetUser(right, divisionCode, primaryRole) - scoreTargetUser(left, divisionCode, primaryRole);
        if (scoreDelta !== 0) {
            return scoreDelta;
        }

        const updatedDelta = toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
        if (updatedDelta !== 0) {
            return updatedDelta;
        }

        const createdDelta = toTimestamp(right.created_at) - toTimestamp(left.created_at);
        if (createdDelta !== 0) {
            return createdDelta;
        }

        return String(left.email || '').localeCompare(String(right.email || ''));
    });

    if (rankedUsers.length > 1) {
        console.warn(`[AUTH_SWITCH_DIVISION] Multiple active accounts matched ${divisionCode}. Selected ${rankedUsers[0].email}.`);
    }

    return { user: rankedUsers[0] };
}

function getDivisionRedirectPath(divisionCode: string) {
    if (divisionCode === 'HC') {
        return '/dashboard/hc';
    }

    return `/dashboard/${divisionCode.toLowerCase()}`;
}

export async function POST(request: Request) {
    try {
        if (!isSameOriginRequest(request)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const divisionCode = normalizeDivisionCode(body?.divisionCode);

        if (!divisionCode) {
            return NextResponse.json({ error: 'Kode divisi tidak valid' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;
        const session = sessionToken ? await verifySession(sessionToken) : null;

        if (!session || String(session.role || '').trim().toUpperCase() !== 'DIVISI_ESKALASI') {
            return NextResponse.json({ error: 'Hanya akun eskalasi utama yang bisa membuka divisi.' }, { status: 403 });
        }

        let bundle = parseAuthBundle(cookieStore.get('auth_bundle')?.value);
        let originToken = bundle?.origin_uid ? bundle.sessions[bundle.origin_uid] : null;
        let originSession = originToken ? await verifySession(originToken) : null;

        if (sessionToken) {
            originToken = sessionToken;
            originSession = session;
        }

        if (!originSession || String(originSession.role || '').trim().toUpperCase() !== 'DIVISI_ESKALASI' || !originToken) {
            return NextResponse.json({ error: 'Hanya akun eskalasi yang bisa switch ke divisi lain' }, { status: 403 });
        }

        const clientIp = getClientIp(request);
        const switchLimit = await checkDbRateLimit(`switch-division:${originSession.id}:${clientIp}`, 20, 15 * 60_000);
        if (!switchLimit.success) {
            return NextResponse.json(
                { error: 'Terlalu banyak percobaan switch divisi. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((switchLimit.resetAt - Date.now()) / 1000)) } }
            );
        }

        bundle = bundle ?? {
            active_uid: originSession.id,
            origin_uid: originSession.id,
            sessions: {},
        };
        bundle.origin_uid = originSession.id;
        bundle.sessions[originSession.id] = originToken;

        const roles = DIVISION_ROLE_CANDIDATES[divisionCode];
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, full_name, role, division, status, created_at, updated_at')
            .eq('status', 'active')
            .in('role', roles);

        if (error) {
            throw error;
        }

        const resolution = resolveTargetUser(divisionCode, (users || []) as SwitchableUser[]);
        if (!resolution.user) {
            return NextResponse.json({ error: resolution.error || 'Akun target tidak ditemukan' }, { status: resolution.status || 404 });
        }

        const targetUser = resolution.user;
        let targetToken = bundle.sessions[targetUser.id];
        const targetSession = targetToken ? await verifySession(targetToken) : null;

        if (
            !targetSession ||
            targetSession.id !== targetUser.id ||
            String(targetSession.role || '').trim().toUpperCase() !== String(targetUser.role || '').trim().toUpperCase()
        ) {
            const sid = crypto.randomUUID();
            targetToken = await signSession({
                id: targetUser.id,
                email: targetUser.email,
                role: targetUser.role,
                division: targetUser.division || undefined,
                sid,
            }, { maxAgeSeconds: SWITCHED_DIVISION_SESSION_MAX_AGE_SECONDS });

            await registerSession(
                targetUser.id,
                sid,
                clientIp,
                request.headers.get('user-agent'),
                SWITCHED_DIVISION_SESSION_MAX_AGE_SECONDS
            );
        }

        if (!targetToken) {
            throw new Error(`Failed to create session token for division ${divisionCode}`);
        }

        bundle.active_uid = targetUser.id;
        bundle.sessions = {
            [originSession.id]: originToken,
            [targetUser.id]: targetToken,
        };

        cookieStore.set('auth_bundle', serializeAuthBundle(bundle), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: ESCALATION_SESSION_MAX_AGE_SECONDS,
            path: '/',
        });

        cookieStore.set('session', targetToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SWITCHED_DIVISION_SESSION_MAX_AGE_SECONDS,
            path: '/',
        });

        return NextResponse.json({
            success: true,
            role: targetUser.role,
            userId: targetUser.id,
            redirectPath: getDivisionRedirectPath(divisionCode),
        });
    } catch (error) {
        console.error('Switch division error:', error);
        return NextResponse.json({ error: 'Gagal switch ke akun divisi' }, { status: 500 });
    }
}
