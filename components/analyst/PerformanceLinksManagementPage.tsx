'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ExternalLink, GripVertical, ImagePlus, Loader2, MoreHorizontal, Plus, QrCode, RefreshCw, Search, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { cn } from '@/lib/utils';
import type { PerformanceLink } from '@/types';

type LinkCategory = 'ground-handling' | 'joumpa';

const CATEGORIES: { id: LinkCategory; label: string }[] = [
    { id: 'ground-handling', label: 'Ground Handling' },
    { id: 'joumpa', label: 'JOUMPA' },
];

interface FormState {
    title: string;
    url: string;
    description: string;
    thumbnailUrl: string;
    category: LinkCategory;
}

function initialForm(): FormState {
    return { title: '', url: '', description: '', thumbnailUrl: '', category: 'ground-handling' };
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function PerformanceLinksManagementPage() {
    const [links, setLinks] = useState<PerformanceLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [composerOpen, setComposerOpen] = useState(false);
    const [editing, setEditing] = useState<PerformanceLink | null>(null);
    const [form, setForm] = useState<FormState>(initialForm());
    const [qrLink, setQrLink] = useState<PerformanceLink | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/performance-links', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Unable to load links');
            setLinks(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load links');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filteredLinks = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return links;
        return links.filter((l) => [l.title, l.url, l.description].filter(Boolean).join(' ').toLowerCase().includes(query));
    }, [links, search]);

    const openCreate = useCallback(() => {
        setEditing(null);
        setForm(initialForm());
        setComposerOpen(true);
    }, []);

    const openEdit = useCallback((link: PerformanceLink) => {
        setEditing(link);
        setForm({
            title: link.title,
            url: link.url,
            description: link.description || '',
            thumbnailUrl: link.thumbnail_url || '',
            category: link.category || 'ground-handling',
        });
        setComposerOpen(true);
    }, []);

    const closeComposer = useCallback(() => {
        setComposerOpen(false);
        setEditing(null);
        setForm(initialForm());
    }, []);

    const submit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const body = {
                title: form.title.trim(),
                url: form.url.trim(),
                description: form.description.trim() || null,
                thumbnail_url: form.thumbnailUrl.trim() || null,
                category: form.category,
            };
            const res = await fetch(
                editing ? `/api/performance-links/${editing.id}` : '/api/performance-links',
                { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            );
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Unable to save link');
            closeComposer();
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save link');
        } finally {
            setSaving(false);
        }
    }, [closeComposer, editing, form, load]);

    const removeLink = useCallback(async (link: PerformanceLink) => {
        if (!window.confirm(`Remove "${link.title}"?`)) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/performance-links/${link.id}`, { method: 'DELETE' });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Unable to remove link');
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to remove link');
        } finally {
            setSaving(false);
        }
    }, [load]);

    const uploadThumbnail = useCallback(async (file: File) => {
        setUploadingThumbnail(true);
        setError('');
        try {
            const body = new FormData();
            body.append('file', file);
            const res = await fetch('/api/uploads/performance-link-thumbnail', { method: 'POST', body });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Unable to upload photo');
            setForm((c) => ({ ...c, thumbnailUrl: result.url }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to upload photo');
        } finally {
            setUploadingThumbnail(false);
        }
    }, []);

    const copyLink = useCallback(async (link: PerformanceLink) => {
        try {
            await navigator.clipboard.writeText(link.url);
            setCopiedId(link.id);
            setTimeout(() => setCopiedId((cur) => (cur === link.id ? null : cur)), 1500);
        } catch {
            setError('Unable to copy link to clipboard');
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setDragOverId(null);
    }, []);

    const handleDrop = useCallback(async (targetId: string) => {
        const fromId = draggingId;
        handleDragEnd();
        if (!fromId || fromId === targetId) return;

        const fromIndex = links.findIndex((l) => l.id === fromId);
        const toIndex = links.findIndex((l) => l.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const reordered = [...links];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        setLinks(reordered);

        try {
            const res = await fetch('/api/performance-links/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: reordered.map((l) => l.id) }),
            });
            if (!res.ok) throw new Error('Unable to save the new order');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save the new order');
            await load();
        }
    }, [draggingId, handleDragEnd, links, load]);

    return (
        <div className="min-h-screen bg-[#F7F8FA] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                <QrCode className="h-4 w-4" />
                                Performance Evaluation Monitoring
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Manage Links</h1>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                                Add external links. A QR code is generated automatically for each one.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void load()}
                                disabled={loading}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                aria-label="Refresh"
                            >
                                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                            </button>
                            <button
                                type="button"
                                onClick={openCreate}
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                            >
                                <Plus className="h-4 w-4" />
                                Add link
                            </button>
                        </div>
                    </div>
                </header>

                {error ? (
                    <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="h-4 w-4" /></button>
                    </div>
                ) : null}

                <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search title or URL"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-80 items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                        </div>
                    ) : filteredLinks.length === 0 ? (
                        <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                            <QrCode className="h-10 w-10 text-slate-300" />
                            <h2 className="mt-4 text-base font-semibold text-slate-800">No links found</h2>
                            <p className="mt-1 text-sm text-slate-500">Add the first link or adjust the current search.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                            {filteredLinks.map((link) => {
                                const isDragging = draggingId === link.id;
                                const isDropTarget = dragOverId === link.id && draggingId !== null && draggingId !== link.id;
                                return (
                                    <article
                                        key={link.id}
                                        onDragOver={(e) => { e.preventDefault(); if (draggingId && draggingId !== link.id) setDragOverId(link.id); }}
                                        onDragLeave={() => setDragOverId((cur) => (cur === link.id ? null : cur))}
                                        onDrop={(e) => { e.preventDefault(); void handleDrop(link.id); }}
                                        className={cn(
                                            'group relative overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] transition',
                                            isDragging ? 'border-emerald-900/8' : 'border-emerald-900/8 hover:-translate-y-1',
                                            isDropTarget && 'ring-2 ring-emerald-400 ring-offset-2'
                                        )}
                                    >
                                        {isDragging && (
                                            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] border-2 border-dashed border-emerald-300 bg-emerald-50/80 backdrop-blur-sm">
                                                <span className="text-xs font-bold uppercase tracking-wide text-emerald-500">Drop to reorder</span>
                                            </div>
                                        )}
                                        <div
                                            draggable
                                            onDragStart={(e) => { e.stopPropagation(); setDraggingId(link.id); }}
                                            onDragEnd={handleDragEnd}
                                            className="absolute right-3 top-3 z-30 flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 backdrop-blur transition hover:bg-white active:cursor-grabbing"
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </div>
                                        <div className={cn(isDragging && 'invisible')}>
                                            <button
                                                type="button"
                                                onClick={() => setQrLink(link)}
                                                className="relative block h-44 w-full overflow-hidden"
                                                aria-label="Show QR code"
                                            >
                                                {link.thumbnail_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={link.thumbnail_url}
                                                        alt=""
                                                        draggable={false}
                                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
                                                        <QrCode className="h-16 w-16 text-white/25" />
                                                    </div>
                                                )}
                                            </button>
                                            <div className="px-5 pb-5 pt-5">
                                                <span
                                                    className={cn(
                                                        'mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                                                        link.category === 'joumpa'
                                                            ? 'bg-lime-100 text-lime-700'
                                                            : 'bg-teal-100 text-teal-700'
                                                    )}
                                                >
                                                    {link.category === 'joumpa' ? 'JOUMPA' : 'Ground Handling'}
                                                </span>
                                                <h3 className="line-clamp-2 text-base font-extrabold leading-tight tracking-tight text-slate-950">
                                                    {link.title}
                                                </h3>
                                                <span className="mt-1 block truncate text-xs font-medium text-slate-500">{link.url}</span>
                                                <span className="mt-1 block text-xs text-slate-400">{formatDate(link.created_at)}</span>
                                                <div className="mt-4 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyLink(link)}
                                                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        {copiedId === link.id ? 'Copied' : 'Copy'}
                                                    </button>
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        draggable={false}
                                                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Open
                                                    </a>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                                                                aria-label="Link actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEdit(link)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => void removeLink(link)}>
                                                                Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {qrLink && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="flex items-start justify-between">
                            <h2 className="text-left text-lg font-bold text-slate-950">{qrLink.title}</h2>
                            <button type="button" onClick={() => setQrLink(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-4 flex justify-center">
                            <QRCodeWithLogo value={qrLink.url} size={220} />
                        </div>
                        <p className="mt-4 break-all text-xs text-slate-500">{qrLink.url}</p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => void copyLink(qrLink)}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                <Copy className="h-4 w-4" />
                                {copiedId === qrLink.id ? 'Copied' : 'Copy link'}
                            </button>
                            <a
                                href={qrLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open
                            </a>
                        </div>
                    </div>
                </div>,
                document.body,
            ) : null}

            {composerOpen && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                            <h2 className="text-lg font-bold text-slate-950">{editing ? 'Edit link' : 'Add link'}</h2>
                            <button type="button" onClick={closeComposer} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={submit}>
                            <div className="space-y-5 p-6">
                                <label className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Title
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                        required
                                    />
                                </label>
                                <div className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Category
                                    <div className="grid grid-cols-2 gap-2">
                                        {CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setForm((c) => ({ ...c, category: cat.id }))}
                                                className={cn(
                                                    'h-10 rounded-lg border px-3 text-sm font-semibold transition',
                                                    form.category === cat.id
                                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                )}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <label className="block space-y-2 text-sm font-semibold text-slate-700">
                                    URL
                                    <input
                                        type="url"
                                        value={form.url}
                                        onChange={(e) => setForm((c) => ({ ...c, url: e.target.value }))}
                                        placeholder="https://..."
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                        required
                                    />
                                </label>
                                <label className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Description (optional)
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                                        rows={3}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-emerald-500"
                                    />
                                </label>
                                <div className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Cover photo (optional)
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                            {uploadingThumbnail ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                            ) : form.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={form.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <ImagePlus className="h-5 w-5 text-slate-300" />
                                            )}
                                        </div>
                                        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                            {form.thumbnailUrl ? 'Replace photo' : 'Upload photo'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) void uploadThumbnail(file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                        {form.thumbnailUrl ? (
                                            <button
                                                type="button"
                                                onClick={() => setForm((c) => ({ ...c, thumbnailUrl: '' }))}
                                                className="text-xs font-semibold text-slate-400 hover:text-red-600"
                                            >
                                                Remove
                                            </button>
                                        ) : null}
                                    </div>
                                    <p className="text-xs font-normal text-slate-400">
                                        Shown as the card cover on the escalation monitoring page. If left empty, an abstract gradient is used instead.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={closeComposer}
                                    disabled={saving}
                                    className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || uploadingThumbnail}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {saving ? 'Saving...' : 'Save link'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body,
            ) : null}
        </div>
    );
}
