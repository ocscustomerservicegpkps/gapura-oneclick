'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const OTHER = '__other__';
export const resolveOther = (v: string, other: string) => (v === OTHER ? other.trim() : v);

export function toLocalDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

export function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const ratio = Math.min(1600 / width, 1600 / height, 1);
      width = Math.round(width * ratio); height = Math.round(height * ratio);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('Canvas not supported')); }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error('Compression failed'));
        const ext = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/png' ? '.png' : '.jpg';
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: blob.type }));
      }, 'image/webp', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load error')); };
    img.src = url;
  });
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="jm-field">
      <div className="jm-field__head">
        <span className="jm-label">{label}{required && <span className="jm-req" aria-hidden>*</span>}</span>
        {hint && <span className="jm-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="jm-section">
      <div className="jm-section__head">
        <h3 className="jm-section__title">{title}</h3>
        {subtitle && <p className="jm-section__sub">{subtitle}</p>}
      </div>
      <div className="jm-section__body">{children}</div>
    </section>
  );
}

export function Options({
  options, value, onChange, allowOther, otherValue, onOtherChange, variant = 'pills', getLabel,
}: {
  options: string[]; value: string; onChange: (v: string) => void;
  allowOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void;
  variant?: 'pills' | 'list';
  getLabel?: (v: string) => string;
}) {
  const isOther = value === OTHER;
  const label = (v: string) => (getLabel ? getLabel(v) : v);
  if (variant === 'list') {
    return (
      <div className="jm-list">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(opt)} className={cn('jm-row', active && 'jm-row--active')}>
              <span className="jm-row__mark">{active && <Check size={13} strokeWidth={2.5} />}</span>
              <span className="jm-row__text">{label(opt)}</span>
            </button>
          );
        })}
        {allowOther && (
          <button type="button" onClick={() => onChange(OTHER)} className={cn('jm-row', isOther && 'jm-row--active')}>
            <span className="jm-row__mark">{isOther && <Check size={13} strokeWidth={2.5} />}</span>
            <span className="jm-row__text">Other</span>
          </button>
        )}
        {allowOther && isOther && (
          <input type="text" className="jm-input jm-input--nested" placeholder="Please specify"
            value={otherValue || ''} onChange={(e) => onOtherChange?.(e.target.value)} autoFocus />
        )}
      </div>
    );
  }
  return (
    <div className="jm-pills">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} className={cn('jm-pill', value === opt && 'jm-pill--active')}>
          {label(opt)}
        </button>
      ))}
      {allowOther && (
        <button type="button" onClick={() => onChange(OTHER)} className={cn('jm-pill', isOther && 'jm-pill--active')}>Other</button>
      )}
      {allowOther && isOther && (
        <input type="text" className="jm-input jm-input--nested" placeholder="Please specify"
          value={otherValue || ''} onChange={(e) => onOtherChange?.(e.target.value)} autoFocus />
      )}
    </div>
  );
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="jm-progress">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn('jm-progress__dot', i < step && 'jm-progress__dot--done')} />
      ))}
    </div>
  );
}

export function StepFooter({
  onBack, backDisabled, isLast, onNext, nextDisabled, submitting, nextLabel = 'Continue',
}: {
  onBack: () => void; backDisabled: boolean; isLast: boolean;
  onNext?: () => void; nextDisabled: boolean; submitting: boolean; nextLabel?: string;
}) {
  return (
    <div className="jm-stepnav">
      <button type="button" onClick={onBack} disabled={backDisabled} className="jm-btn-back">Back</button>
      <button
        type={isLast ? 'submit' : 'button'}
        onClick={isLast ? undefined : onNext}
        disabled={nextDisabled}
        className={cn('jm-submit', nextDisabled && 'jm-submit--disabled')}
      >
        {submitting && <Loader2 size={16} className="animate-spin" strokeWidth={2} />}
        {isLast ? (submitting ? 'Submitting…' : 'Submit report') : nextLabel}
      </button>
    </div>
  );
}

export function InlineShell({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) {
  return (
    <div className="jm-inline" role="region" aria-label={ariaLabel}>
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
      {children}
    </div>
  );
}

const subscribeToClient = () => () => {};

export function FormShell({ onClose, ariaLabel, wide, dashboardScope, children }: { onClose: () => void; ariaLabel: string; wide?: boolean; dashboardScope?: boolean; children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Move focus into the dialog on open so keyboard/screen-reader users land
  // somewhere inside it, then trap Tab within it and let Escape close it —
  // the portal escapes the React tree, so nothing else provides this.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const frame = frameRef.current;
      if (!frame) return;
      const focusable = frame.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  // Portal to <body> so `position: fixed` escapes any ancestor with
  // transform/filter/will-change (which creates a new containing block and
  // clips the backdrop to the dashboard content — leaving corners uncovered).
  return createPortal(
    <div className={cn('jm-root', dashboardScope && 'jm-dashboard-scope')} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
      <div className="jm-backdrop" onClick={onClose} />
      <div className={cn('jm-frame', wide && 'jm-frame--wide')} ref={frameRef}>
        <button type="button" onClick={onClose} className="jm-close" aria-label="Close" ref={closeButtonRef}>
          <X size={16} strokeWidth={2.2} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const FORM_CSS = `
.jm-root, .jm-inline {
  --ink: #101013;
  --ink-2: #3a3a42;
  /* #7c7c85 measured 4.13:1 on white, below WCAG AA's 4.5:1 floor for the
     small (10-13px) labels and metadata this token drives throughout. */
  --mute: #6b6b74;
  --line: rgba(0,0,0,0.08);
  --fill: rgba(0,0,0,0.045);
  --fill-2: rgba(0,0,0,0.075);
  --paper: #fafafc;
  --card: rgba(255,255,255,0.72);
  /* Brand-aligned: Gapura green (was teal #0f7c7c). Drives progress bar,
     focus rings, active marks, and the primary Continue/Submit button. */
  --teal: #047857;
  --teal-soft: rgba(4,120,87,0.10);
  --teal-strong: #065f46;
  --red: #d0342c;
  --font: var(--font-plus-jakarta), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-family: var(--font);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'ss01', 'cv11';
}
/* This shell is shared with the public intake form (which keeps Plus
   Jakarta above). The OP dashboard's report modal opts into the dashboard
   body font instead so its typography matches the rest of the dashboard. */
.jm-root.jm-dashboard-scope, .jm-inline.jm-dashboard-scope {
  --font: var(--font-body, var(--font-plus-jakarta), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
}
.jm-root {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.jm-inline {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  z-index: 0;
}
.jm-inline .jm-form { overflow: visible; }
.jm-inline .jm-scroll { overflow: visible; padding: 0; gap: 14px; }
.jm-inline .jm-footer {
  position: sticky; bottom: 12px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px -12px rgba(0,0,0,0.15);
}
.jm-inline .jm-head { margin-bottom: 4px; }
.jm-backdrop {
  position: absolute; inset: 0;
  background: rgba(15, 17, 22, 0.55);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  animation: jm-fade .35s ease-out;
}
.jm-frame {
  position: relative;
  width: 100%; max-width: 720px;
  max-height: 92vh;
  display: flex; flex-direction: column;
  background: var(--paper);
  border-radius: 28px;
  overflow: hidden;
  box-shadow:
    0 30px 90px -20px rgba(0,0,0,0.45),
    0 0 0 1px rgba(255,255,255,0.6) inset,
    0 1px 0 0 rgba(255,255,255,0.9) inset;
  animation: jm-rise .45s cubic-bezier(.2,.85,.2,1);
}
.jm-frame--wide { max-width: 1040px; }
.jm-close {
  position: absolute; top: 14px; right: 14px; z-index: 10;
  width: 44px; height: 44px; border-radius: 999px;
  background: rgba(0,0,0,0.06);
  border: none; cursor: pointer;
  color: var(--ink);
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .18s ease, transform .18s ease;
  backdrop-filter: blur(8px);
}
.jm-close:hover { background: rgba(0,0,0,0.10); }
.jm-close:active { transform: scale(0.92); }

.jm-form { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.jm-scroll {
  overflow-y: auto;
  padding: 48px 32px 24px;
  display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.15) transparent;
}

/* Report detail: report body left, feedback right */
.jm-detail-split { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
.jm-detail-side { border-top: 1px solid var(--line); }
@media (min-width: 900px) {
  .jm-detail-split { flex-direction: row; overflow: hidden; }
  .jm-detail-main { flex: 1.6; min-width: 0; }
  .jm-detail-side {
    flex: 1; min-width: 320px; max-width: 400px;
    border-top: none; border-left: 1px solid var(--line);
    background: rgba(0,0,0,0.015);
    padding-top: 48px;
  }
}
@media (max-width: 899px) {
  .jm-detail-split > .jm-scroll { overflow: visible; }
}
.jm-scroll::-webkit-scrollbar { width: 6px; }
.jm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 999px; }
.jm-scroll::-webkit-scrollbar-track { background: transparent; }

.jm-head { margin-bottom: 12px; }
.jm-title { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.03em; color: var(--ink); }
.jm-sub { margin: 6px 0 0; font-size: 15px; color: var(--mute); font-weight: 400; }

.jm-error {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: rgba(208, 52, 44, 0.08);
  border-radius: 12px;
  color: var(--red);
  font-size: 13.5px; font-weight: 500;
}
.jm-error svg { flex-shrink: 0; }

.jm-section {
  padding: 22px 22px;
  background: var(--card);
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.03);
  backdrop-filter: blur(20px);
}
.jm-section__head { margin-bottom: 18px; }
.jm-section__title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.015em; color: var(--ink); }
.jm-section__sub { margin: 4px 0 0; font-size: 13px; color: var(--mute); font-weight: 400; }
.jm-section__body { display: flex; flex-direction: column; gap: 20px; }

/* Feedback / comment thread inside report detail */
.jm-feedback { display: flex; flex-direction: column; gap: 18px; }
.jm-feedback__list {
  position: relative;
  display: flex; flex-direction: column; gap: 16px;
  padding-left: 4px;
}
.jm-feedback__list::before {
  content: ''; position: absolute; left: 15px; top: 6px; bottom: 6px;
  width: 1px; background: var(--line);
}
.jm-feedback__item { position: relative; display: flex; align-items: flex-start; gap: 12px; }
.jm-feedback__avatar {
  flex-shrink: 0; z-index: 1;
  width: 24px; height: 24px; border-radius: 999px;
  background: #fff; border: 1px solid var(--line);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: var(--ink-2);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.jm-feedback__bubble {
  flex: 1;
  background: #fff; border: 1px solid var(--line); border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.jm-feedback__bubble-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.jm-feedback__author { font-size: 12px; font-weight: 700; color: var(--ink); }
.jm-feedback__time { font-size: 10px; font-weight: 500; color: var(--mute); }
.jm-feedback__content { margin: 0; font-size: 13px; line-height: 1.55; color: var(--ink-2); white-space: pre-wrap; word-break: break-word; }
.jm-feedback__sys {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding-left: 1px; font-size: 11px; font-style: italic; color: var(--mute);
}
.jm-feedback__sys-icon {
  flex-shrink: 0; z-index: 1;
  width: 24px; height: 24px; border-radius: 999px;
  background: var(--fill); border: 1px solid var(--line);
  display: inline-flex; align-items: center; justify-content: center; color: var(--mute);
}
.jm-feedback__sys-time { margin-left: auto; opacity: 0.6; font-weight: 600; }
.jm-feedback__empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 32px 0; border: 1px dashed var(--line); border-radius: 16px;
  color: var(--mute); background: rgba(255,255,255,0.4);
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
}

.jm-field { display: flex; flex-direction: column; gap: 8px; }
.jm-field__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.jm-label { font-size: 13px; font-weight: 600; letter-spacing: -0.005em; color: var(--ink); }
.jm-req { color: var(--red); margin-left: 3px; font-weight: 600; }
.jm-hint { font-size: 12px; color: var(--mute); font-weight: 400; }

.jm-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--fill);
  border: 1px solid transparent;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px; font-weight: 500;
  color: var(--ink);
  outline: none;
  transition: background .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.jm-input::placeholder { color: var(--mute); font-weight: 400; }
.jm-input:hover:not(:focus) { background: var(--fill-2); }
.jm-input:focus {
  background: #fff;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px var(--teal-soft);
}
.jm-textarea { min-height: 84px; resize: vertical; line-height: 1.5; }
.jm-select {
  appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2.5 4.5l3.5 3.5 3.5-3.5' stroke='%23101013' fill='none' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
  cursor: pointer;
}
.jm-input--nested { margin-top: 4px; flex-basis: 100%; }

.jm-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.jm-pill {
  padding: 9px 14px;
  border-radius: 999px;
  background: var(--fill);
  border: none;
  font-family: inherit;
  font-size: 13.5px; font-weight: 500;
  color: var(--ink-2);
  cursor: pointer;
  transition: background .18s ease, color .18s ease, transform .12s ease;
}
.jm-pill:hover { background: var(--fill-2); }
.jm-pill:active { transform: scale(0.97); }
.jm-pill--active { background: var(--ink); color: #fff; }
.jm-pill--active:hover { background: var(--ink); }

.jm-list {
  display: flex; flex-direction: column;
  background: var(--fill);
  border-radius: 14px;
  padding: 4px;
  gap: 2px;
}
.jm-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 12px;
  background: transparent;
  border: none; cursor: pointer;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px; font-weight: 500;
  color: var(--ink-2);
  text-align: left;
  transition: background .15s ease, color .15s ease;
}
.jm-row:hover { background: rgba(0,0,0,0.03); }
.jm-row__mark {
  width: 18px; height: 18px; border-radius: 999px;
  border: 1.5px solid rgba(0,0,0,0.15);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background .18s ease, border-color .18s ease, color .18s ease;
  color: transparent;
}
.jm-row__text { flex: 1; }
.jm-row--active { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.jm-row--active .jm-row__mark { background: var(--teal); border-color: var(--teal); color: #fff; }

.jm-nested {
  margin-top: 4px;
  padding: 18px;
  background: rgba(0,0,0,0.025);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 18px;
  animation: jm-slide .25s ease-out;
}

.jm-drop {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed rgba(0,0,0,0.15);
  border-radius: 14px;
  background: rgba(0,0,0,0.015);
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
  text-align: center;
}
.jm-drop:hover { border-color: var(--teal); background: var(--teal-soft); }
.jm-drop svg { color: var(--mute); }
.jm-drop:hover svg { color: var(--teal); }
.jm-drop__title { font-size: 14px; font-weight: 600; color: var(--ink); }
.jm-drop__hint { font-size: 12.5px; color: var(--mute); }
.jm-drop--full { opacity: 0.4; pointer-events: none; }
.jm-evidence-required-msg { margin: 10px 0 0; font-size: 12.5px; font-weight: 600; color: var(--red); }

.jm-files { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.jm-file {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  background: var(--fill);
  border-radius: 10px;
  font-size: 13px;
}
.jm-file__name { flex: 1; color: var(--ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jm-file__size { color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }
.jm-file__remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 999px;
  background: transparent; border: none; cursor: pointer;
  color: var(--mute);
  transition: background .18s ease, color .18s ease;
}
.jm-file__remove:hover { background: rgba(208,52,44,0.10); color: var(--red); }

.jm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.jm-progress { display: flex; gap: 6px; margin: 2px 0 4px; }
.jm-progress__dot { height: 4px; flex: 1; border-radius: 999px; background: var(--fill-2); transition: background .2s ease; }
.jm-progress__dot--done { background: var(--teal); }

.jm-stepnav { display: flex; gap: 12px; }
.jm-stepnav .jm-submit { flex: 1; }
.jm-btn-back {
  flex-shrink: 0;
  padding: 14px 22px;
  background: var(--fill);
  color: var(--ink);
  border: none; border-radius: 14px;
  font-family: inherit; font-size: 15px; font-weight: 600;
  cursor: pointer;
  transition: background .18s ease, opacity .18s ease;
}
.jm-btn-back:hover:not(:disabled) { background: var(--fill-2); }
.jm-btn-back:disabled { opacity: 0.35; cursor: not-allowed; }

.jm-footer {
  padding: 16px 32px 24px;
  border-top: 1px solid var(--line);
  background: rgba(250,250,252,0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.jm-submit {
  width: 100%;
  padding: 14px 24px;
  background: var(--teal);
  color: #fff;
  border: none; border-radius: 14px;
  font-family: inherit;
  font-size: 15px; font-weight: 600; letter-spacing: -0.005em;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .2s ease, transform .12s ease, box-shadow .2s ease;
}
.jm-submit:hover:not(:disabled) {
  background: var(--teal-strong);
  box-shadow: 0 8px 24px -8px rgba(4,120,87,0.5);
}
.jm-submit:active:not(:disabled) { transform: scale(0.985); }
.jm-submit--disabled { opacity: 0.35; cursor: not-allowed; }

/* Same brand green as .jm-submit above (was its own standalone oklch
   gradient — a second, independently-tuned green duplicating --teal). */
.jm-submit--close { background: var(--teal); }
.jm-submit--close:hover:not(:disabled) {
  background: var(--teal-strong);
  box-shadow: 0 8px 24px -8px rgba(4,120,87,0.5);
}
.jm-submit--close:active:not(:disabled) { transform: scale(0.985); }

.jm-success {
  padding: 72px 32px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 14px;
  animation: jm-fade .4s ease-out;
}
.jm-check {
  width: 60px; height: 60px; border-radius: 999px;
  background: var(--teal); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  animation: jm-pop .45s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 12px 32px -8px rgba(15,124,124,0.5);
  margin-bottom: 8px;
}
.jm-success__title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.jm-success__body { margin: 0; font-size: 14.5px; color: var(--mute); max-width: 320px; }
.jm-submit--success { margin-top: 16px; max-width: 200px; }

/* Detail view additions */
.jm-detail__hero {
  padding: 8px 4px 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}
.jm-detail__eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--fill);
  color: var(--mute);
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  margin-bottom: 12px;
}
.jm-detail__eyebrow--joumpa { background: rgba(15,124,124,0.10); color: var(--teal); }
.jm-detail__title {
  margin: 0;
  font-size: 26px; font-weight: 700; letter-spacing: -0.025em;
  color: var(--ink);
}
.jm-detail__meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 14px;
}
.jm-documents { display: flex; flex-wrap: wrap; align-items: center; gap: 9px 12px; margin-top: 12px; }
.jm-documents__actions { display: inline-flex; gap: 7px; }
.jm-document-btn {
  min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--line); border-radius: 10px;
  background: #fff; color: var(--ink);
  font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform .12s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.jm-document-btn--docx { color: #1d4ed8; border-color: rgba(37, 99, 235, 0.18); background: rgba(37, 99, 235, 0.045); }
.jm-document-btn--pdf { color: #b42318; border-color: rgba(180, 35, 24, 0.18); background: rgba(180, 35, 24, 0.045); }
.jm-document-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 14px -10px currentColor; }
.jm-document-btn--docx:hover:not(:disabled) { border-color: rgba(37, 99, 235, 0.34); background: rgba(37, 99, 235, 0.075); }
.jm-document-btn--pdf:hover:not(:disabled) { border-color: rgba(180, 35, 24, 0.34); background: rgba(180, 35, 24, 0.075); }
.jm-document-btn:disabled { cursor: not-allowed; opacity: 0.38; filter: grayscale(0.35); }
.jm-documents__status { font-size: 11px; color: var(--mute); }
.jm-documents__status--error { color: var(--red); }
.jm-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px; font-weight: 600; letter-spacing: -0.005em;
  background: var(--fill);
  color: var(--ink);
}
.jm-badge__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; opacity: 0.85; }
.jm-badge--open { background: rgba(15,124,124,0.10); color: var(--teal); }
.jm-badge--progress { background: rgba(217, 119, 6, 0.10); color: #b4530a; }
.jm-badge--closed { background: rgba(60, 60, 67, 0.08); color: #3c3c47; }
.jm-badge--urgent, .jm-badge--top { background: rgba(208, 52, 44, 0.10); color: var(--red); }
.jm-badge--high { background: rgba(217, 119, 6, 0.10); color: #b4530a; }
.jm-badge--medium { background: rgba(15,124,124,0.10); color: var(--teal); }
.jm-badge--low { background: rgba(60, 60, 67, 0.06); color: var(--mute); }

.jm-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
.jm-kv__cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.jm-kv__cell--wide { grid-column: 1 / -1; }
.jm-kv__k {
  font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--mute); font-weight: 600;
}
.jm-kv__v {
  font-size: 14.5px; font-weight: 500; color: var(--ink);
  line-height: 1.5; word-break: break-word;
}
.jm-kv__v--muted { color: var(--mute); font-weight: 400; font-style: italic; }
.jm-body-para {
  margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--ink); white-space: pre-wrap;
}

.jm-evidence {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.jm-evidence__item {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--fill);
  border: 1px solid var(--line);
  display: block;
  position: relative;
  transition: transform .18s ease, box-shadow .18s ease;
}
.jm-evidence__item:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); }
.jm-evidence__item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.jm-evidence__fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--mute);
  background: var(--fill);
}
.jm-evidence__badge {
  position: absolute; bottom: 6px; left: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.55); color: #fff;
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .jm-detail__title { font-size: 22px; }
  .jm-kv { grid-template-columns: 1fr; gap: 12px; }
  .jm-evidence { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}

@keyframes jm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes jm-rise { from { opacity: 0; transform: translateY(20px) scale(0.98) } to { opacity: 1; transform: none } }
@keyframes jm-pop { from { transform: scale(0.4); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes jm-slide { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }

@media (max-width: 640px) {
  .jm-root { padding: 0; }
  .jm-frame { border-radius: 20px 20px 0 0; max-height: 96vh; align-self: flex-end; }
  .jm-scroll { padding: 40px 20px 20px; }
  .jm-footer { padding: 14px 20px 20px; }
  .jm-section { padding: 20px 18px; border-radius: 18px; }
  .jm-grid-2 { grid-template-columns: 1fr; gap: 16px; }
  .jm-title { font-size: 26px; }
}
`;
