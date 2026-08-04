"use client";

import { useState, useEffect, useRef } from "react";
import Image from 'next/image';
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit3,
  FileText,
  FileType,
  Image as ImageIcon,
  Link,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  User,
  X,
} from "lucide-react";

import {
  STATUS_CONFIG,
  getAllowedTransitions,
  normalizeStatus,
} from "@/lib/constants/report-status";
import { cn, formatDate } from "@/lib/utils";
import { type Report, type UserRole } from "@/types";
import { CommentInput } from "@/components/dashboard/reports/CommentInput";
import { generatePDF } from "@/lib/utils/document-generator";
import { DocxEditorModal } from "@/components/dashboard/DocxEditorModal";
import { BriefingEditorModal } from "@/components/dashboard/BriefingEditorModal";
import { EvidenceViewModal } from "@/components/dashboard/EvidenceViewModal";
import { AIInsightCard } from "@/components/dashboard/ai-insight";
import { canExportBranchData, canEditReport } from "@/lib/permissions";

const SEVERITY_BADGES: Record<string, { label: string; classes: string }> = {
  'TOP RISK': { label: "TOP RISK", classes: "bg-rose-50 text-rose-600 border border-rose-100" },
  'HIGH RISK': { label: "HIGH RISK", classes: "bg-orange-50 text-orange-600 border border-orange-100" },
  'MEDIUM': { label: "MEDIUM", classes: "bg-amber-50 text-amber-600 border border-amber-100" },
  'LOW': { label: "LOW", classes: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
};

const DEFAULT_SEVERITY_BADGE = SEVERITY_BADGES.MEDIUM;

const AREA_LABELS: Record<string, string> = {
  TERMINAL: "Terminal Area",
  APRON: "Apron Area",
  GENERAL: "General",
};

type ReportComment = NonNullable<Report["comments"]>[number] & {
  users?: { full_name: string; avatar_url?: string; role?: string };
};
type LampiranActionType = "CORRECTIVE" | "PREVENTIVE";
export interface StatusUpdateDetails {
  finalRemarks?: string;
  remarksBy?: string;
}

const REMARKS_BY_DIVISIONS = ["OP", "UQ", "OT", "OS", "OCS", "HT", "HC"] as const;

function DataField({
  label,
  value,
  span = 1
}: {
  label: string; 
  value: React.ReactNode; 
  icon?: React.ElementType;
  span?: 1 | 2;
}) {
  const isEmpty = !value || value === "" || value === "-" || value === "—";
  return (
    <div className={cn("flex flex-col gap-1", span === 2 && "col-span-1 md:col-span-2")}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </dt>
      <dd className={cn(
        "text-[14px] leading-relaxed break-words",
        isEmpty ? "text-slate-400 italic font-medium" : "text-slate-900 font-semibold"
      )}>
        {isEmpty ? "Not Recorded" : value}
      </dd>
    </div>
  );
}

function SectionCard({ 
  title, 
  children, 
  className,
  headerAction
}: { 
  title?: string; 
  children: React.ReactNode; 
  className?: string;
  headerAction?: React.ReactNode;
}) {
  return (
    <section className={cn(
      "bg-white border border-slate-100 overflow-hidden",
      className
    )}>
      {title && (
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-700">{title}</h3>
          {headerAction}
        </header>
      )}
      <div className="p-4 md:p-6">{children}</div>
    </section>
  );
}

function isSafeLocalImage(url: string) {
  return url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:");
}

interface ReportDetailViewProps {
  report: Report | null;
  onUpdateStatus?: (reportId: string, status: string, notes?: string, evidenceUrl?: string, details?: StatusUpdateDetails) => Promise<void>;
  onRefresh?: (updatedReport?: Report) => void;
  onClose?: () => void;
  userRole?: string;
  divisionColor?: string;
  isModal?: boolean;
  currentUserId?: string;
  currentUserStationId?: string;
}

export function ReportDetailView({
  report,
  onUpdateStatus,
  onRefresh,
  userRole = "PARTNER_ADMIN",
  divisionColor = "#10b981",
  currentUserId,
  currentUserStationId,
}: ReportDetailViewProps) {
  const pathname = usePathname();
  
  const [isDocxModalOpen, setIsDocxModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [showBriefingEditor, setShowBriefingEditor] = useState(false);
  const [lampiranActionType, setLampiranActionType] = useState<LampiranActionType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeRemarksByDivision, setCloseRemarksByDivision] = useState("");
  const [closeRemarksByName, setCloseRemarksByName] = useState("");
  const [reopenNotes, setReopenNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    title: "", description: "", flight_number: "", aircraft_reg: "", location: "",
    route: "", airline: "", area: "", branch: "",
    date_of_event: "", root_caused: "", action_taken: "", preventive_action: "",
    sub_category_note: ""
  });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCommentRef = useRef<HTMLDivElement>(null);

  const [, setMounted] = useState(false);

  const resolveEscalationDivisionLabel = () => {
    if (pathname.startsWith('/dashboard/eskalasi/op') || pathname.startsWith('/dashboard/op')) return 'Division OP';
    if (pathname.startsWith('/dashboard/eskalasi/os') || pathname.startsWith('/dashboard/ocs') || pathname.startsWith('/dashboard/os')) return 'Unit Service';
    if (pathname.startsWith('/dashboard/eskalasi/ht') || pathname.startsWith('/dashboard/ht')) return 'Division HT';
    return 'Division Escalation';
  };

  const getCommentAuthorName = (comment: ReportComment) => {
    if (userRole === 'DIVISI_ESKALASI' && comment?.users?.role === 'DIVISI_ESKALASI') {
      return resolveEscalationDivisionLabel();
    }
    return comment?.users?.full_name || 'Unknown';
  };

  const getCommentAuthorInitial = (comment: ReportComment) => getCommentAuthorName(comment).charAt(0) || '?';

  useEffect(() => {
    if (report?.comments?.length) {
      lastCommentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [report?.comments?.length]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Opening a report clears this user's unread comment notifications for it.
  useEffect(() => {
    if (!report?.id) return;
    fetch('/api/notifications/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: report.id }),
    }).catch(() => {});
  }, [report?.id]);

  
  useEffect(() => {
    if (report && !isEditing) {
      setEditForm({
        title: report.title || "",
        description: report.description || "",
        flight_number: report.flight_number || "",
        aircraft_reg: report.aircraft_reg || "",
        location: report.location || report.specific_location || "",
        route: report.route || "",
        airline: report.airline || report.airlines || "",
        area: report.area || "",
        branch: report.branch || report.stations?.code || "",
        date_of_event: report.date_of_event || report.event_date || report.created_at || "",
        root_caused: report.root_caused || report.root_cause || "",
        action_taken: report.action_taken || report.gapura_kps_action_taken || "",
        preventive_action: report.preventive_action || report.immediate_action || "",
        sub_category_note: report.sub_category_note || report.kps_remarks || report.remarks_gapura_kps || ""
      });
    }
  }, [report, isEditing]);

  useEffect(() => {}, []);

  
  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (status: string, notes?: string, evidenceUrl?: string, details?: StatusUpdateDetails) => {
    if (!onUpdateStatus || !report) return;
    setActionLoading(true);
    try {
      await onUpdateStatus(report.id, status, notes, evidenceUrl, details);
      onRefresh?.();
      setShowCloseModal(false);
      setShowReopenModal(false);
      setShowVerifyModal(false);
      setCloseNotes("");
      setCloseRemarksByDivision("");
      setCloseRemarksByName("");
      setVerifyNotes("");
      setReopenNotes("");
    } finally { setActionLoading(false); }
  };

  const compressImage = (file: File, opts: { maxWidth?: number; maxHeight?: number; quality?: number; mimeType?: string } = {}) => {
    const { maxWidth = 1600, maxHeight = 1600, quality = 0.8, mimeType = 'image/webp' } = opts;
    return new Promise<File>((resolve, reject) => {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('Canvas not supported')); }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Compression failed'));
          const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: blob.type });
          resolve(compressed);
        }, mimeType, quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load error')); };
      img.src = url;
    });
  };

  const handleUploadEvidence = async () => {
    if (!report || evidenceFiles.length === 0) return;
    setActionLoading(true);
    try {
      const currentEvidence = report.evidence_urls || (report.evidence_url ? [report.evidence_url] : []);
      const uploaded: string[] = [];
      for (const file of evidenceFiles) {
        const compressed = await compressImage(file);
        const typeTag = lampiranActionType; // e.g. CORRECTIVE or PREVENTIVE
        const uploader = userRole || 'Unknown';
        const cleanUploader = uploader.replace(/[^a-zA-Z0-9]/g, '-');
        const newFilename = `${typeTag}__${cleanUploader}__${new Date().getTime()}__${compressed.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const renamedFile = new File([compressed], newFilename, { type: compressed.type });
        const fd = new FormData();
        fd.append('file', renamedFile);
        const res = await fetch(`/api/reports/${report.id}/evidence`, { method: 'POST', body: fd });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || 'Upload failed');
        }
        const data = await res.json();
        const url = data.url as string;
        uploaded.push(url);
      }
      const newEvidence = [...currentEvidence, ...uploaded];
      const resPatch = await fetch(`/api/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidence_urls: newEvidence }) });
      if (!resPatch.ok) throw new Error("Failed to update evidence in report");
      const patchData = await resPatch.json();
      setEvidenceFiles([]);
      onRefresh?.(patchData.data || patchData);
    } catch (error) {
      console.error(error);
      alert('Failed to upload evidence');
    } finally { setActionLoading(false); }
  };

  const handleSaveChanges = async () => {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      if (!res.ok) throw new Error("Failed to update");
      const patchData = await res.json();
      setIsEditing(false);
      onRefresh?.(patchData.data || patchData);
    } catch (error) {
      console.error(error);
      alert("Failed to save changes");
    } finally { setActionLoading(false); }
  };

  // Empty State
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-3 p-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <FileText size={28} strokeWidth={1.5} />
        </div>
        <p className="text-sm">Select a report to view details</p>
      </div>
    );
  }

  // Derived values
  const severityKey = String(report.severity || report.priority || "MEDIUM").trim().toUpperCase();
  const severityBadge = SEVERITY_BADGES[severityKey] || DEFAULT_SEVERITY_BADGE;
  const normalizedStatus = normalizeStatus(report.status);
  const statusConfig = STATUS_CONFIG[normalizedStatus];
  
  // Aggregate all possible evidence sources
  const extractUrls = (val: unknown): string[] => {
    if (!val || typeof val !== 'string') return [];
    const m = val.match(/https?:\/\/[^\s"',<>]+/g);
    return m ? m.map(s => s.trim()) : [];
  };
  const normalizeUrlList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => normalizeUrlList(item));
    }

    if (typeof value === 'string') {
      const extracted = extractUrls(value);
      if (extracted.length > 0) return extracted;

      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    return [];
  };
  const textFieldUrls = [
    ...(extractUrls(report.description)),
    ...(extractUrls(report.action_taken)),
    ...(extractUrls(report.preventive_action)),
    ...(extractUrls(report.immediate_action)),
    ...(extractUrls(report.sub_category_note)),
    ...(extractUrls(report.root_caused)),
    ...(extractUrls(report.kps_remarks)),
    ...(extractUrls(report.remarks_gapura_kps)),
    ...(extractUrls(report.partner_response_notes)),
  ];
  const commentUrls = (report.comments || []).flatMap(c => [
    ...normalizeUrlList(c.attachments),
    ...extractUrls(c.content || '')
  ]);
  const reportEvidenceUrls = Array.from(new Set([
    ...normalizeUrlList(report.evidence_urls),
    ...normalizeUrlList(report.evidence_url),
  ])).filter(Boolean);
  const allEvidence = Array.from(new Set([
    ...reportEvidenceUrls,
    ...normalizeUrlList(report.video_urls),
    ...normalizeUrlList(report.video_url),
    ...normalizeUrlList(report.partner_evidence_urls),
    ...textFieldUrls,
    ...commentUrls
  ])).filter(Boolean);
  const reportExtra = report as Report & Record<string, unknown>;
  const nextActions = getAllowedTransitions(report.status, userRole);
  const primaryAction = nextActions.includes("CLOSED") ? "CLOSED" : (nextActions[0] || null);
  const canEdit = canEditReport(
    userRole as UserRole,
    currentUserId || '',
    report.user_id,
    currentUserStationId,
    report.station_id
  );
  const isClosed = normalizedStatus === "CLOSED";

  let actionLabel = "Update Status";
  let actionButtonLabel = "Execute Action";
  if (primaryAction === "ON PROGRESS") {
    actionLabel = "Update Progress";
    actionButtonLabel = "Update Progress";
  }
  else if (primaryAction === "CLOSED") {
    actionLabel = "Close Case";
    actionButtonLabel = "Close Report";
  }
  else if (primaryAction === "OPEN") {
    actionLabel = "Reopen Case";
    actionButtonLabel = "Reopen Report";
  }

  const closeRemarksBy = closeRemarksByDivision && closeRemarksByName.trim()
    ? `${closeRemarksByDivision} - ${closeRemarksByName.trim()}`
    : "";
  const canSubmitClose = Boolean(closeNotes.trim() && closeRemarksBy);

  return (
    <div className="min-h-full flex flex-col bg-slate-50/50 md:p-6 lg:p-8 gap-4 md:gap-8 overflow-hidden font-sans antialiased rounded-t-[2.5rem] md:rounded-none">
      {/* =============================================
          EDITORIAL HEADER
          ============================================= */}
      <header className="shrink-0 bg-white border-b md:border border-slate-200/60 shadow-sm md:shadow-sm overflow-hidden relative rounded-t-[2.5rem] md:rounded-none">
        <div className="px-8 md:px-10 pt-16 pb-10 md:py-10">
          <div className="flex flex-col gap-6">
            {/* Top Row: Meta Info */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                    {report?.id?.slice(0, 8).toUpperCase() ?? 'N/A'}
                  </span>
                </div>
                <div className="h-4 w-[1px] bg-slate-200" />
                <div className="flex items-center gap-2 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
                  <Calendar size={12} className="text-slate-500" />
                  {formatDate(report.date_of_event || report.event_date || report.created_at)}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3">
                {report.primary_tag && (
                  <span className="px-3 py-1 rounded-full bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)] text-[10px] font-bold uppercase tracking-widest border border-[var(--chip-ink-border,#e2e5eb)]">
                    {report.primary_tag}
                  </span>
                )}
                <span className={cn(
                  "px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                  severityBadge.classes
                )}>
                  {severityBadge.label}
                </span>
                <span className={cn(
                  "px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                  "bg-white text-slate-500 border-slate-200"
                )}>
                  {statusConfig?.label || report.status}
                </span>
              </div>
            </div>

            {/* Main Title Section */}
            <div className="max-w-4xl space-y-4 md:space-y-6">
              <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 leading-tight tracking-tight px-0.5">
                {report.report || report.title || `${report.airlines || ""} ${report.flight_number || ""}`.trim() || "Unlabeled Record"}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 md:gap-8 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <User size={14} className="text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Reported By</span>
                    <span className="text-[13px] font-bold text-slate-900">{report.users?.full_name || report.reporter_name || "Anonymous"}</span>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-[1px] bg-slate-100" />

                <div className="flex flex-col pl-1 sm:pl-0">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Category</span>
                  {(() => {
                    const cat = (report.category || 'General Irregularity').toUpperCase();
                    let style = "bg-slate-700 text-white";
                    if (cat.includes('IRREGULARITY')) style = "bg-amber-600 text-white";
                    else if (cat.includes('COMPLAINT')) style = "bg-rose-700 text-white";
                    else if (cat.includes('COMPLIMENT')) style = "bg-emerald-700 text-white";
                    
                    return (
                      <span className={cn(
                        "inline-block w-fit text-[11px] font-black uppercase tracking-[0.05em] px-3 py-1 rounded-md shadow-sm",
                        style
                      )}>
                        {cat}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

            {/* Row 3: Mobile Status Badges ONLY (No redundant actions) */}
            <div className="flex flex-wrap items-center gap-3 md:hidden border-t border-slate-100 py-6 mt-4 px-8">
              {report.primary_tag && (
                <span className="px-2 py-1 rounded-full bg-[var(--chip-ink-bg,#f1f2f5)] text-[var(--chip-ink-text,#475569)] text-[9px] font-black uppercase tracking-widest border border-[var(--chip-ink-border,#e2e5eb)]">
                  {report.primary_tag}
                </span>
              )}
              <span className={cn(
                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                severityBadge.classes
              )}>
                {severityBadge.label}
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm transition-colors",
                statusConfig?.bgClass || "bg-slate-100",
                statusConfig?.textClass || "text-slate-600",
                statusConfig?.borderClass || "border-slate-200"
              )}>
                {statusConfig?.label || report.status}
              </span>
            </div>

            {/* Row 4: Desktop Actions Only */}
            <div className="hidden md:flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-3 px-3 pb-2">
               {/* Evidence Link */}
               {reportEvidenceUrls.length > 0 && (
                <button onClick={() => setIsEvidenceModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[12px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-100">
                  <ImageIcon size={14} strokeWidth={2.5} /> View Evidence
                </button>
               )}

               {((userRole === "CABANG" || canExportBranchData(userRole as UserRole)) || (canEdit && !isClosed)) && (
                <div className="flex items-center gap-3">
                  {(userRole === "CABANG" || canExportBranchData(userRole as UserRole)) && (
                    <button onClick={() => generatePDF(report)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold hover:bg-red-100 transition-colors border border-red-100">
                      <FileType size={14} strokeWidth={2.5} /> Download PDF
                    </button>
                  )}
                  <button onClick={() => setIsDocxModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-[12px] font-bold hover:bg-blue-100 transition-colors border border-blue-100">
                    <FileText size={14} strokeWidth={2.5} /> Edit DOCX
                  </button>
                </div>
              )}
              {canEdit && !isClosed && (
                <button 
                  onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)} 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shadow-sm",
                    isEditing ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  )}
                >
                  {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
                  {isEditing ? "Save Changes" : "Edit Report"}
                </button>
              )}
            </div>

      </header>

      {/* =============================================
          MAIN CONTENT CARD
          ============================================= */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN — Report Detail (8 cols) */}
          <main 
            className="lg:col-span-8 overflow-y-auto scroll-smooth pb-20 md:pb-12 px-4 md:px-0" 
            ref={scrollRef}
          >
            <div className="space-y-12">

              {/* PRIMARY DATA GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 px-8 md:px-0">
                <div className="space-y-8">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Flight Metadata</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <DataField label="Flight No." value={report.flight_number} />
                    <DataField label="Aircraft Reg" value={report.aircraft_reg} />
                    <DataField label="Airline" value={report.airlines || report.airline} />
                  </div>
                </div>

                <div className="space-y-8">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Operations Context</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <DataField label="Area" value={AREA_LABELS[report.area || ""] || report.area} />
                    <DataField label="Sub Category" value={report.irregularity_complain_category} />
                    <DataField label="Station" value={`${report.stations?.code || report.branch || ""}`} />
                    <DataField label="Specific Location" value={report.specific_location || report.location} span={2} />
                    <DataField label="Route" value={report.route} />
                  </div>
                </div>
              </div>

              {/* CORE DESCRIPTION */}
              <div className="bg-white p-8 border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Issue Narrative</h4>
                {isEditing ? (
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full text-[15px] bg-slate-50 border border-slate-200 p-4 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none resize-none transition-all"
                    rows={6}
                    placeholder="Enter detailed description..."
                  />
                ) : (
                  <p className="text-[17px] text-slate-700 leading-relaxed font-light italic">
                    &quot;{report.description || "No narrative description provided."}&quot;
                  </p>
                )}
              </div>

              {/* ANALYTICS & OPERATIONAL DEPTH */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <SectionCard title="Technical Specs" className="md:col-span-1 border-none bg-slate-50 shadow-none">
                  <div className="space-y-6">
                    {reportExtra.jenis_maskapai && <DataField label="Type" value={String(reportExtra.jenis_maskapai)} />}
                    {reportExtra.delay_code && <DataField label="Delay Code" value={String(reportExtra.delay_code)} />}
                    {reportExtra.delay_duration && <DataField label="Duration" value={String(reportExtra.delay_duration)} />}
                    {reportExtra.severity_level && <DataField label="Severity Lvl" value={String(reportExtra.severity_level)} />}
                    {reportExtra.case_classification && <DataField label="Classification" value={String(reportExtra.case_classification)} />}
                    {reportExtra.accident_incident && <DataField label="Inc. Type" value={String(reportExtra.accident_incident)} />}
                    {reportExtra.gse_available_requirement && <DataField label="GSE Req" value={String(reportExtra.gse_available_requirement)} />}
                    {reportExtra.remarks_case && <DataField label="Case Remarks" value={String(reportExtra.remarks_case)} />}
                    {reportExtra.service_business_type && <DataField label="Service" value={String(reportExtra.service_business_type)} />}
                    {reportExtra.esklasi_divisi && <DataField label="Escalation" value={String(reportExtra.esklasi_divisi)} />}
                  </div>
                </SectionCard>

                <div className="md:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Root Cause Analysis</h4>
                      {isEditing ? (
                        <textarea value={editForm.root_caused} onChange={e => setEditForm(p => ({...p, root_caused: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-3 text-[13px] outline-none" rows={4} placeholder="Root cause analysis..." />
                      ) : (
                        <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{report.root_caused || "Awaiting RCA analysis."}</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Immediate Response</h4>
                      {isEditing ? (
                        <textarea value={editForm.action_taken} onChange={e => setEditForm(p => ({...p, action_taken: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-3 text-[13px] outline-none" rows={4} placeholder="Immediate action taken..." />
                      ) : (
                        <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{report.action_taken || "No immediate action recorded."}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-emerald-50/50 p-8 border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <CheckCircle2 size={48} className="text-emerald-500" />
                    </div>
                    <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">Strategic Prevention</h4>
                    {isEditing ? (
                      <textarea value={editForm.preventive_action} onChange={e => setEditForm(p => ({...p, preventive_action: e.target.value}))} className="w-full bg-white border border-emerald-100 p-3 text-[13px] outline-none" rows={4} placeholder="Preventive strategies..." />
                    ) : (
                      <p className="text-[14px] text-emerald-900 leading-relaxed font-semibold italic">&quot;{report.preventive_action || report.immediate_action || "Strategic prevention plan pending."}&quot;</p>
                    )}
                  </div>

                  {report.sub_category_note && (
                    <div className="bg-amber-50/60 p-6 border border-amber-100">
                      <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-3">Auditor Remarks</h4>
                      <p className="text-[13px] text-amber-900 leading-relaxed">{report.sub_category_note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* LAMPIRAN — Evidence */}
              <SectionCard title={`Lampiran (${allEvidence.length})`}>
                {allEvidence.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {allEvidence.map((url, i) => {
                      const isPartnerEvidence = report.partner_evidence_urls?.includes(url);
                      const isImage = /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(url) || 
                                     (url.includes('/storage/v1/object/public/evidence/') && !/\.(docx|doc|pdf|xlsx|xls|pptx|ppt)$/i.test(url));
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "group rounded-xl border overflow-hidden bg-white shadow-sm transition-all hover:shadow-md",
                            isPartnerEvidence ? "border-emerald-200" : "border-slate-100"
                          )}
                        >
                          {isImage ? (
                            <div className="relative aspect-video bg-slate-50 group">
                              {isSafeLocalImage(url) ? (
                                <Image
                                  src={url}
                                  alt={`evidence-${i}`}
                                  width={800}
                                  height={600}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-[1.05]"
                                />
                              ) : (
                                // Deliberate fallback for external evidence URLs (arbitrary
                                // hosts, not just the few in next.config's remotePatterns
                                // allowlist) — next/image would throw for an unconfigured
                                // host, isSafeLocalImage() already routes local/data/blob
                                // URLs to next/image above.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={`evidence-${i}`}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-[1.05]"
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              
                              {/* Metadata Overlay for Images */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                                {(() => {
                                  const filename = decodeURIComponent(url.split('/').pop() || '');
                                  const metadataMatch = filename.match(/^([A-Z]+)__(.*?)__/);
                                  if (metadataMatch) {
                                    const actionType = metadataMatch[1] === 'CORRECTIVE' ? 'Corrective Action' : 
                                                      metadataMatch[1] === 'PREVENTIVE' ? 'Preventive Action' : 
                                                      metadataMatch[1].replace(/-/g, ' ');
                                    return (
                                      <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">{actionType}</span>
                                        <span className="text-[9px] text-gray-200">Oleh: {metadataMatch[2]}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col p-3 gap-2">
                              <div className="flex items-center gap-3">
                                <FileText size={16} className={isPartnerEvidence ? "text-emerald-600 shrink-0" : "text-blue-500 shrink-0"} />
                                <span className="text-sm text-[var(--text-secondary)] truncate flex-1 font-medium">
                                  {decodeURIComponent(url.split('/').pop() || '').split('__').pop() || 'Document'}
                                </span>
                              </div>
                              
                              {(() => {
                                const filename = decodeURIComponent(url.split('/').pop() || '');
                                const metadataMatch = filename.match(/^([A-Z]+)__(.*?)__/);
                                if (metadataMatch) {
                                  const actionType = metadataMatch[1] === 'CORRECTIVE' ? 'Corrective Action' : 
                                                    metadataMatch[1] === 'PREVENTIVE' ? 'Preventive Action' : 
                                                    metadataMatch[1].replace(/-/g, ' ');
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold uppercase ring-1 ring-gray-200">
                                        {actionType}
                                      </span>
                                      <span className="text-[9px] text-gray-400 font-medium">
                                        {metadataMatch[2]}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                    <Link size={32} strokeWidth={1.5} />
                    <p className="text-sm mt-3">No attachments</p>
                  </div>
                )}
                {!isClosed && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Attachment Classification</label>
                      <p className="text-xs text-slate-500">
                        Select the type of evidence to upload for the corrective or preventive action.
                      </p>
                      <select 
                        className="mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none"
                        value={lampiranActionType || ""}
                        onChange={(e) => setLampiranActionType(e.target.value as LampiranActionType)}
                      >
                        <option value="" disabled>Select attachment evidence type</option>
                        <option value="CORRECTIVE">Corrective Action Evidence</option>
                        <option value="PREVENTIVE">Preventive Action Evidence</option>
                      </select>
                    </div>

                    {lampiranActionType && (
                      <>
                        <div className="flex flex-col gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Briefing Options</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                              <a
                                href="/templates/form-briefing.docx"
                                download
                                className="flex-1 text-center px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors"
                              >
                                Download Template
                              </a>
                              <button
                                onClick={() => setShowBriefingEditor(true)}
                                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <FileText size={14} /> Fill Briefing Form
                              </button>
                          </div>
                        </div>
                      
                        <div className="flex flex-col sm:flex-row gap-2 items-center">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                            className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none"
                          />
                          <button
                            onClick={handleUploadEvidence}
                            disabled={evidenceFiles.length === 0 || actionLoading}
                            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                          >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Upload Photo
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* AI Insight Section (v2 — exec layout, schema-validated) — hidden for now, ponytail: flip back on when ready */}
              {false && (
                <SectionCard title="AI Insight" headerAction={
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">v2</span>
                }>
                  <AIInsightCard report={report} />
                </SectionCard>
              )}
            </div>
          </main>

          {/* RIGHT COLUMN — Activity Feed (4 cols) */}
          <aside className="lg:col-span-4 flex flex-col h-full lg:max-h-[900px] px-4 lg:px-0 pb-24 lg:pb-0">
            <div className="bg-white border border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
              {/* Aside Header */}
              <header className="px-6 py-6 border-b border-slate-50 bg-slate-50/30 shrink-0">
                <h2 className="text-[12px] font-bold text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                  <MessageSquare size={14} className="text-emerald-600" />
                  Activity Stream
                </h2>
                <p className="text-[10px] text-slate-400 font-medium mt-2 uppercase tracking-widest">
                  Total Events: {report.comments?.length || 0}
                </p>
              </header>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/10">
              
              {/* Quick Action Card */}
              {onUpdateStatus && primaryAction && !isEditing && (
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status Update Request</p>
                    <p className="text-[14px] font-semibold">{actionLabel}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (primaryAction === "CLOSED") setShowCloseModal(true);
                      else if (primaryAction === "OPEN") setShowReopenModal(true);
                      else if (primaryAction === "ON PROGRESS") setShowVerifyModal(true);
                      else handleUpdateStatus(primaryAction);
                    }}
                    disabled={actionLoading}
                    className="w-full py-3 bg-white text-slate-900 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all uppercase tracking-widest shadow-sm"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {actionButtonLabel}
                  </button>
                </div>
              )}

              {/* Comment Input */}
              <div className="bg-white p-4 border border-slate-100 shadow-sm rounded-2xl relative overflow-hidden">
                {refreshing && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-slate-100 overflow-hidden z-10">
                    <div className="h-full bg-emerald-500 animate-pulse" />
                  </div>
                )}
                <CommentInput reportId={report.id} onSuccess={handleRefresh} placeholder="Post a response..." />
              </div>

              {/* Activity Feed */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100 pb-2">Audit Trail</h4>
                {report.comments && report.comments.length > 0 ? (
                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                    {report.comments.slice().reverse().map((comment, idx) => {
                      const isLast = idx === 0;
                      if (comment.is_system_message) {
                        return (
                          <div 
                            key={comment.id} 
                            ref={isLast ? lastCommentRef : null}
                            className="flex items-start gap-4 text-[11px] text-slate-400 italic pl-1"
                          >
                            <div className="w-[22px] h-[22px] rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center z-10">
                              <RotateCcw size={10} className="text-slate-300" />
                            </div>
                            <div className="flex-1 py-0.5">
                              <span>{comment.content}</span>
                              <span className="ml-2 opacity-50 font-medium">
                                {new Date(comment.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div 
                          key={comment.id} 
                          ref={isLast ? lastCommentRef : null}
                          className="flex items-start gap-4 pl-1"
                        >
                          <div className="w-[22px] h-[22px] rounded-full bg-white border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 z-10 shadow-sm">
                            {getCommentAuthorInitial(comment)}
                          </div>
                          <div className="flex-1 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-bold text-slate-800">{getCommentAuthorName(comment)}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(comment.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[13px] text-slate-600 leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-white/50">
                    <MessageSquare size={24} className="mx-auto text-slate-200" />
                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">No Activity Yet</p>
                  </div>
                )}
              </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* =============================================
          MODALS
          ============================================= */}
      
      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Update Progress</h3>
              <button onClick={() => setShowVerifyModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-[13px] mb-5 flex items-center gap-3 border border-blue-100">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>Report will be marked as ON PROGRESS. Add notes below.</span>
            </div>
            <textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 text-[15px] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none bg-gray-50 mb-5 resize-none"
              rows={4}
              placeholder="Add notes (required)..."
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-[15px]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus("ON PROGRESS", verifyNotes)}
                disabled={actionLoading || !verifyNotes.trim()}
                className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Update Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Reopen Report</h3>
              <button onClick={() => setShowReopenModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} /></button>
            </div>
            <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-[13px] mb-5 flex items-center gap-3 border border-amber-100">
              <AlertCircle size={18} className="shrink-0" />
              <span>The case will be reopened and the status will change to Waiting for Feedback. All previous notes and comments will remain saved.</span>
            </div>
            <textarea
              value={reopenNotes}
              onChange={(e) => setReopenNotes(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 text-[15px] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none bg-gray-50 mb-5 resize-none"
              rows={4}
              placeholder="Explain the reason for reopening..."
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowReopenModal(false)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-[15px]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus("OPEN", reopenNotes)}
                disabled={actionLoading}
                className="flex-1 py-3.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all text-[15px] flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={16} />}
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Close Report</h3>
              <button onClick={() => setShowCloseModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} /></button>
            </div>
            
            {/* Link bukti penyelesaian dihilangkan dari alur update status */}

            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-[13px] mb-5 flex items-start gap-3 border border-emerald-100">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>Final Remarks dan Remarks By wajib diisi sebelum status laporan ditutup.</span>
            </div>

            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Final Remarks
            </label>
            <textarea 
              value={closeNotes} 
              onChange={(e) => setCloseNotes(e.target.value)} 
              className="w-full p-4 rounded-xl border border-gray-200 text-[15px] outline-none bg-gray-50 mb-5 resize-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" 
              rows={4} 
              placeholder="Tuliskan final remarks..." 
              autoFocus
            />

            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 mb-5">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Remarks By
                </label>
                <select
                  value={closeRemarksByDivision}
                  onChange={(e) => setCloseRemarksByDivision(e.target.value)}
                  className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[14px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  <option value="">Divisi</option>
                  {REMARKS_BY_DIVISIONS.map((division) => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 sm:opacity-0">
                  Nama
                </label>
                <input
                  value={closeRemarksByName}
                  onChange={(e) => setCloseRemarksByName(e.target.value)}
                  className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  placeholder="Nama pengisi"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCloseModal(false)} 
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-[15px]"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUpdateStatus("CLOSED", closeNotes.trim(), undefined, {
                  finalRemarks: closeNotes.trim(),
                  remarksBy: closeRemarksBy,
                })}
                disabled={actionLoading || !canSubmitClose} 
                className="flex-1 py-3.5 text-white font-bold rounded-xl text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: divisionColor }}
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docx Editor Modal */}
      <DocxEditorModal
        isOpen={isDocxModalOpen}
        onClose={() => setIsDocxModalOpen(false)}
        reportData={report}
        onSuccess={(updatedReport) => {
          onRefresh?.(updatedReport);
        }}
      />

      {/* Evidence View Modal */}
      <EvidenceViewModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        evidenceUrls={reportEvidenceUrls}
      />

      {/* Briefing Editor Modal */}
      {showBriefingEditor && report && lampiranActionType && (
        <BriefingEditorModal
          isOpen={showBriefingEditor}
          onClose={() => setShowBriefingEditor(false)}
          reportData={report}
          uploadType={lampiranActionType}
          divisionName={userRole}
          onSuccess={(updatedReport) => {
             // Keep modal open to show success state and download button
             onRefresh?.(updatedReport);
          }}
        />
      )}
    </div>
  );
}
