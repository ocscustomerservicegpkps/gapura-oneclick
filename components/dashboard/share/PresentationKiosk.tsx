'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import type { Report } from '@/types';

const AnalystCharts = dynamic(
  () => import('@/components/dashboard/analyst/AnalystCharts'),
  { ssr: false }
);
const OCSRecordsTabs = dynamic(
  () => import('@/components/dashboard/ocs/OCSRecordsTabs'),
  { ssr: false }
);

const DIVISION_LABELS: Record<string, string> = {
  OCS: 'Operations Control',
  OP: 'Operations',
  OS: 'Operations Support',
  HT: 'Human Talent',
};

export interface KioskFilters {
  hubs: string[];
  branches: string[];
  airlines: string[];
  categories: string[];
}

interface PresentationKioskProps {
  open: boolean;
  onClose: () => void;
  divisionCode: string;
  filteredReports: readonly Report[];
  globalFilters: KioskFilters;
  availableOptions: KioskFilters;
}

// Fullscreen read-only presentation overlay. Same readOnly render as the
// public share page, but fed live from the presenter's current dashboard
// state. No navigation, no filters, no drilldowns; Esc or the close button
// exits. Browser fullscreen API when available, plain overlay otherwise.
export function PresentationKiosk({
  open,
  onClose,
  divisionCode,
  filteredReports,
  globalFilters,
  availableOptions,
}: PresentationKioskProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  // Fullscreen on open (best effort), scroll lock regardless.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = containerRef.current;
    if (target?.requestFullscreen) {
      void target.requestFullscreen().catch(() => {});
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const isOcs = divisionCode === 'OCS';
  const divisionLabel = DIVISION_LABELS[divisionCode] ?? divisionCode;
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[oklch(0.98_0.005_200)] text-[var(--text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard presentation mode"
    >
      {/* Presentation chrome. Scrolls away so the dashboard's own sticky tab
          bar owns the top edge once the viewer starts reading. */}
      <header className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-7">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
            Presentation Mode
          </p>
          <h1 className="truncate font-display text-lg font-black tracking-tight text-[var(--text-primary)] sm:text-xl">
            {divisionLabel} Dashboard
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] sm:inline">
            {today}
          </span>
          <button
            onClick={handleClose}
            aria-label="Exit presentation mode"
            title="Exit presentation mode (Esc)"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] shadow-sm transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X size={15} />
            Exit
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8">
        {isOcs ? (
          <OCSRecordsTabs readOnly />
        ) : (
          <AnalystCharts
            readOnly
            filteredReports={filteredReports as Report[]}
            globalFilters={globalFilters}
            setGlobalFilters={() => {}}
            availableOptions={availableOptions}
            showDelayCodeTab={divisionCode === 'OP'}
          />
        )}
      </div>
    </div>
  );
}
