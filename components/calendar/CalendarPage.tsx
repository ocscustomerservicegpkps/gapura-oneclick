'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { CalendarHeader } from './CalendarHeader';
import { QuickEditPopover } from './QuickEditPopover';
import { EventModal } from './EventModal';
import { EventDetailModal } from './EventDetailModal';
import { CalendarEvent, CalendarType } from '@/types';
import { AlertCircle, RefreshCw } from 'lucide-react';

type CalendarView = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

// toISOString() converts to UTC first, so a local-midnight Date shifts back
// a day in any positive-UTC-offset timezone (e.g. all of Indonesia).
function toLocalDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

const Calendar = dynamic(() => import('./Calendar').then((mod) => mod.Calendar), {
  ssr: false,
  loading: () => (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--surface-3)] border-t-[var(--brand-primary)]" />
        <p className="text-sm text-[var(--text-muted)]">Loading calendar...</p>
      </div>
    </div>
  ),
});

interface CalendarPageProps {
  calendarType?: CalendarType;
  title?: string;
  description?: string;
  canEdit?: boolean;
  initialEvents?: CalendarEvent[];
  initialUsers?: Array<{ value: string; label: string }>;
}

export function CalendarPage({
  calendarType = 'event',
  title,
  description,
  canEdit = false,
  initialEvents = [],
  initialUsers = [],
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [loading, setLoading] = useState(initialEvents.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ value: string; label: string }>>(initialUsers);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('calendar_type', calendarType);
      if (searchQuery) params.set('search', searchQuery);
      if (userFilter) params.set('created_by', userFilter);

      let startDate: Date;
      let endDate: Date;

      if (currentView === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
      } else {
        const day = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - day - 7);
        endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + (6 - day) + 7);
      }

      params.set('start_date', toLocalDateInput(startDate));
      params.set('end_date', toLocalDateInput(endDate));

      const response = await fetch(`/api/calendar/events?${params}`, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();
        setEvents(data);

        const userMap = new Map<string, { value: string; label: string }>();
        data.forEach((event: CalendarEvent) => {
          if (!userMap.has(event.created_by)) {
            userMap.set(event.created_by, {
              value: event.created_by,
              label: event.created_by_name || 'Unknown',
            });
          }
        });
        setUsers(Array.from(userMap.values()));
      } else {
        setError('Gagal memuat data kalender. Silakan coba lagi.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error fetching events:', err);
      setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [calendarType, searchQuery, userFilter, currentDate, currentView]);

  useEffect(() => {
    fetchEvents();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchEvents]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const handleDetailEdit = () => {
    setDetailModalOpen(false);
    setEventModalMode('edit');
    setEventModalOpen(true);
  };

  const handleDetailQuickEdit = () => {
    setDetailModalOpen(false);
    setQuickEditOpen(true);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedSlot(slotInfo);
    setSelectedEvent(null);
    setEventModalMode('create');
    setEventModalOpen(true);
  };

  const handleAddEvent = () => {
    setSelectedSlot(null);
    setSelectedEvent(null);
    setEventModalMode('create');
    setEventModalOpen(true);
  };

  const handleEventDrop = async (eventId: string, newDate: string) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_date: newDate, edit_scope: 'single' }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update event');
      }

      await fetchEvents();
    } catch (error) {
      console.error('Error moving event:', error);
      throw error;
    }
  };

  const handleQuickSave = async (eventId: string, updates: Partial<CalendarEvent>) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, edit_scope: 'single' }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save changes');
      }

      await fetchEvents();
    } catch (error) {
      throw error;
    }
  };

  const handleQuickDelete = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}?scope=single`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete event');
      }

      await fetchEvents();
    } catch (error) {
      throw error;
    }
  };

  const handleMoreOptions = () => {
    if (selectedEvent) {
      setQuickEditOpen(false);
      setEventModalMode('edit');
      setEventModalOpen(true);
    }
  };

  const handleModalSave = async () => {
    await fetchEvents();
    setEventModalOpen(false);
  };

  const handleModalDelete = async (eventId: string) => {
    // handleQuickDelete issues the DELETE, refetches, and throws on failure
    // (EventModal catches the throw, keeps the modal open, and shows the error).
    await handleQuickDelete(eventId);
    setEventModalOpen(false);
  };

  const displayTitle = title || (calendarType === 'meeting' ? 'Kalender Rapat' : 'Kalender Kegiatan');
  const displayDescription = description || (calendarType === 'meeting'
    ? 'Jadwal dan manajemen rapat'
    : 'Jadwal bersama untuk kegiatan dan koordinasi');

  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="w-full max-w-none space-y-5 md:space-y-6 stagger-children">
        {}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-[var(--text-primary)]">
            {displayTitle}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base mt-1">
            {displayDescription}
          </p>
        </div>

        {}
        {error && (
          <div className="animate-fade-in-up flex items-center gap-3 p-4 rounded-xl bg-[oklch(0.6_0.22_25/0.08)] border border-[oklch(0.6_0.22_25/0.15)]" role="alert">
            <AlertCircle className="w-5 h-5 text-[oklch(0.55_0.2_25)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[oklch(0.45_0.18_25)]">{error}</p>
            </div>
            <button
              onClick={fetchEvents}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[oklch(0.45_0.18_25)] hover:bg-[oklch(0.6_0.22_25/0.08)] rounded-lg transition-colors"
              aria-label="Coba lagi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba lagi
            </button>
          </div>
        )}

        {}
        <section className="animate-fade-in-up w-full rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)] p-4 shadow-sm md:p-6">
          <CalendarHeader
            currentDate={currentDate}
            currentView={currentView}
            onDateChange={setCurrentDate}
            onViewChange={setCurrentView}
            onSearchChange={setSearchQuery}
            onUserFilterChange={setUserFilter}
            onAddEvent={canEdit ? handleAddEvent : () => {}}
            users={users}
            canEdit={canEdit}
            userFilterValue={userFilter}
          />

          <div className="mt-5 md:mt-6">
            <Calendar
              events={events}
              currentDate={currentDate}
              currentView={currentView}
              onDateChange={setCurrentDate}
              onViewChange={setCurrentView}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={canEdit ? handleSelectSlot : undefined}
              onEventDrop={canEdit ? handleEventDrop : undefined}
              loading={loading}
            />
          </div>
        </section>
      </div>

      {}
      {selectedEvent && (
        <QuickEditPopover
          event={selectedEvent}
          open={quickEditOpen}
          onClose={() => setQuickEditOpen(false)}
          onSave={handleQuickSave}
          onDelete={handleQuickDelete}
          onMoreOptions={handleMoreOptions}
        />
      )}

      <EventDetailModal
        event={selectedEvent}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onEdit={canEdit ? handleDetailEdit : undefined}
        onQuickEdit={canEdit ? handleDetailQuickEdit : undefined}
      />

      <EventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        event={eventModalMode === 'edit' ? selectedEvent : null}
        defaultDate={selectedSlot?.start}
        calendarType={calendarType}
      />
    </div>
  );
}
