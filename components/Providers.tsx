'use client';

import dynamic from 'next/dynamic';
import { SWRConfig } from 'swr';
import type { SWRConfiguration } from 'swr';
import { fetcher as sharedFetcher, swrCache } from '@/lib/swr';

const PWAProvider = dynamic(() => import('@/components/PWAProvider'), {
    ssr: false,
    loading: () => null,
});

const onErrorRetry: NonNullable<SWRConfiguration['onErrorRetry']> = (_error, _key, _config, revalidate, options) => {
    if (options.retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount: options.retryCount }), Math.min(options.retryCount * 2000, 10000));
};

const swrConfig: SWRConfiguration = {
    fetcher: sharedFetcher,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: () => swrCache as any,
    revalidateOnFocus: false,
    // Keep showing the previous result while a new key (e.g. changed filter)
    // loads, so navigation/filtering never flashes back to a spinner.
    keepPreviousData: true,
    dedupingInterval: 60000,
    onErrorRetry,
};

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig value={swrConfig}>
            <PWAProvider>
                {children}
            </PWAProvider>
        </SWRConfig>
    );
}
