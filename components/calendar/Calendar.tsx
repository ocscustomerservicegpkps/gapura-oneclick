'use client';

import React, { useMemo, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format } from 'date-fns';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import { CalendarEvent } from '@/types';
import { formatEventForCalendar } from '@/lib/utils/calendar-utils';
import { FileText, Repeat, CalendarDays } from 'lucide-react';
import './calendar-styles.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEventItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEvent;
}

const EventComponent = React.memo(({ event }: { event: CalendarEventItem }) => {
  const calEvent = event.resource;
  return (
    <div className="flex items-center gap-1 overflow-hidden" title={event.title}>
      <span className="truncate flex-1 text-[0.6875rem] leading-tight">{event.title}</span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {calEvent.is_recurring && (
          <Repeat className="w-3 h-3 text-[var(--text-on-brand)] opacity-70" />
        )}
        {calEvent.meeting_minutes_link && (
          <FileText className="w-3 h-3 text-[var(--text-on-brand)] opacity-70" />
        )}
      </div>
    </div>
  );
});

EventComponent.displayName = 'CalendarEventComponent';

interface CalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  currentView: View;
  onDateChange: (date: Date) => void;
  onViewChange: (view: View) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  onEventDrop?: (eventId: string, newDate: string) => Promise<void>;
  loading?: boolean;
}

export function Calendar({
  events,
  currentDate,
  currentView,
  onDateChange,
  onViewChange,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  loading,
}: CalendarProps) {
  const calendarEvents = useMemo(() => {
    return events.map(formatEventForCalendar);
  }, [events]);

  const handleEventDrop = useCallback(
    async ({ event, start }: { event: CalendarEventItem; start: Date }) => {
      if (!onEventDrop) return;
      const newDate = format(start, 'yyyy-MM-dd');
      await onEventDrop(event.resource.id, newDate);
    },
    [onEventDrop]
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEventItem) => {
      onSelectEvent(event.resource);
    },
    [onSelectEvent]
  );

  if (loading) {
    return (
      <div className="h-[37.5rem] flex items-center justify-center" role="status" aria-label="Loading calendar">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[var(--surface-4)] border-t-[var(--brand-primary)] animate-spin" />
            <CalendarDays className="w-5 h-5 text-[var(--text-muted)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm font-medium">Loading calendar...</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">Fetching event data</p>
          </div>
        </div>
      </div>
    );
  }

  const messages = {
    today: 'Today',
    previous: 'Previous',
    next: 'Next',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Agenda',
    date: 'Date',
    time: 'Time',
    event: 'Event',
    noEventsInRange: 'No events in this range.',
    showMore: (total: number) => `+${total} more`,
  };

  return (
    <div className="calendar-container">
      <BigCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        views={['month', 'week', 'day', 'agenda']}
        view={currentView}
        date={currentDate}
        onNavigate={onDateChange}
        onView={onViewChange}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={onSelectSlot}
        onEventDrop={onEventDrop ? handleEventDrop : undefined}
        selectable={!!onSelectSlot}
        popup
        draggableAccessor={() => !!onEventDrop}
        resizable={!!onEventDrop}
        components={{
          event: EventComponent,
        }}
        style={{ height: '100%', minHeight: '37.5rem' }}
        step={30}
        timeslots={2}
        min={new Date(0, 0, 0, 0, 0, 0)}
        max={new Date(0, 0, 0, 23, 59, 59)}
        messages={messages}
        rtl={false}
        dayLayoutAlgorithm="no-overlap"
      />
    </div>
  );
}
