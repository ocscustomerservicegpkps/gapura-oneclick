
import 'server-only';

import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabase-admin';

interface DashboardCacheEntry<T = unknown> {

  cache_key: string;

  scope_key: string;

  dashboard_slug: string;

  tile_id: string | null;

  payload: T;

  expires_at: string;

  sync_version: number;

  created_at: string;
}

export function hashCacheKey(parts: unknown): string {
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex');
}

export async function readDashboardSnapshot<T>(
  cacheKey: string,
  expectedSyncVersion: number,
): Promise<DashboardCacheEntry<T> | null> {
  const { data, error } = await supabaseAdmin
    .from('dashboard_cache_entries')
    .select('cache_key, scope_key, dashboard_slug, tile_id, payload, expires_at, sync_version, created_at')
    .eq('cache_key', cacheKey)
    .eq('sync_version', expectedSyncVersion)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as DashboardCacheEntry<T> | null) || null;
}

export async function writeDashboardSnapshot(options: {
  cacheKey: string;
  scopeKey: string;
  dashboardSlug: string;
  tileId?: string | null;
  payload: unknown;
  syncVersion: number;
  ttlSeconds?: number;
}): Promise<void> {
  const {
    cacheKey,
    scopeKey,
    dashboardSlug,
    tileId = null,
    payload,
    syncVersion,
    ttlSeconds = 300,
  } = options;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('dashboard_cache_entries')
    .upsert(
      {
        cache_key: cacheKey,
        scope_key: scopeKey,
        dashboard_slug: dashboardSlug,
        tile_id: tileId,
        payload,
        expires_at: expiresAt,
        sync_version: syncVersion,
      },
      { onConflict: 'cache_key', ignoreDuplicates: false },
    );

  if (error) {
    throw error;
  }
}

export async function purgeDashboardSnapshots(options?: {
  dashboardSlug?: string;
  maxSyncVersion?: number;
}): Promise<void> {
  let query = supabaseAdmin.from('dashboard_cache_entries').delete();

  if (options?.dashboardSlug) {
    query = query.eq('dashboard_slug', options.dashboardSlug);
  }

  if (typeof options?.maxSyncVersion === 'number') {
    query = query.lt('sync_version', options.maxSyncVersion);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}

export async function purgeExpiredDashboardSnapshots(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('dashboard_cache_entries')
    .delete()
    .lte('expires_at', new Date().toISOString());

  if (error) {
    throw error;
  }
}
