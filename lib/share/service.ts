import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PublishedDashboardRecord, ShareScope } from './types';

interface PublishedDashboardRow {
  id: string;
  slug: string;
  dashboard_key: string;
  tab: string;
  name: string | null;
  config: { scope: ShareScope };
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

function mapRow(row: PublishedDashboardRow): PublishedDashboardRecord {
  return {
    id: row.id,
    slug: row.slug,
    dashboardKey: row.dashboard_key,
    tab: row.tab,
    name: row.name,
    config: row.config ?? { scope: { hubs: [], stations: [], airlines: [], categories: [] } },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

export async function createPublishedDashboard(params: {
  slug: string;
  dashboardKey: string;
  tab: string;
  name?: string | null;
  config: { scope: ShareScope };
  createdBy: string | null;
}): Promise<PublishedDashboardRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('published_dashboards')
    .insert({
      slug: params.slug,
      dashboard_key: params.dashboardKey,
      tab: params.tab,
      name: params.name?.trim() ? params.name.trim().slice(0, 120) : null,
      config: params.config,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error || !data) return null;
  return mapRow(data as PublishedDashboardRow);
}

export async function listPublishedDashboards(
  createdBy: string,
  dashboardKey?: string,
): Promise<PublishedDashboardRecord[]> {
  let query = supabaseAdmin
    .from('published_dashboards')
    .select('*')
    .eq('created_by', createdBy)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (dashboardKey) query = query.eq('dashboard_key', dashboardKey);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as PublishedDashboardRow[]).map(mapRow);
}

export async function updatePublishedDashboard(params: {
  slug: string;
  createdBy: string;
  name?: string | null;
  config?: { scope: ShareScope };
}): Promise<PublishedDashboardRecord | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.name !== undefined) {
    patch.name = params.name?.trim() ? params.name.trim().slice(0, 120) : null;
  }
  if (params.config !== undefined) patch.config = params.config;

  const { data, error } = await supabaseAdmin
    .from('published_dashboards')
    .update(patch)
    .eq('slug', params.slug)
    .eq('created_by', params.createdBy)
    .select()
    .single();

  if (error || !data) return null;
  return mapRow(data as PublishedDashboardRow);
}

export async function revokePublishedDashboard(slug: string, createdBy: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('published_dashboards')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .eq('created_by', createdBy);

  return !error;
}

// Public lookup: security-definer RPC returns only safe columns for active
// slugs; revoked/missing rows come back empty.
export async function getActivePublishedDashboard(slug: string): Promise<PublishedDashboardRecord | null> {
  const { data, error } = await supabaseAdmin.rpc('get_active_published_dashboard', {
    p_slug: slug,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as PublishedDashboardRow;
  return mapRow(row);
}
