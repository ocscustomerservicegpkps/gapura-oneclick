import 'server-only';

import { getWorkspaceUser } from '@/lib/server/workspace-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CalendarEvent } from '@/types';
import { wibYearMonth } from '@/lib/utils/wib-date';

interface CalendarEventRow {
  id: string;
  title: string;
  event_date: string;
  event_end_date?: string | null;
  event_time?: string | null;
  notes?: string | null;
  meeting_minutes_link?: string | null;
  calendar_type?: 'event' | 'meeting' | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_end_date?: string | null;
  parent_event_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  users?: { full_name?: string | null } | null;
}

function getDefaultCalendarRange(currentDate = new Date()) {
  // Anchor the range on the WIB calendar month, not the host process's local/UTC month,
  // then build the boundary dates directly in UTC so no further timezone shift is applied.
  const { year, month } = wibYearMonth(currentDate);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month + 2, 0));

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}

export async function getInitialCalendarEvents(calendarType: 'event' | 'meeting' = 'event') {
  const user = await getWorkspaceUser();
  const role = String(user?.role || '').trim().toUpperCase();
  const division = String(user?.division || '').trim().toUpperCase();
  if (!user || (role !== 'DIVISI_OCS' && !(role === 'ANALYST' && division === 'OCS'))) {
    return [];
  }

  const { start, end } = getDefaultCalendarRange();
  let query = supabaseAdmin
    .from('calendar_events')
    .select(`
      *,
      users:created_by (
        full_name
      )
    `)
    .is('deleted_at', null)
    .eq('calendar_type', calendarType)
    .lte('event_date', end)
    .order('event_date', { ascending: true });

  query = query.or(`event_end_date.gte.${start},event_end_date.is.null`);
  query = query.gte('event_date', start).or(`event_end_date.gte.${start}`);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    console.error('[calendar-events] Failed to preload events:', error);
    return [];
  }

  return (data as CalendarEventRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    event_date: row.event_date,
    event_end_date: row.event_end_date || null,
    event_time: row.event_time,
    notes: row.notes,
    meeting_minutes_link: row.meeting_minutes_link,
    calendar_type: row.calendar_type || 'event',
    is_recurring: row.is_recurring,
    recurrence_pattern: row.recurrence_pattern,
    recurrence_end_date: row.recurrence_end_date,
    parent_event_id: row.parent_event_id,
    created_by: row.created_by,
    created_by_name: row.users?.full_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  })) as CalendarEvent[];
}

export function getCalendarUserOptions(events: CalendarEvent[]) {
  const userMap = new Map<string, { value: string; label: string }>();

  events.forEach((event) => {
    if (!userMap.has(event.created_by)) {
      userMap.set(event.created_by, {
        value: event.created_by,
        label: event.created_by_name || 'Unknown',
      });
    }
  });

  return Array.from(userMap.values());
}
