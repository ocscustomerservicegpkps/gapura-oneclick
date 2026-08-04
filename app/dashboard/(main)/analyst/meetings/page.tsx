'use client';

import { useAuth } from '@/lib/hooks';
import dynamic from 'next/dynamic';

const CalendarPage = dynamic(
  () => import('@/components/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })),
  { ssr: false, loading: () => <div className="h-96 animate-pulse bg-gray-100 rounded-xl" /> }
);

export default function AnalystMeetingCalendarPage() {
  const { user } = useAuth();
  const role = user?.role as string;
  const canEdit = role?.toUpperCase() === 'ANALYST';

  return (
    <CalendarPage
      calendarType="meeting"
      title="Meeting Calendar"
      description="Shared schedule for analyst and OS meetings"
      canEdit={canEdit}
    />
  );
}
