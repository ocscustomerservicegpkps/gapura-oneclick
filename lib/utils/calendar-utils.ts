
import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { set } from 'date-fns/set';
import { CalendarEvent } from '@/types';

export function isValidUrl(url: string): boolean {

  if (!url || url.trim() === '') {
    return true;
  }

  try {
    const urlObject = new URL(url);
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatEventForCalendar(event: CalendarEvent): {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEvent;
} {
  let startDate = parseISO(event.event_date);
  const isMultiDay = !!event.event_end_date && event.event_end_date !== event.event_date;

  if (event.event_time && !isMultiDay) {
    const [hours, minutes] = event.event_time.split(':').map(Number);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      startDate = set(startDate, { hours, minutes, seconds: 0, milliseconds: 0 });
    }
  }

  let endDate = startDate;
  if (isMultiDay) {
    endDate = addDays(parseISO(event.event_end_date!), 1);
  }

  return {
    id: event.id,
    title: event.title,
    start: startDate,
    end: endDate,
    allDay: isMultiDay || !event.event_time,
    resource: event,
  };
}

