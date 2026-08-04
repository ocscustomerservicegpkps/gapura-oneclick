'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, FileType2, ImageOff, Loader2, MessageSquare, RotateCcw } from 'lucide-react';
import { AREA_LABELS } from '@/lib/constants/incident-areas';
import { FormShell, Section } from '@/components/public-report/apple-form-shell';
import { CommentInput } from '@/components/dashboard/reports/CommentInput';
import { CloseReportDialog, type CloseReportValues } from '@/components/dashboard/CloseReportDialog';
import { getEvidencePreviewUrl } from '@/lib/evidence-url';
import type { Report } from '@/types';

interface Props {
  report: Report;
  onClose: () => void;
  onUpdateStatus?: (
    id: string,
    status: string,
    notes?: string,
    evidenceUrl?: string,
    details?: CloseReportValues,
  ) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

export const detectJoumpa = (r: Report): boolean =>
  !!r.category_case_joumpa ||
  !!r.customer_joumpa ||
  !!r.detail_customer_joumpa ||
  (r.category || '').toUpperCase().includes('JOUMPA') ||
  (r.main_category || '').toUpperCase().includes('JOUMPA') ||
  (r.source_sheet || '').toLowerCase().includes('joumpa');

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

const areaCategoryOf = (r: Report): string | undefined =>
  r.terminal_area_category ||
  r.apron_area_category ||
  r.general_category ||
  r.category_case_gse ||
  r.category_case_cargo ||
  r.irregularity_complain_category ||
  undefined;

const rootCauseIdOf = (r: Report): string | undefined =>
  r.case_classification || r.identification_of_root || undefined;

function KV({ k, v, wide, muted }: { k: string; v?: string | null; wide?: boolean; muted?: boolean }) {
  const value = v && String(v).trim() ? String(v).trim() : '—';
  return (
    <div className={wide ? 'jm-kv__cell jm-kv__cell--wide' : 'jm-kv__cell'}>
      <span className="jm-kv__k">{k}</span>
      <span className={muted || value === '—' ? 'jm-kv__v jm-kv__v--muted' : 'jm-kv__v'}>{value}</span>
    </div>
  );
}

function Paragraph({ text }: { text?: string | null }) {
  const val = text && String(text).trim() ? String(text).trim() : '—';
  if (val === '—') return <span className="jm-kv__v jm-kv__v--muted">Not recorded</span>;
  return <p className="jm-body-para">{val}</p>;
}

export function StatusBadge({ status }: { status?: string }) {
  const s = (status || '').toUpperCase();
  const cls =
    s === 'OPEN' ? 'jm-badge jm-badge--open' :
    s === 'ON PROGRESS' || s === 'IN PROGRESS' ? 'jm-badge jm-badge--progress' :
    s === 'CLOSED' ? 'jm-badge jm-badge--closed' :
    'jm-badge';
  return (
    <span className={cls}>
      <span className="jm-badge__dot" aria-hidden />
      {s || 'UNKNOWN'}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity?: string }) {
  const s = (severity || '').toUpperCase();
  const cls =
    s === 'TOP RISK' || s === 'URGENT' ? 'jm-badge jm-badge--urgent' :
    s === 'HIGH RISK' ? 'jm-badge jm-badge--high' :
    s === 'MEDIUM' ? 'jm-badge jm-badge--medium' :
    s === 'LOW' ? 'jm-badge jm-badge--low' :
    'jm-badge';
  return <span className={cls}>{s || 'UNSET'}</span>;
}

const toUrlList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
};

function EvidenceThumb({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const previewUrl = getEvidencePreviewUrl(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="jm-evidence__item">
      {failed ? (
        <div className="jm-evidence__fallback">
          <ImageOff size={22} strokeWidth={1.5} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Evidence ${index + 1}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      <span className="jm-evidence__badge">{String(index + 1).padStart(2, '0')}</span>
    </a>
  );
}

function EvidenceGallery({ urls }: { urls: string[] }) {
  if (!urls.length) return <span className="jm-kv__v jm-kv__v--muted">No evidence attached</span>;
  return (
    <div className="jm-evidence">
      {urls.map((url, i) => (
        <EvidenceThumb key={url + i} url={url} index={i} />
      ))}
    </div>
  );
}

interface DocumentMetadata {
  available: boolean;
  source?: 'finalized' | 'generated';
  docx_filename?: string;
  pdf_filename?: string;
}

function ReportDocumentDownloads({ reportId, isJoumpa }: { reportId: string; isJoumpa: boolean }) {
  const reportType = isJoumpa ? 'JOUMPA' : 'IRREGULARITY';
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [loadingFormat, setLoadingFormat] = useState<'docx' | 'pdf' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setMetadata(null);
    setError('');
    fetch(`/api/report-documents/${reportType}/${encodeURIComponent(reportId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Failed to load report documents');
        setMetadata(result as DocumentMetadata);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load report documents');
      });
    return () => controller.abort();
  }, [reportId, reportType]);

  const download = async (format: 'docx' | 'pdf') => {
    if (!metadata?.available || loadingFormat) return;
    setLoadingFormat(format);
    setError('');
    try {
      const response = await fetch(
        `/api/report-documents/${reportType}/${encodeURIComponent(reportId)}/${format}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || `Failed to download ${format.toUpperCase()}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = format === 'docx'
        ? (metadata.docx_filename || 'report.docx')
        : (metadata.pdf_filename || 'report.pdf');
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
    } finally {
      setLoadingFormat(null);
    }
  };

  const controlsDisabled = !metadata?.available || loadingFormat !== null;

  return (
    <div className="jm-documents" aria-live="polite">
      <div className="jm-documents__actions">
        <button
          type="button"
          className="jm-document-btn jm-document-btn--docx"
          onClick={() => download('docx')}
          disabled={controlsDisabled}
          aria-label={`Download the DOCX ${isJoumpa ? 'JOUMPA' : 'irregularity'} report form`}
        >
          {loadingFormat === 'docx' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          DOCX
          <Download size={12} />
        </button>
        <button
          type="button"
          className="jm-document-btn jm-document-btn--pdf"
          onClick={() => download('pdf')}
          disabled={controlsDisabled}
          aria-label={`Download the PDF ${isJoumpa ? 'JOUMPA' : 'irregularity'} report form`}
        >
          {loadingFormat === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileType2 size={14} />}
          PDF
          <Download size={12} />
        </button>
      </div>
      <span className={error ? 'jm-documents__status jm-documents__status--error' : 'jm-documents__status'}>
        {error
          ? error
          : metadata === null
            ? 'Checking finalized documents…'
            : metadata?.source === 'generated'
              ? 'Formatted from report information'
              : 'Final edited documents'}
      </span>
    </div>
  );
}

export function IrregularityBody({ report }: { report: Report }) {
  const areaLabel = report.area ? (AREA_LABELS[report.area as keyof typeof AREA_LABELS] || report.area) : '';
  const isGse = report.area === 'GSE' || !!report.gse_available_requirement;
  const airline = report.airlines || report.airline;

  return (
    <>
      <Section title="Reporter">
        <div className="jm-kv">
          <KV k="Reporter" v={report.reporter_name} />
          <KV k="Email" v={report.reporter_email} />
          <KV k="Date of Event" v={fmtDate(report.date_of_event || report.incident_date)} />
          <KV k="Filed" v={fmtDate(report.created_at)} />
        </div>
      </Section>

      <Section title="Flight">
        <div className="jm-kv">
          <KV k="Airline" v={airline} />
          <KV k="Flight" v={report.flight_number} />
          <KV k="Route" v={report.route} />
          <KV k="Station" v={report.station_code || report.branch} />
          <KV k="Hub" v={report.hub} />
          <KV k="Airline Type" v={report.jenis_maskapai} />
          {report.delay_code && <KV k="Delay Code" v={report.delay_code} wide />}
        </div>
      </Section>

      <Section title="Location">
        <div className="jm-kv">
          <KV k="Area" v={areaLabel} />
          <KV k="Category" v={areaCategoryOf(report)} />
        </div>
      </Section>

      {isGse && (
        <Section title="GSE Availability & Requirement">
          <div className="jm-kv">
            <KV k="GSE Available & Requirement" v={report.gse_available_requirement} />
            <KV k="Motorized" v={report.gse_motorized} />
            <KV k="Non-Motorized" v={report.gse_non_motorized} />
            <KV k="GSE Case Category" v={report.category_case_gse} />
          </div>
        </Section>
      )}

      <Section title="Case Narrative">
        <div className="jm-kv">
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Description</span>
            <Paragraph text={report.description || report.report} />
          </div>
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Root Cause</span>
            <Paragraph text={report.root_cause || report.root_caused} />
          </div>
          <KV k="Case Classification" v={rootCauseIdOf(report)} wide />
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Action Taken</span>
            <Paragraph text={report.action_taken} />
          </div>
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Preventive Action</span>
            <Paragraph text={report.preventive_action} />
          </div>
        </div>
      </Section>

      <Section title="Evidence">
        <EvidenceGallery urls={toUrlList(report.evidence_urls)} />
      </Section>
    </>
  );
}

export function FeedbackThread({ report, onRefresh }: { report: Report; onRefresh?: () => void | Promise<void> }) {
  const comments = report.comments || [];
  const authorName = (c: NonNullable<Report['comments']>[number]) => c?.users?.full_name || 'Unknown';
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <Section title="Feedback & Discussion" subtitle="Post a response or track the audit trail">
      <div className="jm-feedback">
        <CommentInput reportId={report.id} onSuccess={onRefresh} placeholder="Post a response…" />

        {comments.length > 0 ? (
          <div className="jm-feedback__list">
            {comments.slice().reverse().map((c) => {
              if (c.is_system_message) {
                return (
                  <div key={c.id} className="jm-feedback__sys">
                    <span className="jm-feedback__sys-icon"><RotateCcw size={11} /></span>
                    <span className="jm-feedback__sys-text">{c.content}</span>
                    <span className="jm-feedback__sys-time">{timeOf(c.created_at)}</span>
                  </div>
                );
              }
              return (
                <div key={c.id} className="jm-feedback__item">
                  <span className="jm-feedback__avatar">{authorName(c).charAt(0) || '?'}</span>
                  <div className="jm-feedback__bubble">
                    <div className="jm-feedback__bubble-head">
                      <span className="jm-feedback__author">{authorName(c)}</span>
                      <span className="jm-feedback__time">{timeOf(c.created_at)}</span>
                    </div>
                    <p className="jm-feedback__content">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="jm-feedback__empty">
            <MessageSquare size={22} />
            <span>No activity yet</span>
          </div>
        )}
      </div>
    </Section>
  );
}

export function JoumpaBody({ report }: { report: Report }) {
  const isCorporate = (report.customer_joumpa || '').toLowerCase().includes('corporate') && !(report.customer_joumpa || '').toLowerCase().includes('non');
  const isNonCorporate = (report.customer_joumpa || '').toLowerCase().includes('non');

  return (
    <>
      <Section title="Reporter">
        <div className="jm-kv">
          <KV k="Report by" v={report.reporter_name} />
          <KV k="Email" v={report.reporter_email} />
          <KV k="Date of Event" v={fmtDate(report.date_of_event || report.incident_date)} />
          <KV k="Filed" v={fmtDate(report.created_at)} />
        </div>
      </Section>

      <Section title="Flight">
        <div className="jm-kv">
          <KV k="Airlines" v={report.airlines || report.airline} />
          <KV k="Flight" v={report.flight_number} />
          <KV k="Route" v={report.route} />
          <KV k="Station" v={report.station_code || report.branch} />
        </div>
      </Section>

      <Section title="Customer">
        <div className="jm-kv">
          <KV k="Customer Type" v={report.customer_joumpa} />
          {isCorporate && <>
            <KV k="Corporate Segment" v={report.corporate} />
            <KV k="Company Profile" v={report.customer_company_profile_corporate} wide />
            <KV k="Detail Customer" v={report.detail_customer_corporate} wide />
          </>}
          {isNonCorporate && <>
            <KV k="Non-Corporate Type" v={report.non_corporate} />
            <KV k="Customer Background" v={report.customer_background_non_corporate} />
            <KV k="Detail Customer" v={report.detail_customer_non_corporate} wide />
          </>}
          {!isCorporate && !isNonCorporate && report.detail_customer_joumpa && (
            <KV k="Detail Customer" v={report.detail_customer_joumpa} wide />
          )}
        </div>
      </Section>

      <Section title="Case Narrative">
        <div className="jm-kv">
          <KV k="Category Case" v={report.category_case_joumpa} wide />
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Report</span>
            <Paragraph text={report.report || report.description} />
          </div>
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Root Caused</span>
            <Paragraph text={report.root_caused || report.root_cause} />
          </div>
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Action Taken</span>
            <Paragraph text={report.action_taken} />
          </div>
          <div className="jm-kv__cell jm-kv__cell--wide">
            <span className="jm-kv__k">Preventive Action</span>
            <Paragraph text={report.preventive_action} />
          </div>
        </div>
      </Section>

      <Section title="Evidence">
        <EvidenceGallery urls={toUrlList(report.evidence_urls)} />
      </Section>
    </>
  );
}

export function AppleReportDetail({ report, onClose, onUpdateStatus, onRefresh }: Props) {
  const isJoumpa = detectJoumpa(report);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const nextStatus = report.status === 'CLOSED' ? null : 'CLOSED';

  const handleCloseReport = async (values: CloseReportValues) => {
    if (!onUpdateStatus || !nextStatus) return;
    await onUpdateStatus(report.id, nextStatus, values.finalRemarks, undefined, values);
  };

  const airline = report.airlines || report.airline || '';
  const flight = report.flight_number || '';
  const areaLabel = report.area ? (AREA_LABELS[report.area as keyof typeof AREA_LABELS] || report.area) : '';
  const title = isJoumpa
    ? [airline, flight].filter(Boolean).join(' · ') || (report.title || 'JOUMPA Report')
    : [airline, flight, areaLabel].filter(Boolean).join(' · ') || (report.title || 'Irregularity Report');

  return (
    <FormShell onClose={onClose} wide dashboardScope ariaLabel={isJoumpa ? 'JOUMPA Report Detail' : 'Irregularity Report Detail'}>
      <div className="jm-form">
        <div className="jm-detail-split">
          <div className="jm-scroll jm-detail-main">
            <div className="jm-detail__hero">
              <span className={isJoumpa ? 'jm-detail__eyebrow jm-detail__eyebrow--joumpa' : 'jm-detail__eyebrow'}>
                {isJoumpa ? 'JOUMPA · Field Report' : 'Ground Handling · Irregularity'}
              </span>
              <h2 className="jm-detail__title">{title}</h2>
              <div className="jm-detail__meta">
                <StatusBadge status={report.status} />
                <SeverityBadge severity={report.severity} />
                {report.reference_number && (
                  <span className="jm-badge">Ref · {report.reference_number}</span>
                )}
              </div>
              <ReportDocumentDownloads reportId={report.id} isJoumpa={isJoumpa} />
            </div>

            {isJoumpa ? <JoumpaBody report={report} /> : <IrregularityBody report={report} />}
          </div>

          <aside className="jm-scroll jm-detail-side">
            <FeedbackThread report={report} onRefresh={onRefresh} />
          </aside>
        </div>

        {onUpdateStatus && nextStatus && (
          <div className="jm-footer">
            <button
              type="button"
              onClick={() => setShowCloseDialog(true)}
              className="jm-submit jm-submit--close"
            >
              {`Mark as ${nextStatus}`}
            </button>
          </div>
        )}
      </div>
      <CloseReportDialog
        open={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
        onSubmit={handleCloseReport}
      />
    </FormShell>
  );
}

export default AppleReportDetail;
