import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/lib/services/sync-service';
import { JoumpaSyncService } from '@/lib/services/joumpa-sync-service';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { timingSafeStringEqual } from '@/lib/security/rate-limit';

// Vercel Hobby caps functions at 60s. Pin the budget and give the sync most of it
// to finish in a single run (the old 3:15 continuation cron was dropped to stay
// within Hobby's 2-cron limit).
export const maxDuration = 60;

const SOFT_TIMEOUT_MS = 50000;

function isCronRequest(request: NextRequest): boolean {
    // Only trust Bearer CRON_SECRET. The `x-vercel-cron` header is a client-
    // supplied request header and is spoofable, so it must not gate auth.
    // Fail closed when the secret is unset instead of matching `Bearer undefined`.
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return timingSafeStringEqual(request.headers.get('authorization'), `Bearer ${secret}`);
}

async function handleCronSync(request: NextRequest) {
    if (!isCronRequest(request) && process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const syncPromise = SyncService.syncReportsFromSheets('vercel-cron');

        const result = await Promise.race([
            syncPromise,
            new Promise<{ timeout: true }>((resolve) =>
                setTimeout(() => resolve({ timeout: true }), SOFT_TIMEOUT_MS)
            ),
        ]);

        if ('timeout' in result && result.timeout) {

            await logSecurityAudit({
                actorId: 'vercel-cron',
                action: 'SYNC_REPORTS_STARTED',
                entityType: 'Report',
                newValue: { status: 'in_progress', note: 'Soft timeout, sync continuing in background' },
                ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
                userAgent: request.headers.get('user-agent'),
            }).catch(() => {});

            return NextResponse.json({
                success: true,
                status: 'in_progress',
                message: 'Sync started but not yet complete within time budget. It continues in the background.',
                continuation: true,
            }, { status: 202 });
        }

        const syncResult = result as Awaited<typeof syncPromise>;

        // JOUMPA is tiny (dozens of rows) so it piggybacks on this cron rather
        // than a 3rd Vercel cron (Hobby caps at 2). Non-blocking on failure.
        let joumpa: Awaited<ReturnType<typeof JoumpaSyncService.sync>> | { error: string } | null = null;
        try {
            joumpa = await JoumpaSyncService.sync();
        } catch (joumpaError) {
            joumpa = { error: joumpaError instanceof Error ? joumpaError.message : 'Joumpa sync failed' };
            console.error('[CRON-SYNC] JOUMPA sync error:', joumpaError);
        }

        // Same reasoning as JOUMPA above — SLA-breach alerts piggyback on this
        // cron rather than getting their own schedule. Non-blocking on failure.
        let slaBreaches: Awaited<ReturnType<typeof SyncService.checkSlaBreaches>> | { error: string } | null = null;
        try {
            slaBreaches = await SyncService.checkSlaBreaches();
        } catch (slaError) {
            slaBreaches = { error: slaError instanceof Error ? slaError.message : 'SLA breach check failed' };
            console.error('[CRON-SYNC] SLA breach check error:', slaError);
        }

        await logSecurityAudit({
            actorId: 'vercel-cron',
            action: 'SYNC_REPORTS',
            entityType: 'Report',
            newValue: {
                success: syncResult.success,
                inserted: syncResult.inserted,
                updated: syncResult.updated,
                deleted: syncResult.deleted,
                duration: syncResult.duration,
            },
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
            userAgent: request.headers.get('user-agent'),
        }).catch(() => {});

        return NextResponse.json({ ...syncResult, joumpa, slaBreaches }, {
            status: syncResult.success ? 200 : 500,
        });
    } catch (error) {
        console.error('[CRON-SYNC] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handleCronSync(request);
}

export async function POST(request: NextRequest) {
    return handleCronSync(request);
}
