
'use client';

import { useState, useId, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Link2, Check, Loader2, LayoutGrid, FileText } from 'lucide-react';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface SaveDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialDescription: string;
  initialFolder?: string;
  existingFolders?: string[];
  onSave: (name: string, description: string, folder: string | null) => Promise<{ embedUrl: string } | null>;
  tileCount?: number;
  pageCount?: number;
}

export function SaveDashboardModal({
  isOpen,
  onClose,
  initialName,
  initialDescription,
  initialFolder = '',
  existingFolders = [],
  onSave,
  tileCount = 0,
  pageCount = 0,
}: SaveDashboardModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [folder, setFolder] = useState(initialFolder);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const folderListId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const saveSessionRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    // Reset on every open, not just first mount — the modal stays mounted
    // between opens, so without this a cancelled/saved session leaks its
    // stale name/description or success screen into the next open. Bumping
    // saveSessionRef also invalidates any save still in flight from the
    // previous open, so its result can't paint over this fresh session.
    saveSessionRef.current += 1;
    savingRef.current = false;
    setName(initialName);
    setDescription(initialDescription);
    setFolder(initialFolder);
    setSaving(false);
    setSavedUrl(null);
    setCopied(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleSave = async () => {
    // setSaving() doesn't take effect until the next render, so a fast
    // double-click can fire handleSave twice before the button disables —
    // guard synchronously with a ref instead of relying on state.
    if (!name.trim() || savingRef.current) return;
    const session = saveSessionRef.current;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await onSave(name, description, folder.trim() || null);
      // The modal may have been closed and reopened (new session) while this
      // was in flight — don't paint a stale result over the fresh session.
      if (session !== saveSessionRef.current) return;
      if (result) {
        setSavedUrl(result.embedUrl);
      }
    } finally {
      if (session === saveSessionRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const handleCopy = () => {
    if (!savedUrl) return;
    const fullUrl = `${window.location.origin}${savedUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fullUrl = savedUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${savedUrl}` : '';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dashboard-modal-title"
        className="relative bg-[var(--surface-1)] border border-[var(--surface-4)] rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in"
      >
        {}
        <div className="flex items-center justify-between p-4 border-b border-[var(--surface-4)]">
          <h3 id="save-dashboard-modal-title" className="text-sm font-bold text-[var(--text-primary)]">Simpan Dashboard</h3>
          <button onClick={onClose} className="min-h-11 min-w-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!savedUrl ? (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Nama Dashboard
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Weekly Performance"
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat dashboard..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Folder (Opsional)
                </label>
                <input
                  type="text"
                  value={folder}
                  onChange={e => setFolder(e.target.value)}
                  placeholder="Example: Monthly Report"
                  list={folderListId}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
                <datalist id={folderListId}>
                  {existingFolders.map(f => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              {}
              {(tileCount > 0 || pageCount > 0) && (
                <div className="flex items-center gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-lg text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid size={12} className="text-[var(--text-muted)]" />
                    {tileCount} tile{tileCount !== 1 ? 's' : ''}
                  </span>
                  {pageCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} className="text-[var(--text-muted)]" />
                      {pageCount} halaman
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold bg-[var(--brand-primary)] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Menyimpan...' : 'Save Dashboard'}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              {}
              <div className="relative inline-block mb-3">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto animate-scale-in">
                  <Check size={28} className="text-emerald-600" />
                </div>
                {}
                <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-emerald-400 animate-celebrate-dot" style={{ '--dot-x': '-12px', '--dot-y': '-16px' } as React.CSSProperties} />
                <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-purple-400 animate-celebrate-dot" style={{ '--dot-x': '14px', '--dot-y': '-12px', animationDelay: '0.1s' } as React.CSSProperties} />
                <div className="absolute top-0 left-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-celebrate-dot" style={{ '--dot-x': '-16px', '--dot-y': '8px', animationDelay: '0.15s' } as React.CSSProperties} />
                <div className="absolute top-0 left-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-celebrate-dot" style={{ '--dot-x': '18px', '--dot-y': '6px', animationDelay: '0.2s' } as React.CSSProperties} />
              </div>

              <p className="text-sm font-bold text-[var(--text-primary)] mb-1">Dashboard Tersimpan!</p>
              <p className="text-xs text-[var(--text-muted)] mb-4">Embed URL untuk PowerPoint:</p>

              <div className="flex items-center gap-2 p-2 bg-[var(--surface-2)] border border-[var(--surface-4)] rounded-lg mb-4">
                <Link2 size={14} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{savedUrl}</span>
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 text-[10px] font-bold bg-[var(--brand-primary)] text-white rounded-md hover:opacity-90 transition-opacity"
                >
                  {copied ? 'Disalin!' : 'Salin'}
                </button>
              </div>

              {}
              {fullUrl && (
                <div className="flex flex-col items-center gap-2 mb-4">
                  <div className="p-3 bg-white rounded-xl border border-[var(--surface-4)]">
                    <QRCodeWithLogo value={fullUrl} size={120} fgColor="#6b8e3d" />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">Scan QR untuk akses cepat</span>
                </div>
              )}

              <div className="flex gap-2">
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 text-xs font-bold text-[var(--brand-primary)] border border-[var(--brand-primary)] rounded-lg text-center hover:bg-emerald-50 transition-colors"
                >
                  Preview
                </a>
                <button
                  onClick={onClose}
                  className="flex-1 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] border border-[var(--surface-4)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
