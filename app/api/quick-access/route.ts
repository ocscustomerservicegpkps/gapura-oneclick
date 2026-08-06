import { NextResponse } from 'next/server';
import { getPublicQuickAccess } from '@/lib/quick-access-server';

export async function GET() {
    try {
        const config = await getPublicQuickAccess();
        return NextResponse.json(config, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        console.error('[QUICK_ACCESS] GET /api/quick-access failed:', error);
        return NextResponse.json({ error: 'Failed to fetch quick access config' }, { status: 500 });
    }
}
