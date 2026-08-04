'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import type { DashboardTile, QueryResult } from '@/types/builder';

interface ChartClickHandlerProps {
  tile: DashboardTile;
  result: QueryResult | null;
  children: ReactNode;
  dashboardId?: string;
}

export function ChartClickHandler({ tile, result, children, dashboardId }: ChartClickHandlerProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!result) return;

    const openInNewTab = tile.visualization.openLinkInNewTab;

    const detailData = {
      tile,
      result,
      dashboardId,
      timestamp: Date.now()
    };

    sessionStorage.setItem('chartDetailData', JSON.stringify(detailData));

    const params = new URLSearchParams();
    if (dashboardId) params.set('dashboardId', dashboardId);
    params.set('tileId', tile.id);
    const url = `/dashboard/chart-detail?${params.toString()}`;

    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      router.push(url);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="cursor-pointer transition-all duration-200 hover:opacity-90 relative group h-full w-full"
      title="Klik untuk melihat detail"
    >
      {children}

      {}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-[#6b8e3d]/20">
          <span className="text-[11px] font-medium text-[#6b8e3d] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
              <path d="M11 8v6M8 11h6"/>
            </svg>
            Klik untuk detail
          </span>
        </div>
      </div>
    </div>
  );
}
