import { after, NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { SyncService } from '@/lib/services/sync-service';
import { timingSafeStringEqual } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const TARGET_REPORT_SHEETS = new Set(['NON CARGO', 'CGO']);
const SCHEDULED_TRIGGER_TYPES = new Set(['scheduled', 'scheduledsync', 'poll', 'polling', 'time_driven']);

type SessionLike = { role?: unknown } | null | undefined;

function isAuthorized(payload: SessionLike): boolean {
  if (!payload) return false;
  const role = String(payload.role || '').trim().toUpperCase();
  return role === 'SUPER_ADMIN' || role === 'ANALYST';
}

function hasWebhookSecretAccess(request: NextRequest): boolean {
  const configuredSecret = String(process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || '').trim();
  if (!configuredSecret) return false;
  return timingSafeStringEqual(request.headers.get('x-irrs-webhook-secret'), configuredSecret);
}

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isLegacyScheduledPoll(params: {
  triggerType: string;
  sheetName: string;
  rowNumber: number;
  rowSignature: string;
}): boolean {
  const normalizedTrigger = params.triggerType.trim().toLowerCase();
  return (
    SCHEDULED_TRIGGER_TYPES.has(normalizedTrigger) &&
    !params.sheetName &&
    !params.rowSignature &&
    (!Number.isFinite(params.rowNumber) || params.rowNumber <= 0)
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value;
    const payload = session ? await verifySession(session) : null;
    const isWebhookSecret = hasWebhookSecretAccess(request);
    // Auth bypass is opt-in only: never keyed on NODE_ENV alone, so a
    // misconfigured deployment (NODE_ENV != production) can't silently open
    // the endpoint. Requires the explicit local flag AND running under `next dev`.
    const devBypass =
      process.env.NODE_ENV === 'development' &&
      isEnabled(process.env.GOOGLE_SHEETS_WEBHOOK_DEV_BYPASS);

    if (!isWebhookSecret && !isAuthorized(payload) && !devBypass) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    const triggerType = String(body.triggerType || body.changeType || 'unknown');
    const sheetName = typeof body.sheetName === 'string' ? body.sheetName.trim() : '';
    const rowNumber = Number(body.rowNumber || 0);
    const rowSignature = typeof body.rowSignature === 'string' ? body.rowSignature : '';

    if (
      isLegacyScheduledPoll({ triggerType, sheetName, rowNumber, rowSignature }) &&
      !isEnabled(process.env.GOOGLE_SHEETS_WEBHOOK_ALLOW_SCHEDULED_POLL)
    ) {
      return NextResponse.json({
        success: true,
        accepted: false,
        skipped: true,
        reason: 'Scheduled Google Sheets polling is disabled; use edit webhooks or Vercel cron instead.',
      });
    }

    if (sheetName && !TARGET_REPORT_SHEETS.has(sheetName)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Sheet ${sheetName} is outside the report-source allowlist`,
      });
    }

    after(async () => {
      try {
        // A normal Apps Script edit notification always carries sheetName +
        // rowNumber — use them to sync just that row instead of a full pull
        // plus the whole push-back-to-sheets backlog on every single edit.
        // Falls back to a full sync only when a caller sends an unscoped
        // ping (no row info) — the periodic full sync (login/cron) remains
        // the safety net for deletions and reconciling anything missed.
        if (sheetName && Number.isFinite(rowNumber) && rowNumber > 0) {
          const result = await SyncService.syncSingleRowFromSheets(sheetName, rowNumber);
          if (!result.success) {
            console.warn(
              `[GOOGLE_SHEETS_WEBHOOK] Scoped sync failed for ${sheetName}!row_${rowNumber}, leaving it for the next full sync:`,
              result.error
            );
          }
        } else {
          await SyncService.syncReportsFromSheets('google-sheets-webhook');
        }
      } catch (error) {
        console.error('[GOOGLE_SHEETS_WEBHOOK] Background sync failed:', error);
      }
    });

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        trigger: {
          triggerType,
          sheetName: sheetName || null,
          rowNumber: Number.isFinite(rowNumber) && rowNumber > 0 ? rowNumber : null,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[GOOGLE_SHEETS_WEBHOOK] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
