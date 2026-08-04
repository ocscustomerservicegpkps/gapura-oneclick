import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const { data: userData, error } = await supabaseAdmin
            .from('users')
            .select(`
                id,
                email,
                full_name,
                nik,
                phone,
                role,
                division,
                status,
                station_id,
                stations:station_id (
                    id,
                    code,
                    name
                )
            `)
            .eq('id', payload.id)
            .single();

        if (error) {
            console.error('Error fetching user:', error);
            return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
        }

        const resolvedRole = String(payload.role || userData.role || '').trim().toUpperCase();

        const response = {
            id: userData.id,
            email: userData.email,
            full_name: userData.full_name,
            nik: userData.nik,
            phone: userData.phone,
            role: resolvedRole,
            division: userData.division,
            status: userData.status,
            station_id: userData.station_id,
            station: userData.stations ? {
                id: (userData.stations as unknown as { id: string }).id,
                code: (userData.stations as unknown as { code: string }).code,
                name: (userData.stations as unknown as { name: string }).name,
            } : null,
        };

        return NextResponse.json(response, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
