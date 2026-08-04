'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const Analytics = dynamic(
    () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
    { ssr: false, loading: () => null }
);

const SpeedInsights = dynamic(
    () => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights),
    { ssr: false, loading: () => null }
);

const isIdleCallbackSupported = typeof window !== 'undefined' && 'requestIdleCallback' in window;

export default function PerformanceTelemetry() {
    const pathname = usePathname();
    const [isIdle, setIsIdle] = useState(false);

    const isLightweightRoute = useMemo(
        () => pathname.startsWith('/auth/') || pathname.startsWith('/embed/') || pathname === '/offline',
        [pathname]
    );

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || isLightweightRoute) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsIdle(false);
            return;
        }

        if (isIdleCallbackSupported) {
            const idleId = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(
                () => setIsIdle(true)
            );

            return () => {
                if ('cancelIdleCallback' in window) {
                    (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                }
            };
        }

        const timeoutId = window.setTimeout(() => setIsIdle(true), 1200);
        return () => window.clearTimeout(timeoutId);
    }, [isLightweightRoute]);

    if (!isIdle) {
        return null;
    }

    return (
        <>
            <Analytics />
            <SpeedInsights />
        </>
    );
}
