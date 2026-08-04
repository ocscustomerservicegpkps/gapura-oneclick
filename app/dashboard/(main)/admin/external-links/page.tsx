'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Link2, RefreshCw, Copy, Check, Save, RotateCcw,
  ChevronDown, ChevronUp, ExternalLink, AlertCircle, Loader2,
  Database, Plus, X,
} from 'lucide-react';
import {
  DEFAULT_EXTERNAL_LINKS, CATEGORY_LABELS,
  type ExternalLinkEntry,
} from '@/lib/external-links';

type LinkWithDirty = ExternalLinkEntry & { isDirty?: boolean };

export default function ExternalLinksAdminPage() {
  const [links, setLinks] = useState<LinkWithDirty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ google_forms: true, looker_studio: true, other: true });
  const [addModalOpen, setAddModalOpen] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/external-links');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLinks((data.links || []).map((l: ExternalLinkEntry) => ({ ...l, isDirty: false })));
    } catch {
      setError('Failed to load links. Using defaults.');
      setLinks(Object.values(DEFAULT_EXTERNAL_LINKS).map((l) => ({ ...l, isDirty: false })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleSeed = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/external-links', { method: 'POST' });
      if (!res.ok) throw new Error('Seed failed');
      await fetchLinks();
    } catch {
      setError('Failed to seed default links.');
    } finally {
      setLoading(false);
    }
  };

  const updateLink = (id: string, field: string, value: string) => {
    setLinks((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const defaultEntry = DEFAULT_EXTERNAL_LINKS[id];
        const urlChanged = field === 'url' ? value !== defaultEntry?.url : l.url !== defaultEntry?.url;
        const fieldChanged = value !== defaultEntry?.[field as keyof ExternalLinkEntry];
        return { ...l, [field]: value, isDirty: urlChanged || fieldChanged };
      })
    );
  };

  const saveLink = async (link: LinkWithDirty) => {
    setSaving(link.id);
    try {
      const res = await fetch('/api/admin/external-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: [{ id: link.id, label: link.label, url: link.url, category: link.category, description: link.description }] }),
      });
      if (!res.ok) throw new Error('Save failed');
      setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, isDirty: false } : l));
    } catch {
      setError('Failed to save link.');
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    const dirty = links.filter((l) => l.isDirty);
    if (dirty.length === 0) return;
    setSaving('__all__');
    try {
      const res = await fetch('/api/admin/external-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- isDirty is intentionally stripped out via rest destructuring before sending to the API
        body: JSON.stringify({ links: dirty.map(({ isDirty, ...l }) => l) }),
      });
      if (!res.ok) throw new Error('Save all failed');
      setLinks((prev) => prev.map((l) => ({ ...l, isDirty: false })));
    } catch {
      setError('Failed to save changes.');
    } finally {
      setSaving(null);
    }
  };

  const resetLink = (id: string) => {
    const def = DEFAULT_EXTERNAL_LINKS[id];
    if (!def) return;
    setLinks((prev) => prev.map((l) => l.id === id ? { ...def, isDirty: false } : l));
  };

  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const grouped = links.reduce<Record<string, LinkWithDirty[]>>((acc, l) => {
    (acc[l.category] = acc[l.category] || []).push(l);
    return acc;
  }, {});

  const dirtyCount = links.filter((l) => l.isDirty).length;

  const handleAddLink = async (entry: { id: string; label: string; url: string; category: string; description: string }) => {
    setSaving('__add__');
    try {
      const res = await fetch('/api/admin/external-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: [entry] }),
      });
      if (!res.ok) throw new Error('Add failed');
      setAddModalOpen(false);
      await fetchLinks();
    } catch {
      setError('Failed to add new link.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <Link2 className="w-6 h-6 text-emerald-600" />
            </div>
            External Links
          </h1>
          <p className="text-sm text-black/60 font-bold mt-1">Kelola semua link eksternal dan QR code di sistem.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Link
          </button>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5 transition-all"
          >
            <Database className="w-4 h-4" /> Seed Defaults
          </button>
          <button
            onClick={fetchLinks}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {}
      {dirtyCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-700">{dirtyCount} perubahan belum disimpan</span>
          <div className="flex gap-2">
            <button onClick={saveAll} disabled={saving === '__all__'} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold active:scale-95 disabled:opacity-50">
              {saving === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save All'}
            </button>
          </div>
        </div>
      )}

      {}
      {loading && links.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (

        Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
          const catLinks = grouped[catKey] || [];
          if (catLinks.length === 0) return null;
          const isOpen = expanded[catKey] !== false;

          return (
            <div key={catKey} className="rounded-2xl border border-black/10 bg-white overflow-hidden">
              {}
              <button
                onClick={() => toggleCategory(catKey)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black uppercase tracking-widest text-black/50">{catLabel}</span>
                  <span className="px-2 py-0.5 rounded-md bg-black/5 text-xs font-bold text-black/50">{catLinks.length}</span>
                  {catLinks.some((l) => l.isDirty) && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-black/40" /> : <ChevronDown className="w-4 h-4 text-black/40" />}
              </button>

              {}
              {isOpen && (
                <div className="divide-y divide-black/5">
                  {catLinks.map((link) => {
                    const def = DEFAULT_EXTERNAL_LINKS[link.id];
                    const urlDiffers = def && link.url !== def.url;

                    return (
                      <div key={link.id} className="p-5 space-y-3">
                        {}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              value={link.label}
                              onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                              className="flex-1 text-base font-extrabold bg-transparent border-none outline-none focus:ring-0 p-0"
                            />
                            {urlDiffers && (
                              <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-black uppercase">Modified</span>
                            )}
                            {link.isDirty && (
                              <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => copyUrl(link.url, link.id)} className="p-2 rounded-lg hover:bg-black/5 transition-colors" title="Copy URL">
                              {copied === link.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-black/40" />}
                            </button>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-black/5 transition-colors" title="Open in new tab">
                              <ExternalLink className="w-4 h-4 text-black/40" />
                            </a>
                            {def && (
                              <button onClick={() => resetLink(link.id)} className="p-2 rounded-lg hover:bg-black/5 transition-colors" title="Reset to default">
                                <RotateCcw className="w-4 h-4 text-black/40" />
                              </button>
                            )}
                            <button
                              onClick={() => saveLink(link)}
                              disabled={saving === link.id}
                              className="p-2 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              {saving === link.id
                                ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                : <Save className="w-4 h-4 text-emerald-600" />}
                            </button>
                          </div>
                        </div>

                        {}
                        <div className="flex gap-2">
                          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-black/40 pt-3 w-8">URL</span>
                          <input
                            value={link.url}
                            onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                            className="flex-1 px-3 py-2.5 rounded-lg border border-black/10 bg-white text-sm font-mono focus:border-emerald-500/50 outline-none transition-all"
                          />
                        </div>

                        {}
                        <div className="flex gap-2">
                          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-black/40 pt-3 w-16">Desc</span>
                          <input
                            value={link.description}
                            onChange={(e) => updateLink(link.id, 'description', e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-black/5 bg-black/[0.02] text-sm text-black/70 focus:border-emerald-500/50 outline-none transition-all"
                            placeholder="Description..."
                          />
                        </div>

                        {}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-black/30">ID: {link.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {}
      {addModalOpen && (
        <AddLinkModal
          onSave={handleAddLink}
          onClose={() => setAddModalOpen(false)}
          isLoading={saving === '__add__'}
          existingIds={links.map((l) => l.id)}
        />
      )}
    </div>
  );
}

function AddLinkModal({
  onSave,
  onClose,
  isLoading,
  existingIds,
}: {
  onSave: (entry: { id: string; label: string; url: string; category: string; description: string }) => void;
  onClose: () => void;
  isLoading: boolean;
  existingIds: string[];
}) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');

  const isValid = id && label && url && category && !existingIds.includes(id) && url.startsWith('http');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Add New Link</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">ID (slug)</label>
            <input value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="e.g. my-new-link" className="w-full px-3 py-2.5 rounded-lg border border-black/10 text-sm font-mono focus:border-emerald-500/50 outline-none" />
            {existingIds.includes(id) && <p className="text-xs text-red-500 font-bold mt-1">ID sudah digunakan</p>}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display name" className="w-full px-3 py-2.5 rounded-lg border border-black/10 text-sm font-bold focus:border-emerald-500/50 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2.5 rounded-lg border border-black/10 text-sm font-mono focus:border-emerald-500/50 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-black/10 text-sm focus:border-emerald-500/50 outline-none">
              <option value="google_forms">Google Forms</option>
              <option value="looker_studio">Looker Studio</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="w-full px-3 py-2.5 rounded-lg border border-black/10 text-sm focus:border-emerald-500/50 outline-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5 transition-all">
            Batal
          </button>
          <button onClick={() => isValid && onSave({ id, label, url, category, description })} disabled={!isValid || isLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
