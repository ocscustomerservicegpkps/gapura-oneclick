
import 'server-only';

import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabase-admin';

export interface AICacheEnvelope<T = unknown> {

  payload: T;

  generatedAt: string;

  sourceSyncAt: string | null;

  syncVersion: number;

  stale: boolean;
}

export function buildAICacheScopeHash(scope: unknown): string {
  return crypto.createHash('sha1').update(JSON.stringify(scope)).digest('hex');
}

export function buildAICacheKey(feature: string, scope: unknown, syncVersion: number): string {
  const scopeHash = buildAICacheScopeHash(scope);
  return `${feature}:${syncVersion}:${scopeHash}`;
}

export async function readAICache<T>(cacheKey: string): Promise<AICacheEnvelope<T> | null> {
  const { data, error } = await supabaseAdmin
    .from('ai_cache_entries')
    .select('cache_key, insights, metadata, created_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const metadata = (data.metadata || {}) as Record<string, unknown>;
  return {
    payload: data.insights as T,
    generatedAt: String(metadata.generatedAt || data.created_at),
    sourceSyncAt: metadata.sourceSyncAt ? String(metadata.sourceSyncAt) : null,
    syncVersion: Number(metadata.syncVersion || 0),
    stale: Boolean(metadata.stale),
  };
}

export async function findLatestAICache<T>(feature: string, scopeHashPrefix?: string): Promise<AICacheEnvelope<T> | null> {
  let query = supabaseAdmin
    .from('ai_cache_entries')
    .select('cache_key, insights, metadata, created_at')
    .ilike('cache_key', `${feature}:%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (scopeHashPrefix) {
    query = query.ilike('cache_key', `${feature}:%:${scopeHashPrefix}`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  const metadata = (row.metadata || {}) as Record<string, unknown>;

  return {
    payload: row.insights as T,
    generatedAt: String(metadata.generatedAt || row.created_at),
    sourceSyncAt: metadata.sourceSyncAt ? String(metadata.sourceSyncAt) : null,
    syncVersion: Number(metadata.syncVersion || 0),
    stale: true,
  };
}

export async function writeAICache<T>(options: {
  cacheKey: string;
  feature: string;
  payload: T;
  sourceSyncAt: string | null;
  syncVersion: number;
  stale?: boolean;
  extraMetadata?: Record<string, unknown>;
}): Promise<void> {
  const {
    cacheKey,
    feature,
    payload,
    sourceSyncAt,
    syncVersion,
    stale = false,
    extraMetadata = {},
  } = options;

  const generatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('ai_cache_entries')
    .upsert(
      {
        cache_key: cacheKey,
        insights: payload,
        metadata: {
          feature,
          generatedAt,
          sourceSyncAt,
          syncVersion,
          stale,
          ...extraMetadata,
        },
      },
      { onConflict: 'cache_key', ignoreDuplicates: false },
    );

  if (error) {
    throw error;
  }
}
