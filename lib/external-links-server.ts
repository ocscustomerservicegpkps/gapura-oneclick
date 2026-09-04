import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_EXTERNAL_LINKS, type ExternalLinksMap, type ExternalLinkEntry } from '@/lib/external-links';

export async function getExternalLinks(): Promise<ExternalLinksMap> {
  try {
    // One .order() per column: the comma-joined form was sent as a single
    // column name, so the ordering PostgREST applied was not the one intended.
    const { data, error } = await supabaseAdmin
      .from('external_links')
      .select('*')
      .order('category')
      .order('sort_order');

    if (error) {
      console.error('[EXTERNAL_LINKS] Query failed, using defaults:', error.message);
      return { ...DEFAULT_EXTERNAL_LINKS };
    }
    if (!data || data.length === 0) {
      return { ...DEFAULT_EXTERNAL_LINKS };
    }

    const merged: ExternalLinksMap = { ...DEFAULT_EXTERNAL_LINKS };
    for (const row of data) {
      merged[row.id] = {
        id: row.id,
        label: row.label,
        url: row.url,
        category: row.category,
        description: row.description || '',
      };
    }
    return merged;
  } catch {
    return { ...DEFAULT_EXTERNAL_LINKS };
  }
}

export function getDefaultLinksArray(): ExternalLinkEntry[] {
  return Object.values(DEFAULT_EXTERNAL_LINKS);
}
