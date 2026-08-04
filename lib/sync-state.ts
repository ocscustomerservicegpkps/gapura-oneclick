
import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';

const REPORTS_SYNC_SOURCE = 'reports';

interface SyncStateRecord {

  source: string;

  last_sync_at: string | null;

  sync_version: number;

  status: string;

  locked_until: string | null;

  last_error: string | null;

  row_count: number;

  updated_at: string;
}

interface SyncLockRpcRow extends Omit<SyncStateRecord, 'source'> {
  acquired: boolean;
  sync_source: string;
}

async function ensureSyncState(source: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sync_state')
    .upsert({ source, status: 'idle' }, { onConflict: 'source', ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

export async function getSyncState(source = REPORTS_SYNC_SOURCE): Promise<SyncStateRecord> {
  await ensureSyncState(source);

  const { data, error } = await supabaseAdmin
    .from('sync_state')
    .select('*')
    .eq('source', source)
    .single();

  if (error || !data) {
    throw error || new Error(`Missing sync_state row for ${source}`);
  }

  return data as SyncStateRecord;
}

export async function acquireSyncLock(
  source = REPORTS_SYNC_SOURCE,
  lockSeconds = 300,
): Promise<{ acquired: boolean; state: SyncStateRecord }> {
  const { data, error } = await supabaseAdmin.rpc('acquire_sync_lock', {
    p_source: source,
    p_lock_seconds: lockSeconds,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as SyncLockRpcRow | undefined) : (data as SyncLockRpcRow | null);
  if (!row) {
    const state = await getSyncState(source);
    return { acquired: false, state };
  }

  const { acquired, sync_source, ...rest } = row;
  const state: SyncStateRecord = { ...rest, source: sync_source };
  return { acquired: Boolean(acquired), state };
}

export async function completeSyncState(options: {
  source?: string;
  success: boolean;
  rowCount?: number | null;
  error?: string | null;
  bumpVersion?: boolean;
}): Promise<SyncStateRecord> {
  const { source = REPORTS_SYNC_SOURCE, success, rowCount = null, error = null, bumpVersion = false } = options;

  const { data, error: rpcError } = await supabaseAdmin.rpc('complete_sync_state', {
    p_source: source,
    p_success: success,
    p_row_count: rowCount,
    p_error: error,
    p_bump_version: bumpVersion,
  });

  if (rpcError || !data) {
    throw rpcError || new Error(`Failed to complete sync state for ${source}`);
  }

  return data as SyncStateRecord;
}

export async function bumpSyncVersion(source = REPORTS_SYNC_SOURCE, rowCount?: number | null): Promise<SyncStateRecord> {
  const { data, error } = await supabaseAdmin.rpc('bump_sync_state_version', {
    p_source: source,
    p_row_count: rowCount ?? null,
  });

  if (error || !data) {
    throw error || new Error(`Failed to bump sync version for ${source}`);
  }

  return data as SyncStateRecord;
}
