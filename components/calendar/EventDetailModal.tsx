'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, Calendar, Clock, FileText, Repeat, User, ExternalLink, StickyNote } from 'lucide-react';
import { CalendarEvent } from '@/types';
import { PrismButton } from '@/components/ui/PrismButton';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onQuickEdit?: () => void;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--surface-3)]">
        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm text-[var(--text-primary)]">{children}</div>
      </div>
    </div>
  );
}

export function EventDetailModal({
  event,
  open,
  onClose,
  onEdit,
  onQuickEdit,
}: EventDetailModalProps) {
  if (!event) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return 'Sepanjang hari';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes} WIB`;
  };

  const isMultiDay = !!event.event_end_date && event.event_end_date !== event.event_date;

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-1)] border border-[oklch(0.92_0.01_90/0.8)] rounded-2xl shadow-[var(--shadow-spatial-lg)] animate-scale-in focus:outline-none"
          aria-describedby={undefined}
        >
          {}
          <div className="flex items-center justify-between p-4 border-b border-[oklch(0.94_0.01_90/0.6)]">
            <Dialog.Title className="text-lg font-bold font-display tracking-tight text-[var(--text-primary)]">
              Detail Kegiatan
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
          <div className="p-5 space-y-4">
            {}
            <div>
              <h3 className="text-xl font-bold font-display tracking-tight text-[var(--text-primary)] leading-tight">
                {event.title}
              </h3>
              {event.is_recurring && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-[oklch(0.55_0.18_280/0.1)] text-[oklch(0.55_0.18_280)] text-xs font-semibold">
                  <Repeat className="w-3 h-3" />
                  Recurring ({event.recurrence_pattern === 'daily' ? 'Daily' : event.recurrence_pattern === 'weekly' ? 'Weekly' : 'Monthly'})
                </div>
              )}
            </div>

            {}
            <div className="space-y-3">
              <DetailRow icon={Calendar} label={isMultiDay ? 'Date Range' : 'Date'}>
                {formatDate(event.event_date)}
                {isMultiDay && (
                  <>
                    <span className="text-[var(--text-muted)]"> — </span>
                    {formatDate(event.event_end_date!)}
                  </>
                )}
              </DetailRow>

              <DetailRow icon={Clock} label="Waktu">
                {formatTime(event.event_time)}
              </DetailRow>

              <DetailRow icon={User} label="Dibuat oleh">
                {event.created_by_name || 'Tidak diketahui'}
              </DetailRow>

              {event.meeting_minutes_link && (
                <DetailRow icon={FileText} label="Notulensi Rapat">
                  <a
                    href={event.meeting_minutes_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline font-medium"
                  >
                    Buka Link
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </DetailRow>
              )}

              {event.notes && (
                <DetailRow icon={StickyNote} label="Catatan">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.notes}</p>
                </DetailRow>
              )}
            </div>
          </div>

          {}
          {(onEdit || onQuickEdit) && (
            <div className="flex justify-end gap-2 p-4 border-t border-[oklch(0.94_0.01_90/0.6)]">
              {onQuickEdit && (
                <PrismButton variant="secondary" onClick={onQuickEdit} size="sm">
                  Sunting Cepat
                </PrismButton>
              )}
              {onEdit && (
                <PrismButton onClick={onEdit} size="sm">
                  Edit Kegiatan
                </PrismButton>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
