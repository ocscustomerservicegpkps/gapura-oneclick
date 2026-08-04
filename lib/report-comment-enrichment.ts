import type { Report } from '@/types';

type ReportComment = NonNullable<Report['comments']>[number];

export type ReferencedReportComment = ReportComment & {
  report_id: string;
};

export interface LoadedReportComments {
  reportId: string;
  comments: Report['comments'];
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function getReportCommentIdentifiers(report: Pick<Report, 'id' | 'sheet_id' | 'original_id'>): string[] {
  return Array.from(new Set([
    normalizeIdentifier(report.id),
    normalizeIdentifier(report.sheet_id),
    normalizeIdentifier(report.original_id),
  ].filter((value): value is string => value !== null)));
}

export function collectReportCommentIdentifiers(reports: Report[]): string[] {
  return Array.from(new Set(reports.flatMap(getReportCommentIdentifiers)));
}

export function attachCommentsToReports<T extends Report>(
  reports: T[],
  comments: ReferencedReportComment[],
): T[] {
  const ownerByIdentifier = new Map<string, number>();
  const ambiguousIdentifiers = new Set<string>();

  reports.forEach((report, reportIndex) => {
    for (const identifier of getReportCommentIdentifiers(report)) {
      const existingOwner = ownerByIdentifier.get(identifier);
      if (existingOwner !== undefined && existingOwner !== reportIndex) {
        ambiguousIdentifiers.add(identifier);
      } else {
        ownerByIdentifier.set(identifier, reportIndex);
      }
    }
  });

  for (const identifier of ambiguousIdentifiers) {
    ownerByIdentifier.delete(identifier);
  }

  const commentsByReport = reports.map(() => new Map<string, ReportComment>());
  for (const referencedComment of comments) {
    const commentIdentifier = normalizeIdentifier(referencedComment.report_id);
    if (!commentIdentifier) continue;
    const owner = ownerByIdentifier.get(commentIdentifier);
    if (owner === undefined) continue;

    const comment = { ...referencedComment };
    delete (comment as Partial<ReferencedReportComment>).report_id;
    commentsByReport[owner].set(comment.id, comment);
  }

  return reports.map((report, index) => ({
    ...report,
    comments: Array.from(commentsByReport[index].values()).sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    ),
  }));
}

export function buildReportDetailSnapshot(
  initialReport: Report,
  fullReport: Report | null,
  loadedComments: LoadedReportComments | null,
): Report {
  const matchingFullReport = fullReport?.id === initialReport.id ? fullReport : null;
  const base = matchingFullReport || initialReport;
  const comments = loadedComments?.reportId === initialReport.id
    ? loadedComments.comments
    : matchingFullReport?.comments ?? initialReport.comments;

  return comments !== undefined ? { ...base, comments } : base;
}
