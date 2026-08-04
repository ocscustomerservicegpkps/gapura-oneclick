interface ReportCursor {
  createdAt: string;
  id: string;
}

const SAFE_REPORT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function encodeReportCursor(cursor: ReportCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeReportCursor(value: string | null | undefined): ReportCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ReportCursor>;
    const createdAt = new Date(String(parsed.createdAt || ''));
    const id = String(parsed.id || '');
    if (Number.isNaN(createdAt.getTime()) || !SAFE_REPORT_ID.test(id)) return null;
    return { createdAt: createdAt.toISOString(), id };
  } catch {
    return null;
  }
}

function quotePostgrestLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function buildReportCursorFilter(cursor: ReportCursor): string {
  const createdAt = quotePostgrestLiteral(cursor.createdAt);
  const id = quotePostgrestLiteral(cursor.id);
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

export function sanitizeReportSearch(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .normalize('NFKC')
    .slice(0, 120)
    .replace(/[^\p{L}\p{N}\s@._/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

export function quoteReportFilterValue(value: string): string {
  return quotePostgrestLiteral(value);
}
