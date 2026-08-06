'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { QAIcon } from '@/components/quick-access/QAIcon';
import { getSASpanClass, sanitizeColor, type QASpan, type QuickAccessAdminTile } from '@/lib/quick-access';

interface SortableTileProps {
    tile: QuickAccessAdminTile;
    solo?: boolean;
    isDragSource?: boolean;
    isDropTarget?: boolean;
    onEdit: (tile: QuickAccessAdminTile) => void;
    onToggleVisible: (tile: QuickAccessAdminTile) => void;
    onDelete: (tile: QuickAccessAdminTile) => void;
    onResize: (tile: QuickAccessAdminTile, next: QASpan) => void;
    onDragStart: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onDragOverTile: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onDropOnTile: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onDragEnd: () => void;
}

/** Static card visual — same as the public tile. */
export function TileCardVisual({ tile }: { tile: QuickAccessAdminTile }) {
    const color = sanitizeColor(tile.color);
    const badge = tile.display_mode === 'qr' ? 'Quick Access' : tile.display_mode === 'form' ? 'Isi Form' : 'Launch';

    return (
        <GlassCard
            variant="frosted"
            className="h-full border-[oklch(0.15_0.02_200_/_0.05)] shadow-spatial-sm"
        >
            <div className="p-5 md:p-7 h-full flex flex-col justify-between relative z-10 overflow-hidden">
                <div className="space-y-1.5 md:space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-[oklch(1_0_0_/_0.4)] border border-white/40 shadow-inner-rim relative">
                            <QAIcon name={tile.icon} className="w-4 h-4 md:w-6 md:h-6" style={{ color }} />
                            {tile.is_password_protected && (
                                <Lock className="w-3 h-3 text-[oklch(0.15_0.02_200_/_0.4)] absolute -top-1 -right-1 bg-white rounded-full p-0.5" />
                            )}
                        </div>
                    </div>
                    <div className="space-y-0.5 md:space-y-2">
                        <h3 className="text-base md:text-2xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)] leading-tight">
                            {tile.title}
                        </h3>
                        {tile.description ? (
                            <p className="hidden md:block text-sm text-[oklch(0.45_0.02_200)] leading-relaxed font-medium">{tile.description}</p>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center justify-between text-[oklch(0.15_0.02_200_/_0.2)] mt-auto pt-3">
                    <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase">{badge}</span>
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </GlassCard>
    );
}

function decodeSpan(span: QASpan): { w: number; h: number } {
    if (span === '4x1') return { w: 4, h: 1 };
    if (span === '2x2') return { w: 2, h: 2 };
    if (span === '2x1') return { w: 2, h: 1 };
    return { w: 1, h: 1 };
}

function encodeSpan(w: number, h: number): QASpan {
    if (h >= 2) return w >= 2 ? '2x2' : '1x1';
    if (w >= 4) return '4x1';
    if (w >= 2) return '2x1';
    return '1x1';
}

/** Clamp target span from a corner drag: w ∈ 1..4 (h=1) / 1..2 (h=2), h ∈ 1..2. */
function spanFromDelta(span: QASpan, dx: number, dy: number): QASpan {
    const { w, h } = decodeSpan(span);
    const STEP = 48; // px per size step
    // trunc (not round): symmetric dead-zone around 0 so the preview doesn't
    // jitter between sizes near a threshold.
    const stepsX = Math.trunc(dx / STEP);
    const stepsY = Math.trunc(dy / STEP);
    const nh = Math.min(2, Math.max(1, h + stepsY));
    const nw = Math.min(nh >= 2 ? 2 : 4, Math.max(1, w + stepsX));
    return encodeSpan(nw, nh);
}

export function SortableTile({
    tile,
    solo = false,
    isDragSource = false,
    isDropTarget = false,
    onEdit,
    onToggleVisible,
    onDelete,
    onResize,
    onDragStart,
    onDragOverTile,
    onDropOnTile,
    onDragEnd,
}: SortableTileProps) {
    const [previewSpan, setPreviewSpan] = useState<QASpan | null>(null);
    const resizeStart = useRef<{ x: number; y: number; span: QASpan } | null>(null);

    const onResizePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        resizeStart.current = { x: e.clientX, y: e.clientY, span: tile.span };
    };

    const onResizePointerMove = (e: React.PointerEvent) => {
        if (!resizeStart.current) return;
        setPreviewSpan(spanFromDelta(resizeStart.current.span, e.clientX - resizeStart.current.x, e.clientY - resizeStart.current.y));
    };

    const onResizePointerUp = (e: React.PointerEvent) => {
        if (!resizeStart.current) return;
        const next = spanFromDelta(resizeStart.current.span, e.clientX - resizeStart.current.x, e.clientY - resizeStart.current.y);
        resizeStart.current = null;
        setPreviewSpan(null);
        if (next !== tile.span) onResize(tile, next);
    };

    const span = previewSpan ?? tile.span;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, tile)}
            onDragOver={(e) => onDragOverTile(e, tile)}
            onDrop={(e) => onDropOnTile(e, tile)}
            onDragEnd={onDragEnd}
            onClick={() => onEdit(tile)}
            className={`${solo ? 'col-span-full' : getSASpanClass(span)} group relative cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-[var(--radius-2xl)] ${
                isDragSource ? 'opacity-40' : ''
            } ${isDropTarget ? 'ring-2 ring-emerald-500/70 ring-offset-2' : ''} ${tile.is_visible ? '' : 'opacity-40'}`}
            role="button"
            tabIndex={0}
            aria-label={`${tile.title} — klik untuk edit`}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onEdit(tile);
                }
            }}
        >
            <TileCardVisual tile={tile} />

            {/* Hover controls */}
            <div
                className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    draggable={false}
                    onClick={() => onToggleVisible(tile)}
                    className="p-1.5 rounded-lg bg-white/90 border border-black/10 text-black/60 hover:border-emerald-500/50"
                    title={tile.is_visible ? 'Sembunyikan tile' : 'Tampilkan tile'}
                >
                    {tile.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                    draggable={false}
                    onClick={() => onDelete(tile)}
                    className="p-1.5 rounded-lg bg-white/90 border border-black/10 text-black/60 hover:border-red-400 hover:text-red-500"
                    title="Hapus tile"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Badges */}
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 pointer-events-none">
                {tile.gated_by && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-black uppercase">AI</span>
                )}
                {tile.wizard_category && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase">Form</span>
                )}
                {!tile.is_visible && (
                    <span className="px-1.5 py-0.5 rounded bg-black/10 text-black/50 text-[9px] font-black uppercase">Hidden</span>
                )}
            </div>

            {/* Corner resize handle — drag to change width/height */}
            <div
                draggable={false}
                className={`absolute bottom-1 right-1 z-20 h-4 w-4 cursor-nwse-resize touch-none rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                    previewSpan ? '!opacity-100' : ''
                }`}
                style={{
                    borderRight: '2px solid rgba(0,0,0,0.25)',
                    borderBottom: '2px solid rgba(0,0,0,0.25)',
                    borderBottomRightRadius: 4,
                }}
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                onPointerCancel={onResizePointerUp}
                title="Seret sudut untuk ubah ukuran"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}
