'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  Plus, MoreVertical, Pencil, Trash2, X, Loader2,
  LayoutDashboard, Link2, BarChart2, Clock, LayoutGrid, FolderOpen,
  Globe, FileText, Users, TrendingUp, Calendar, Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickLink {
  id: string;
  label: string;
  url: string;
  color: string;
  icon: string;
  sort_order: number;
}

const ICONS: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'link':             Link2,
  'bar-chart':        BarChart2,
  'clock':            Clock,
  'layout-grid':      LayoutGrid,
  'folder-open':      FolderOpen,
  'globe':            Globe,
  'file-text':        FileText,
  'users':            Users,
  'trending-up':      TrendingUp,
  'calendar':         Calendar,
  'star':             Star,
};

const COLORS = [
  { name: 'emerald', from: '#10b981', to: '#059669' },
  { name: 'blue',    from: '#3b82f6', to: '#1d4ed8' },
  { name: 'violet',  from: '#8b5cf6', to: '#6d28d9' },
  { name: 'cyan',    from: '#06b6d4', to: '#0891b2' },
  { name: 'amber',   from: '#f59e0b', to: '#d97706' },
  { name: 'slate',   from: '#64748b', to: '#475569' },
  { name: 'rose',    from: '#f43f5e', to: '#e11d48' },
  { name: 'orange',  from: '#f97316', to: '#ea580c' },
];

function gradient(color: string) {
  const c = COLORS.find((x) => x.name === color) ?? COLORS[0];
  return `linear-gradient(135deg, ${c.from}, ${c.to})`;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OCSQuickLinkCards() {
  const { user } = useAuth(false);
  const canManage = user?.role === 'SUPER_ADMIN' || (user?.role === 'ANALYST' && user?.division === 'OCS');
  const router = useRouter();

  const { data, mutate } = useSWR<QuickLink[]>('/api/ocs-links', fetcher, { revalidateOnFocus: false });
  const links = Array.isArray(data) ? data : [];

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<QuickLink | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const handleOpen = (link: QuickLink) => {
    if (link.url.startsWith('/') && !link.url.startsWith('//')) {
      router.push(link.url);
    } else if (/^https?:\/\//i.test(link.url)) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this link?')) return;
    await fetch(`/api/ocs-links?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {links.map((link) => {
          const Icon = ICONS[link.icon] ?? Link2;
          return (
            <div
              key={link.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpen(link)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen(link)}
              className="relative group rounded-2xl cursor-pointer select-none overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] min-h-[130px] flex flex-col items-center justify-center gap-2.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ background: gradient(link.color) }}
            >
              {canManage && (
                <button
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center bg-white/20 hover:bg-white/35 text-white opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === link.id ? null : link.id); }}
                  aria-label="Options"
                >
                  <MoreVertical size={14} />
                </button>
              )}
              {canManage && menuOpen === link.id && (
                <div
                  className="absolute top-9 right-2 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-32"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => { setMenuOpen(null); setEditing(link); setShowForm(true); }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => { setMenuOpen(null); handleDelete(link.id); }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
              <Icon size={30} className="text-white drop-shadow-sm" />
              <span className="text-white font-bold text-sm text-center leading-tight px-1">{link.label}</span>
            </div>
          );
        })}
        {canManage && (
          <button
            className="rounded-2xl border-2 border-dashed border-gray-200 min-h-[130px] flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-500 hover:border-gray-300 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={22} />
            <span className="text-xs font-semibold">Add new</span>
          </button>
        )}
      </div>

      {showForm && typeof document !== 'undefined' && createPortal(
        <LinkForm
          link={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { mutate(); setShowForm(false); setEditing(null); }}
        />,
        document.body
      )}
    </>
  );
}

function LinkForm({
  link,
  onClose,
  onSaved,
}: {
  link: QuickLink | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!link;
  const [label, setLabel] = useState(link?.label ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [color, setColor] = useState(link?.color ?? 'emerald');
  const [icon, setIcon] = useState(link?.icon ?? 'link');
  const [saving, setSaving] = useState(false);

  const PreviewIcon = ICONS[icon] ?? Link2;

  const submit = async () => {
    if (!label.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ocs-links', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit
          ? { id: link!.id, label, url, color, icon }
          : { label, url, color, icon }),
      });
      if (!res.ok) throw new Error('save failed');
      onSaved();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit Link' : 'New Link'}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Live preview */}
        <div className="px-6 pt-5 flex justify-center">
          <div
            className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-md"
            style={{ background: gradient(color) }}
          >
            <PreviewIcon size={26} className="text-white" />
            <span className="text-white font-bold text-[11px] text-center px-1 leading-tight max-w-full truncate">
              {label || 'Label'}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. JOUMPA"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... or /dashboard/..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="mb-2 block text-[11px] font-medium text-gray-500">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  className={`w-7 h-7 rounded-full transition-all ${color === c.name ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ background: gradient(c.name) }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="mb-2 block text-[11px] font-medium text-gray-500">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  onClick={() => setIcon(name)}
                  title={name}
                  className={`flex items-center justify-center h-10 rounded-lg transition-all ${icon === name ? 'bg-emerald-50 ring-2 ring-emerald-400 text-emerald-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !label.trim() || !url.trim()}
            className="h-9 inline-flex items-center gap-2 px-5 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
