'use client';

import { Link as LinkIcon, ExternalLink, Copy, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DashboardLinkModalProps {
  title: string;
  link: string;
  onLinkChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
}

function DashboardLinkModal({ title, link, onLinkChange, onSave, onClose, onReset }: DashboardLinkModalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 mx-4 animate-scale-in border border-[var(--surface-3)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <LinkIcon size={18} /> {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-2)] rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] mb-4">
          Edit, copy, or open the {title} link (Google Looker Studio).
        </p>
        <div className="space-y-3">
          <label className="block text-[11px] font-bold text-[var(--text-muted)]">Link Dashboard</label>
          <input
            type="text"
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
            placeholder="https://lookerstudio.google.com/..."
          />
          <div className="flex gap-3 pt-2">
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(link); } catch {}
              }}
              className="flex-1 py-3.5 bg-[var(--surface-2)] text-[var(--text-primary)] font-semibold rounded-xl hover:bg-[var(--surface-3)] transition-all text-[13px] flex items-center justify-center gap-2"
            >
              <Copy size={16} /> Salin Link
            </button>
            <button
              onClick={() => window.open(link, '_blank')}
              className="flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all text-[13px] flex items-center justify-center gap-2"
            >
              <ExternalLink size={16} /> Buka
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSave}
              className="flex-1 py-3.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:bg-[var(--brand-primary-hover,#2563eb)] active:scale-[0.98] transition-all text-[13px]"
            >
              Simpan
            </button>
            <button
              onClick={onReset}
              className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-[13px]"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface DashboardLinkModalsProps {
  showOS: boolean;
  osLink: string;
  onOsLinkChange: (v: string) => void;
  onCloseOS: () => void;
  onSaveOS: () => void;
  onResetOS: () => void;
}

export function DashboardLinkModals({
  showOS,
  osLink,
  onOsLinkChange,
  onCloseOS,
  onSaveOS,
  onResetOS,
}: DashboardLinkModalsProps) {
  return (
    <>
      {showOS && (
        <DashboardLinkModal
          title="Dashboard OS"
          link={osLink}
          onLinkChange={onOsLinkChange}
          onSave={onSaveOS}
          onClose={onCloseOS}
          onReset={onResetOS}
        />
      )}
    </>
  );
}
