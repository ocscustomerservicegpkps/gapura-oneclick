import { createHmac, timingSafeEqual } from 'crypto';

interface AuthBundle {
    active_uid: string;
    origin_uid: string;
    sessions: Record<string, string>;
}

export const DIVISION_ROLE_CANDIDATES: Record<string, string[]> = {
    OP: ['DIVISI_OP', 'PARTNER_OP'],
    OT: ['DIVISI_OT', 'PARTNER_OT'],
    UQ: ['DIVISI_UQ', 'PARTNER_UQ'],
    OCS: ['DIVISI_OCS', 'PARTNER_OCS'],
    OS: ['DIVISI_OS', 'PARTNER_OS'],
    HC: ['DIVISI_HC', 'PARTNER_HC'],
    HT: ['DIVISI_HT', 'PARTNER_HT'],
};

export function normalizeDivisionCode(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return DIVISION_ROLE_CANDIDATES[normalized] ? normalized : null;
}

function getAuthBundleSecret(): string | null {
    return process.env.JWT_SECRET || null;
}

function signBundlePayload(payload: string): string | null {
    const secret = getAuthBundleSecret();
    if (!secret) {
        console.error('[AUTH_BUNDLE] JWT_SECRET is not configured; refusing to trust auth bundle cookies.');
        return null;
    }

    return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function parseAuthBundle(raw: string | null | undefined): AuthBundle | null {
    if (!raw) {
        return null;
    }

    try {
        const separatorIndex = raw.lastIndexOf('.');
        if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
            return null;
        }

        const payload = raw.slice(0, separatorIndex);
        const providedSignature = raw.slice(separatorIndex + 1);
        const expectedSignature = signBundlePayload(payload);
        if (!expectedSignature) {
            return null;
        }

        const providedBuffer = Buffer.from(providedSignature);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (
            providedBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(providedBuffer, expectedBuffer)
        ) {
            console.warn('[AUTH_BUNDLE] Rejected auth bundle with invalid signature.');
            return null;
        }

        const parsed = JSON.parse(payload) as Partial<AuthBundle> | null;
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const sessions = parsed.sessions && typeof parsed.sessions === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.sessions).filter(
                    ([key, value]) => typeof key === 'string' && key && typeof value === 'string' && value
                )
            )
            : {};

        const activeUid = typeof parsed.active_uid === 'string' ? parsed.active_uid : '';
        const originUidRaw = typeof parsed.origin_uid === 'string' ? parsed.origin_uid : '';
        const originUid = originUidRaw || activeUid;

        if (!activeUid || !originUid || !sessions[activeUid] || !sessions[originUid]) {
            return null;
        }

        return {
            active_uid: activeUid,
            origin_uid: originUid,
            sessions,
        };
    } catch {
        return null;
    }
}

export function serializeAuthBundle(bundle: AuthBundle): string {
    const payload = JSON.stringify({
        active_uid: bundle.active_uid,
        origin_uid: bundle.origin_uid,
        sessions: bundle.sessions,
    });
    const signature = signBundlePayload(payload);
    if (!signature) {
        throw new Error('Unable to sign auth bundle');
    }

    return `${payload}.${signature}`;
}
