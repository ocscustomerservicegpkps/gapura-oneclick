'use client';

import { useEffect, useState } from 'react';
import { Link2, Copy, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { slugifyTileTitle, type QuickAccessSectionDTO, type QuickAccessTileDTO } from '@/lib/quick-access';

/**
 * Read-only list of the /auth/public-report `?open=` quick links for every
 * tile — one per bento card, generated from the live config so a new tile
 * gets one automatically. Uses the tile-id form (stable across title edits)
 * since that's the one worth handing out for permanent distribution.
 */
export function QuickLinksPanel({ sections }: { sections: QuickAccessSectionDTO[] }) {
    const [open, setOpen] = useState(false);
    const [origin, setOrigin] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => { setOrigin(window.location.origin); }, []);

    const tiles: QuickAccessTileDTO[] = sections.flatMap((s) => s.tiles);
    if (tiles.length === 0) return null;

    const linkFor = (tile: QuickAccessTileDTO) => `${origin}/auth/public-report?open=${tile.id}`;
    const slugFor = (tile: QuickAccessTileDTO) => slugifyTileTitle(tile.title);

    const copy = async (tile: QuickAccessTileDTO) => {
        try {
            await navigator.clipboard.writeText(linkFor(tile));
            setCopiedId(tile.id);
            setTimeout(() => setCopiedId((c) => (c === tile.id ? null : c)), 1500);
        } catch {
            // Clipboard API unavailable — silently ignore, the field is selectable.
        }
    };

    return (
        <div className="mt-6 rounded-2xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white/70 backdrop-blur-xl overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
                <Link2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold">Quick Link per Tile</p>
                    <p className="text-[11px] text-[oklch(0.40_0.02_200)] font-medium">
                        Link langsung ke /auth/public-report yang otomatis membuka tile terkait ({tiles.length} tile)
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-[oklch(0.15_0.02_200_/_0.08)] divide-y divide-[oklch(0.15_0.02_200_/_0.06)]">
                    {sections.map((section) => section.tiles.length === 0 ? null : (
                        <div key={section.id} className="px-5 py-4 space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[oklch(0.45_0.02_200)]">
                                {section.title}
                            </p>
                            <div className="space-y-2">
                                {section.tiles.map((tile) => (
                                    <div
                                        key={tile.id}
                                        className="flex items-center gap-2 rounded-xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white px-3 py-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold truncate">{tile.title}</p>
                                            <p className="text-[11px] font-mono text-[oklch(0.45_0.02_200)] truncate">
                                                {origin ? linkFor(tile) : '...'}
                                            </p>
                                            <p className="text-[10px] text-[oklch(0.55_0.02_200)] truncate">
                                                alias: ?open={tile.wizard_category ? tile.wizard_category.toLowerCase() : slugFor(tile)}
                                            </p>
                                        </div>
                                        <a
                                            href={linkFor(tile)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 p-2 rounded-lg hover:bg-black/5 text-[oklch(0.40_0.02_200)]"
                                            title="Buka link"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        <button
                                            onClick={() => void copy(tile)}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100"
                                        >
                                            {copiedId === tile.id ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" /> Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" /> Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
