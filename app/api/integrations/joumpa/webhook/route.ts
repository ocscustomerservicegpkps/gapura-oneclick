import { after, NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { JoumpaSyncService } from '@/lib/services/joumpa-sync-service';
import { timingSafeStringEqual } from '@/lib/security/rate-limit';

// JOUMPA had no real-time sync path at all before this route: unlike the
// NON CARGO / CGO webhook (which at least has an onEdit trigger), the only
// thing that ever pulled JOUMPA Sheets edits into Supabase was the once-daily
// Vercel cron. Editing the JOUMPA sheet directly (outside this app's own
// create/update-status flows, which already write to Sheets + Supabase
// synchronously) would sit unsynced for up to 24 hours. This mirrors the
// NON CARGO/CGO webhook's auth model but always triggers a full
// JoumpaSyncService.sync() — the sheet is "tiny (dozens of rows)" (see
// JoumpaSyncService/cron comments), so a scoped single-row sync like
// SyncService.syncSingleRowFromSheets isn't worth the extra complexity here.
export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get('session')?.value;
    const payload = session ? await verifySession(session) : null;
    const isWebhookSecret = hasWebhookSecretAccess(request);
    // Same opt-in-only bypass shape as the NON CARGO/CGO webhook: never keyed
    // on NODE_ENV alone, so a misconfigured deployment can't silently open this.
    const devBypass =
      process.env.NODE_ENV === 'development' &&
      isEnabled(process.env.GOOGLE_SHEETS_WEBHOOK_DEV_BYPASS);

    if (!isWebhookSecret && !isAuthorized(payload) && !devBypass) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    after(async () => {
      try {
        const result = await JoumpaSyncService.sync();
        if (!result.success) {
          console.warn('[JOUMPA_WEBHOOK] Background sync reported failure:', result.error);
        }
      } catch (error) {
        console.error('[JOUMPA_WEBHOOK] Background sync failed:', error);
      }
    });

    return NextResponse.json({ success: true, accepted: true }, { status: 202 });
  } catch (error) {
    console.error('[JOUMPA_WEBHOOK] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
