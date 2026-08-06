'use client';

import { Pencil, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { SortableTile } from '@/components/quick-access/admin/SortableTile';
import type { QASpan, QuickAccessAdminTile, QuickAccessSectionDTO } from '@/lib/quick-access';

interface AdminSectionProps {
    section: QuickAccessSectionDTO;
    tiles: QuickAccessAdminTile[];
    dragTileId: string | null;
    onEditSection: (section: QuickAccessSectionDTO) => void;
    onToggleSection: (section: QuickAccessSectionDTO) => void;
    onDeleteSection: (section: QuickAccessSectionDTO) => void;
    onEditTile: (tile: QuickAccessAdminTile) => void;
    onToggleTile: (tile: QuickAccessAdminTile) => void;
    onDeleteTile: (tile: QuickAccessAdminTile) => void;
    onResizeTile: (tile: QuickAccessAdminTile, next: QASpan) => void;
    onAddTile: (sectionId: string) => void;
    onTileDragStart: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onTileDragOver: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onTileDrop: (e: React.DragEvent, tile: QuickAccessAdminTile) => void;
    onTileDragEnd: () => void;
    onSectionDrop: (e: React.DragEvent, sectionId: string) => void;
}

/**
 * One bento section in the admin editor — same look as the public page.
 * Tiles are draggable with native HTML5 DnD (within and across sections);
 * the section block itself is also a drop target (append at the end).
 */
export function AdminSection({
    section,
    tiles,
    dragTileId,
    onEditSection,
    onToggleSection,
    onDeleteSection,
    onEditTile,
    onToggleTile,
    onDeleteTile,
    onResizeTile,
    onAddTile,
    onTileDragStart,
    onTileDragOver,
    onTileDrop,
    onTileDragEnd,
    onSectionDrop,
}: AdminSectionProps) {
    const solo = tiles.length === 1;

    return (
        <div
            className={`mb-6 ${section.is_visible ? '' : 'opacity-50'}`}
            onDragOver={(e) => {
                if (!dragTileId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => onSectionDrop(e, section.id)}
        >
            <div className="flex items-center gap-3 mb-3">
                <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[oklch(0.50_0.02_200)]">{section.title}</span>
                <div className="flex items-center gap-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-[oklch(0.15_0.02_200_/_0.06)] text-[9px] font-black text-[oklch(0.40_0.02_200)]">{tiles.length}</span>
                    <button onClick={() => onEditSection(section)} className="p-1.5 rounded-lg hover:bg-[oklch(0.15_0.02_200_/_0.05)]" title="Edit section">
                        <Pencil className="w-3.5 h-3.5 text-[oklch(0.15_0.02_200_/_0.4)]" />
                    </button>
                    <button onClick={() => onToggleSection(section)} className="p-1.5 rounded-lg hover:bg-[oklch(0.15_0.02_200_/_0.05)]" title={section.is_visible ? 'Sembunyikan section' : 'Tampilkan section'}>
                        {section.is_visible
                            ? <Eye className="w-3.5 h-3.5 text-[oklch(0.15_0.02_200_/_0.4)]" />
                            : <EyeOff className="w-3.5 h-3.5 text-[oklch(0.15_0.02_200_/_0.4)]" />}
                    </button>
                    <button onClick={() => onDeleteSection(section)} className="p-1.5 rounded-lg hover:bg-red-50" title="Hapus section">
                        <Trash2 className="w-3.5 h-3.5 text-[oklch(0.15_0.02_200_/_0.4)] hover:text-red-500" />
                    </button>
                </div>
                <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] lg:auto-rows-[minmax(220px,auto)] grid-flow-row-dense">
                {tiles.map((tile) => (
                    <SortableTile
                        key={tile.id}
                        tile={tile}
                        solo={solo}
                        isDragSource={dragTileId === tile.id}
                        isDropTarget={!!dragTileId && dragTileId !== tile.id}
                        onEdit={onEditTile}
                        onToggleVisible={onToggleTile}
                        onDelete={onDeleteTile}
                        onResize={onResizeTile}
                        onDragStart={onTileDragStart}
                        onDragOverTile={onTileDragOver}
                        onDropOnTile={onTileDrop}
                        onDragEnd={onTileDragEnd}
                    />
                ))}
            </div>

            <button
                onClick={() => onAddTile(section.id)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[oklch(0.15_0.02_200_/_0.2)] text-xs font-bold text-[oklch(0.40_0.02_200)] hover:border-emerald-500/50 hover:text-emerald-600 transition-all"
            >
                <Plus size={13} /> Tambah Tile di Section Ini
            </button>
        </div>
    );
}
