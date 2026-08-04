/**
 * @file
 * 
 * File ini berisi implementasi klien HuggingFace dengan fitur caching, rate limiting,
 * retry logic, dan queue management untuk optimasi request ke layanan AI
 */

/**
 * Interface untuk entry cache
 * Menyimpan data, waktu kadaluarsa, dan URL asli
 * 
 * @template T - Tipe data yang disimpan dalam cache
 */
interface CacheEntry<T> {
  /** Data yang disimpan dalam cache */
  data: T;
  /** Waktu kadaluarsa cache dalam timestamp */
  expiry: number;
  /** URL asli dari request */
  url: string;
}

/**
 * Interface untuk request yang di-queue
 * Menyimpan resolve/reject function dan informasi request
 */
interface QueuedRequest {
  /** Fungsi resolve untuk Promise */
  resolve: (value: Response) => void;
  /** Fungsi reject untuk Promise */
  reject: (error: Error) => void;
  /** URL target request */
  url: string;
  /** Opsi request (method, headers, body, dll) */
  options: RequestInit;
  /** Jumlah percobaan yang sudah dilakukan */
  attempt: number;
}

/**
 * Interface untuk konfigurasi HfClient
 */
interface HfClientConfig {
  /** Base URL untuk layanan AI */
  baseUrl: string;
  /** API key untuk header X-API-Key (kosong = layanan tanpa autentikasi) */
  apiKey: string;
  /** Rate limit dalam request per menit */
  rateLimitRpm: number;
  /** Time-to-live cache dalam milidetik */
  cacheTtlMs: number;
  /** Jumlah maksimal retry untuk request gagal */
  maxRetries: number;
  /** Timeout untuk request dalam milidetik */
  timeoutMs: number;
  /** Backoff time untuk retry dalam milidetik */
  retryBackoffMs: number;
}

/**
 * Interface untuk statistik HfClient
 * Menyimpan berbagai metrik performa dan penggunaan
 */
interface HfClientStats {
  /** Jumlah cache hit */
  cacheHits: number;
  /** Jumlah cache miss */
  cacheMisses: number;
  /** Jumlah request yang terkena rate limit */
  rateLimited: number;
  /** Jumlah retry yang dilakukan */
  retries: number;
  /** Jumlah request yang dideduplikasi */
  dedupedRequests: number;
  /** Jumlah request yang di-queue */
  requestsQueued: number;
}

const MAX_CACHE_SIZE = 500;

/**
 * Konfigurasi default untuk HfClient
 * Nilai-nilai ini dapat di-override dengan environment variable atau parameter
 */
const DEFAULT_CONFIG: HfClientConfig = {
  baseUrl: typeof window !== 'undefined'
    ? ''
    : (process.env.AI_SERVICE_URL || process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://gapura-dev-gapura-ai.hf.space'),
  // Server-only secret — di browser selalu kosong (request browser lewat /api proxy).
  apiKey: typeof window !== 'undefined'
    ? ''
    : (process.env.ML_SERVICE_API_KEY || process.env.AI_SERVICE_API_KEY || ''),
  rateLimitRpm: parseInt(process.env.HF_RATE_LIMIT_RPM || '100', 10),
  cacheTtlMs: parseInt(process.env.HF_CACHE_TTL_MS || '900000', 10),
  maxRetries: parseInt(process.env.HF_MAX_RETRIES || '3', 10),
  timeoutMs: parseInt(process.env.HF_TIMEOUT_MS || '120000', 10),
  retryBackoffMs: parseInt(process.env.HF_RETRY_BACKOFF_MS || '1000', 10),
};

/**
 * Kelas klien HuggingFace dengan caching, rate limiting, dan retry logic
 * Kelas ini menyediakan antarmuka untuk melakukan request ke layanan AI
 * dengan berbagai optimasi seperti caching, deduplikasi, dan rate limiting
 */
class HuggingFaceClient {
  private config: HfClientConfig;
  private requestTimestamps: number[] = [];
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private pendingRequests: Map<string, Promise<Response>> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private stats: HfClientStats = {
    cacheHits: 0,
    cacheMisses: 0,
    rateLimited: 0,
    retries: 0,
    dedupedRequests: 0,
    requestsQueued: 0,
  };

  // [FIX] Store the interval ID so it can be cleared on destroy.
  // Previously, setInterval() was called without storing the handle,
  // creating an un-cancellable timer that leaked across HMR reloads.
  private cleanupTimerId: ReturnType<typeof setInterval> | null = null;

  // [FIX] Track whether the client has been explicitly destroyed
  // to prevent use-after-destroy bugs.
  private destroyed = false;

  /**
   * Membuat instance baru dari HuggingFaceClient
   * 
   * @param config - Konfigurasi parsial untuk override default
   */
  constructor(config: Partial<HfClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCacheCleanup();
  }

  /**
   * Memulai proses pembersihan cache secara berkala
   * Membersihkan cache yang sudah kadaluarsa setiap 60 detik
   *
   * [FIX] Now stores the interval handle in `cleanupTimerId` so it can
   * be cleared via `destroy()`. This prevents the timer from running
   * indefinitely (especially critical during Next.js HMR where module
   * re-evaluation creates new singleton instances).
   */
  private startCacheCleanup(): void {
    // Guard: clear any existing timer before starting a new one
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
    }

    this.cleanupTimerId = setInterval(() => {
      // [FIX] Early exit if client was destroyed between ticks
      if (this.destroyed) {
        if (this.cleanupTimerId !== null) {
          clearInterval(this.cleanupTimerId);
          this.cleanupTimerId = null;
        }
        return;
      }

      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiry < now) {
          this.cache.delete(key);
        }
      }
      if (this.cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(this.cache.entries())
          .sort((a, b) => a[1].expiry - b[1].expiry);
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
        toRemove.forEach(([key]) => this.cache.delete(key));
      }
    }, 60000);
  }

  /**
   * Menghasilkan kunci cache yang unik berdasarkan URL dan opsi request
   * 
   * @param url - URL request
   * @param options - Opsi request (method, body, dll)
   * @returns String kunci cache yang unik
   */
  private generateCacheKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Membersihkan timestamp request yang sudah lama (lebih dari 60 detik)
   */
  private cleanOldTimestamps(): void {
    const windowStart = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
  }

  /**
   * Memeriksa apakah request baru dapat dibuat tanpa melanggar rate limit
   * 
   * @returns True jika request dapat dibuat, false jika rate limit tercapai
   */
  private canMakeRequest(): boolean {
    this.cleanOldTimestamps();
    return this.requestTimestamps.length < this.config.rateLimitRpm;
  }

  /**
   * Menunggu hingga rate limit terlewati
   * Fungsi ini akan menunggu hingga request dapat dibuat lagi
   */
  private async waitForRateLimit(): Promise<void> {
    while (!this.canMakeRequest()) {
      const oldestInWindow = this.requestTimestamps[0];
      if (oldestInWindow) {
        const waitTime = Math.max(100, 60000 - (Date.now() - oldestInWindow) + 100);
        await this.sleep(Math.min(waitTime, 5000));
      }
      this.cleanOldTimestamps();
    }
  }

  /**
   * Fungsi helper untuk menunggu selama waktu tertentu
   * 
   * @param ms - Waktu tunggu dalam milidetik
   * @returns Promise yang resolve setelah waktu tunggu selesai
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mencatat timestamp request baru
   */
  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Melakukan request dengan timeout dan abort signal
   * 
   * @param url - URL target request
   * @param options - Opsi request
   * @param timeout - Timeout dalam milidetik
   * @param signal - Abort signal untuk membatalkan request
   * @returns Promise yang resolve dengan Response
   * @throws Error jika timeout atau request dibatalkan
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = this.config.timeoutMs,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onAbort = () => {
      clearTimeout(timeoutId);
      controller.abort();
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (signal?.aborted) throw error;
        throw new Error('Request timeout - AI service took too long to respond');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }

  /**
   * Melakukan request dengan retry logic
   * Akan melakukan retry otomatis jika request gagal atau terkena rate limit
   * 
   * @param url - URL target request
   * @param options - Opsi request
   * @param attempt - Jumlah percobaan yang sudah dilakukan
   * @returns Promise yang resolve dengan Response
   * @throws Error jika request gagal setelah semua percobaan
   */
  private async executeRequest(
    url: string,
    options: RequestInit,
    attempt: number = 0
  ): Promise<Response> {
    await this.waitForRateLimit();
    this.recordRequest();

    try {
      const response = await this.fetchWithTimeout(url, options);

      if (response.status === 429 && attempt < this.config.maxRetries) {
        this.stats.rateLimited++;
        this.stats.retries++;
        
        const backoffMs = this.config.retryBackoffMs * Math.pow(2, attempt);
        await this.sleep(backoffMs);
        
        return this.executeRequest(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < this.config.maxRetries && error instanceof Error) {
        this.stats.retries++;
        const backoffMs = this.config.retryBackoffMs * Math.pow(2, attempt);
        await this.sleep(backoffMs);
        return this.executeRequest(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Memproses antrian request yang tertahan karena rate limit
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;

    const processNext = async () => {
      while (this.requestQueue.length > 0) {
        if (!this.canMakeRequest()) {
          await this.waitForRateLimit();
        }

        const request = this.requestQueue.shift();
        if (!request) break;

        try {
          const response = await this.executeRequest(
            request.url,
            request.options,
            request.attempt
          );
          request.resolve(response);
        } catch (error) {
          request.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }

      this.isProcessingQueue = false;
    };

    processNext();
  }

  /**
   * Melakukan request ke layanan AI dengan caching dan deduplikasi
   * 
   * @param url - URL target request (relative atau absolute)
   * @param options - Opsi request (method, headers, body, dll)
   * @param cacheOptions - Opsi untuk mengatur cache behavior
   * @param signal - Abort signal untuk membatalkan request
   * @returns Promise yang resolve dengan Response
   * @throws Error jika request gagal atau dibatalkan
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    cacheOptions?: { 
      cacheKey?: string; 
      ttl?: number;
      bypassCache?: boolean;
    },
    signal?: AbortSignal
  ): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    if (this.config.apiKey) {
      options = {
        ...options,
        headers: { ...(options.headers as Record<string, string> | undefined), 'X-API-Key': this.config.apiKey },
      };
    }
    const effectiveTtl = cacheOptions?.ttl ?? this.config.cacheTtlMs;
    const cacheKey = cacheOptions?.cacheKey ?? this.generateCacheKey(fullUrl, options);

    if (!cacheOptions?.bypassCache && (options.method === 'GET' || !options.method)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<Response> | undefined;
      if (cached && cached.expiry > Date.now()) {
        this.stats.cacheHits++;
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
        });
      }
      this.stats.cacheMisses++;

      if (this.pendingRequests.has(cacheKey)) {
        this.stats.dedupedRequests++;
        return this.pendingRequests.get(cacheKey)!.then((response) => response.clone());
      }
    }

    const requestPromise = (async () => {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      if (!this.canMakeRequest()) {
        this.stats.requestsQueued++;
        return new Promise<Response>((resolve, reject) => {
          this.requestQueue.push({
            resolve,
            reject,
            url: fullUrl,
            options,
            attempt: 0,
          });
          this.processQueue();
        });
      }

      const response = await this.executeRequest(fullUrl, options);

      if (
        response.ok &&
        !cacheOptions?.bypassCache &&
        (options.method === 'GET' || !options.method)
      ) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          this.cache.set(cacheKey, {
            data,
            expiry: Date.now() + effectiveTtl,
            url: fullUrl,
          });
        } catch {
          // Non-JSON response, skip caching
        }
      }

      return response;
    })();

    if (!cacheOptions?.bypassCache && (options.method === 'GET' || !options.method)) {
      this.pendingRequests.set(cacheKey, requestPromise);
      requestPromise.finally(() => {
        this.pendingRequests.delete(cacheKey);
      });
    }

    return requestPromise;
  }

  /**
   * Melakukan request dan mengembalikan data JSON
   * Shortcut untuk fetch() dengan response.json()
   * 
   * @template T - Tipe data JSON yang diharapkan
   * @param url - URL target request
   * @param options - Opsi request
   * @param cacheOptions - Opsi untuk mengatur cache behavior
   * @param signal - Abort signal untuk membatalkan request
   * @returns Promise yang resolve dengan data JSON
   * @throws Error jika request gagal atau response tidak OK
   */
  async fetchJson<T = unknown>(
    url: string,
    options: RequestInit = {},
    cacheOptions?: {
      cacheKey?: string;
      ttl?: number;
      bypassCache?: boolean;
    },
    signal?: AbortSignal
  ): Promise<T> {
    const response = await this.fetch(url, options, cacheOptions, signal);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Mengambil statistik penggunaan klien
   * 
   * @returns Object berisi statistik cache, queue, dan request
   */
  getStats(): HfClientStats & { cacheSize: number; queueLength: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      queueLength: this.requestQueue.length,
    };
  }

  /**
   * Menghapus semua entry dari cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Menghapus entry cache yang cocok dengan pattern
   * Pattern dapat berupa string atau regex
   * 
   * @param pattern - Pattern untuk mencocokkan kunci cache
   */
  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      } else {
        if (pattern.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Mengambil konfigurasi saat ini
   * 
   * @returns Copy dari konfigurasi saat ini
   */
  getConfig(): HfClientConfig {
    return { ...this.config };
  }

  /**
   * Memperbarui konfigurasi klien
   * 
   * @param newConfig - Konfigurasi baru yang akan di-merge dengan konfigurasi saat ini
   */
  updateConfig(newConfig: Partial<HfClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * [FIX] Destroy the client and release all held resources.
   *
   * Clears the periodic cleanup interval, drains the cache, rejects
   * any queued requests, and clears pending request promises.
   *
   * This MUST be called when the client is no longer needed (e.g.,
   * during process shutdown, test teardown, or before recreating
   * the singleton) to prevent timer and memory leaks.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // 1. Stop the periodic cleanup timer
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }

    // 2. Clear all caches
    this.cache.clear();
    this.pendingRequests.clear();
    this.requestTimestamps = [];

    // 3. Reject all queued requests so callers don't hang forever
    for (const queued of this.requestQueue) {
      queued.reject(new Error('HuggingFaceClient destroyed'));
    }
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }
}

// One instance per resolved baseUrl. Keying by baseUrl matters because callers
// like ml-client pass a different ML_SERVICE_URL — a single global singleton
// would silently pin every caller to whichever baseUrl was requested first.
const hfClients = new Map<string, HuggingFaceClient>();

/**
 * Mendapatkan atau membuat instance HuggingFaceClient untuk baseUrl tertentu.
 * Instance dibagi (di-cache) per baseUrl agar timer & cache tidak berlipat.
 *
 * @param config - Konfigurasi parsial (dipakai hanya saat instance dibuat).
 * @returns Instance HuggingFaceClient
 * @example
 * ```typescript
 * const client = getHfClient({ rateLimitRpm: 200 });
 * ```
 */
export function getHfClient(config?: Partial<HfClientConfig>): HuggingFaceClient {
  const baseUrl = config?.baseUrl ?? DEFAULT_CONFIG.baseUrl;
  let instance = hfClients.get(baseUrl);
  if (!instance) {
    instance = new HuggingFaceClient(config);
    hfClients.set(baseUrl, instance);
  }
  return instance;
}

/**
 * Mereset semua instance HuggingFaceClient.
 *
 * [FIX] Now calls destroy() on each existing instance before clearing the
 * map. This ensures the setInterval timer, cache Maps, and queued requests
 * are properly cleaned up before the singletons are replaced — preventing
 * the most common leak vector in this module.
 *
 * Berguna untuk testing atau re-initialization
 */
export function resetHfClient(): void {
  for (const instance of hfClients.values()) {
    instance.destroy();
  }
  hfClients.clear();
}

export { HuggingFaceClient };
export type { HfClientConfig, HfClientStats };
