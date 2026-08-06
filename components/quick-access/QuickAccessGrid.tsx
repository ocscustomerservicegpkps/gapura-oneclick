'use client';

import { ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { QAIcon } from '@/components/quick-access/QAIcon';
import {
    getSASpanClass,
    sanitizeColor,
    type QuickAccessSectionDTO,
    type QuickAccessTileDTO,
} from '@/lib/quick-access';

interface QuickAccessGridProps {
    sections: QuickAccessSectionDTO[];
    /** false → render-only preview (admin editor); true → clickable tiles. */
    interactive?: boolean;
    /** true → public page (max-w-7xl wrapper + bottom spacing); false → embedded (admin editor). */
    standalone?: boolean;
    onTileClick?: (tile: QuickAccessTileDTO) => void;
}

/**
 * Tile card — verbatim copy of the original PublicReportWizard renderCard
 * (GlassCard frosted, lucide icon, font-display, entrance animation).
 */
function TileCard({
    tile,
    idx,
    solo,
    interactive,
    onClick,
}: {
    tile: QuickAccessTileDTO;
    idx: number;
    solo: boolean;
    interactive: boolean;
    onClick?: (tile: QuickAccessTileDTO) => void;
}) {
    const color = sanitizeColor(tile.color);

    const badge = (() => {
        if (tile.display_mode === 'qr') return 'Quick Access';
        if (tile.display_mode === 'form') return 'Isi Form';
        return 'Launch';
    })();

    const card = (
        <GlassCard
            variant="frosted"
            className="h-full border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 transition-all duration-500 shadow-spatial-sm hover:shadow-spatial-lg"
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
                        <h3 className="text-base md:text-2xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)] group-hover:translate-x-1 transition-transform leading-tight">
                            {tile.title}
                        </h3>
                        {tile.description ? (
                            <p className="hidden md:block text-sm text-[oklch(0.45_0.02_200)] leading-relaxed font-medium">{tile.description}</p>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center justify-between text-[oklch(0.15_0.02_200_/_0.2)] group-hover:text-emerald-600 transition-colors mt-auto">
                    <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase">{badge}</span>
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </GlassCard>
    );

    if (!interactive) {
        return (
            <div className={`${solo ? 'col-span-full' : getSASpanClass(tile.span)} group relative cursor-pointer`}>
                {card}
            </div>
        );
    }

    // Original used m.div (div, left-aligned text) — a <button> would center
    // its content per browser defaults, so keep the div + role="button".
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
            onClick={() => onClick?.(tile)}
            className={`${solo ? 'col-span-full' : getSASpanClass(tile.span)} group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-[var(--radius-2xl)]`}
            role="button"
            tabIndex={0}
            aria-label={tile.title}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick?.(tile);
                }
            }}
        >
            {card}
        </motion.div>
    );
}

/**
 * Bento grid per section — pixel-matches the original public /auth/public-report
 * grid (section divider headers, grid-cols-1 sm:grid-cols-2 lg:grid-cols-4,
 * grid-flow-row-dense so hiding a tile never leaves an empty hole).
 */
export function QuickAccessGrid({ sections, interactive = true, standalone = false, onTileClick }: QuickAccessGridProps) {
    const visibleSections = sections.filter((s) => s.is_visible !== false && s.tiles.some((t) => t.is_visible));

    const inner = visibleSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[oklch(0.15_0.02_200_/_0.15)] bg-white/60 p-12 text-center">
            <p className="text-sm font-bold text-[oklch(0.40_0.02_200)]">Belum ada akses cepat.</p>
            <p className="text-xs text-[oklch(0.50_0.02_200)] mt-1">Super admin bisa menambahkan section dan tile dari menu Quick Access.</p>
        </div>
    ) : (
        <div className="px-4 md:px-0">
            {visibleSections.map((section) => {
                const tiles = section.tiles.filter((t) => t.is_visible);
                const solo = tiles.length === 1;
                return (
                    <section key={section.id} className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[oklch(0.50_0.02_200)]">{section.title}</span>
                            <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] lg:auto-rows-[minmax(220px,auto)] grid-flow-row-dense">
                            {tiles.map((tile, idx) => (
                                <TileCard key={tile.id} tile={tile} idx={idx} solo={solo} interactive={interactive} onClick={onTileClick} />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );

    if (!standalone) return inner;

    return (
        <main className="max-w-7xl mx-auto mb-32 relative z-10">
            {inner}
        </main>
    );
}
