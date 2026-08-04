'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { MobileNavWrapper } from '@/components/MobileNavWrapper';
import { cn } from '@/lib/utils';

const SIDEBAR_HIDDEN_PATHS = new Set([
  '/dashboard/eskalasi/select',
  '/dashboard/eskalasi/performance-links',
  '/dashboard/eskalasi/documents',
]);

// Width of the fixed desktop sidebar (Sidebar.tsx: w-[240px] lg:w-[260px], so
// 260px whenever it is visible, which is xl+).
const SIDEBAR_WIDTH = 260;
const SIDEBAR_QUERY = '(min-width: 1280px)';

export function DashboardFrame({ role, division, children }: { role: string; division?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = SIDEBAR_HIDDEN_PATHS.has(pathname ?? '');

  // The sidebar offset is applied as an INLINE style driven by matchMedia rather
  // than a CSS class. This dev environment (stable CSS URLs + a Serwist service
  // worker) aggressively caches the stylesheet, so newly-added CSS rules
  // frequently don't reach the browser and content slid under the fixed sidebar.
  // An inline style lives in the rendered DOM, bypassing the cached stylesheet
  // entirely, so the offset is always correct. Uses the SAME 1280px breakpoint as
  // the sidebar's `hidden xl:block` so the two can never desync.
  const [sidebarVisible, setSidebarVisible] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(SIDEBAR_QUERY);
    const sync = () => setSidebarVisible(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (hideSidebar) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 min-h-screen min-w-0 bg-[var(--surface-0)] flex flex-col">
          {children}
        </main>
      </div>
    );
  }

  const isEskalasi = role === 'DIVISI_ESKALASI';

  // Sidebar reserves space only at xl+ (matches Sidebar's `hidden xl:block`),
  // so portrait tablets (incl. iPad Pro 12.9" @ 1024px) get full width + bottom nav.

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} division={division} />
      {}
      <main
        className={cn(
          'flex-1 min-h-screen min-w-0 bg-[var(--surface-0)] flex flex-col',
          // `.dashboard-shell-main` (globals.css) is the CSS fallback for the very
          // first paint; the inline paddingLeft below is the authoritative offset.
          'dashboard-shell-main',
          isEskalasi ? 'pb-0' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] xl:pb-0'
        )}
        style={{ maxWidth: '100%', paddingLeft: sidebarVisible ? SIDEBAR_WIDTH : undefined }}
      >
        <div className="w-full min-w-0 flex-1 flex flex-col xl:pl-5">
          {children}
        </div>
      </main>
      {!isEskalasi && <MobileNavWrapper role={role} division={division} />}
    </div>
  );
}
