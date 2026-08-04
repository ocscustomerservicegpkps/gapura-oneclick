import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getSessionPayload() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    return verifySession(token);
}

export async function GET(req: Request) {
    const payload = await getSessionPayload();

    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role || '').trim().toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'ANALYST') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity');

    let query = supabaseAdmin
        .from('notification_recipients')
        .select('*')
        .order('created_at', { ascending: false });

    if (entity) {
        query = query.eq('entity', entity);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const payload = await getSessionPayload();

    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role || '').trim().toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'ANALYST') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { email, entity = 'REPORT_NEW_RECORD', channel = 'EMAIL' } = await req.json();

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
        }

        const { data: existing } = await supabaseAdmin
            .from('notification_recipients')
            .select('id')
            .eq('entity', entity)
            .eq('recipient_email', email)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Email sudah terdaftar untuk entity ini' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('notification_recipients')
            .insert({
                entity,
                recipient_email: email,
                enabled: true,
                channel
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function PATCH(req: Request) {
    const payload = await getSessionPayload();

    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role || '').trim().toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'ANALYST') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, enabled } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('notification_recipients')
            .update({ enabled, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function DELETE(req: Request) {
    const payload = await getSessionPayload();

    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role || '').trim().toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'ANALYST') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('notification_recipients')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
