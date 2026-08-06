import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth-utils';
import {
  createPublishedDashboard,
  listPublishedDashboards,
} from '@/lib/share/service';
import {
  ALL_TABS,
  generateShareSlug,
  isValidShareTab,
  sanitizeScope,
} from '@/lib/share/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireSession() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  return session;
}

// Publish a new share link. Owner-only.
export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const dashboardKey = typeof source.dashboardKey === 'string' ? source.dashboardKey.trim() : '';
  const tab = typeof source.tab === 'string' ? source.tab.trim() : '';
  const name = typeof source.name === 'string' ? source.name : null;

  if (!dashboardKey || !tab || !isValidShareTab(dashboardKey, tab)) {
    return NextResponse.json(
      { error: `Invalid dashboard or tab. Allowed tabs for "${dashboardKey}": ${tab === ALL_TABS ? '' : 'see tab list'}` },
      { status: 400 },
    );
  }

  const record = await createPublishedDashboard({
    slug: generateShareSlug(),
    dashboardKey,
    tab,
    name,
    config: { scope: sanitizeScope(source.config) },
    createdBy: session.id ?? null,
  });

  if (!record) {
    return NextResponse.json({ error: 'Failed to publish dashboard' }, { status: 500 });
  }

  return NextResponse.json(record, { status: 201 });
}

// List the caller's active published links, optionally per dashboard.
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dashboardKey = request.nextUrl.searchParams.get('dashboardKey')?.trim() || undefined;
  const records = await listPublishedDashboards(session.id || '', dashboardKey);
  return NextResponse.json({ links: records });
}
