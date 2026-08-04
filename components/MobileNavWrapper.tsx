
'use client';

import dynamic from 'next/dynamic';

const MobileBottomNavContent = dynamic(
    () => import('./MobileBottomNav').then(mod => mod.MobileBottomNav),
    { ssr: false }
);

export function MobileNavWrapper({ role, division }: { role: string; division?: string | null }) {
    return <MobileBottomNavContent role={role} division={division} />;
}
