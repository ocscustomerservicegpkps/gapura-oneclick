import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { SyncService } from '@/lib/services/sync-service';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { timingSafeStringEqual } from '@/lib/security/rate-limit';

type SessionLike = { role?: unknown; id?: unknown; email?: unknown } | null | undefined;

function isAuthorized(payload: SessionLike): boolean {
  if (!payload) return false;
  const role = String(payload.role).trim().toUpperCase();
  return role === 'SUPER_ADMIN' || role === 'ANALYST';
}

export async function POST(request: NextRequest) {
  try {
    const nodeEnv = process.env.NODE_ENV;
    const isDevelopment = nodeEnv === 'development';

    if (isDevelopment) {
    }

    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    const authHeader = request.headers.get('authorization');
    // Only trust Bearer CRON_SECRET. The `x-vercel-cron` header is client-supplied
    // and spoofable — trusting it let any anonymous request reach the destructive
    // `action:'clear'` path (clearSyncedData). Fail closed when the secret is unset.
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = !!cronSecret && timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`);

    let payload = null;

    if (session) {
      payload = await verifySession(session);
    }

    if (!isVercelCron && !isAuthorized(payload) && !isDevelopment) {
      return NextResponse.json({
        error: 'Forbidden: Only admins and analysts can trigger sync'
      }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === 'status') {
      const status = await SyncService.getSyncStatus();
      return NextResponse.json(status);
    }

    if (action === 'clear') {
      const result = await SyncService.clearSyncedData();
      return NextResponse.json(result);
    }

    const result = await SyncService.syncReportsFromSheets('admin-sync-api');

    await logSecurityAudit({
      actorId: payload ? String(payload.id) : (isVercelCron ? 'vercel-cron' : 'system'),
      action: 'SYNC_REPORTS',
      entityType: 'Report',
      newValue: { success: result.success, inserted: result.inserted, updated: result.updated, deleted: result.deleted },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });

  } catch (error) {
    console.error('[API] Sync reports error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    const isDevelopment = process.env.NODE_ENV === 'development';

    let payload = null;

    if (session) {
      payload = await verifySession(session);
    }

    if (!isAuthorized(payload) && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await SyncService.getSyncStatus();

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });

  } catch (error) {
    console.error('[API] Get sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
