'use client';

import { useState, useMemo, useCallback, memo, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Plane,
  ArrowUp, ArrowDown,
  Loader2, CalendarDays, UserRound, Building2, GitBranch, Download,
  PencilLine, Save, X
} from 'lucide-react';
import {
  STATUS_CONFIG,
  type ReportStatus,
  getSeverityConfig,
  normalizeSeverityLevel
} from '@/lib/constants/report-status';
import { Report } from '@/types';
import { cn, splitReportTimestamp } from '@/lib/utils';
import { exportSingleReportToDocx } from '@/lib/reports-export';
import { resolveAreaType } from '@/lib/report-normalization';
import { StatusUpdateSuccessDialog } from '@/components/dashboard/StatusUpdateSuccessDialog';

type AreaTag = 'CGO' | 'LANDSIDE' | 'AIRSIDE' | 'GENERAL' | 'GSE' | 'JOUMPA' | 'LANDSIDE & AIRSIDE';

// Palette guard: dashboard uses ONE dominant (green) + ONE accent (amber) + neutral ink.
// CGO keeps emerald, GSE keeps amber; the former blue/sky/violet categories collapse to a
// neutral-ink chip (category text is retained, only the color noise is removed).
const AREA_TAG_CLASS: Record<AreaTag, string> = {
  CGO: 'bg-[var(--brand-emerald-50,#ecfdf5)] text-[var(--brand-emerald-700,#047857)]',
  LANDSIDE: 'bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)]',
  AIRSIDE: 'bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)]',
  GENERAL: 'bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)]',
  GSE: 'bg-[var(--signal-amber-soft,#fbecd2)] text-[var(--signal-amber-strong,#a86e10)]',
  JOUMPA: 'bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)]',
  'LANDSIDE & AIRSIDE': 'bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)]',
};

// ponytail: delegates to the same classifier the All Reports source toggle
// uses (lib/report-normalization.ts) so a card's badge always agrees with
// which toggle pill surfaces it.
function resolveAreaTag(report: Report): AreaTag {
  switch (resolveAreaType(report)) {
    case 'Terminal Area': return 'LANDSIDE';
    case 'Apron Area': return 'AIRSIDE';
    case 'General': return 'GENERAL';
    case 'GSE Availability': return 'GSE';
    case 'Cargo (CGO)': return 'CGO';
    case 'Joumpa': return 'JOUMPA';
    default: return 'LANDSIDE & AIRSIDE';
  }
}

type SortField = 'created_at' | 'status' | 'severity' | 'report' | 'location' | 'station';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS: ReportStatus[] = ['OPEN', 'CLOSED'];
const REMARKS_BY_DIVISIONS = ['OP', 'UQ', 'OT', 'OS', 'OCS', 'HT', 'HC'] as const;

type StatusUpdateDetails = {
  finalRemarks: string;
  remarksBy: string;
};

function resolveSeverity(report: Report): string {
  const raw = (report as Record<string, unknown>)['severity_level']
    || (report as Record<string, unknown>)['Severity Level']
    || (report as Record<string, unknown>)['Severity_Level']
    || report.severity;
  return normalizeSeverityLevel(raw);
}

const severityOrder: Record<string, number> = {
  'TOP RISK': 0,
  'HIGH RISK': 1,
  'MEDIUM': 2,
  'LOW': 3,
};

const statusOrder: Record<string, number> = {
  'OPEN': 0,
  'ON PROGRESS': 1,
  'CLOSED': 2,
};

function cleanDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || text === '#N/A' || text === '-' || text.toLowerCase() === 'null') return '';
  return text;
}

function resolveCaseClassification(report: Report): string {
  return cleanDisplayValue((report as Record<string, unknown>).case_classification)
    || cleanDisplayValue((report as Record<string, unknown>)['Case Classification'])
    || cleanDisplayValue(report.category)
    || cleanDisplayValue(report.main_category)
    || 'Unclassified';
}

function resolveSeverityLevel(report: Report): string {
  return cleanDisplayValue((report as Record<string, unknown>).severity_level)
    || cleanDisplayValue((report as Record<string, unknown>)['Severity Level'])
    || cleanDisplayValue((report as Record<string, unknown>)['Severity_Level'])
    || resolveSeverity(report)
    || 'LOW';
}

function getStatusTone(status: ReportStatus) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
  if (status === 'OPEN') {
    return { bg: 'oklch(0.62 0.22 25 / 0.12)', text: 'oklch(0.55 0.22 25)', accent: 'oklch(0.55 0.22 25)' };
  }
  if (status === 'CLOSED') {
    return { bg: 'oklch(0.58 0.18 145 / 0.12)', text: 'oklch(0.45 0.16 145)', accent: 'oklch(0.45 0.16 145)' };
  }
  return { bg: cfg.bgColor, text: cfg.color, accent: cfg.color };
}

const ClassificationSeverityCell = memo(function ClassificationSeverityCell({ report }: { report: Report }) {
  const classification = resolveCaseClassification(report);
  const level = resolveSeverityLevel(report);
  const config = getSeverityConfig(level);
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70 xl:bg-transparent xl:px-0 xl:py-0 xl:ring-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="whitespace-normal break-words text-[10px] font-black uppercase leading-snug tracking-wide text-slate-800" title={classification}>
          {classification}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap"
          style={{ backgroundColor: config.bg, color: config.color }}
        >
          {level}
        </span>
      </div>
    </div>
  );
});

interface StatusEditorModalProps {
  report: Report;
  onSubmit: (reportId: string, status: ReportStatus, finalRemarks: string, details: StatusUpdateDetails) => Promise<void>;
  onClose: () => void;
}

// ponytail: keystroke state lives in its own component so typing here never
// forces the (potentially 100+ row) report list in ReportsDetailTable to
// re-render on every character.
function StatusEditorModal({ report, onSubmit, onClose }: StatusEditorModalProps) {
  const [status, setStatus] = useState<ReportStatus>(report.status === 'CLOSED' ? 'CLOSED' : 'OPEN');
  const [finalRemarks, setFinalRemarks] = useState(cleanDisplayValue(report.kps_remarks));
  const [division, setDivision] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (event: MouseEvent) => {
    event.stopPropagation();
    const trimmedRemarks = finalRemarks.trim();
    const trimmedName = name.trim();

    if (!status || !trimmedRemarks || !division || !trimmedName) {
      setError('Status, final remarks, division, and name are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(report.id, status, trimmedRemarks, {
        finalRemarks: trimmedRemarks,
        remarksBy: `${division} - ${trimmedName}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report status.');
    } finally {
      setSubmitting(false);
    }
  }, [division, finalRemarks, name, onSubmit, report.id, status]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change report status"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_32px_90px_-28px_rgba(15,23,42,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Report status</p>
            <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">Change Status</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Close status dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status <span className="text-red-500">*</span></span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReportStatus)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-black text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              required
              aria-required="true"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{STATUS_CONFIG[option]?.label || option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Final Remarks <span className="text-red-500">*</span></span>
            <textarea
              value={finalRemarks}
              onChange={(event) => setFinalRemarks(event.target.value)}
              rows={4}
              className="min-h-[8rem] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Write final remarks"
              required
              aria-required="true"
              autoFocus
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Division <span className="text-red-500">*</span></span>
            <select
              value={division}
              onChange={(event) => setDivision(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-black text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              required
              aria-required="true"
            >
              <option value="">Select</option>
              {REMARKS_BY_DIVISIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Name <span className="text-red-500">*</span></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Filled by"
              required
              aria-required="true"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{error}</p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Status
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ReportsDetailTableProps {
  reports: Report[];
  onReportClick: (report: Report) => void;
  onStatusUpdate?: (
    reportId: string,
    status: string,
    notes?: string,
    evidenceUrl?: string,
    details?: StatusUpdateDetails
  ) => Promise<void>;
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  toolbarFilter?: ReactNode;
  fullHeight?: boolean;
}

export const ReportsDetailTable = memo(function ReportsDetailTable({
  reports,
  onReportClick,
  onStatusUpdate,
  loading,
  emptyTitle = 'No reports found',
  emptySubtitle = 'Try adjusting your filters to see other results.',
  toolbarFilter,
  fullHeight = false,
}: ReportsDetailTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [updatingStatusReportId, setUpdatingStatusReportId] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<ReportStatus | null>(null);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortedReports = useMemo(() => {
    const copy = [...reports];
    const dir = sortDir === 'asc' ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortField) {
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'status':
          return dir * ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
        case 'severity': {
          const sa = severityOrder[resolveSeverity(a)] ?? 9;
          const sb = severityOrder[resolveSeverity(b)] ?? 9;
          return dir * (sa - sb);
        }
        case 'report':
          return dir * ((a.report || a.title || '').localeCompare(b.report || b.title || ''));
        case 'location':
          return dir * ((a.location || '').localeCompare(b.location || ''));
        case 'station':
          return dir * ((a.stations?.code || a.branch || '').localeCompare(b.stations?.code || b.branch || ''));
        default:
          return 0;
      }
    });
    return copy;
  }, [reports, sortField, sortDir]);

  const pageItems = sortedReports;

  const sortOptions: Array<{ field: SortField; label: string }> = [
    { field: 'created_at', label: 'Date' },
    { field: 'severity', label: 'Severity' },
    { field: 'status', label: 'Status' },
    { field: 'station', label: 'Station' },
    { field: 'report', label: 'Report' },
  ];

  const handleDownloadCaseReport = useCallback(async (event: MouseEvent, report: Report) => {
    event.stopPropagation();
    setDownloadingReportId(report.id);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}`);
      const fullReport = response.ok ? await response.json() as Report : report;
      await exportSingleReportToDocx(fullReport);
    } finally {
      setDownloadingReportId(null);
    }
  }, []);

  const handleOpenStatusEditor = useCallback((event: MouseEvent, report: Report) => {
    event.stopPropagation();
    setEditingReport(report);
  }, []);

  const handleSubmitStatusUpdate = useCallback(async (
    reportId: string,
    status: ReportStatus,
    finalRemarks: string,
    details: StatusUpdateDetails,
  ) => {
    if (!onStatusUpdate) return;
    setUpdatingStatusReportId(reportId);
    try {
      await onStatusUpdate(reportId, status, finalRemarks, undefined, details);
      setEditingReport(null);
      setStatusUpdateSuccess(status);
    } finally {
      setUpdatingStatusReportId(null);
    }
  }, [onStatusUpdate]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)] overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-[var(--brand-emerald-500,#10b981)]" />
          <p className="text-sm font-medium text-[var(--text-muted)]">Loading reports...</p>
        </div>
        <div className="border-t border-[var(--surface-3)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-[var(--surface-3)] last:border-b-0">
              <div className="w-6 h-3 rounded bg-[var(--surface-2)] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-[var(--surface-2)] animate-pulse" />
                <div className="h-2 w-1/2 rounded bg-[var(--surface-2)] animate-pulse" />
              </div>
              <div className="w-16 h-5 rounded-full bg-[var(--surface-2)] animate-pulse" />
              <div className="w-20 h-5 rounded-full bg-[var(--surface-2)] animate-pulse" />
              <div className="w-14 h-3 rounded bg-[var(--surface-2)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)]">
        {toolbarFilter && (
          <div className="border-b border-[var(--surface-4)] bg-[var(--surface-0)] px-4 py-3">
            {toolbarFilter}
          </div>
        )}
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="p-5 rounded-full bg-[var(--surface-2)]">
            <FileText size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <p className="text-base font-display font-bold text-[var(--text-secondary)]">{emptyTitle}</p>
          <p className="text-sm text-[var(--text-muted)]">{emptySubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--surface-4)] bg-[var(--surface-1)]',
        fullHeight && 'flex min-h-[calc(100dvh-150px)] flex-col overflow-hidden'
      )}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--surface-4)] bg-[var(--surface-0)] px-4 py-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 shrink-0 items-center gap-2 pt-1">
          <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Sort by
          </span>
          <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto hide-scrollbar sm:flex-wrap sm:overflow-visible">
            {sortOptions.map((option) => {
              const active = sortField === option.field;
              return (
                <button
                  key={option.field}
                  type="button"
                  onClick={() => handleSort(option.field)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide transition',
                    active
                      ? 'border-[var(--brand-emerald-200,#a7f3d0)] bg-[var(--brand-emerald-50,#ecfdf5)] text-[var(--brand-emerald-700,#047857)]'
                      : 'border-[var(--surface-3)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  {option.label}
                  {active && (sortDir === 'asc'
                    ? <ArrowUp size={10} strokeWidth={2.5} />
                    : <ArrowDown size={10} strokeWidth={2.5} />)}
                </button>
              );
            })}
          </div>
        </div>
        {toolbarFilter && (
          <div className="min-w-0 flex-1 xl:max-w-[1120px]">
            {toolbarFilter}
          </div>
        )}
      </div>

      <div
        className={cn(
          'space-y-2 overflow-y-auto p-3',
          fullHeight ? 'min-h-0 flex-1' : 'max-h-[calc(100vh-320px)] min-h-[300px]'
        )}
      >
        {pageItems.map((report, idx) => {
          const station = cleanDisplayValue(report.stations?.code)
            || cleanDisplayValue(report.branch)
            || cleanDisplayValue(report.reporting_branch)
            || '-';
          const reporter = cleanDisplayValue(report.users?.full_name) || cleanDisplayValue(report.reporter_name) || '-';
          const title = report.report || report.title || '(Tanpa Judul)';
          const createdStamp = splitReportTimestamp(report.created_at);
          const sourceTag = resolveAreaTag(report);
          const flightNumber = cleanDisplayValue(report.flight_number);
          const route = cleanDisplayValue(report.route);
          const statusTone = getStatusTone(report.status as ReportStatus);
          const isUpdatingStatus = updatingStatusReportId === report.id;

          return (
            <div
              key={report.id}
              role="button"
              tabIndex={0}
              onClick={() => onReportClick(report)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onReportClick(report);
                }
              }}
              className="group flex w-full flex-col gap-3 rounded-xl border border-[var(--surface-3)] bg-white px-3.5 py-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:grid sm:grid-cols-[52px_minmax(0,1fr)]"
              style={{ borderLeft: `4px solid ${statusTone.accent}` }}
            >
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f8f2df] font-display text-[15px] font-extrabold tabular-nums text-slate-900 ring-1 ring-black/[0.03] sm:flex sm:h-12 sm:w-12 sm:text-[17px]">
                {idx + 1}
              </div>

              <div className="min-w-0 flex flex-col gap-2">
                {}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-md bg-[#f8f2df] px-1.5 font-display text-[12px] font-extrabold tabular-nums text-slate-900 ring-1 ring-black/[0.03] sm:hidden">
                      {idx + 1}
                    </span>
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide',
                      AREA_TAG_CLASS[sourceTag]
                    )}>
                      {sourceTag}
                    </span>
                  </div>
                  {report.status && (
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide',
                      report.status === 'CLOSED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : report.status === 'ON PROGRESS'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-600'
                    )}>
                      {report.status}
                    </span>
                  )}
                </div>

                {}
                {(station !== '-' || flightNumber || route) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {station && station !== '-' && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--chip-ink-border,#e2e5eb)] bg-[var(--chip-ink-bg,#f5f6f8)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-[var(--chip-ink-text,#475569)]">
                        <Building2 size={9} strokeWidth={2.5} className="text-slate-400" />
                        {station}
                      </span>
                    )}
                    {flightNumber && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--chip-ink-border,#e2e5eb)] bg-[var(--chip-ink-bg,#f5f6f8)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-[var(--chip-ink-text,#475569)]">
                        <Plane size={9} strokeWidth={2.5} className="text-slate-400" />
                        {flightNumber}
                      </span>
                    )}
                    {route && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--chip-ink-border,#e2e5eb)] bg-[var(--chip-ink-bg,#f5f6f8)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-[var(--chip-ink-text,#475569)]">
                        <GitBranch size={9} strokeWidth={2.5} className="text-slate-400" />
                        {route}
                      </span>
                    )}
                  </div>
                )}

                {}
                <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-800" title={title}>
                  {title}
                </p>

                {}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <UserRound size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate max-w-[160px]" title={reporter}>{reporter}</span>
                  </span>
                  <span className="hidden text-slate-200 xl:inline">|</span>
                  <ClassificationSeverityCell report={report} />
                  <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-slate-400 tabular-nums">
                    <CalendarDays size={11} className="shrink-0" />
                    {createdStamp.date}
                    {createdStamp.time && (
                      <span className="hidden sm:inline">{createdStamp.time}</span>
                    )}
                  </span>
                </div>

                {}
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  {onStatusUpdate && (
                    <button
                      type="button"
                      onClick={(event) => handleOpenStatusEditor(event, report)}
                      disabled={isUpdatingStatus}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:min-h-0 sm:w-auto"
                    >
                      <PencilLine size={13} />
                      Change Status
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => handleDownloadCaseReport(event, report)}
                    disabled={downloadingReportId === report.id}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 sm:min-h-0 sm:w-auto"
                  >
                    {downloadingReportId === report.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Download This Case Report
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingReport && (
        <StatusEditorModal
          report={editingReport}
          onSubmit={handleSubmitStatusUpdate}
          onClose={() => setEditingReport(null)}
        />
      )}

      <StatusUpdateSuccessDialog
        open={statusUpdateSuccess !== null}
        status={statusUpdateSuccess ?? ''}
        onClose={() => setStatusUpdateSuccess(null)}
      />

    </div>
  );
});
