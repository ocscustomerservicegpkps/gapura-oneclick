
export function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {

        return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;

    return '127.0.0.1';
}

function normalizeAllowedOrigin(value: string | undefined): string | null {
    if (!value) return null;
    try {
        const normalized = value.startsWith('http://') || value.startsWith('https://')
            ? value
            : `https://${value}`;
        return new URL(normalized).origin;
    } catch {
        return null;
    }
}

export function isSameOriginRequest(request: Request): boolean {
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = new Set(
        [
            requestOrigin,
            normalizeAllowedOrigin(process.env.APP_ORIGIN),
            normalizeAllowedOrigin(process.env.NEXT_PUBLIC_APP_URL),
            normalizeAllowedOrigin(process.env.VERCEL_URL),
        ].filter((origin): origin is string => Boolean(origin))
    );

    const origin = request.headers.get('origin');
    if (origin) return allowedOrigins.has(origin);

    const referer = request.headers.get('referer');
    if (referer) {
        try {
            return allowedOrigins.has(new URL(referer).origin);
        } catch {
            return false;
        }
    }

    return process.env.NODE_ENV !== 'production';
}
