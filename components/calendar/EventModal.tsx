'use client';

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2, FileText, Repeat, CalendarRange, AlertTriangle, Plus, Save } from 'lucide-react';
import { CalendarEvent, CreateCalendarEventInput, RecurrencePattern, CalendarType } from '@/types';
import { PrismInput } from '@/components/ui/PrismInput';
import { PrismButton } from '@/components/ui/PrismButton';
import { PrismSelect } from '@/components/ui/PrismSelect';

// toISOString() converts to UTC first, so a local-midnight Date shifts back
// a day in any positive-UTC-offset timezone (e.g. all of Indonesia).
function toLocalDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  event: CalendarEvent | null;
  defaultDate?: Date;
  calendarType?: CalendarType;
}

export function EventModal({
  open,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
  calendarType = 'event',
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [notes, setNotes] = useState('');
  const [meetingMinutesLink, setMeetingMinutesLink] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [editScope, setEditScope] = useState<'single' | 'all'>('single');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [eventEndDate, setEventEndDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setEventDate(event.event_date);
        setEventTime(event.event_time || '');
        setNotes(event.notes || '');
        setMeetingMinutesLink(event.meeting_minutes_link || '');
        setIsRecurring(event.is_recurring);
        setRecurrencePattern(event.recurrence_pattern || 'weekly');
        setRecurrenceEndDate(event.recurrence_end_date || '');
        setIsMultiDay(!!event.event_end_date && event.event_end_date !== event.event_date);
        setEventEndDate(event.event_end_date || '');
      } else {
        setTitle('');
        setEventDate(defaultDate ? toLocalDateInput(defaultDate) : '');
        setEventTime('');
        setNotes('');
        setMeetingMinutesLink('');
        setIsRecurring(false);
        setRecurrencePattern('weekly');
        setRecurrenceEndDate('');
        setIsMultiDay(false);
        setEventEndDate('');
      }
      setError('');
      setEditScope('single');
      setShowDeleteConfirm(false);
    }
  }, [open, event, defaultDate]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => titleRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSave = async () => {
    if (!title.trim() || !eventDate) {
      setError('Judul dan tanggal wajib diisi');
      return;
    }

    if (isMultiDay && eventEndDate && eventEndDate < eventDate) {
      setError('Tanggal selesai harus sama dengan atau setelah tanggal mulai');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload: CreateCalendarEventInput = {
        title: title.trim(),
        event_date: eventDate,
        event_end_date: isMultiDay && eventEndDate ? eventEndDate : null,
        event_time: eventTime || null,
        notes: notes || null,
        meeting_minutes_link: meetingMinutesLink || null,
        calendar_type: calendarType,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        recurrence_end_date: isRecurring ? recurrenceEndDate : null,
      };

      let response: Response;

      if (event) {
        response = await fetch(`/api/calendar/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, edit_scope: editScope }),
        });
      } else {
        response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        let message = 'Gagal menyimpan kegiatan';
        try {
          const err = await response.json();
          if (err && typeof err.error === 'string' && err.error) {
            message = err.error;
          }
        } catch {
          // Response body wasn't valid JSON — keep the fallback message.
        }
        throw new Error(message);
      }

      await onSave();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan kegiatan';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    try {
      setSaving(true);
      await onDelete(event.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus kegiatan';
      setError(message);
      setSaving(false);
    }
  };

  const typeLabel = calendarType === 'meeting' ? 'Rapat' : 'Kegiatan';

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-[51] grid place-items-center p-4">
          <Dialog.Content
            className="relative flex max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[oklch(0.92_0.01_90/0.8)] bg-[var(--surface-1)] shadow-[var(--shadow-spatial-lg)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            aria-describedby={undefined}
          >
            {}
            <div className="flex shrink-0 items-center justify-between border-b border-[oklch(0.94_0.01_90/0.6)] p-4">
              <Dialog.Title className="text-lg font-bold font-display tracking-tight text-[var(--text-primary)]">
                {event ? `Edit ${typeLabel}` : `Buat ${typeLabel}`}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </Dialog.Close>
            </div>

          {}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {}
            <div>
              <label htmlFor="event-title" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Judul <span className="text-[oklch(0.6_0.22_25)]">*</span>
              </label>
              <PrismInput
                id="event-title"
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Nama ${typeLabel.toLowerCase()}`}
                maxLength={200}
              />
            </div>

            {}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  {isMultiDay ? 'Tanggal Mulai' : 'Tanggal'} <span className="text-[oklch(0.6_0.22_25)]">*</span>
                </label>
                <PrismInput
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              {isMultiDay ? (
                <div>
                  <label htmlFor="event-end-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Tanggal Selesai <span className="text-[oklch(0.6_0.22_25)]">*</span>
                  </label>
                  <PrismInput
                    id="event-end-date"
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    min={eventDate}
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="event-time" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Waktu
                  </label>
                  <PrismInput
                    id="event-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    placeholder="HH:MM"
                  />
                </div>
              )}
            </div>

            {}
            <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer group select-none">
              <span className="relative w-5 h-5 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={isMultiDay}
                  onChange={(e) => {
                    setIsMultiDay(e.target.checked);
                    if (!e.target.checked) setEventEndDate('');
                  }}
                  className="w-5 h-5 rounded-md border-2 border-[oklch(0.85_0.02_90)] bg-[var(--surface-3)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)] appearance-none transition-all duration-[var(--duration-fast)] cursor-pointer"
                />
                {isMultiDay && (
                  <svg className="absolute w-3 h-3 text-[var(--text-on-brand)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <CalendarRange className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="group-hover:text-[var(--text-primary)] transition-colors">Kegiatan Multi-hari</span>
            </label>

            {}
            {calendarType === 'meeting' && (
              <div>
                <label htmlFor="event-minutes" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  <FileText className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Link Notulensi
                </label>
                <PrismInput
                  id="event-minutes"
                  type="url"
                  value={meetingMinutesLink}
                  onChange={(e) => setMeetingMinutesLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {}
            <div>
              <label htmlFor="event-notes" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Catatan
              </label>
              <textarea
                id="event-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2.5 bg-[var(--surface-3)] border-2 border-transparent rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-0 focus:outline-none resize-none transition-all duration-[var(--duration-fast)] text-sm"
              />
            </div>

            {}
            <div className="space-y-3 pt-3 border-t border-[oklch(0.94_0.01_90/0.6)]">
              <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer group select-none">
                <span className="relative w-5 h-5 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 rounded-md border-2 border-[oklch(0.85_0.02_90)] bg-[var(--surface-3)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)] appearance-none transition-all duration-[var(--duration-fast)] cursor-pointer"
                  />
                  {isRecurring && (
                    <svg className="absolute w-3 h-3 text-[var(--text-on-brand)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <Repeat className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="group-hover:text-[var(--text-primary)] transition-colors">Kegiatan Berulang</span>
              </label>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-3 pl-8 animate-fade-in-up">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Pola Perulangan</label>
                    <PrismSelect
                      options={[
                        { value: 'daily', label: 'Harian' },
                        { value: 'weekly', label: 'Mingguan' },
                        { value: 'monthly', label: 'Bulanan' },
                      ]}
                      value={recurrencePattern}
                      onChange={(value) => setRecurrencePattern(value as RecurrencePattern)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Tanggal Selesai</label>
                    <PrismInput
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {}
            {event && (event.is_recurring || event.parent_event_id) && (
              <fieldset className="space-y-2.5 pt-3 border-t border-[oklch(0.94_0.01_90/0.6)]">
                <legend className="text-sm font-medium text-[var(--text-secondary)]">Cakupan Edit</legend>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer group select-none">
                    <input
                      type="radio"
                      name="editScope"
                      value="single"
                      checked={editScope === 'single'}
                      onChange={() => setEditScope('single')}
                      className="w-4 h-4 border-[oklch(0.85_0.02_90)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-2"
                    />
                    <span className="group-hover:text-[var(--text-primary)] transition-colors">Hanya kegiatan ini</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer group select-none">
                    <input
                      type="radio"
                      name="editScope"
                      value="all"
                      checked={editScope === 'all'}
                      onChange={() => setEditScope('all')}
                      className="w-4 h-4 border-[oklch(0.85_0.02_90)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-2"
                    />
                    <span className="group-hover:text-[var(--text-primary)] transition-colors">Semua kegiatan berulang</span>
                  </label>
                </div>
              </fieldset>
            )}

            {}
            {error && (
              <div className="flex items-start gap-2 text-xs text-[oklch(0.55_0.2_25)] bg-[oklch(0.6_0.22_25/0.08)] px-3 py-2.5 rounded-xl" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {}
          <div className="flex shrink-0 items-center justify-between border-t border-[oklch(0.94_0.01_90/0.6)] bg-[var(--surface-1)] p-4 shadow-[0_-12px_28px_oklch(0.82_0.03_90/0.16)]">
            {event ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">Hapus?</span>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold text-[oklch(0.55_0.2_25)] bg-[oklch(0.6_0.22_25/0.1)] hover:bg-[oklch(0.6_0.22_25/0.15)] rounded-lg transition-colors"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm text-[oklch(0.55_0.2_25)] hover:bg-[oklch(0.6_0.22_25/0.08)] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Dialog.Close asChild>
                <PrismButton variant="secondary" onClick={onClose} size="sm">
                  Batal
                </PrismButton>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !eventDate}
                className="inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  'Menyimpan...'
                ) : event ? (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Buat {typeLabel}
                  </>
                )}
              </button>
            </div>
          </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
