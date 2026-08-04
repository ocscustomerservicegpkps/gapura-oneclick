'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Check,
    Copy,
    Loader2,
    LogOut,
    Plane,
    QrCode,
    RefreshCw,
    Share2,
    Users,
    X,
} from 'lucide-react';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { logoutWithPwaCleanup } from '@/lib/pwa/logout';
import type { PerformanceLink } from '@/types';

type TabId = 'ground-handling' | 'joumpa';

const TABS: { id: TabId; label: string; icon: typeof Plane; color: string; colorSoft: string }[] = [
    { id: 'ground-handling', label: 'Ground Handling', icon: Plane, color: '#0ea5a6', colorSoft: '#0d9488' },
    { id: 'joumpa', label: 'JOUMPA', icon: Users, color: '#65a30d', colorSoft: '#4d7c0f' },
];

function categorize(link: PerformanceLink): TabId {
    return link.category === 'joumpa' ? 'joumpa' : 'ground-handling';
}

export function PerformanceLinksViewerPage() {
    const [links, setLinks] = useState<PerformanceLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('ground-handling');
    const [activeLink, setActiveLink] = useState<PerformanceLink | null>(null);

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

    const tabbed = useMemo(() => {
        const buckets: Record<TabId, PerformanceLink[]> = { 'ground-handling': [], joumpa: [] };
        for (const link of links) buckets[categorize(link)].push(link);
        return buckets;
    }, [links]);

    const activeMeta = TABS.find((t) => t.id === activeTab)!;
    const visibleLinks = tabbed[activeTab];

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#F3F6F1]">
            {}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F6F8F4] via-[#EEF4EE] to-[#E4EFE6]" />
                <div className="absolute -top-40 left-[-10%] h-[560px] w-[560px] rounded-full bg-emerald-300/30 blur-[140px]" />
                <div className="absolute top-1/4 right-[-10%] h-[520px] w-[520px] rounded-full bg-teal-200/35 blur-[140px]" />
                <div className="absolute bottom-[-15%] left-1/3 h-[480px] w-[480px] rounded-full bg-lime-200/25 blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] [background-size:26px_26px]" />
            </div>

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

            <div className="mx-auto w-full max-w-[1400px] px-4 py-8 pt-20 sm:px-6 lg:px-10 lg:py-10 lg:pt-20">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                            Performance Evaluation Monitoring
                        </h1>
                        <p className="mt-2 max-w-lg text-sm font-medium text-slate-500">
                            Scan, copy, or share survey links for Ground Handling and JOUMPA.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading}
                        aria-label="Refresh"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-900/10 bg-white/70 text-slate-700 backdrop-blur-md transition hover:bg-white active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </button>
                </div>

                <div className="mb-8 flex gap-2">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = tab.id === activeTab;
                        const count = tabbed[tab.id].length;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold backdrop-blur-md transition ${
                                    isActive
                                        ? 'border-transparent text-white shadow-lg'
                                        : 'border-emerald-900/10 bg-white/70 text-slate-500 hover:bg-white'
                                }`}
                                style={isActive ? { background: tab.color } : undefined}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                                <span
                                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                                        isActive ? 'bg-white/25 text-white' : 'bg-emerald-900/5 text-slate-500'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
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
                ) : visibleLinks.length === 0 ? (
                    <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-emerald-900/15 bg-white/60 backdrop-blur-md">
                        <div className="text-center px-6">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900/5 text-slate-500">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <h2 className="mt-4 text-lg font-extrabold tracking-tight text-slate-950">No links on {activeMeta.label} yet</h2>
                            <p className="mt-1 max-w-xs text-sm font-medium text-slate-500">
                                Once the analyst team publishes a survey link for this division, it will appear here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleLinks.map((link) => (
                            <LinkCard
                                key={link.id}
                                link={link}
                                tab={activeMeta}
                                onSeeMore={() => setActiveLink(link)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {activeLink && (
                <LinkModal link={activeLink} accent={activeMeta.color} onClose={() => setActiveLink(null)} />
            )}
        </div>
    );
}

function LinkCard({
    link,
    tab,
    onSeeMore,
}: {
    link: PerformanceLink;
    tab: typeof TABS[number];
    onSeeMore: () => void;
}) {
    const Icon = tab.icon;
    return (
        <article className="group overflow-hidden rounded-[28px] border border-emerald-900/8 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] transition hover:-translate-y-1">
            <div className="relative h-44 w-full overflow-hidden">
                {link.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={link.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${tab.color}, ${tab.colorSoft})` }}
                    >
                        <Icon className="h-16 w-16 text-white/25" />
                    </div>
                )}
                <div
                    className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-sm"
                    style={{ background: `${tab.color}e6` }}
                >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                </div>
            </div>

            <div className="px-5 pb-5 pt-5">
                <h3 className="line-clamp-2 text-lg font-extrabold leading-tight tracking-tight text-slate-950">
                    {link.title}
                </h3>
                {link.description && (
                    <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-slate-500">
                        {link.description}
                    </p>
                )}
                <button
                    type="button"
                    onClick={onSeeMore}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95"
                    style={{ background: `${tab.color}1a`, color: tab.color }}
                >
                    See more
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </button>
            </div>
        </article>
    );
}

function LinkModal({
    link,
    accent,
    onClose,
}: {
    link: PerformanceLink;
    accent: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [shared, setShared] = useState(false);

    const copyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard unavailable */
        }
    }, [link.url]);

    const shareLink = useCallback(async () => {
        if (typeof navigator === 'undefined') return;
        const payload = { title: link.title, text: link.description ?? link.title, url: link.url };
        try {
            if (typeof navigator.share === 'function') {
                await navigator.share(payload);
            } else {
                await navigator.clipboard.writeText(link.url);
            }
            setShared(true);
            setTimeout(() => setShared(false), 1600);
        } catch {

        }
    }, [link]);

    if (typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end">
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex justify-center">
                    <div className="rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <QRCodeWithLogo value={link.url} size={200} fgColor={accent} />
                    </div>
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{link.url}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => void copyLink()}
                        className="inline-flex h-11 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                    >
                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold text-white transition active:scale-95"
                        style={{ background: accent }}
                    >
                        <ArrowUpRight className="h-4 w-4" />
                        Open
                    </a>
                    <button
                        type="button"
                        onClick={() => void shareLink()}
                        className="inline-flex h-11 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                    >
                        {shared ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                        {shared ? 'Sent' : 'Share'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
