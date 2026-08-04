import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canManagePerformanceLinks, getWorkspaceUser } from '@/lib/server/workspace-auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!canManagePerformanceLinks(user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;
        const body = await request.json();

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) {
            const title = String(body.title).trim();
            if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            updates.title = title;
        }
        if (body.url !== undefined) {
            const url = String(body.url).trim();
            if (!url || !/^https?:\/\//i.test(url)) {
                return NextResponse.json({ error: 'A valid URL (starting with http:// or https://) is required' }, { status: 400 });
            }
            updates.url = url;
        }
        if (body.description !== undefined) {
            updates.description = body.description ? String(body.description).trim() : null;
        }
        if (body.thumbnail_url !== undefined) {
            updates.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url).trim() : null;
        }
        if (body.category !== undefined) {
            updates.category = body.category === 'joumpa' ? 'joumpa' : 'ground-handling';
        }

        const { data, error } = await supabaseAdmin
            .from('performance_links')
            .update(updates)
            .eq('id', id)
            .eq('is_active', true)
            .select(`*, created_by_user:created_by ( full_name )`)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Link not found' }, { status: 404 });
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Performance Links API] Failed to update link:', error);
        return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!canManagePerformanceLinks(user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;
        const { error } = await supabaseAdmin
            .from('performance_links')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Performance Links API] Failed to delete link:', error);
        return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
}
