import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  attachCommentsToReports,
  collectReportCommentIdentifiers,
  type ReferencedReportComment,
} from '@/lib/report-comment-enrichment';
import type { Report } from '@/types';

const COMMENT_IDENTIFIER_BATCH_SIZE = 100;

function chunkIdentifiers(identifiers: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < identifiers.length; index += COMMENT_IDENTIFIER_BATCH_SIZE) {
    chunks.push(identifiers.slice(index, index + COMMENT_IDENTIFIER_BATCH_SIZE));
  }
  return chunks;
}

export async function enrichReportsWithComments<T extends Report>(reports: T[]): Promise<T[]> {
  if (reports.length === 0) return reports;

  const identifiers = collectReportCommentIdentifiers(reports);
  if (identifiers.length === 0) {
    return reports.map((report) => ({ ...report, comments: [] }));
  }

  try {
    const results = await Promise.all(chunkIdentifiers(identifiers).map((batch) => (
      supabaseAdmin
        .from('report_comments')
        .select(`
          id,
          report_id,
          content,
          attachments,
          is_system_message,
          sheet_id,
          created_at,
          users:user_id (
            id,
            full_name,
            role,
            division
          )
        `)
        .in('report_id', batch)
        .order('created_at', { ascending: true })
    )));

    const comments: ReferencedReportComment[] = [];
    for (const result of results) {
      if (result.error) throw result.error;
      comments.push(...((result.data || []) as unknown as ReferencedReportComment[]));
    }

    return attachCommentsToReports(reports, comments);
  } catch (error) {
    console.error('[ReportComments] Failed to preload report comments:', error);
    return reports;
  }
}
