'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import useSWRInfinite from 'swr/infinite';
import type { Report } from '@/types';
import { buildPwaScopedStorageKey } from '@/lib/pwa/client-state';
import {
  REPORT_PAGE_CACHE_SCHEMA,
  REPORT_PAGE_FRESH_MS,
  isPersistedReportPage,
  normalizeReportPage,
  withReportCursor,
  type PersistedReportPage,
  type ReportPage,
} from '@/lib/report-page';

const STORAGE_KEY = 'reports-cache-v5';
const CACHE_EVENT = 'gapura:reports-cache-updated';
const snapshotCache = new Map<string, { raw: string | null; value: PersistedReportPage<Report> | null }>();

interface UseReportsDataOptions {
  initialPage?: ReportPage<Report> | null;
  revalidateOnMount?: boolean;
  /** When false, no network requests are made (used to gate by active view). */
  enabled?: boolean;
}

async function fetchReportPage(url: string): Promise<ReportPage<Report>> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch reports (${response.status})`);
  return normalizeReportPage<Report>(await response.json());
}

function subscribeToPersistentCache(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CACHE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CACHE_EVENT, onStoreChange);
  };
}

function readPersistentPage(key: string, query: string): PersistedReportPage<Report> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  const cached = snapshotCache.get(key);
  if (cached?.raw === raw) return cached.value;

  let value: PersistedReportPage<Report> | null = null;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPersistedReportPage<Report>(parsed, query)) {
        value = {
          ...parsed,
          page: {
            ...parsed.page,
            meta: { ...parsed.page.meta, source: 'cache' },
          },
        };
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  snapshotCache.set(key, { raw, value });
  return value;
}

function persistWhenIdle(key: string, query: string, page: ReportPage<Report>) {
  const write = () => {
    const entry: PersistedReportPage<Report> = {
      schema: REPORT_PAGE_CACHE_SCHEMA,
      query,
      timestamp: Date.now(),
      page,
    };
    const serialized = JSON.stringify(entry);

    try {
      localStorage.setItem(key, serialized);
      snapshotCache.set(key, { raw: serialized, value: entry });
      window.dispatchEvent(new Event(CACHE_EVENT));
    } catch {
      try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const storageKey = localStorage.key(index);
          if (storageKey?.includes(STORAGE_KEY)) localStorage.removeItem(storageKey);
        }
        localStorage.setItem(key, serialized);
        snapshotCache.set(key, { raw: serialized, value: entry });
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[use-reports-cache] localStorage full; skipping report-page persist');
        }
      }
    }
  };

  if (typeof requestIdleCallback === 'function') requestIdleCallback(write, { timeout: 3000 });
  else setTimeout(write, 250);
}

export function useReportsData(
  url = '/api/reports',
  options: UseReportsDataOptions = {},
) {
  const storageKey = typeof window !== 'undefined'
    ? buildPwaScopedStorageKey(`${STORAGE_KEY}:${url}`)
    : `${STORAGE_KEY}:${url}`;
  const persisted = useSyncExternalStore(
    subscribeToPersistentCache,
    () => readPersistentPage(storageKey, url),
    () => null,
  );
  const fallbackPage = options.initialPage || persisted?.page || null;

  const enabled = options.enabled ?? true;
  const getKey = useCallback((pageIndex: number, previousPage: ReportPage<Report> | null) => {
    if (!enabled) return null;
    if (previousPage && !previousPage.pagination.hasMore) return null;
    return withReportCursor(url, pageIndex === 0 ? null : previousPage?.pagination.nextCursor || null);
  }, [url, enabled]);

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    setSize,
    size,
  } = useSWRInfinite<ReportPage<Report>>(getKey, fetchReportPage, {
    fallbackData: fallbackPage ? [fallbackPage] : undefined,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateFirstPage: true,
    revalidateOnMount: options.revalidateOnMount ?? !options.initialPage,
    dedupingInterval: 60_000,
    persistSize: false,
  });

  useEffect(() => {
    if (!persisted?.page || data?.length) return;
    void mutate([persisted.page], false);
  }, [data?.length, mutate, persisted]);

  useEffect(() => {
    if (!data?.[0]) return;
    persistWhenIdle(storageKey, url, data[0]);
  }, [data, storageKey, url]);

  const reports = useMemo(() => {
    const byId = new Map<string, Report>();
    for (const page of data || []) {
      for (const report of page.reports) byId.set(report.id, report);
    }
    return Array.from(byId.values());
  }, [data]);

  const lastPage = data?.at(-1) || fallbackPage;
  const hasMore = Boolean(lastPage?.pagination.hasMore);
  const isLoadingMore = isValidating && size > (data?.length || 0);

  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    const compute = () => {
      setIsStale(persisted ? Date.now() - persisted.timestamp > REPORT_PAGE_FRESH_MS : false);
    };
    const timeoutId = setTimeout(compute, 0);
    const intervalId = setInterval(compute, 30_000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [persisted]);

  const updateReport = useCallback((reportId: string, update: Partial<Report>) => {
    return mutate((pages) => pages?.map((page) => ({
      ...page,
      reports: page.reports.map((report) => (
        report.id === reportId ? { ...report, ...update } : report
      )),
    })), false);
  }, [mutate]);

  useEffect(() => {
    const handleOnline = () => void mutate();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [mutate]);

  return {
    reports,
    pages: data || [],
    isLoading: isLoading && reports.length === 0,
    isError: error,
    isValidating,
    isLoadingMore,
    isOffline: typeof navigator !== 'undefined' && !navigator.onLine,
    hasMore,
    loadMore: () => hasMore ? setSize((current) => current + 1) : Promise.resolve(),
    refresh: async () => {
      await mutate();
    },
    updateReport,
    lastUpdated: data?.[0]?.meta.generatedAt
      ? new Date(data[0].meta.generatedAt).getTime()
      : persisted?.timestamp || null,
    isStale,
  };
}
