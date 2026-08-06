'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    LayoutGrid, Plus, AlertCircle, Loader2, Bot, Power,
} from 'lucide-react';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AdminSection } from '@/components/quick-access/admin/AdminSection';
import { TileEditorModal } from '@/components/quick-access/admin/TileEditorModal';
import { SectionEditorModal } from '@/components/quick-access/admin/SectionEditorModal';
import { SubmissionsModal } from '@/components/quick-access/admin/SubmissionsModal';
import type { QASpan, QuickAccessAdminConfigDTO, QuickAccessAdminTile, QuickAccessSectionDTO } from '@/lib/quick-access';

interface ConfirmState {
    title: string;
    description: string;
    onConfirm: () => void;
}

interface ActiveDrag {
    tileId: string;
    fromSectionId: string;
}

export default function AdminQuickAccessPage() {
    const [config, setConfig] = useState<QuickAccessAdminConfigDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

    const [sectionModal, setSectionModal] = useState<{ section: QuickAccessSectionDTO | null } | null>(null);
    const [tileModal, setTileModal] = useState<{ tile: QuickAccessAdminTile | null; sectionId: string } | null>(null);
    const [submissionsTile, setSubmissionsTile] = useState<QuickAccessAdminTile | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/quick-access', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            setConfig(await res.json());
        } catch {
            setError('Gagal memuat konfigurasi Quick Access.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchConfig(); }, [fetchConfig]);

    const api = async (url: string, method: string, body?: Record<string, unknown>): Promise<boolean> => {
        setSaving(true);
        setError('');
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'Operasi gagal.');
                return false;
            }
            return true;
        } catch {
            setError('Operasi gagal.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // ── Settings toggles ────────────────────────────────────────────────
    const toggleSetting = async (key: 'ai_enabled' | 'quick_access_enabled', value: boolean) => {
        if (!config) return;
        const ok = await api('/api/admin/quick-access/settings', 'PATCH', { [key]: value });
        if (ok) setConfig((c) => c ? { ...c, settings: { ...c.settings, [key]: value } } : c);
    };

    // ── Section ops ─────────────────────────────────────────────────────
    const saveSection = async (body: Record<string, unknown>) => {
        const ok = await api('/api/admin/quick-access/sections', body.id ? 'PATCH' : 'POST', body);
        setSectionModal(null);
        if (ok) await fetchConfig();
    };

    const deleteSection = (section: QuickAccessSectionDTO) => {
        setConfirm({
            title: `Hapus section "${section.title}"?`,
            description: 'Seluruh tile dan isian form di dalamnya ikut terhapus permanen. Tindakan ini tidak bisa dibatalkan.',
            onConfirm: async () => {
                setConfirm(null);
                const ok = await api('/api/admin/quick-access/sections', 'DELETE', { id: section.id });
                if (ok) await fetchConfig();
            },
        });
    };

    const toggleSectionVisible = async (section: QuickAccessSectionDTO) => {
        const ok = await api('/api/admin/quick-access/sections', 'PATCH', { id: section.id, is_visible: !section.is_visible });
        if (ok) await fetchConfig();
    };

    // ── Tile ops ────────────────────────────────────────────────────────
    const saveTile = async (body: Record<string, unknown>) => {
        const ok = await api('/api/admin/quick-access/tiles', body.id ? 'PATCH' : 'POST', body);
        setTileModal(null);
        if (ok) await fetchConfig();
    };

    const deleteTile = (tile: QuickAccessAdminTile) => {
        setConfirm({
            title: `Hapus tile "${tile.title}"?`,
            description: 'Tile beserta isian form-nya terhapus permanen.',
            onConfirm: async () => {
                setConfirm(null);
                const ok = await api('/api/admin/quick-access/tiles', 'DELETE', { id: tile.id });
                if (ok) await fetchConfig();
            },
        });
    };

    const toggleTileVisible = async (tile: QuickAccessAdminTile) => {
        const ok = await api('/api/admin/quick-access/tiles', 'PATCH', { id: tile.id, is_visible: !tile.is_visible });
        if (ok) await fetchConfig();
    };

    const resizeTile = async (tile: QuickAccessAdminTile, next: QASpan) => {
        // Optimistic — the tile keeps the new size immediately (no flash back
        // to the old span while the PATCH round-trips).
        setConfig((c) => c ? {
            ...c,
            sections: c.sections.map((s) => s.id !== tile.section_id ? s : {
                ...s,
                tiles: s.tiles.map((t) => t.id === tile.id ? { ...t, span: next } : t),
            }),
        } : c);
        const ok = await api('/api/admin/quick-access/tiles', 'PATCH', { id: tile.id, span: next });
        if (!ok) await fetchConfig();
    };

    // ── Drag & drop (native HTML5 DnD — swap within/across sections) ─────
    const handleTileDragStart = (e: React.DragEvent, tile: QuickAccessAdminTile) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tile.id);
        setActiveDrag({ tileId: tile.id, fromSectionId: tile.section_id });
    };

    const handleTileDragOver = (e: React.DragEvent, tile: QuickAccessAdminTile) => {
        if (!activeDrag || tile.id === activeDrag.tileId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    /** Reorder after a drop: same-section → arrayMove; cross-section → insert. */
    const applyDrop = async (drag: ActiveDrag, toSectionId: string, overTileId: string | null) => {
        const { tileId, fromSectionId } = drag;
        setActiveDrag(null);
        if (!config) return;

        const tile = config.sections.flatMap((s) => s.tiles).find((t) => t.id === tileId);
        if (!tile) return;

        const sections = config.sections.map((s) => ({ ...s, tiles: [...s.tiles] }));
        const from = sections.find((s) => s.id === fromSectionId);
        const to = sections.find((s) => s.id === toSectionId);
        if (!from || !to) return;

        if (fromSectionId === toSectionId) {
            // Same section: standard arrayMove.
            const oldIndex = from.tiles.findIndex((t) => t.id === tileId);
            const newIndex = overTileId ? from.tiles.findIndex((t) => t.id === overTileId) : from.tiles.length - 1;
            if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
            const [moved] = from.tiles.splice(oldIndex, 1);
            from.tiles.splice(newIndex, 0, moved);
        } else {
            // Cross-section: remove from source, insert at target (or append).
            const insertAt = overTileId ? to.tiles.findIndex((t) => t.id === overTileId) : to.tiles.length;
            from.tiles = from.tiles.filter((t) => t.id !== tileId);
            to.tiles.splice(Math.max(0, insertAt), 0, { ...tile, section_id: toSectionId });
        }

        setConfig({ ...config, sections });

        // Persist, then resync.
        if (toSectionId !== fromSectionId) {
            await api('/api/admin/quick-access/tiles', 'PATCH', { id: tileId, section_id: toSectionId });
        }
        for (const sid of new Set([fromSectionId, toSectionId])) {
            const section = sections.find((s) => s.id === sid);
            if (!section) continue;
            await api('/api/admin/quick-access/tiles/reorder', 'PATCH', { tileIds: section.tiles.map((t) => t.id) });
        }
        await fetchConfig();
    };

    const handleTileDrop = (e: React.DragEvent, overTile: QuickAccessAdminTile) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeDrag) return;
        void applyDrop(activeDrag, overTile.section_id, overTile.id);
    };

    const handleSectionDrop = (e: React.DragEvent, sectionId: string) => {
        e.preventDefault();
        if (!activeDrag) return;
        // Dropped on the section block (not a tile) → append at the end.
        void applyDrop(activeDrag, sectionId, null);
    };

    const handleDragEnd = () => {
        setActiveDrag(null);
    };

    const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
        <button
            onClick={onClick}
            disabled={saving}
            className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-600' : 'bg-black/15'}`}
            role="switch"
            aria-checked={on}
            aria-label={label}
        >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
    );

    return (
        <div className="relative overflow-x-hidden p-6 md:p-12 font-body">
            <NoiseTexture opacity={0.02} />
            <main className="max-w-7xl mx-auto mb-32 relative z-10">
                <div className="px-4 md:px-0">
                    {error && (
                        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {loading && !config ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                        </div>
                    ) : config && config.sections.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[oklch(0.15_0.02_200_/_0.15)] bg-white/60 p-12 text-center space-y-3">
                            <LayoutGrid className="w-10 h-10 text-[oklch(0.15_0.02_200_/_0.2)] mx-auto" />
                            <p className="text-sm font-bold text-[oklch(0.40_0.02_200)]">Belum ada section.</p>
                            <p className="text-xs text-[oklch(0.50_0.02_200)]">Klik &quot;Tambah Section&quot; untuk memulai.</p>
                        </div>
                    ) : config ? (
                        config.sections.map((section) => (
                            <AdminSection
                                key={section.id}
                                section={section}
                                tiles={section.tiles}
                                dragTileId={activeDrag?.tileId ?? null}
                                onEditSection={(s) => setSectionModal({ section: s })}
                                onToggleSection={(s) => void toggleSectionVisible(s)}
                                onDeleteSection={deleteSection}
                                onEditTile={(t) => setTileModal({ tile: t, sectionId: section.id })}
                                onToggleTile={(t) => void toggleTileVisible(t)}
                                onDeleteTile={deleteTile}
                                onResizeTile={(t, next) => void resizeTile(t, next)}
                                onAddTile={(sectionId) => setTileModal({ tile: null, sectionId })}
                                onTileDragStart={handleTileDragStart}
                                onTileDragOver={handleTileDragOver}
                                onTileDrop={handleTileDrop}
                                onTileDragEnd={handleDragEnd}
                                onSectionDrop={handleSectionDrop}
                            />
                        ))
                    ) : null}

                    {/* Bottom bar: toggles + add section — only after config loads,
                        so reloads never flash default toggle states. */}
                    {config && (
                    <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white/70 backdrop-blur-xl px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Bot className="w-5 h-5 text-blue-600" />
                            <div>
                                <p className="text-sm font-extrabold">AI — I am in Charge</p>
                                <p className="text-[11px] text-[oklch(0.40_0.02_200)] font-medium">Off = tile AI nampil dialog maintenance</p>
                            </div>
                            <Toggle
                                on={config?.settings.ai_enabled ?? false}
                                onClick={() => toggleSetting('ai_enabled', !(config?.settings.ai_enabled ?? false))}
                                label="Toggle AI I am in Charge"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Power className="w-5 h-5 text-amber-600" />
                            <div>
                                <p className="text-sm font-extrabold">Semua Quick Access</p>
                                <p className="text-[11px] text-[oklch(0.40_0.02_200)] font-medium">Off = halaman public pesan maintenance</p>
                            </div>
                            <Toggle
                                on={config?.settings.quick_access_enabled ?? false}
                                onClick={() => toggleSetting('quick_access_enabled', !(config?.settings.quick_access_enabled ?? false))}
                                label="Toggle Semua Quick Access"
                            />
                        </div>
                        <button
                            onClick={() => setSectionModal({ section: null })}
                            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Tambah Section
                        </button>
                    </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            {sectionModal && (
                <SectionEditorModal
                    section={sectionModal.section}
                    onClose={() => setSectionModal(null)}
                    onSave={saveSection}
                    isSaving={saving}
                />
            )}
            {tileModal && (
                <TileEditorModal
                    key={tileModal.tile?.id || `new-${tileModal.sectionId}`}
                    tile={tileModal.tile}
                    sectionId={tileModal.sectionId}
                    onClose={() => setTileModal(null)}
                    onSave={saveTile}
                    isSaving={saving}
                />
            )}
            {submissionsTile && (
                <SubmissionsModal tile={submissionsTile} onClose={() => setSubmissionsTile(null)} />
            )}
            {confirm && (
                <ConfirmDialog
                    open
                    title={confirm.title}
                    description={confirm.description}
                    confirmLabel="Hapus"
                    cancelLabel="Batal"
                    danger
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}
        </div>
    );
}
