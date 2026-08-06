'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PublicQuickAccessBoard } from '@/components/quick-access/PublicQuickAccessBoard';
import type { QuickAccessConfigDTO } from '@/lib/quick-access';

const Wizard = dynamic(
    () => import('@/components/public-report/PublicReportWizard').then((mod) => mod.PublicReportWizard),
    {
        ssr: false,
        loading: () => (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="space-y-4 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                    <p className="text-sm font-medium text-[oklch(0.40_0.02_200)]">Loading report form...</p>
                </div>
            </div>
        ),
    },
);

/**
 * The interactive bento grid (DB-driven, managed by super admin) plus the
 * report-form wizard, which mounts on demand when a wizard_category tile is
 * clicked — the wizard grid itself is never shown (hideGrid).
 * initialConfig comes from the server page (SSR) so the grid renders
 * instantly — no loading flash — exactly like the old StaticBentoGrid.
 */
export function PublicReportSection({ initialConfig }: { initialConfig?: QuickAccessConfigDTO | null }) {
    const [wizardCategory, setWizardCategory] = useState<'Irregularity' | 'JOUMPA' | null>(null);

    return (
        <>
            <PublicQuickAccessBoard initialConfig={initialConfig || null} onOpenWizard={setWizardCategory} />
            {wizardCategory && (
                <Wizard
                    key={wizardCategory}
                    initialCategory={wizardCategory}
                    hideGrid
                    onClosed={() => setWizardCategory(null)}
                />
            )}
        </>
    );
}
