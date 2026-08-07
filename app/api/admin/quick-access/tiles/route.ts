import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/server/require-super-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth-utils';
import {
    validateTileContent,
    QA_SPANS,
    QA_DISPLAY_MODES,
    QA_WIZARD_CATEGORIES,
} from '@/lib/quick-access-server';
import {
    type QADisplayMode,
    type QASpan,
} from '@/lib/quick-access';

const MAX_STRING = 200;

function normalizeTileFields(body: Record<string, unknown>, isCreate: boolean): { updates: Record<string, unknown>; passwordAction?: 'set' | 'clear' | null } {
    const updates: Record<string, unknown> = {};
    let passwordAction: 'set' | 'clear' | null = null;

    if (typeof body.title === 'string') {
        const title = body.title.trim();
        if (!title || title.length > MAX_STRING) {
            throw Object.assign(new Error('title wajib diisi (maks 200 karakter)'), { status: 400 });
        }
        updates.title = title;
    }
    if (typeof body.description === 'string') {
        updates.description = body.description.trim().slice(0, MAX_STRING);
    }
    if (typeof body.icon === 'string' && body.icon.trim()) {
        updates.icon = body.icon.trim().slice(0, 60);
    }
    if (typeof body.color === 'string' && body.color.trim()) {
        updates.color = body.color.trim().slice(0, 60);
    }
    if (body.span !== undefined) {
        if (!QA_SPANS.includes(body.span as QASpan)) {
            throw Object.assign(new Error('span tidak valid'), { status: 400 });
        }
        updates.span = body.span;
    }
    if (body.display_mode !== undefined) {
        if (!QA_DISPLAY_MODES.includes(body.display_mode as QADisplayMode)) {
            throw Object.assign(new Error('display_mode tidak valid'), { status: 400 });
        }
        updates.display_mode = body.display_mode;
    }
    if (body.wizard_category !== undefined) {
        const wc = body.wizard_category === null ? null : String(body.wizard_category);
        if (wc !== null && !QA_WIZARD_CATEGORIES.includes(wc as (typeof QA_WIZARD_CATEGORIES)[number])) {
            throw Object.assign(new Error('wizard_category tidak valid'), { status: 400 });
        }
        updates.wizard_category = wc;
        // Wizard tiles open the report form — content is irrelevant.
        if (wc !== null) updates.content = {};
    }

    if (body.content !== undefined && updates.wizard_category === undefined) {
        const mode = (body.display_mode as QADisplayMode | undefined) ?? (updates.display_mode as QADisplayMode | undefined);
        if (!mode) {
            throw Object.assign(new Error('display_mode wajib diisi saat mengirim content'), { status: 400 });
        }
        updates.content = validateTileContent(mode, body.content);
    }
    if (typeof body.is_visible === 'boolean') {
        updates.is_visible = body.is_visible;
    }
    if (typeof body.is_maintenance === 'boolean') {
        updates.is_maintenance = body.is_maintenance;
    }
    if (body.gated_by !== undefined) {
        const gatedBy = body.gated_by === null ? null : String(body.gated_by);
        if (gatedBy !== null && gatedBy !== 'ai_enabled') {
            throw Object.assign(new Error('gated_by tidak valid'), { status: 400 });
        }
        updates.gated_by = gatedBy;
    }
    if (body.section_id !== undefined) {
        if (typeof body.section_id !== 'string' || !body.section_id.trim()) {
            throw Object.assign(new Error('section_id tidak valid'), { status: 400 });
        }
        updates.section_id = body.section_id;
    }
    if (typeof body.sort_order === 'number') {
        updates.sort_order = body.sort_order;
    }

    // Password semantics: `password` non-empty → set/rehash; `clearPassword` → remove.
    if (body.clearPassword === true || body.password === '') {
        passwordAction = 'clear';
    } else if (typeof body.password === 'string' && body.password.trim().length > 0) {
        if (body.password.trim().length < 4 || body.password.trim().length > 100) {
            throw Object.assign(new Error('Password minimal 4 dan maksimal 100 karakter'), { status: 400 });
        }
        passwordAction = 'set';
    }

    if (isCreate) {
        if (!updates.title) throw Object.assign(new Error('title wajib diisi'), { status: 400 });
        if (!updates.display_mode) updates.display_mode = 'links';
        if (!updates.span) updates.span = '1x1';
        if (!updates.section_id) throw Object.assign(new Error('section_id wajib diisi'), { status: 400 });
        if (updates.wizard_category) {
            updates.content = {};
        } else if (updates.content === undefined) {
            updates.content = { links: [{ label: updates.title, url: '#' }] };
        }
    }

    return { updates, passwordAction };
}

async function getNextSortOrder(sectionId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from('quick_access_tiles')
        .select('sort_order')
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: false })
        .limit(1);
    if (error) throw error;
    return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function POST(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { updates, passwordAction } = normalizeTileFields(body, true);

        const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : await getNextSortOrder(updates.section_id as string);
        const row: Record<string, unknown> = {
            ...updates,
            sort_order: sortOrder,
            is_password_protected: passwordAction === 'set',
        };
        if (passwordAction === 'set') {
            row.password_hash = await hashPassword(String(body.password).trim());
        }

        const { data, error } = await supabaseAdmin
            .from('quick_access_tiles')
            .insert(row)
            .select()
            .single();

        if (error) {
            console.error('[QUICK_ACCESS] tile create failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ tile: data });
    } catch (e) {
        const err = e as { status?: number; message: string };
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: err.status || 500 });
    }
}

export async function PATCH(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { updates, passwordAction } = normalizeTileFields(body, false);

        if (passwordAction === 'set') {
            updates.password_hash = await hashPassword(String(body.password).trim());
            updates.is_password_protected = true;
        } else if (passwordAction === 'clear') {
            updates.password_hash = null;
            updates.is_password_protected = false;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('quick_access_tiles')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();

        if (error) {
            console.error('[QUICK_ACCESS] tile update failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ tile: data });
    } catch (e) {
        const err = e as { status?: number; message: string };
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: err.status || 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await requireSuperAdmin();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('quick_access_tiles')
            .delete()
            .eq('id', body.id);

        if (error) {
            console.error('[QUICK_ACCESS] tile delete failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
