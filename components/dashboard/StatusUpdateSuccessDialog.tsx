'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

interface StatusUpdateSuccessDialogProps {
  open: boolean;
  status: string;
  onClose: () => void;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusUpdateSuccessDialog({
  open,
  status,
  onClose,
}: StatusUpdateSuccessDialogProps) {
  const doneButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    doneButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const displayStatus = formatStatus(status);

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-update-success-title"
        aria-describedby="status-update-success-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_32px_90px_-28px_rgba(15,23,42,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1.5 bg-emerald-500" />
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <CheckCircle2 className="text-emerald-600" size={34} strokeWidth={2.25} />
          </div>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
            Update complete
          </p>
          <h2 id="status-update-success-title" className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Status Updated
          </h2>
          <p id="status-update-success-description" className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-slate-600">
            The report status has been changed successfully.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            {displayStatus}
          </div>

          <button
            ref={doneButtonRef}
            type="button"
            onClick={onClose}
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
