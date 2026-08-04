'use client';

import dynamic from 'next/dynamic';
import type { CalendarEvent, CalendarType } from '@/types';

const CalendarPage = dynamic(
  () => import('@/components/calendar/CalendarPage').then((mod) => mod.CalendarPage),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--surface-3)] border-t-[var(--brand-primary)]" />
          <p className="text-sm text-[var(--text-muted)]">Loading calendar...</p>
        </div>
      </div>
    ),
  },
);

interface CalendarPageLoaderProps {
  calendarType: CalendarType;
  title: string;
  description: string;
  canEdit: boolean;
  initialEvents: CalendarEvent[];
  initialUsers: Array<{ value: string; label: string }>;
}

export function CalendarPageLoader(props: CalendarPageLoaderProps) {
  return <CalendarPage {...props} />;
}
