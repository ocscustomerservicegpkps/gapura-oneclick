'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PANEL_WIDTH = 288; // 18rem

interface NotifItem {
    id: string;
    report_id: string;
    created_at: string;
    comment: {
        content: string | null;
        users: { full_name: string | null; role: string | null } | null;
    } | null;
}

// Which dashboard a user opens a report detail from.
function detailBase(role: string): string {
    const r = (role || '').toUpperCase();
    if (r === 'SUPER_ADMIN') return 'admin';
    if (r === 'ANALYST') return 'analyst';
    if (r === 'DIVISI_OCS' || r === 'PARTNER_OCS') return 'ocs';
    if (r === 'DIVISI_OS' || r === 'PARTNER_OS') return 'os';
    if (r === 'MANAGER_CABANG' || r === 'STAFF_CABANG' || r === 'CABANG') return 'employee';
    return 'op'; // OP / OT / UQ / HT (and eskalasi fallback)
}

export function CommentNotificationBell({ role }: { role: string }) {
    const [items, setItems] = useState<NotifItem[]>([]);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ left: number; bottom: number } | null>(null);
    const router = useRouter();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Anchor the panel to the bell, opening upward, clamped into the viewport.
    const positionPanel = useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12);
        setCoords({ left: Math.max(12, left), bottom: window.innerHeight - rect.top + 8 });
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications/comments');
            if (!res.ok) return;
            const data = await res.json();
            setItems(Array.isArray(data?.items) ? data.items : []);
        } catch {
            /* ignore polling errors */
        }
    }, []);

    useEffect(() => {
        const initial = setTimeout(load, 0);
        const t = setInterval(load, 60_000);
        return () => {
            clearTimeout(initial);
            clearInterval(t);
        };
    }, [load]);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onReflow = () => positionPanel();
        document.addEventListener('mousedown', onClick);
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            document.removeEventListener('mousedown', onClick);
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
    }, [open, positionPanel]);

    const markAll = async () => {
        setItems([]);
        await fetch('/api/notifications/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }).catch(() => {});
    };

    const openItem = async (n: NotifItem) => {
        setOpen(false);
        setItems((prev) => prev.filter((i) => i.report_id !== n.report_id));
        await fetch('/api/notifications/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: n.report_id }),
        }).catch(() => {});
        router.push(`/dashboard/${detailBase(role)}/reports/${n.report_id}`);
    };

    const count = items.length;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => { if (!open) positionPanel(); setOpen((v) => !v); }}
                aria-label="Comment notifications"
                className="relative flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--brand-primary)]"
            >
                <Bell size={15} />
                {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && coords && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', left: coords.left, bottom: coords.bottom, width: PANEL_WIDTH, zIndex: 2147483600 }}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-1"
                >
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                            New Comments
                        </span>
                        {count > 0 && (
                            <button
                                type="button"
                                onClick={markAll}
                                className="text-[10px] font-semibold text-[var(--brand-primary)] hover:underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {count === 0 ? (
                            <p className="px-3 py-6 text-center text-xs text-gray-400">
                                No new comments
                            </p>
                        ) : (
                            items.map((n) => {
                                const author = n.comment?.users?.full_name || 'Someone';
                                const snippet = (n.comment?.content || '').slice(0, 80);
                                return (
                                    <button
                                        key={n.id}
                                        type="button"
                                        onClick={() => openItem(n)}
                                        className="block w-full border-b border-gray-50 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                                    >
                                        <p className="text-xs font-semibold text-gray-800">
                                            {author} <span className="font-normal text-gray-500">commented</span>
                                        </p>
                                        {snippet && (
                                            <p className="mt-0.5 truncate text-[11px] text-gray-500">{snippet}</p>
                                        )}
                                        <p className="mt-0.5 text-[10px] text-gray-400">
                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
