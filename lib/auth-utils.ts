
import 'server-only';
import { SessionPayload } from '@/types';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cache } from 'react';
import { headers } from 'next/headers';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    throw new Error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start with insecure configuration.');
}
const key = new TextEncoder().encode(SECRET_KEY);

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
export const ESCALATION_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const SWITCHED_DIVISION_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

// Cross-request authorization state is deliberately short-lived. React cache
// below removes duplicate work inside one request without extending revocation.
const SESSION_CACHE_TTL_MS = 30 * 1000;
const sessionCache = new Map<string, { payload: SessionPayload; expiresAt: number; cacheTime: number }>();

function getCachedSession(sid: string): SessionPayload | null {
    const entry = sessionCache.get(sid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        sessionCache.delete(sid);
        return null;
    }
    return entry.payload;
}

function getCachedSessionAge(sid: string): number | null {
    const entry = sessionCache.get(sid);
    if (!entry) return null;
    return Date.now() - entry.cacheTime;
}

function setCachedSession(sid: string, payload: SessionPayload): void {

    if (sessionCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of sessionCache) {
            if (now > v.expiresAt) sessionCache.delete(k);
        }

        if (sessionCache.size > 500) {
            const entries = [...sessionCache.entries()]
                .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
            for (let i = 0; i < Math.ceil(entries.length / 4); i++) {
                sessionCache.delete(entries[i][0]);
            }
        }
    }
    sessionCache.set(sid, { payload, expiresAt: Date.now() + SESSION_CACHE_TTL_MS, cacheTime: Date.now() });
}

export function evictSessionCache(sid: string): void {
    sessionCache.delete(sid);
}

// proxy.ts verifies the session once per request and forwards the result via
// this header so downstream layouts/pages/route handlers don't each re-verify
// (JWT decode + a security_sessions/users DB join) independently. proxy.ts is
// responsible for stripping any client-supplied copy before setting its own.
export const TRUSTED_SESSION_HEADER = 'x-irrs-verified-session';

async function getTrustedHeaderPayload(): Promise<SessionPayload | null> {
    try {
        // headers() throws when called outside a Server Component/Route
        // Handler request scope — notably from inside proxy.ts itself, which
        // is exactly where we must fall through to real verification instead.
        const hdrs = await headers();
        const raw = hdrs.get(TRUSTED_SESSION_HEADER);
        if (!raw) return null;
        return JSON.parse(raw) as SessionPayload;
    } catch {
        return null;
    }
}

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

import { supabaseAdmin } from './supabase-admin';

export async function signSession(
    payload: SessionPayload,
    options: { maxAgeSeconds?: number } = {},
) {
    const sid = payload.sid || crypto.randomUUID();
    const maxAgeSeconds = options.maxAgeSeconds || DEFAULT_SESSION_MAX_AGE_SECONDS;
    return await new SignJWT({ ...payload, sid } as unknown as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(sid)
        .setIssuedAt()
        .setExpirationTime(`${maxAgeSeconds}s`)
        .sign(key);
}

function mergeUserIntoSession(session: SessionPayload, u: Record<string, unknown>): SessionPayload {
    const stationRelation = u.stations as
        | { id: string; code: string; name: string }
        | Array<{ id: string; code: string; name: string }>
        | null
        | undefined;
    const station = Array.isArray(stationRelation) ? stationRelation[0] : stationRelation;

    return {
        ...session,
        role: (u.role as string) || session.role,
        division: (u.division as string) ?? session.division,
        full_name: (u.full_name as string) ?? session.full_name,
        email: (u.email as string) ?? session.email,
        station_id: (u.station_id as string) ?? session.station_id,
        station_code: station?.code ?? session.station_code,
        station_name: station?.name ?? session.station_name,
    };
}

async function verifySessionUncached(token: string): Promise<SessionPayload | null> {
    try {
        let session = await readSessionPayload(token);
        if (!session) {
            return null;
        }

        // The trusted header only reflects proxy.ts's verification of THIS
        // request's own 'session' cookie. Callers that verify a different,
        // explicitly-passed token (e.g. another account's token stashed in
        // the auth_bundle cookie while an eskalasi user is switched into a
        // division) must not get that unrelated identity back just because
        // a trusted header happens to be present — only reuse it when it
        // actually corresponds to the token being verified.
        const trusted = await getTrustedHeaderPayload();
        if (trusted && trusted.sid && trusted.sid === session.sid) {
            return trusted;
        }

        if (session.sid) {

            const cached = getCachedSession(session.sid);
            if (cached) {

                const cachedAge = getCachedSessionAge(session.sid);
                if (cachedAge !== null && cachedAge > 15 * 60 * 1000) {
                    supabaseAdmin.from('security_sessions')
                        .update({ last_active: new Date().toISOString() })
                        .eq('session_id', session.sid)
                        .then();
                }
                return cached;
            }

            // Single query: join users (and stations) via security_sessions.user_id to
            // avoid extra round-trips — this is the one DB-verified source of truth that
            // getWorkspaceUser() and other call sites rely on via the returned payload.
            const { data, error: dbError } = await supabaseAdmin
                .from('security_sessions')
                .select(`
                    is_revoked, last_active, expires_at,
                    user:users!user_id (
                        role, status, division, full_name, email, station_id,
                        stations:station_id ( id, code, name )
                    )
                `)
                .eq('session_id', session.sid)
                .single();

            if (data?.is_revoked) {
                console.warn(`[AUTH_UTILS] Session ${session.sid} is REVOKED`);
                evictSessionCache(session.sid);
                return null;
            }

            if (!data) {
                if (dbError) {
                    console.warn(`[AUTH_UTILS] Session ${session.sid} DB lookup error:`, dbError.message, dbError.code);
                } else {
                    console.warn(`[AUTH_UTILS] Session ${session.sid} NOT FOUND in DB — attempting re-register`);
                }

                try {
                    const { data: userData } = await supabaseAdmin
                        .from('users')
                        .select(`
                            role, status, division, full_name, email, station_id,
                            stations:station_id ( id, code, name )
                        `)
                        .eq('id', session.id)
                        .single();

                    if (!userData || (userData as Record<string, unknown>).status !== 'active') {
                        console.warn(`[AUTH_UTILS] Session ${session.sid} user not active — rejecting`);
                        return null;
                    }

                    const jwtExp = (session as unknown as { exp?: number }).exp;
                    const remainingMs = jwtExp ? (jwtExp * 1000 - Date.now()) : 0;
                    if (remainingMs <= 0) return null;

                    const remainingSeconds = Math.ceil(remainingMs / 1000);
                    await registerSession(session.id, session.sid, null, null, remainingSeconds);
                    session = mergeUserIntoSession(session, userData as Record<string, unknown>);
                    setCachedSession(session.sid, session);
                } catch (reregErr) {
                    console.warn(`[AUTH_UTILS] Session re-register failed:`, reregErr instanceof Error ? reregErr.message : reregErr);
                    return null;
                }

                return session;
            }

            if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
                console.warn(`[AUTH_UTILS] Session ${session.sid} is EXPIRED`);
                evictSessionCache(session.sid);
                return null;
            }

            // User data comes from the join — no second DB call on the hot path
            const joinedUser = Array.isArray(data.user) ? data.user[0] : data.user;
            if (!joinedUser) {
                console.warn(`[AUTH_UTILS] Session ${session.sid} user not found — rejecting`);
                evictSessionCache(session.sid);
                return null;
            }
            const u = joinedUser as Record<string, unknown>;
            if (u.status !== 'active') {
                evictSessionCache(session.sid);
                return null;
            }
            session = mergeUserIntoSession(session, u);

            setCachedSession(session.sid, session);

            const lastActive = data.last_active ? new Date(data.last_active).getTime() : 0;
            if (!lastActive || (Date.now() - lastActive) > 15 * 60 * 1000) {
                supabaseAdmin.from('security_sessions')
                    .update({ last_active: new Date().toISOString() })
                    .eq('session_id', session.sid)
                    .then();
            }
        }

        return session;
    } catch (err: unknown) {
        console.error(`[AUTH_UTILS] verifySession catch error for token:`, err instanceof Error ? err.message : err);
        return null;
    }
}

async function readSessionPayloadUncached(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS256'],
        });

        return payload as unknown as SessionPayload;
    } catch (err: unknown) {
        console.error(`[AUTH_UTILS] readSessionPayload catch error for token:`, err instanceof Error ? err.message : err);
        return null;
    }
}

export const readSessionPayload = cache(readSessionPayloadUncached);
export const verifySession = cache(verifySessionUncached);

export async function registerSession(
    userId: string,
    sid: string,
    ip: string | null,
    ua: string | null,
    maxAgeSeconds: number = DEFAULT_SESSION_MAX_AGE_SECONDS,
) {
    return await supabaseAdmin.from('security_sessions').insert({
        user_id: userId,
        session_id: sid,
        ip_address: ip,
        user_agent: ua,
        expires_at: new Date(Date.now() + maxAgeSeconds * 1000).toISOString(),
    });
}
