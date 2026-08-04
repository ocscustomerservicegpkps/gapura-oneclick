import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAuthBundle } from '@/lib/auth-bundle';
import { verifySession } from '@/lib/auth-utils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;
        const session = sessionToken ? await verifySession(sessionToken) : null;
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bundle = parseAuthBundle(cookieStore.get('auth_bundle')?.value);
        if (!bundle) return NextResponse.json({ active: null, origin: null, accounts: [] });
        if (bundle.active_uid !== String(session.id) || !bundle.sessions[String(session.id)]) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const uids = Object.keys(bundle.sessions);

        if (uids.length === 0) return NextResponse.json({ active: null, origin: bundle.origin_uid, accounts: [] });

        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('id, email, full_name, role, division')
            .in('id', uids);

        if (error) throw error;

        return NextResponse.json({
            active: bundle.active_uid,
            origin: bundle.origin_uid,
            accounts: (users || []).map(u => ({
                id: u.id,
                email: u.email,
                name: u.full_name,
                role: u.role,
                division: u.division,
                isCurrent: u.id === bundle.active_uid,
                isOrigin: u.id === bundle.origin_uid,
            }))
        }, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch bundle' }, { status: 500 });
    }
}
