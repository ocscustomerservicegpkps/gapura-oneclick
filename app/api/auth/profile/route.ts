import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySession } from '@/lib/auth-utils';

const PROFILE_SELECT = `
    id,
    email,
    full_name,
    nik,
    phone,
    role,
    division,
    status,
    station_id,
    unit_id,
    position_id,
    department,
    created_at,
    updated_at,
    stations:station_id ( id, code, name )
`;

async function requireSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    return await verifySession(token);
}

function serialize(row: Record<string, unknown>) {
    const station = row.stations as { id: string; code: string; name: string } | null;
    return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        nik: row.nik,
        phone: row.phone,
        role: row.role,
        division: row.division,
        status: row.status,
        station_id: row.station_id,
        unit_id: row.unit_id,
        position_id: row.position_id,
        department: row.department,
        created_at: row.created_at,
        updated_at: row.updated_at,
        station: station ? { id: station.id, code: station.code, name: station.name } : null,
    };
}

export async function GET() {
    try {
        const session = await requireSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('users')
            .select(PROFILE_SELECT)
            .eq('id', session.id)
            .single();

        if (error || !data) {
            console.error('[PROFILE] Fetch error:', error);
            return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
        }

        return NextResponse.json(serialize(data), {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[PROFILE] GET error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await requireSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({})) as Record<string, unknown>;

        const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const nik = typeof body.nik === 'string' ? body.nik.trim() : '';

        if (!fullName || fullName.length > 120) {
            return NextResponse.json({ error: 'Full name is required (max. 120 characters)' }, { status: 400 });
        }
        if (!phone || !/^[0-9+\-\s()]{8,20}$/.test(phone)) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }
        if (!nik || !/^[A-Za-z0-9.\-/]{3,32}$/.test(nik)) {
            return NextResponse.json({ error: 'Invalid employee ID (NIK)' }, { status: 400 });
        }

        // NIK is unique across users (see 20260725210000_users_nik_unique).
        const { data: nikOwner } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('nik', nik)
            .neq('id', session.id)
            .maybeSingle();

        if (nikOwner) {
            return NextResponse.json({ error: 'This employee ID (NIK) is already used by another account' }, { status: 409 });
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                full_name: fullName,
                phone,
                nik,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)
            .select(PROFILE_SELECT)
            .single();

        if (error || !data) {
            console.error('[PROFILE] Update error:', error);
            return NextResponse.json({ error: 'Failed to save profile changes' }, { status: 500 });
        }

        // Email, role, division and station are deliberately not editable here —
        // they drive authorization and stay under admin control.
        return NextResponse.json({ success: true, profile: serialize(data) });
    } catch (error) {
        console.error('[PROFILE] PATCH error:', error);
        return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
}
