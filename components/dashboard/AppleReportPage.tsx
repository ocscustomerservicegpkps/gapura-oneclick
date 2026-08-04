'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2, Sparkles, ArrowUpRight, ShieldCheck, Wrench } from 'lucide-react';
import { AREA_LABELS } from '@/lib/constants/incident-areas';
import { InlineShell, Section } from '@/components/public-report/apple-form-shell';
import {
  detectJoumpa, IrregularityBody, JoumpaBody, FeedbackThread, StatusBadge, SeverityBadge,
} from '@/components/dashboard/AppleReportDetail';
import { CloseReportDialog, type CloseReportValues } from '@/components/dashboard/CloseReportDialog';
import type { Report } from '@/types';

interface Props {
  reportId: string;
  backTo: string;
  divisionColor?: string;
  defaultRole?: string;
}

// Synced reports only carry a date, so the clock part is shown when the
// timestamp actually has one (see splitReportTimestamp).
const fmt = (d?: string | null) => {
  if (!d) return '—';
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return d;
  const date = p.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isDateOnly = p.getHours() === 0 && p.getMinutes() === 0;
  return isDateOnly
    ? date
    : `${date}, ${p.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

type AIRec = { escalation: string; preventive: string; handling: string };

function AIPanel({ reportId, accent }: { reportId: string; accent: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rec, setRec] = useState<AIRec | null>(null);

  const run = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai/report-recommendation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load AI recommendation');
      setRec(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI recommendation');
    } finally { setLoading(false); }
  };

  return (
    <Section title="AI Recommendation" subtitle="AI-based escalation, prevention, and handling suggestions">
      <div className="jm-ai">
        <button type="button" onClick={run} disabled={loading} className="jm-ai__btn" style={{ background: accent }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Analyzing…' : rec ? 'Regenerate recommendation' : 'Request AI recommendation'}
        </button>

        {error && <div className="jm-error"><AlertCircle size={16} />{error}</div>}

        {rec && (
          <div className="jm-ai__grid">
            <div className="jm-ai__card">
              <span className="jm-ai__card-head"><ArrowUpRight size={14} /> Escalation</span>
              <p>{rec.escalation || '—'}</p>
            </div>
            <div className="jm-ai__card">
              <span className="jm-ai__card-head"><ShieldCheck size={14} /> Prevention</span>
              <p>{rec.preventive || '—'}</p>
            </div>
            <div className="jm-ai__card">
              <span className="jm-ai__card-head"><Wrench size={14} /> Handling</span>
              <p>{rec.handling || '—'}</p>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function CaseManagement({ report }: { report: Report }) {
  const rows: Array<[string, string | undefined]> = [
    ['Reference', report.reference_number],
    ['Priority', report.priority],
    ['Severity', report.severity],
    ['Status', report.status],
    ['Escalation Division', report.esklasi_divisi],
    ['Remarks By', report.remarks_by],
    ['KPS Remarks', report.kps_remarks || report.remarks_gapura_kps],
    ['Final Remarks', report.final_remarks],
    ['Immediate Action', report.immediate_action],
    ['Created', fmt(report.created_at)],
    ['Updated', fmt(report.updated_at)],
    ['Resolved', report.resolved_at ? fmt(report.resolved_at) : undefined],
  ];
  const shown = rows.filter(([, v]) => v && String(v).trim());
  if (!shown.length) return null;
  return (
    <Section title="Case Management" subtitle="Status, escalation, and handling trail">
      <div className="jm-kv">
        {shown.map(([k, v]) => (
          <div key={k} className="jm-kv__cell">
            <span className="jm-kv__k">{k}</span>
            <span className="jm-kv__v">{v}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function AppleReportPage({ reportId, backTo, divisionColor = '#0f7c7c', defaultRole = 'ANALYST' }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Report['comments'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  // Guards against a slower in-flight request for a previous reportId
  // resolving after navigation to a new report and clobbering its state
  // (e.g. fast nav between two reports showing report A's data under
  // report B's URL). Mirrors the fullReport.id === selectedId guard in
  // ReportMasterDetail.tsx.
  const activeReportIdRef = useRef(reportId);

  const fetchComments = useCallback(async () => {
    const requestId = reportId;
    try {
      const res = await fetch(`/api/reports/${requestId}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (activeReportIdRef.current === requestId) setComments(data);
      }
    } catch { /* ignore */ }
  }, [reportId]);

  const fetchReport = useCallback(async () => {
    const requestId = reportId;
    try {
      const res = await fetch(`/api/reports/${requestId}`);
      if (!res.ok) throw new Error('Gagal memuat laporan');
      const data = await res.json();
      if (activeReportIdRef.current === requestId) setReport(data);
    } catch (e) {
      if (activeReportIdRef.current === requestId) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      if (activeReportIdRef.current === requestId) setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    activeReportIdRef.current = reportId;
    setLoading(true);
    setError('');

    fetchComments();   // instant, DB-only
    fetchReport();     // may wait on Google Sheets

    // Clear unread comment notifications for this report on open.
    fetch('/api/notifications/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId }),
    }).catch(() => {});

    // report_comments has no client-reachable RLS policy (locked down to
    // server-only reads), so an anon-client Realtime subscription here
    // would never receive events. Poll instead.
    const intervalId = setInterval(() => { fetchComments(); }, 10_000);

    return () => { clearInterval(intervalId); };
  }, [reportId, fetchComments, fetchReport]);

  const handleStatus = useCallback(async (id: string, status: string, values: CloseReportValues) => {
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId: id,
        status,
        notes: values.finalRemarks,
        kps_remarks: values.finalRemarks,
        final_remarks: values.finalRemarks,
        remarks_by: values.remarksBy,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || 'Failed to close report');
    await fetchReport();
  }, [fetchReport]);

  const display = useMemo<Report | null>(
    () => (report ? { ...report, comments: comments ?? report.comments } : null),
    [report, comments],
  );

  if (loading && !display) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: divisionColor }} />
      </div>
    );
  }

  if (error || !display) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold">Error Loading Report</h2>
        <p className="text-gray-500">{error}</p>
        <button onClick={() => router.push(backTo)} className="flex items-center gap-2 font-bold hover:underline" style={{ color: divisionColor }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  const r = display;
  const isJoumpa = detectJoumpa(r);
  void defaultRole;
  const airline = r.airlines || r.airline || '';
  const flight = r.flight_number || '';
  const areaLabel = r.area ? (AREA_LABELS[r.area as keyof typeof AREA_LABELS] || r.area) : '';
  const title = isJoumpa
    ? [airline, flight].filter(Boolean).join(' · ') || (r.title || 'JOUMPA Report')
    : [airline, flight, areaLabel].filter(Boolean).join(' · ') || (r.title || 'Irregularity Report');
  const nextStatus = r.status === 'CLOSED' ? null : 'CLOSED';

  return (
    <div className="jm-page">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="jm-page__inner">
        <InlineShell ariaLabel={isJoumpa ? 'JOUMPA Report Detail' : 'Irregularity Report Detail'}>
          <header className="jm-page__bar">
            <button type="button" onClick={() => router.push(backTo)} className="jm-page__back" aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div className="jm-page__bar-main">
              <span className={isJoumpa ? 'jm-detail__eyebrow jm-detail__eyebrow--joumpa' : 'jm-detail__eyebrow'} style={{ marginBottom: 0 }}>
                {isJoumpa ? 'JOUMPA · Field Report' : 'Ground Handling · Irregularity'}
              </span>
              <h1 className="jm-page__title">{title}</h1>
            </div>
            <div className="jm-page__badges">
              <StatusBadge status={r.status} />
              <SeverityBadge severity={r.severity} />
              {r.reference_number && <span className="jm-badge">Ref · {r.reference_number}</span>}
            </div>
          </header>

          <div className="jm-detail-split">
            <div className="jm-scroll jm-detail-main">
              <AIPanel reportId={r.id} accent={divisionColor} />
              {isJoumpa ? <JoumpaBody report={r} /> : <IrregularityBody report={r} />}
              <CaseManagement report={r} />
              {nextStatus && (
                <div className="jm-page__actions">
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
            <aside className="jm-scroll jm-detail-side">
              <FeedbackThread report={r} onRefresh={fetchComments} />
            </aside>
          </div>
        </InlineShell>
        <CloseReportDialog
          open={showCloseDialog}
          onClose={() => setShowCloseDialog(false)}
          onSubmit={(values) => handleStatus(r.id, nextStatus!, values)}
          accentColor={divisionColor}
        />
      </div>
    </div>
  );
}

const PAGE_CSS = `
.jm-page { min-height: 100vh; height: 100vh; overflow-y: auto; background: #f4f4f7; }
.jm-page__inner { max-width: 1180px; margin: 0 auto; padding: 20px 20px 64px; }
.jm-page__bar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 16px;
  padding: 14px 4px; margin-bottom: 8px;
  background: rgba(244,244,247,0.82); backdrop-filter: blur(18px) saturate(1.2);
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.jm-page__back {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.08); background: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; color: #101013;
  transition: background .18s ease, transform .18s ease;
}
.jm-page__back:hover { background: rgba(0,0,0,0.05); }
.jm-page__back:active { transform: scale(0.92); }
.jm-page__bar-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.jm-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #101013; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
.jm-page__badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.jm-page__actions { display: flex; justify-content: flex-end; padding-top: 4px; }
.jm-page .jm-inline .jm-scroll { padding: 0; }

.jm-ai { display: flex; flex-direction: column; gap: 14px; }
.jm-ai__btn {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px; border: none; border-radius: 999px; cursor: pointer;
  color: #fff; font-family: inherit; font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em;
  box-shadow: 0 8px 20px -8px rgba(0,0,0,0.4); transition: transform .18s ease, opacity .18s ease;
}
.jm-ai__btn:hover:not(:disabled) { transform: translateY(-1px); }
.jm-ai__btn:disabled { cursor: default; opacity: 0.7; }
.jm-ai__grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 640px) { .jm-ai__grid { grid-template-columns: repeat(3, 1fr); } }
.jm-ai__card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 15px; border-radius: 16px; background: #fff; border: 1px solid rgba(0,0,0,0.07);
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.jm-ai__card-head { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #7c7c85; }
.jm-ai__card p { margin: 0; font-size: 13px; line-height: 1.55; color: #3a3a42; }
`;

export default AppleReportPage;
