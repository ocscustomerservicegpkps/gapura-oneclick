'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    ArrowLeft,
    ArrowDownAZ,
    ArrowUpAZ,
    BookOpen,
    ChevronsUpDown,
    FileSpreadsheet,
    Loader2,
    LogOut,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/hooks/use-auth';
import { logoutWithPwaCleanup } from '@/lib/pwa/logout';
import { exportDivisionDocumentsToExcel } from '@/lib/division-documents-export';
import { getFileKind } from '@/lib/material-file-kind';
import { resolveMaterialLinks, type MaterialLink } from '@/lib/division-documents-material-links';
import { cn } from '@/lib/utils';
import { AIRLINES } from '@/data/airlines';
import type { DivisionDocument } from '@/types';

// ponytail: branch roles excluded from CRUD here; keep in sync with BRANCH_ROLES in lib/server/workspace-auth.ts
const BRANCH_ROLES = ['MANAGER_CABANG', 'STAFF_CABANG', 'CABANG', 'EMPLOYEE'];

interface StationOption {
    id: string;
    code: string;
    name: string;
}

type SortKey = 'meeting_date' | 'title' | 'activity_location' | 'activity_pic' | 'station' | 'airline' | 'participants';
type SortDir = 'asc' | 'desc';
interface SortRule { key: SortKey; dir: SortDir }

interface DocumentFormState {
    title: string;
    meeting_date: string;
    activity_pic: string;
    activity_location: string;
    station_id: string;
    airline: string;
    participants: string;
    material_links: MaterialLink[];
    sendTo: 'all' | 'station';
    target_station_id: string;
}

function initialForm(): DocumentFormState {
    return {
        title: '',
        meeting_date: '',
        activity_pic: '',
        activity_location: '',
        station_id: '',
        airline: '',
        participants: '',
        material_links: [{ title: '', url: '' }],
        sendTo: 'all',
        target_station_id: '',
    };
}

interface FieldFilters {
    title: string;
    activity_location: string;
    activity_pic: string;
    station: string;
    airline: string;
    participants: string;
    dateFrom: string;
    dateTo: string;
}

function emptyFilters(): FieldFilters {
    return { title: '', activity_location: '', activity_pic: '', station: '', airline: '', participants: '', dateFrom: '', dateTo: '' };
}

const ROW_LIMIT = 50;

function formatDate(value?: string | null) {
    if (!value) return '—';
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function sortValue(doc: DivisionDocument, key: SortKey): string {
    switch (key) {
        case 'meeting_date': return doc.meeting_date || doc.created_at || '';
        case 'title': return doc.title || '';
        case 'activity_location': return doc.activity_location || '';
        case 'station': return doc.station_code || doc.station_name || '';
        case 'airline': return doc.airline || '';
        case 'activity_pic': return doc.activity_pic || '';
        case 'participants': return doc.participants || '';
        default: return '';
    }
}

function MaterialButton({ href, label }: { href?: string | null; label: string }) {
    if (!href) return null;
    const kind = getFileKind(href);
    const Icon = kind.icon;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition hover:shadow-sm',
                kind.className
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </a>
    );
}

export function EskalasiDocumentsViewerPage({ hideNav = false }: { hideNav?: boolean } = {}) {
    const { user } = useAuth(false);
    const role = String(user?.role || '').trim().toUpperCase();
    const canManage = Boolean(role) && !BRANCH_ROLES.includes(role);

    const [documents, setDocuments] = useState<DivisionDocument[]>([]);
    const [stations, setStations] = useState<StationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [sortRules, setSortRules] = useState<SortRule[]>([{ key: 'meeting_date', dir: 'desc' }]);
    const [filters, setFilters] = useState<FieldFilters>(emptyFilters());
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [visibleCount, setVisibleCount] = useState(ROW_LIMIT);
    const [editing, setEditing] = useState<DivisionDocument | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);
    const [form, setForm] = useState<DocumentFormState>(initialForm());
    const [removeTarget, setRemoveTarget] = useState<DivisionDocument | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [docsRes, stationsRes] = await Promise.all([
                fetch('/api/division-documents?division=ANALYST', { cache: 'no-store' }),
                fetch('/api/master-data?type=stations', { cache: 'force-cache' }),
            ]);
            const data = await docsRes.json().catch(() => ({}));
            if (!docsRes.ok) throw new Error(data.error || 'Unable to load documents');
            const stationData = stationsRes.ok ? await stationsRes.json() : [];
            setDocuments(Array.isArray(data) ? data : []);
            setStations(Array.isArray(stationData) ? stationData : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load documents');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const openCreate = useCallback(() => {
        setEditing(null);
        setForm(initialForm());
        setComposerOpen(true);
    }, []);

    const openEdit = useCallback((doc: DivisionDocument) => {
        setEditing(doc);
        const links = resolveMaterialLinks(doc);
        setForm({
            title: doc.title,
            meeting_date: doc.meeting_date?.slice(0, 10) || '',
            activity_pic: doc.activity_pic || '',
            activity_location: doc.activity_location || '',
            station_id: doc.station_id || '',
            airline: doc.airline || '',
            participants: doc.participants || '',
            material_links: links.length > 0 ? links : [{ title: '', url: '' }],
            sendTo: doc.visibility_scope === 'stations' ? 'station' : 'all',
            target_station_id: doc.audience_station_ids?.[0] || '',
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
            const sendToStation = form.sendTo === 'station' && form.target_station_id;
            const targetStation = sendToStation ? stations.find((s) => s.id === form.target_station_id) : null;
            const body = {
                division: 'ANALYST',
                category: 'NOTULENSI_RAPAT',
                title: form.title.trim() || '(No agenda)',
                meeting_date: form.meeting_date || null,
                activity_pic: form.activity_pic.trim() || null,
                activity_location: form.activity_location.trim() || null,
                station_id: form.station_id || null,
                airline: form.airline.trim() || null,
                participants: form.participants.trim() || null,
                source_type: 'link',
                material_links: form.material_links
                    .map((link) => ({ title: link.title.trim(), url: link.url.trim() }))
                    .filter((link) => link.url),
                visibility_scope: sendToStation ? 'stations' : 'all',
                audience_station_ids: sendToStation ? [form.target_station_id] : [],
                audience_roles: ['MANAGER_CABANG', 'STAFF_CABANG'],
                audience_label: targetStation ? `${targetStation.code} — ${targetStation.name}` : 'All branches',
            };

            const res = await fetch(
                editing ? `/api/division-documents/${editing.id}` : '/api/division-documents',
                { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            );
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Unable to save document');
            closeComposer();
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save document');
        } finally {
            setSaving(false);
        }
    }, [closeComposer, editing, form, load, stations]);

    const removeDocument = useCallback(async () => {
        if (!removeTarget) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/division-documents/${removeTarget.id}`, { method: 'DELETE' });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Unable to remove document');
            setRemoveTarget(null);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to remove document');
        } finally {
            setSaving(false);
        }
    }, [load, removeTarget]);

    const visibleDocuments = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = documents.filter((doc) => {
            if (query) {
                const haystack = [doc.title, doc.activity_location, doc.activity_pic, doc.station_code, doc.station_name, doc.airline, doc.participants]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            if (filters.title && !(doc.title || '').toLowerCase().includes(filters.title.toLowerCase())) return false;
            if (filters.activity_location && !(doc.activity_location || '').toLowerCase().includes(filters.activity_location.toLowerCase())) return false;
            if (filters.activity_pic && !(doc.activity_pic || '').toLowerCase().includes(filters.activity_pic.toLowerCase())) return false;
            if (filters.station) {
                const stationHay = `${doc.station_code || ''} ${doc.station_name || ''}`.toLowerCase();
                if (!stationHay.includes(filters.station.toLowerCase())) return false;
            }
            if (filters.airline && !(doc.airline || '').toLowerCase().includes(filters.airline.toLowerCase())) return false;
            if (filters.participants && !(doc.participants || '').toLowerCase().includes(filters.participants.toLowerCase())) return false;
            const docDate = (doc.meeting_date || doc.created_at || '').slice(0, 10);
            if (filters.dateFrom && (!docDate || docDate < filters.dateFrom)) return false;
            if (filters.dateTo && (!docDate || docDate > filters.dateTo)) return false;
            return true;
        });
        const sorted = [...filtered].sort((a, b) => {
            for (const rule of sortRules) {
                const cmp = sortValue(a, rule.key).localeCompare(sortValue(b, rule.key));
                if (cmp !== 0) return rule.dir === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
        return sorted;
    }, [documents, search, filters, sortRules]);

    const displayedDocuments = useMemo(
        () => visibleDocuments.slice(0, visibleCount),
        [visibleDocuments, visibleCount]
    );

    useEffect(() => { setVisibleCount(ROW_LIMIT); }, [search, filters, sortRules]);

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                setVisibleCount((c) => Math.min(c + ROW_LIMIT, visibleDocuments.length));
            }
        }, { rootMargin: '300px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [visibleDocuments.length]);

    const toggleSort = useCallback((key: SortKey, additive: boolean) => {
        setSortRules((current) => {
            const idx = current.findIndex((r) => r.key === key);
            if (additive) {
                if (idx === -1) return [...current, { key, dir: 'asc' }];
                const next = [...current];
                next[idx] = { ...next[idx], dir: next[idx].dir === 'asc' ? 'desc' : 'asc' };
                return next;
            }
            if (current.length === 1 && current[0].key === key) {
                return [{ key, dir: current[0].dir === 'asc' ? 'desc' : 'asc' }];
            }
            return [{ key, dir: 'asc' }];
        });
    }, []);

    const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

    const removeSortRule = useCallback((key: SortKey) => {
        setSortRules((current) => {
            const next = current.filter((r) => r.key !== key);
            return next.length > 0 ? next : [{ key: 'meeting_date', dir: 'desc' }];
        });
    }, []);

    const SORT_LABELS: Record<SortKey, string> = {
        meeting_date: 'Date',
        title: 'Agenda',
        activity_location: 'Location',
        activity_pic: 'PIC / Division',
        station: 'Station',
        airline: 'Airlines',
        participants: 'Participants',
    };

    const exportExcel = useCallback(async () => {
        setExporting(true);
        try {
            await exportDivisionDocumentsToExcel(visibleDocuments);
        } finally {
            setExporting(false);
        }
    }, [visibleDocuments]);

    const SortHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => {
        const ruleIndex = sortRules.findIndex((r) => r.key === sortKeyValue);
        const rule = ruleIndex !== -1 ? sortRules[ruleIndex] : null;
        return (
            <button
                type="button"
                onClick={(e) => toggleSort(sortKeyValue, e.shiftKey)}
                title="Click to sort · Shift+click for multi-sort"
                className={cn(
                    'inline-flex items-center gap-1 text-left text-xs font-bold uppercase tracking-wide transition-colors',
                    rule
                        ? 'text-emerald-700'
                        : 'text-emerald-900/60 hover:text-emerald-900'
                )}
            >
                {label}
                {rule ? (
                    <span className="inline-flex items-center gap-0.5">
                        {rule.dir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
                        {sortRules.length > 1 && (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                                {ruleIndex + 1}
                            </span>
                        )}
                    </span>
                ) : (
                    <ChevronsUpDown className="h-3 w-3 opacity-25" />
                )}
            </button>
        );
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#F3F6F1]">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F6F8F4] via-[#EEF4EE] to-[#E4EFE6]" />
                <div className="absolute -top-40 left-[-10%] h-[560px] w-[560px] rounded-full bg-emerald-300/30 blur-[140px]" />
                <div className="absolute top-1/4 right-[-10%] h-[520px] w-[520px] rounded-full bg-teal-200/35 blur-[140px]" />
                <div className="absolute bottom-[-15%] left-1/3 h-[480px] w-[480px] rounded-full bg-lime-200/25 blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] [background-size:26px_26px]" />
            </div>

            {!hideNav && (
                <>
                    <Link
                        href="/dashboard/eskalasi/select"
                        className="fixed left-4 top-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-95 sm:left-6 sm:top-6"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                    <button
                        type="button"
                        onClick={() => logoutWithPwaCleanup()}
                        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-95 sm:bottom-6 sm:left-6"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </>
            )}

            <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10" style={hideNav ? undefined : { paddingTop: '5rem' }}>
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                            Circulars & Materials
                        </h1>
                        <p className="mt-2 max-w-lg text-sm font-medium text-slate-500">
                            Meeting records, materials, and attendance shared by the analyst team.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void exportExcel()}
                            disabled={exporting || visibleDocuments.length === 0}
                            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-900/10 bg-white/70 px-4 text-sm font-bold text-slate-700 backdrop-blur-md transition hover:bg-white disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => void load()}
                            disabled={loading}
                            aria-label="Refresh"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-900/10 bg-white/70 text-slate-700 backdrop-blur-md transition hover:bg-white active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                        </button>
                        {canManage && (
                            <button
                                type="button"
                                onClick={openCreate}
                                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                                <Plus className="h-4 w-4" />
                                Add entry
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <div className="relative max-w-md flex-1 min-w-[220px]">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search agenda, station, airline, or PIC"
                            className="h-11 w-full rounded-2xl border border-emerald-900/10 bg-white/70 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none backdrop-blur-md transition focus:border-emerald-500 focus:bg-white"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((v) => !v)}
                        className={cn(
                            'inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-bold backdrop-blur-md transition',
                            filtersOpen || hasActiveFilters
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-emerald-900/10 bg-white/70 text-slate-700 hover:bg-white'
                        )}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </button>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => setFilters(emptyFilters())}
                            className="inline-flex h-11 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold text-slate-500 transition hover:text-rose-600"
                        >
                            <X className="h-4 w-4" />
                            Clear filters
                        </button>
                    )}
                </div>

                {filtersOpen && (
                    <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-emerald-900/10 bg-white/70 p-4 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Agenda
                            <input value={filters.title} onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Location
                            <input value={filters.activity_location} onChange={(e) => setFilters((f) => ({ ...f, activity_location: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            PIC / Division
                            <input value={filters.activity_pic} onChange={(e) => setFilters((f) => ({ ...f, activity_pic: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Station
                            <input value={filters.station} onChange={(e) => setFilters((f) => ({ ...f, station: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Airlines
                            <select value={filters.airline} onChange={(e) => setFilters((f) => ({ ...f, airline: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500">
                                <option value="">All Airlines</option>
                                {AIRLINES.map((a) => (
                                    <option key={a.code} value={a.name}>{a.code} — {a.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Participants
                            <input value={filters.participants} onChange={(e) => setFilters((f) => ({ ...f, participants: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Date from
                            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-emerald-900/60">
                            Date to
                            <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500" />
                        </label>
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-900/40">Sort by</span>
                    {sortRules.map((rule, i) => (
                        <span
                            key={rule.key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                        >
                            {sortRules.length > 1 && (
                                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                                    {i + 1}
                                </span>
                            )}
                            {SORT_LABELS[rule.key]}
                            {rule.dir === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />}
                            <button
                                type="button"
                                onClick={() => removeSortRule(rule.key)}
                                aria-label={`Remove sort by ${SORT_LABELS[rule.key]}`}
                                className="ml-0.5 rounded-full p-0.5 transition hover:bg-emerald-200"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </span>
                    ))}
                    {sortRules.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setSortRules([{ key: 'meeting_date', dir: 'desc' }])}
                            className="text-xs font-semibold text-slate-400 transition hover:text-rose-500"
                        >
                            Reset
                        </button>
                    )}
                    <span className="ml-auto hidden text-[11px] font-medium text-slate-400 sm:block">
                        Shift+click a column header for multi-sort
                    </span>
                </div>

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 backdrop-blur-md">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="grid min-h-[320px] place-items-center rounded-3xl border border-emerald-900/10 bg-white/60 backdrop-blur-md">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600/70" />
                    </div>
                ) : visibleDocuments.length === 0 ? (
                    <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-emerald-900/15 bg-white/60 backdrop-blur-md">
                        <div className="text-center px-6">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900/5 text-slate-500">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <h2 className="mt-4 text-lg font-extrabold tracking-tight text-slate-950">No entries yet</h2>
                            <p className="mt-1 max-w-xs text-sm font-medium text-slate-500">
                                Once the analyst team publishes a record, it will appear here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-[28px] border border-emerald-900/8 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-emerald-900/8 bg-emerald-900/[0.03]">
                                        <th className="px-5 py-4 text-left"><SortHeader label="Date" sortKeyValue="meeting_date" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="Agenda" sortKeyValue="title" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="Location" sortKeyValue="activity_location" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="PIC / Division" sortKeyValue="activity_pic" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="Station" sortKeyValue="station" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="Airlines" sortKeyValue="airline" /></th>
                                        <th className="px-5 py-4 text-left"><SortHeader label="Participants" sortKeyValue="participants" /></th>
                                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-emerald-900/60">Materials</th>
                                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-emerald-900/60">Send to</th>
                                        {canManage && <th className="px-5 py-4" />}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-900/5">
                                    {displayedDocuments.map((doc) => (
                                        <tr key={doc.id} className="transition hover:bg-emerald-900/[0.02]">
                                            <td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatDate(doc.meeting_date || doc.created_at)}</td>
                                            <td className="px-5 py-4 max-w-[260px] whitespace-normal break-words font-bold text-slate-950">{doc.title}</td>
                                            <td className="px-5 py-4 max-w-[180px] whitespace-normal break-words text-slate-600">{doc.activity_location || '—'}</td>
                                            <td className="px-5 py-4 text-slate-600">{doc.activity_pic || '—'}</td>
                                            <td className="px-5 py-4 text-slate-600">{doc.station_code || doc.station_name || '—'}</td>
                                            <td className="px-5 py-4 text-slate-600">{doc.airline || '—'}</td>
                                            <td className="px-5 py-4 max-w-[220px] whitespace-normal break-words text-slate-600">{doc.participants || '—'}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {resolveMaterialLinks(doc).map((link, idx) => (
                                                        <MaterialButton key={`${doc.id}-${idx}`} href={link.url} label={link.title || 'Link'} />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                                                {doc.visibility_scope === 'stations' ? (doc.audience_label || 'Selected branch') : 'All branches'}
                                            </td>
                                            {canManage && (
                                                <td className="px-5 py-4 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-900/5 hover:text-slate-900"
                                                                aria-label="Document actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEdit(doc)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setRemoveTarget(doc)}>
                                                                Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {visibleCount < visibleDocuments.length && (
                            <div ref={sentinelRef} className="flex items-center justify-center py-5">
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-600/60" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {composerOpen && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                            <div>
                                <h2 className="text-lg font-bold text-slate-950">{editing ? 'Edit entry' : 'Add entry'}</h2>
                                <p className="mt-1 text-sm text-slate-500">Log the meeting details and material links.</p>
                            </div>
                            <button type="button" onClick={closeComposer} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                        Date
                                        <input
                                            type="date"
                                            value={form.meeting_date}
                                            onChange={(e) => setForm((c) => ({ ...c, meeting_date: e.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                        />
                                    </label>
                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                        Location
                                        <input
                                            value={form.activity_location}
                                            onChange={(e) => setForm((c) => ({ ...c, activity_location: e.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                        />
                                    </label>
                                </div>

                                <label className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Agenda
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                    />
                                </label>

                                <div className="grid gap-5 sm:grid-cols-3">
                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                        PIC / Division
                                        <input
                                            value={form.activity_pic}
                                            onChange={(e) => setForm((c) => ({ ...c, activity_pic: e.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                        />
                                    </label>
                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                        Station
                                        <select
                                            value={form.station_id}
                                            onChange={(e) => setForm((c) => ({ ...c, station_id: e.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-emerald-500"
                                        >
                                            <option value="">—</option>
                                            {stations.map((s) => (
                                                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                        Airlines
                                        <select
                                            value={form.airline}
                                            onChange={(e) => setForm((c) => ({ ...c, airline: e.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-emerald-500"
                                        >
                                            <option value="">—</option>
                                            {AIRLINES.map((a) => (
                                                <option key={a.code} value={a.name}>{a.code} — {a.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="block space-y-2 text-sm font-semibold text-slate-700">
                                    Participants
                                    <textarea
                                        value={form.participants}
                                        onChange={(e) => setForm((c) => ({ ...c, participants: e.target.value }))}
                                        rows={2}
                                        placeholder="Names of attendees"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-emerald-500"
                                    />
                                </label>

                                <fieldset className="rounded-xl border border-slate-200 p-4">
                                    <legend className="px-2 text-sm font-semibold text-slate-700">Material links</legend>
                                    <div className="space-y-4">
                                        {form.material_links.map((link, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                                        Title
                                                        <input
                                                            value={link.title}
                                                            onChange={(e) => setForm((c) => ({
                                                                ...c,
                                                                material_links: c.material_links.map((l, i) => i === idx ? { ...l, title: e.target.value } : l),
                                                            }))}
                                                            placeholder="e.g. SOP Ground Handling"
                                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                                        />
                                                    </label>
                                                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                                                        Link
                                                        <input
                                                            type="url"
                                                            value={link.url}
                                                            onChange={(e) => setForm((c) => ({
                                                                ...c,
                                                                material_links: c.material_links.map((l, i) => i === idx ? { ...l, url: e.target.value } : l),
                                                            }))}
                                                            placeholder="https://..."
                                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-emerald-500"
                                                        />
                                                    </label>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setForm((c) => ({
                                                        ...c,
                                                        material_links: c.material_links.filter((_, i) => i !== idx),
                                                    }))}
                                                    aria-label="Remove link"
                                                    className="mt-8 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setForm((c) => ({
                                                ...c,
                                                material_links: [...c.material_links, { title: '', url: '' }],
                                            }))}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-600 transition hover:border-emerald-400 hover:bg-emerald-50"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add more link
                                        </button>
                                    </div>
                                </fieldset>

                                <fieldset className="rounded-xl border border-slate-200 p-4">
                                    <legend className="px-2 text-sm font-semibold text-slate-700">Send to</legend>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                            <input
                                                type="radio"
                                                name="sendTo"
                                                checked={form.sendTo === 'all'}
                                                onChange={() => setForm((c) => ({ ...c, sendTo: 'all' }))}
                                            />
                                            All branches
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                            <input
                                                type="radio"
                                                name="sendTo"
                                                checked={form.sendTo === 'station'}
                                                onChange={() => setForm((c) => ({ ...c, sendTo: 'station' }))}
                                            />
                                            Specific branch
                                        </label>
                                    </div>
                                    {form.sendTo === 'station' && (
                                        <select
                                            value={form.target_station_id}
                                            onChange={(e) => setForm((c) => ({ ...c, target_station_id: e.target.value }))}
                                            required
                                            className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-500"
                                        >
                                            <option value="">Select branch...</option>
                                            {stations.map((s) => (
                                                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </fieldset>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
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
                                    disabled={saving}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {saving ? 'Saving...' : 'Save entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body,
            ) : null}

            <ConfirmDialog
                open={Boolean(removeTarget)}
                title={`Remove "${removeTarget?.title}"?`}
                confirmLabel="Remove"
                danger
                onConfirm={() => void removeDocument()}
                onCancel={() => setRemoveTarget(null)}
            />
        </div>
    );
}
