'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { StatusUpdateSuccessDialog } from '@/components/dashboard/StatusUpdateSuccessDialog';

const REMARKS_BY_DIVISIONS = ['OP', 'UQ', 'OT', 'OS', 'OCS', 'HT', 'HC'] as const;

export interface CloseReportValues {
  finalRemarks: string;
  remarksBy: string;
}

interface CloseReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CloseReportValues) => Promise<void>;
  accentColor?: string;
}

export function CloseReportDialog({
  open,
  onClose,
  onSubmit,
  // Matches --teal in apple-form-shell.tsx's FORM_CSS — this dialog opens
  // from that modal's "Mark as CLOSED" button, so the two greens must agree.
  accentColor = '#047857',
}: CloseReportDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [finalRemarks, setFinalRemarks] = useState('');
  const [division, setDivision] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setFinalRemarks('');
      setDivision('');
      setName('');
      setError('');
      setSubmitting(false);
      setCompleted(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || completed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completed, onClose, open, submitting]);

  if (!mounted || !open) return null;

  const trimmedRemarks = finalRemarks.trim();
  const trimmedName = name.trim();
  const canSubmit = Boolean(trimmedRemarks && division && trimmedName);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        finalRemarks: trimmedRemarks,
        remarksBy: `${division} - ${trimmedName}`,
      });
      setCompleted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to close report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <StatusUpdateSuccessDialog
        open
        status="CLOSED"
        onClose={() => {
          setCompleted(false);
          onClose();
        }}
      />
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
      onClick={() => { if (!submitting) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-report-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_32px_90px_-28px_rgba(15,23,42,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Report status</p>
            <h2 id="close-report-title" className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">Close Report</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Close report dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>Final Remarks and Remarks By are required before this report can be closed.</span>
        </div>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Final Remarks <span className="text-red-500">*</span></span>
          <textarea
            value={finalRemarks}
            onChange={(event) => setFinalRemarks(event.target.value)}
            rows={4}
            className="min-h-[8rem] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Write final remarks"
            required
            aria-required="true"
            autoFocus
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Division <span className="text-red-500">*</span></span>
            <select
              value={division}
              onChange={(event) => setDivision(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-black text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              required
              aria-required="true"
            >
              <option value="">Select</option>
              {REMARKS_BY_DIVISIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Name <span className="text-red-500">*</span></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Filled by"
              required
              aria-required="true"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{error}</p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? 'Closing…' : 'Close Report'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
