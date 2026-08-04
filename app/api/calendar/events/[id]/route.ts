
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CalendarEvent, UpdateCalendarEventInput } from '@/types';
import { isValidUrl } from '@/lib/utils/calendar-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySession(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const role = String(payload.role).trim().toUpperCase();
    const division = String(payload.division || '').trim().toUpperCase();
    if (role !== 'DIVISI_OCS' && !(role === 'ANALYST' && division === 'OCS')) {
      return NextResponse.json(
        { error: 'Forbidden: Access limited to DIVISI_OCS and OCS analysts' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .select(`
        *,
        users:created_by (
          full_name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      console.error('[CALENDAR_API] Error fetching event:', error);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event: CalendarEvent = {
      id: data.id,
      title: data.title,
      event_date: data.event_date,
      event_end_date: data.event_end_date || null,
      event_time: data.event_time,
      notes: data.notes,
      meeting_minutes_link: data.meeting_minutes_link,
      calendar_type: data.calendar_type || 'event',
      is_recurring: data.is_recurring,
      recurrence_pattern: data.recurrence_pattern,
      recurrence_end_date: data.recurrence_end_date,
      parent_event_id: data.parent_event_id,
      created_by: data.created_by,
      created_by_name: data.users?.full_name || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };

    return NextResponse.json(event, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('[CALENDAR_API] Error in GET /api/calendar/events/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar event' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySession(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const role = String(payload.role).trim().toUpperCase();
    const division = String(payload.division || '').trim().toUpperCase();
    if (role !== 'DIVISI_OCS' && !(role === 'ANALYST' && division === 'OCS')) {
      return NextResponse.json(
        { error: 'Forbidden: Access limited to DIVISI_OCS and OCS analysts' },
        { status: 403 }
      );
    }
    if (role !== 'ANALYST') {
      return NextResponse.json(
        { error: 'Forbidden: Only ANALYST role can update events' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const body: UpdateCalendarEventInput = await request.json();
    const edit_scope = body.edit_scope || 'single';

    if (body.title && body.title.length > 200) {
      return NextResponse.json(
        { error: 'Title must not exceed 200 characters' },
        { status: 400 }
      );
    }

    if (body.notes && body.notes.length > 2000) {
      return NextResponse.json(
        { error: 'Notes must not exceed 2000 characters' },
        { status: 400 }
      );
    }

    if (body.meeting_minutes_link && !isValidUrl(body.meeting_minutes_link)) {
      return NextResponse.json(
        { error: 'Invalid URL format for meeting_minutes_link' },
        { status: 400 }
      );
    }

    const { data: currentEvent, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('id, is_recurring, parent_event_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentEvent) {
      console.error('[CALENDAR_API] Error fetching current event:', fetchError);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {};
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.event_date !== undefined) updatePayload.event_date = body.event_date;
    if (body.event_end_date !== undefined) updatePayload.event_end_date = body.event_end_date;
    if (body.event_time !== undefined) updatePayload.event_time = body.event_time;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.meeting_minutes_link !== undefined) updatePayload.meeting_minutes_link = body.meeting_minutes_link;

    if (updatePayload.event_end_date && updatePayload.event_date && updatePayload.event_end_date < updatePayload.event_date) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
    }

    updatePayload.updated_at = new Date().toISOString();

    if (edit_scope === 'all') {

      if (currentEvent.parent_event_id) {

        const { error: parentError } = await supabaseAdmin
          .from('calendar_events')
          .update(updatePayload)
          .eq('id', currentEvent.parent_event_id)
          .is('deleted_at', null);

        if (parentError) {
          console.error('[CALENDAR_API] Error updating parent event:', parentError);
          return NextResponse.json(
            { error: 'Failed to update parent event' },
            { status: 500 }
          );
        }

        const { error: siblingsError } = await supabaseAdmin
          .from('calendar_events')
          .update(updatePayload)
          .eq('parent_event_id', currentEvent.parent_event_id)
          .is('deleted_at', null);

        if (siblingsError) {
          console.error('[CALENDAR_API] Error updating sibling events:', siblingsError);
          return NextResponse.json(
            { error: 'Failed to update all recurring events' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, updated: 'all' });
      }

      if (currentEvent.is_recurring) {

        const { error: parentError } = await supabaseAdmin
          .from('calendar_events')
          .update(updatePayload)
          .eq('id', id)
          .is('deleted_at', null);

        if (parentError) {
          console.error('[CALENDAR_API] Error updating parent event:', parentError);
          return NextResponse.json(
            { error: 'Failed to update parent event' },
            { status: 500 }
          );
        }

        const { error: childrenError } = await supabaseAdmin
          .from('calendar_events')
          .update(updatePayload)
          .eq('parent_event_id', id)
          .is('deleted_at', null);

        if (childrenError) {
          console.error('[CALENDAR_API] Error updating child events:', childrenError);
          return NextResponse.json(
            { error: 'Failed to update all recurring events' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, updated: 'all' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select(`
        *,
        users:created_by (
          full_name
        )
      `)
      .single();

    if (error || !data) {
      console.error('[CALENDAR_API] Error updating event:', error);
      return NextResponse.json(
        { error: 'Failed to update calendar event' },
        { status: 500 }
      );
    }

    const event: CalendarEvent = {
      id: data.id,
      title: data.title,
      event_date: data.event_date,
      event_end_date: data.event_end_date || null,
      event_time: data.event_time,
      notes: data.notes,
      meeting_minutes_link: data.meeting_minutes_link,
      calendar_type: data.calendar_type || 'event',
      is_recurring: data.is_recurring,
      recurrence_pattern: data.recurrence_pattern,
      recurrence_end_date: data.recurrence_end_date,
      parent_event_id: data.parent_event_id,
      created_by: data.created_by,
      created_by_name: data.users?.full_name || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };

    return NextResponse.json(event);
  } catch (error) {
    console.error('[CALENDAR_API] Error in PATCH /api/calendar/events/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySession(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const role = String(payload.role).trim().toUpperCase();
    const division = String(payload.division || '').trim().toUpperCase();
    if (role !== 'DIVISI_OCS' && !(role === 'ANALYST' && division === 'OCS')) {
      return NextResponse.json(
        { error: 'Forbidden: Access limited to DIVISI_OCS and OCS analysts' },
        { status: 403 }
      );
    }
    if (role !== 'ANALYST') {
      return NextResponse.json(
        { error: 'Forbidden: Only ANALYST role can delete events' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'single';

    const { data: currentEvent, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('id, is_recurring, parent_event_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentEvent) {
      console.error('[CALENDAR_API] Error fetching current event:', fetchError);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const deletePayload = {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (scope === 'all') {

      if (currentEvent.parent_event_id) {

        const { error: parentError } = await supabaseAdmin
          .from('calendar_events')
          .update(deletePayload)
          .eq('id', currentEvent.parent_event_id)
          .is('deleted_at', null);

        if (parentError) {
          console.error('[CALENDAR_API] Error deleting parent event:', parentError);
          return NextResponse.json(
            { error: 'Failed to delete parent event' },
            { status: 500 }
          );
        }

        const { error: siblingsError } = await supabaseAdmin
          .from('calendar_events')
          .update(deletePayload)
          .eq('parent_event_id', currentEvent.parent_event_id)
          .is('deleted_at', null);

        if (siblingsError) {
          console.error('[CALENDAR_API] Error deleting sibling events:', siblingsError);
          return NextResponse.json(
            { error: 'Failed to delete all recurring events' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, deleted: 'all' });
      }

      if (currentEvent.is_recurring) {

        const { error: parentError } = await supabaseAdmin
          .from('calendar_events')
          .update(deletePayload)
          .eq('id', id)
          .is('deleted_at', null);

        if (parentError) {
          console.error('[CALENDAR_API] Error deleting parent event:', parentError);
          return NextResponse.json(
            { error: 'Failed to delete parent event' },
            { status: 500 }
          );
        }

        const { error: childrenError } = await supabaseAdmin
          .from('calendar_events')
          .update(deletePayload)
          .eq('parent_event_id', id)
          .is('deleted_at', null);

        if (childrenError) {
          console.error('[CALENDAR_API] Error deleting child events:', childrenError);
          return NextResponse.json(
            { error: 'Failed to delete all recurring events' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, deleted: 'all' });
      }
    }

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .update(deletePayload)
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      console.error('[CALENDAR_API] Error deleting event:', error);
      return NextResponse.json(
        { error: 'Failed to delete calendar event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: 'single' });
  } catch (error) {
    console.error('[CALENDAR_API] Error in DELETE /api/calendar/events/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar event' },
      { status: 500 }
    );
  }
}
