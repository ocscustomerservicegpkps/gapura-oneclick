import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWorkspaceUser, normalizeRole } from '@/lib/server/workspace-auth';

function canManage(role: string | null | undefined, division: string | null | undefined): boolean {
    const r = normalizeRole(role);
    return r === 'SUPER_ADMIN' || (r === 'ANALYST' && division === 'OCS');
}

export async function GET() {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin
        .from('ocs_quick_links')
        .select('*')
        .order('sort_order')
        .order('created_at');
    if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json().catch(() => null);
    const { label, url, color, icon } = body ?? {};
    if (!label?.trim() || !url?.trim()) return NextResponse.json({ error: 'Missing label or url' }, { status: 400 });
    if (!/^https?:\/\//i.test(url.trim())) {
        return NextResponse.json({ error: 'A valid URL (starting with http:// or https://) is required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
        .from('ocs_quick_links')
        .insert({ label: label.trim(), url: url.trim(), color: color ?? 'emerald', icon: icon ?? 'link', created_by: user.id })
        .select()
        .single();
    if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json().catch(() => null);
    const { id, label, url, color, icon } = body ?? {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch: Record<string, string> = {};
    if (label !== undefined) patch.label = String(label).trim();
    if (url !== undefined) {
        const trimmedUrl = String(url).trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
            return NextResponse.json({ error: 'A valid URL (starting with http:// or https://) is required' }, { status: 400 });
        }
        patch.url = trimmedUrl;
    }
    if (color !== undefined) patch.color = String(color);
    if (icon !== undefined) patch.icon = String(icon);
    const { data, error } = await supabaseAdmin
        .from('ocs_quick_links')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(request: Request) {
    const user = await getWorkspaceUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user.role, user.division)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabaseAdmin.from('ocs_quick_links').delete().eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ ok: true });
}
