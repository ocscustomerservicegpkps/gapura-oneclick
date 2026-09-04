import 'server-only';
import { cookies } from 'next/headers';

/**
 * Session token for the /api/security/* routes: a bearer token when one is
 * supplied, otherwise the `session` cookie.
 *
 * These routes each parsed the cookie header by hand with
 * `cookie.split('session=')[1]`, which matches on a *substring* of the header:
 * any cookie whose name merely ends in `session` — `my_session`,
 * `demo_session` — comes first in the header and its value is what the split
 * returns. Reading the cookie by its exact name removes that ambiguity, and
 * `cookies()` handles quoting and whitespace besides.
 */
export async function getSecurityRouteToken(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (bearer) return bearer;

    const cookieStore = await cookies();
    return cookieStore.get('session')?.value || null;
}
