
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;

        if (!token) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const payload = await verifySession(token);

        if (!payload) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        return NextResponse.json({ 
            user: {
                id: payload.id,
                role: payload.role,
                full_name: payload.full_name
            } 
        }, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });

    } catch (error) {
        console.error('Session retrieval error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
