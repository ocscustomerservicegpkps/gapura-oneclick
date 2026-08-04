import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_EXTERNAL_LINKS, type ExternalLinkEntry } from '@/lib/external-links';
import { getDefaultLinksArray } from '@/lib/external-links-server';

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload || payload.role !== 'SUPER_ADMIN') return null;
  return payload;
}

export async function GET() {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('external_links')
      .select('*')
      .order('category, sort_order');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const merged: Record<string, ExternalLinkEntry> = { ...DEFAULT_EXTERNAL_LINKS };
    for (const row of data || []) {
      merged[row.id] = {
        id: row.id,
        label: row.label,
        url: row.url,
        category: row.category,
        description: row.description || '',
      };
    }

    return NextResponse.json({ links: Object.values(merged) });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch external links' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const links: ExternalLinkEntry[] = body.links;

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'links array is required' }, { status: 400 });
    }

    for (const link of links) {
      if (!link.id || !link.label || !link.url || !link.category) {
        return NextResponse.json(
          { error: `Invalid link entry: id, label, url, and category are required. Got: ${JSON.stringify(link)}` },
          { status: 400 }
        );
      }
    }

    const rows = links.map((l) => ({
      id: l.id,
      label: l.label,
      url: l.url,
      category: l.category,
      description: l.description || '',
    }));

    const { data, error } = await supabaseAdmin
      .from('external_links')
      .upsert(rows, { onConflict: 'id' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update external links' }, { status: 500 });
  }
}

export async function POST() {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const defaults = getDefaultLinksArray();

    const rows = defaults.map((l) => ({
      id: l.id,
      label: l.label,
      url: l.url,
      category: l.category,
      description: l.description,
    }));

    const { data, error } = await supabaseAdmin
      .from('external_links')
      .upsert(rows, { onConflict: 'id' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ seeded: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: 'Failed to seed external links' }, { status: 500 });
  }
}
