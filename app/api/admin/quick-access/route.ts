import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { getAdminQuickAccess } from '@/lib/quick-access-server';

export async function GET() {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const config = await getAdminQuickAccess();
        return NextResponse.json(config, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        console.error('[QUICK_ACCESS] GET /api/admin/quick-access failed:', error);
        return NextResponse.json({ error: 'Failed to fetch quick access config' }, { status: 500 });
    }
}
