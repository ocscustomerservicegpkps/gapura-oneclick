import { getCalendarUserOptions, getInitialCalendarEvents } from '@/lib/server/calendar-events';
import { CalendarPageLoader } from '@/components/calendar/CalendarPageLoader';

export default async function OSCalendarPage() {
  const initialEvents = await getInitialCalendarEvents('event');
  const initialUsers = getCalendarUserOptions(initialEvents);

  return (
    <div>
      <CalendarPageLoader
        calendarType="event"
        title="Event Calendar"
        description="Shared schedule for events and coordination"
        canEdit={false}
        initialEvents={initialEvents}
        initialUsers={initialUsers}
      />
    </div>
  );
}
