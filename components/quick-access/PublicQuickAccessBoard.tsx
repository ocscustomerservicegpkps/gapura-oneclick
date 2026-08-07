'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wrench, RefreshCw } from 'lucide-react';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { QuickAccessGrid } from '@/components/quick-access/QuickAccessGrid';
import { QuickAccessTileModal } from '@/components/quick-access/QuickAccessTileModal';
import { MaintenanceDialog } from '@/components/quick-access/MaintenanceDialog';
import { QuickAccessPasswordModal } from '@/components/QuickAccessPasswordModal';
import type { QuickAccessConfigDTO, QuickAccessTileDTO } from '@/lib/quick-access';

interface PublicQuickAccessBoardProps {
    onOpenWizard: (category: 'Irregularity' | 'JOUMPA') => void;
    /** SSR-rendered config (from the server page) — renders instantly, no flash. */
    initialConfig?: QuickAccessConfigDTO | null;
}

/**
 * The public /auth/public-report bento grid — renders from the DB config
 * managed by super admin. Clicks either open the content modal, the wizard
 * form (wizard_category tiles), the per-tile password gate, or the
 * maintenance dialog (gated tiles while their setting is off).
 */
export function PublicQuickAccessBoard({ onOpenWizard, initialConfig = null }: PublicQuickAccessBoardProps) {
    const [config, setConfig] = useState<QuickAccessConfigDTO | null>(initialConfig);
    const [loading, setLoading] = useState(!initialConfig);
    const [error, setError] = useState('');
    const [activeTile, setActiveTile] = useState<QuickAccessTileDTO | null>(null);
    const [passwordTile, setPasswordTile] = useState<QuickAccessTileDTO | null>(null);
    const [maintenanceTile, setMaintenanceTile] = useState<QuickAccessTileDTO | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/quick-access', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            setConfig(await res.json());
        } catch {
            // Keep the SSR config (or show the empty state) — never blank the grid.
            setConfig((prev) => prev ?? null);
            setError('Gagal memuat akses cepat.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchConfig(); }, [fetchConfig]);

    const handleTileClick = (tile: QuickAccessTileDTO) => {
        // Maintenance mode: tile is under maintenance, show dialog.
        if (tile.is_maintenance) {
            setMaintenanceTile(tile);
            return;
        }
        // AI tile: enabled → straight to the virtual assistant, no modal.
        if (tile.gated_by === 'ai_enabled') {
            if (config?.aiEnabled) {
                window.location.href = '/virtual-assistant';
                return;
            }
            setMaintenanceTile(tile);
            return;
        }
        if (tile.wizard_category) {
            onOpenWizard(tile.wizard_category);
            return;
        }
        if (tile.is_password_protected) {
            setPasswordTile(tile);
            return;
        }
        setActiveTile(tile);
    };

    // Same page chrome as the original wizard root: padding + noise texture.
    return (
        <div className="relative overflow-x-hidden p-6 md:p-12 font-body">
            <NoiseTexture opacity={0.02} />

            {loading && !config ? (
                <main className="max-w-7xl mx-auto mb-32 relative z-10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] lg:auto-rows-[minmax(220px,auto)]">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-[256px] animate-pulse rounded-[40px] bg-[oklch(0.96_0.01_200)]" />
                        ))}
                    </div>
                </main>
            ) : error ? (
                <main className="max-w-7xl mx-auto mb-32 relative z-10">
                    <div className="mx-auto max-w-xl rounded-[32px] border border-red-200 bg-red-50 p-10 text-center space-y-3">
                        <p className="text-sm font-bold text-red-700">{error}</p>
                        <button
                            onClick={() => void fetchConfig()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/10 text-sm font-bold hover:bg-black/5"
                        >
                            <RefreshCw className="w-4 h-4" /> Coba Lagi
                        </button>
                    </div>
                </main>
            ) : config && !config.enabled ? (
                <main className="max-w-7xl mx-auto mb-32 relative z-10">
                    <div className="mx-auto max-w-xl rounded-[32px] border border-amber-200 bg-amber-50 p-12 text-center space-y-3">
                        <Wrench className="w-10 h-10 text-amber-500 mx-auto" />
                        <h2 className="text-lg font-display font-black tracking-tight">Quick Access sedang dalam maintenance</h2>
                        <p className="text-sm text-[oklch(0.45_0.02_200)] font-medium">Fitur ini sedang dinonaktifkan oleh admin. Silakan coba lagi nanti.</p>
                    </div>
                </main>
            ) : (
                config && <QuickAccessGrid sections={config.sections} standalone onTileClick={handleTileClick} />
            )}

            <QuickAccessTileModal tile={activeTile} onClose={() => setActiveTile(null)} />

            <QuickAccessPasswordModal
                key={passwordTile?.id || 'none'}
                isOpen={!!passwordTile}
                onClose={() => setPasswordTile(null)}
                label={passwordTile?.title || ''}
                href=""
                tileId={passwordTile?.id}
                onVerified={() => {
                    setActiveTile(passwordTile);
                    setPasswordTile(null);
                }}
            />

            <MaintenanceDialog
                isOpen={!!maintenanceTile}
                onClose={() => setMaintenanceTile(null)}
                title="Sedang Dalam Maintenance"
                message={`"${maintenanceTile?.title}" sedang dalam maintenance. Silakan coba lagi nanti.`}
            />
        </div>
    );
}
