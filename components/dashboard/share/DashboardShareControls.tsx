'use client';

import { useState, useEffect } from 'react';
import { ShareDashboardDialog, type ShareFilterOptions } from './ShareDashboardDialog';
import { PresentationKiosk, type KioskFilters } from './PresentationKiosk';
import type { ShareScope } from '@/lib/share/types';
import type { Report } from '@/types';

export interface ShareControlAction {
  label: string;
  onClick: () => void;
}

interface DashboardShareControlsProps {
  dashboardKey: string;
  tabs: readonly string[];
  initialScope: ShareScope;
  availableOptions: ShareFilterOptions;
  /** Exposes the header action buttons (Share / Present) to the owning dashboard. */
  onActions: (actions: ShareControlAction[]) => void;
  /** Kiosk render inputs. */
  divisionCode: string;
  filteredReports: readonly Report[];
  globalFilters: KioskFilters;
}

// Owns the Share dialog + Presentation kiosk for one dashboard and hands the
// two header actions (Share, Present) to the parent via onActions. The parent
// feeds them into ResponsiveHeader's divisionDashboardActions slot.
export function DashboardShareControls({
  dashboardKey,
  tabs,
  initialScope,
  availableOptions,
  onActions,
  divisionCode,
  filteredReports,
  globalFilters,
}: DashboardShareControlsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [kioskOpen, setKioskOpen] = useState(false);

  useEffect(() => {
    onActions([
      { label: 'Share', onClick: () => setShareOpen(true) },
      { label: 'Present', onClick: () => setKioskOpen(true) },
    ]);
    return () => onActions([]);
  }, [onActions]);

  return (
    <>
      <ShareDashboardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        dashboardKey={dashboardKey}
        tabs={tabs}
        initialScope={initialScope}
        availableOptions={availableOptions}
      />
      <PresentationKiosk
        open={kioskOpen}
        onClose={() => setKioskOpen(false)}
        divisionCode={divisionCode}
        filteredReports={filteredReports}
        globalFilters={globalFilters}
        availableOptions={availableOptions}
      />
    </>
  );
}
