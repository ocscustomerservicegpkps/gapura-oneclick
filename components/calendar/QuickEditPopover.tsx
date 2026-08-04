'use client';

import { useState, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarEvent } from '@/types';
import { PrismInput } from '@/components/ui/PrismInput';
import { PrismButton } from '@/components/ui/PrismButton';
import { Check, X, Trash2, MoreHorizontal, AlertTriangle } from 'lucide-react';

interface QuickEditPopoverProps {
  event: CalendarEvent;
  open: boolean;
  onClose: () => void;
  onSave: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onMoreOptions: () => void;
}

export function QuickEditPopover({
  event,
  open,
  onClose,
  onSave,
  onDelete,
  onMoreOptions,
}: QuickEditPopoverProps) {
  const [title, setTitle] = useState(event.title);
  const [eventDate, setEventDate] = useState(event.event_date);
  const [eventTime, setEventTime] = useState(event.event_time || '');
  const [meetingMinutesLink, setMeetingMinutesLink] = useState(event.meeting_minutes_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(event.title);
      setEventDate(event.event_date);
      setEventTime(event.event_time || '');
      setMeetingMinutesLink(event.meeting_minutes_link || '');
      setError('');
      setShowDeleteConfirm(false);
    }
  }, [event, open]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const updates: Partial<CalendarEvent> = {};

      if (title !== event.title) updates.title = title;
      if (eventDate !== event.event_date) updates.event_date = eventDate;
      if (eventTime !== (event.event_time || '')) updates.event_time = eventTime || null;
      if (meetingMinutesLink !== (event.meeting_minutes_link || '')) {
        updates.meeting_minutes_link = meetingMinutesLink || null;
      }

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await onSave(event.id, updates);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await onDelete(event.id);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          className="z-50 w-80 max-w-[90vw] rounded-xl border border-[oklch(0.92_0.01_90/0.8)] bg-[oklch(0.99_0.005_90/0.95)] backdrop-blur-[24px] shadow-[var(--shadow-spatial-lg)] animate-scale-in focus:outline-none"
          onKeyDown={handleKeyDown}
        >
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Judul</label>
              <PrismInput
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul kegiatan"
                autoFocus
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date</label>
                <PrismInput
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Waktu</label>
                <PrismInput
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Link Notulensi
              </label>
              <PrismInput
                type="url"
                value={meetingMinutesLink}
                onChange={(e) => setMeetingMinutesLink(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {error && (
              <div className="flex items-start gap-1.5 text-xs text-[oklch(0.55_0.2_25)] bg-[oklch(0.6_0.22_25/0.08)] px-2.5 py-2 rounded-lg" role="alert">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2 pt-1">
                <AlertTriangle className="w-4 h-4 text-[oklch(0.55_0.2_25)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] flex-1">Delete this event?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[oklch(0.55_0.2_25)] bg-[oklch(0.6_0.22_25/0.1)] hover:bg-[oklch(0.6_0.22_25/0.15)] rounded-lg transition-colors"
                >
                  Ya
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pt-1">
                <PrismButton
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  size="sm"
                  className="flex-1"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Simpan
                </PrismButton>

                <button
                  onClick={onClose}
                  disabled={saving}
                  className="p-2 rounded-lg border border-[oklch(0.92_0.01_90/0.8)] hover:bg-[var(--surface-3)] transition-all duration-[var(--duration-fast)]"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="p-2 rounded-lg border border-[oklch(0.6_0.22_25/0.15)] hover:bg-[oklch(0.6_0.22_25/0.06)] transition-all duration-[var(--duration-fast)]"
                  aria-label="Delete event"
                >
                  <Trash2 className="w-4 h-4 text-[oklch(0.55_0.2_25)]" />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                onClose();
                onMoreOptions();
              }}
              className="w-full text-xs text-[var(--brand-primary)] hover:underline flex items-center justify-center gap-1 py-1 font-medium"
            >
              <MoreHorizontal className="w-3 h-3" />
              Opsi lainnya...
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
