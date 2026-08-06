import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth-utils';
import {
  getActivePublishedDashboard,
  revokePublishedDashboard,
  updatePublishedDashboard,
} from '@/lib/share/service';
import { sanitizeScope } from '@/lib/share/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function requireSession() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  return session;
}

// Public metadata for an active share link (no auth). Data itself is fetched
// server-side by the /share/[slug] page through lib/share/public-data.ts.
export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const record = await getActivePublishedDashboard(slug);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(record);
}

// Re-scope an existing link (owner only).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const record = await updatePublishedDashboard({
    slug,
    createdBy: session.id || '',
    name: source.name !== undefined ? String(source.name) : undefined,
    config: source.config !== undefined ? { scope: sanitizeScope(source.config) } : undefined,
  });

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(record);
}

// Revoke a link (owner only). Soft delete: public lookups stop resolving.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await context.params;
  const ok = await revokePublishedDashboard(slug, session.id || '');
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
