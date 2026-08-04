
import useSWR, { SWRConfiguration } from 'swr';
import { fetchWithDemo } from './utils';

class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  get size() {
    return this.cache.size;
  }
}

const swrCache = new LRUCache<unknown>(200);

const fetcher = async (url: string) => {
  const res = await fetchWithDemo(url);
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
};

export { fetcher, swrCache };

export function useData<T = unknown>(
  url: string | null,
  options?: SWRConfiguration
) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60000,
    ...options,
  });
}

export function useStaticData<T = unknown>(
  url: string | null,
  options?: SWRConfiguration
) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
    dedupingInterval: 300000,
    ...options,
  });
}
