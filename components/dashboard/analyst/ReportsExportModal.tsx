"use client";

import { useMemo, useState, useEffect, type ElementType } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  MapPin,
  Plane,
  Search,
  ShieldCheck,
  Tag,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Report } from "@/types";
import { normalizeReportPage, withReportCursor } from "@/lib/report-page";
import {
  DEFAULT_REPORT_EXPORT_FILTERS,
  buildReportFilterOptions,
  exportReportsToDocx,
  exportReportsToExcel,
  exportReportsToPdf,
  filterReportsForExport,
  reportFilterSummary,
  type ReportExportFilters,
} from "@/lib/reports-export";

interface ReportsExportModalProps {
  open: boolean;
  reports: Report[];
  onClose: () => void;
}

type ExportFormat = "excel" | "pdf" | "docx";

// Stable reference so a failed prefetch doesn't create a new [] every render
// and cascade into re-running the memoized values derived from it.
const EMPTY_REPORTS: Report[] = [];

async function fetchAllDetailedReports(): Promise<Report[]> {
  const reports: Report[] = [];
  let cursor: string | null = null;

  // Export is the only path allowed to walk the complete collection. Each
  // request remains bounded so normal dashboard reads never inherit this cost.
  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const response = await fetch(withReportCursor('/api/admin/reports?detail=1', cursor, 100));
    if (!response.ok) throw new Error("Unable to load full report details for export.");
    const page = normalizeReportPage<Report>(await response.json());
    reports.push(...page.reports);
    if (!page.pagination.hasMore || !page.pagination.nextCursor) return reports;
    cursor = page.pagination.nextCursor;
  }

  throw new Error('Export exceeded the safe pagination limit. Narrow the export filters and try again.');
}

function SelectField({
  label,
  value,
  options,
  icon: Icon,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  icon: ElementType;
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="relative">
        <Icon className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-teal-700" />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">{emptyLabel}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function ReportsExportModal({ open, reports, onClose }: ReportsExportModalProps) {
  const [filters, setFilters] = useState<ReportExportFilters>(DEFAULT_REPORT_EXPORT_FILTERS);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [joumpaReports, setJoumpaReports] = useState<Report[]>([]);
  const [joumpaLoading, setJoumpaLoading] = useState(false);
  const [irregularityReports, setIrregularityReports] = useState<Report[] | null>(null);
  const [irregularityLoading, setIrregularityLoading] = useState(false);
  const [irregularityPrefetchFailed, setIrregularityPrefetchFailed] = useState(false);

  const isJoumpa = filters.source === "JOUMPA";

  useEffect(() => {
    if (!isJoumpa || !open) return;
    setJoumpaLoading(true);
    fetch("/api/joumpa")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load JOUMPA reports (status ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setJoumpaReports((data.reports as Report[]) || []);
        setExportError(null);
      })
      .catch((err) => {
        console.error('Failed to load JOUMPA reports for export:', err);
        setJoumpaReports([]);
        setExportError('Failed to load JOUMPA reports. Please try again.');
      })
      .finally(() => setJoumpaLoading(false));
  }, [isJoumpa, open]);

  // The dashboard's `reports` prop reflects whatever the screen is currently
  // showing (empty outside the dashboard view). Export must see the complete
  // set regardless, so fetch it independently once the modal opens.
  // `reports` is deliberately excluded from deps: the parent re-creates that
  // array on every render, and including it here caused this effect to refire
  // (and refetch) on every parent re-render instead of once per modal open.
  useEffect(() => {
    if (!open || irregularityReports || irregularityPrefetchFailed) return;
    setIrregularityLoading(true);
    fetchAllDetailedReports()
      .then((data) => {
        setIrregularityReports(data);
        setIrregularityPrefetchFailed(false);
      })
      .catch((err) => {
        console.error('Failed to prefetch detailed reports for export:', err);
        setExportError('Failed to load complete report data for export.');
        setIrregularityPrefetchFailed(true);
      })
      .finally(() => setIrregularityLoading(false));
  }, [open, irregularityReports, irregularityPrefetchFailed]);

  // Never fall back to the (possibly partial) `reports` prop after a failed
  // prefetch — an incomplete silent export is worse than a blocked one.
  const irregularityActiveReports = irregularityReports ?? (irregularityPrefetchFailed ? EMPTY_REPORTS : reports);
  const activeReports = isJoumpa ? joumpaReports : irregularityActiveReports;
  const activeLoading = isJoumpa ? joumpaLoading : (irregularityLoading && !irregularityReports);

  const options = useMemo(() => {
    const base = buildReportFilterOptions(activeReports);
    if (!base.sources.includes("JOUMPA")) base.sources.push("JOUMPA");
    return base;
  }, [activeReports]);

  // When not JOUMPA, always include JOUMPA in source options from the irregularity reports
  const sourceOptions = useMemo(() => {
    if (isJoumpa) return options.sources;
    const base = buildReportFilterOptions(irregularityActiveReports);
    if (!base.sources.includes("JOUMPA")) base.sources.push("JOUMPA");
    return base.sources;
  }, [isJoumpa, options.sources, irregularityActiveReports]);

  const filteredReports = useMemo(() => filterReportsForExport(activeReports, filters), [activeReports, filters]);
  const summary = useMemo(() => reportFilterSummary(filters), [filters]);

  if (!open || typeof document === "undefined") return null;

  const updateFilter = (key: keyof ReportExportFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "source") {
        // Reset mode-specific filters when switching source
        next.area = "";
        next.caseClassification = "";
        next.customerType = "";
        next.joumpaCategory = "";
      }
      return next;
    });
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setExportError(null);
    try {
      let reportsToExport = filteredReports;
      if (!isJoumpa) {
        const fullReports = irregularityReports ?? await fetchAllDetailedReports();
        reportsToExport = filterReportsForExport(fullReports, filters);
      }

      if (format === "excel") await exportReportsToExcel(reportsToExport, filters);
      if (format === "pdf") await exportReportsToPdf(reportsToExport, filters);
      if (format === "docx") await exportReportsToDocx(reportsToExport, filters);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[min(1120px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-200 px-6 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600">Export All Reports</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-teal-800">Select export scope</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Export filters are independent of screen filters. Best for Excel / PDF / DOCX archives.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            aria-label="Close export modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcf8] px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {/* Date range */}
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Start Date</span>
              <span className="relative">
                <CalendarDays className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-teal-700" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => updateFilter("startDate", event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
              </span>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">End Date</span>
              <span className="relative">
                <CalendarDays className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-teal-700" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => updateFilter("endDate", event.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
              </span>
            </label>

            {/* Common */}
            <SelectField label="Station" value={filters.branch} options={options.branches} icon={Building2} emptyLabel="All stations" onChange={(v) => updateFilter("branch", v)} />
            <SelectField label="Airlines" value={filters.airline} options={options.airlines} icon={Plane} emptyLabel="All airlines" onChange={(v) => updateFilter("airline", v)} />

            {/* Source — always visible, drives JOUMPA mode */}
            <SelectField label="Source" value={filters.source} options={sourceOptions} icon={Database} emptyLabel="All sources" onChange={(v) => updateFilter("source", v)} />

            {/* Irregularity-report-specific filters */}
            {!isJoumpa && (
              <>
                <SelectField label="Area" value={filters.area} options={options.areas} icon={MapPin} emptyLabel="All areas" onChange={(v) => updateFilter("area", v)} />
                <SelectField label="Case Classification" value={filters.caseClassification} options={options.caseClassifications} icon={Tag} emptyLabel="All classifications" onChange={(v) => updateFilter("caseClassification", v)} />
              </>
            )}

            {/* JOUMPA-specific filters */}
            {isJoumpa && (
              <>
                <SelectField label="Category" value={filters.caseClassification} options={options.caseClassifications} icon={Tag} emptyLabel="All categories" onChange={(v) => updateFilter("caseClassification", v)} />
                <SelectField label="Sub-Category" value={filters.joumpaCategory} options={options.joumpaCategories} icon={Layers} emptyLabel="All sub-categories" onChange={(v) => updateFilter("joumpaCategory", v)} />
                <SelectField label="Customer Type" value={filters.customerType} options={options.customerTypes} icon={Users} emptyLabel="All customer types" onChange={(v) => updateFilter("customerType", v)} />
              </>
            )}

            {/* Common tail */}
            <SelectField label="Status" value={filters.status} options={options.statuses} icon={CheckCircle2} emptyLabel="All statuses" onChange={(v) => updateFilter("status", v)} />
            <SelectField label="Severity" value={filters.severity} options={options.severities} icon={ShieldCheck} emptyLabel="All severities" onChange={(v) => updateFilter("severity", v)} />
          </div>

          <label className="mt-6 flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Search in Export</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-teal-700" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="ID, reference number, report, flight, station, airlines…"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </span>
          </label>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
            <div>
              {activeLoading ? (
                <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-800">
                  {isJoumpa ? "Loading JOUMPA data…" : "Loading reports…"}
                </p>
              ) : (
                <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-800">
                  {filteredReports.length.toLocaleString("en-US")} / {activeReports.length.toLocaleString("en-US")} reports ready to export
                </p>
              )}
              <p className="mt-2 text-sm font-semibold text-slate-600">{summary}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilters(DEFAULT_REPORT_EXPORT_FILTERS)}
              className="h-12 rounded-2xl px-5 text-xs font-black uppercase tracking-[0.18em]"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:flex-row sm:justify-end">
          {exportError && (
            <p role="alert" className="mr-auto flex items-center gap-3 self-center text-sm font-semibold text-red-600">
              {exportError}
              {!isJoumpa && irregularityPrefetchFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setExportError(null);
                    setIrregularityPrefetchFailed(false);
                  }}
                  className="underline underline-offset-2 hover:text-red-700"
                >
                  Retry
                </button>
              )}
            </p>
          )}
          {[
            { format: "excel" as const, label: "Export Excel", icon: FileSpreadsheet, className: "bg-emerald-700 hover:bg-emerald-800" },
            { format: "pdf" as const, label: "Export PDF", icon: FileText, className: "bg-teal-700 hover:bg-teal-800" },
            { format: "docx" as const, label: "Export DOCX", icon: FileText, className: "bg-amber-600 hover:bg-amber-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.format}
                type="button"
                disabled={exporting !== null || filteredReports.length === 0 || activeLoading || (!isJoumpa && irregularityPrefetchFailed)}
                onClick={() => handleExport(item.format)}
                className={cn("h-14 rounded-2xl px-6 text-xs font-black uppercase tracking-[0.18em] text-white", item.className)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {exporting === item.format ? "Exporting…" : item.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
