'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Trash2, Inbox, RefreshCw, AlertCircle } from 'lucide-react';
import type { QuickAccessAdminTile } from '@/lib/quick-access';

interface Submission {
    id: string;
    tile_id: string;
    data: Record<string, unknown>;
    created_at: string;
}

interface SubmissionsModalProps {
    tile: QuickAccessAdminTile;
    onClose: () => void;
}

export function SubmissionsModal({ tile, onClose }: SubmissionsModalProps) {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const fetchSubmissions = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/quick-access/submissions?tileId=${tile.id}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setSubmissions(data.submissions || []);
        } catch {
            setError('Gagal memuat data isian.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void fetchSubmissions(); }, [tile.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const deleteOne = async (id: string) => {
        try {
            await fetch('/api/admin/quick-access/submissions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setSubmissions((rows) => rows.filter((r) => r.id !== id));
        } catch {
            setError('Gagal menghapus isian.');
        }
    };

    const clearAll = async () => {
        if (!window.confirm(`Hapus semua ${submissions.length} isian dari "${tile.title}"?`)) return;
        setDeleting(true);
        try {
            await fetch('/api/admin/quick-access/submissions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tileId: tile.id }),
            });
            setSubmissions([]);
        } catch {
            setError('Gagal menghapus isian.');
        } finally {
            setDeleting(false);
        }
    };

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90dvh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
                    <div>
                        <h3 className="text-lg font-extrabold">Isian Form</h3>
                        <p className="text-xs text-black/50 font-bold">{tile.title} · {submissions.length} isian</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => void fetchSubmissions()} className="p-2 hover:bg-black/5 rounded-lg transition-colors" title="Refresh">
                            <RefreshCw className={`w-4 h-4 text-black/40 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Close">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-5 overflow-y-auto space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="py-16 text-center space-y-2">
                            <Inbox className="w-10 h-10 text-black/20 mx-auto" />
                            <p className="text-sm font-bold text-black/50">Belum ada isian untuk tile ini.</p>
                        </div>
                    ) : (
                        submissions.map((sub) => (
                            <div key={sub.id} className="rounded-xl border border-black/10 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2 bg-black/[0.03] border-b border-black/5">
                                    <span className="text-[11px] font-black text-black/50 uppercase tracking-widest">{fmtDate(sub.created_at)}</span>
                                    <button
                                        onClick={() => void deleteOne(sub.id)}
                                        className="p-1.5 rounded-lg text-black/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        aria-label="Hapus"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="p-4 space-y-1.5">
                                    {Object.entries(sub.data).map(([key, value]) => (
                                        <div key={key} className="flex gap-3 text-sm">
                                            <span className="w-32 shrink-0 font-black text-black/50 uppercase tracking-wider text-[11px] pt-0.5">{key}</span>
                                            <span className="font-bold text-black/80 break-words flex-1">
                                                {Array.isArray(value) ? value.join(', ') : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {submissions.length > 0 && (
                    <div className="px-6 py-4 border-t border-black/5 shrink-0">
                        <button
                            onClick={() => void clearAll()}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Hapus Semua Isian
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
