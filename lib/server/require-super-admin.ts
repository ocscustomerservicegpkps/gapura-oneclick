import 'server-only';

import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';

/**
 * Shared SUPER_ADMIN gate for admin API routes — same logic as the inline
 * helper in app/api/admin/external-links/route.ts. Returns the verified
 * session payload, or null when the caller is not a super admin.
 */
export async function requireSuperAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    const payload = await verifySession(token);
    if (!payload || payload.role !== 'SUPER_ADMIN') return null;
    return payload;
}
