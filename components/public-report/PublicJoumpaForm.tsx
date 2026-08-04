'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  JOUMPA_AIRLINES,
  JOUMPA_CATEGORY_CASE,
  JOUMPA_CATEGORY_REPORT,
  JOUMPA_CORPORATE_TYPES,
  JOUMPA_CUSTOMER,
  JOUMPA_CUSTOMER_BACKGROUND,
  JOUMPA_NON_CORPORATE_TYPES,
  JOUMPA_SEVERITY_LEVELS,
  JOUMPA_STATUSES,
} from '@/lib/constants/joumpa';
import type { DocEdits } from './wizard-shared';
import { WizardStep } from '@/components/ui/WizardStep';
import { Field, FormShell, InlineShell, Options, Section, StepFooter, StepProgress, compressImage, resolveOther } from './apple-form-shell';
import DocumentEditorStep from './DocumentEditorStep';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TOTAL_STEPS = 6;

interface Station { id: string; code: string; name: string }
interface Props {
  onClose?: () => void;
  quickAccessSessionId?: string | null;
  inline?: boolean;
  mode?: 'public' | 'internal';
  defaultReporterName?: string;
  defaultReporterEmail?: string;
  onSubmitted?: (data: unknown) => void;
}

interface Form {
  reporter_email: string; report_by: string; date_of_event: string;
  airlines: string; airlines_other: string;
  flight_number: string; station_id: string; route: string;
  category_report: string; customer_joumpa: string;
  corporate: string; corporate_other: string;
  customer_company_profile_corporate: string; detail_customer_corporate: string;
  non_corporate: string;
  customer_background_non_corporate: string; customer_background_other: string;
  detail_customer_non_corporate: string;
  category_case_joumpa: string;
  report: string; root_caused: string; action_taken: string; preventive_action: string;
  severity_level: string; status: string;
}

const EMPTY: Form = {
  reporter_email: '', report_by: '', date_of_event: '',
  airlines: '', airlines_other: '', flight_number: '', station_id: '', route: '',
  category_report: '', customer_joumpa: '',
  corporate: '', corporate_other: '', customer_company_profile_corporate: '', detail_customer_corporate: '',
  non_corporate: '', customer_background_non_corporate: '', customer_background_other: '', detail_customer_non_corporate: '',
  category_case_joumpa: '', report: '', root_caused: '', action_taken: '', preventive_action: '',
  severity_level: '', status: '',
};

export default function PublicJoumpaForm({
  onClose,
  quickAccessSessionId,
  inline = false,
  mode = 'public',
  defaultReporterName,
  defaultReporterEmail,
  onSubmitted,
}: Props) {
  const [form, setForm] = useState<Form>(() => ({
    ...EMPTY,
    report_by: defaultReporterName || '',
    reporter_email: defaultReporterEmail || '',
  }));
  const [stations, setStations] = useState<Station[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [docEdits, setDocEdits] = useState<DocEdits | null>(null);
  const [createdReportData, setCreatedReportData] = useState<unknown>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [documentFinalizationToken, setDocumentFinalizationToken] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  // useAuth() resolves asynchronously, so defaultReporterName/Email are often
  // still empty on the initial render that seeds `form` above. Backfill once
  // they arrive, but only into fields the user hasn't already typed into.
  useEffect(() => {
    if (!defaultReporterName && !defaultReporterEmail) return;
    setForm((p) => ({
      ...p,
      report_by: p.report_by || defaultReporterName || '',
      reporter_email: p.reporter_email || defaultReporterEmail || '',
    }));
  }, [defaultReporterName, defaultReporterEmail]);

  useEffect(() => {
    const c = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/master-data?type=stations', { signal: c.signal });
        if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setStations(d); }
      } catch { /* ignore */ }
    })();
    return () => c.abort();
  }, []);

  const isCorporate = form.customer_joumpa === 'Corporate';
  const isNonCorporate = form.customer_joumpa === 'Non - Corporate';

  const stepValid = (n: number): boolean => {
    switch (n) {
      case 1:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reporter_email.trim()) && !!form.report_by.trim();
      case 2:
        return !!(form.date_of_event && resolveOther(form.airlines, form.airlines_other) &&
          form.flight_number.trim() && form.station_id && form.route.trim());
      case 3:
        if (!(form.category_report && form.customer_joumpa)) return false;
        if (isCorporate) return !!(resolveOther(form.corporate, form.corporate_other) && form.customer_company_profile_corporate.trim() && form.detail_customer_corporate.trim());
        if (isNonCorporate) return !!(form.non_corporate && resolveOther(form.customer_background_non_corporate, form.customer_background_other) && form.detail_customer_non_corporate.trim());
        return false;
      case 4:
        return !!(form.category_case_joumpa && form.report.trim() && form.root_caused.trim() &&
          form.action_taken.trim() && form.preventive_action.trim());
      case 5:
        return !!(form.severity_level && form.status);
      case 6:
        return files.length > 0;
      default:
        return false;
    }
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setError('');
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break;
      if (!f.type.startsWith('image/')) { setError(`${f.name}: only images are supported`); continue; }
      if (f.size > MAX_FILE_BYTES) { setError(`${f.name} exceeds 10 MB`); continue; }
      next.push(f);
    }
    setFiles(next);
  };

  const uploadEvidence = async (): Promise<{ urls: string[]; ids: string[] }> => {
    let token: string | null = null;
    if (mode === 'public') {
      const tokenRes = await fetch('/api/uploads/evidence/token');
      const tokenData = await tokenRes.json().catch(() => null);
      if (!tokenRes.ok || !tokenData?.token) throw new Error(tokenData?.error || 'Failed to get upload token');
      token = tokenData.token;
    }
    const station = stations.find((s) => s.id === form.station_id);
    const uploadOne = async (file: File) => {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', compressed);
      fd.append('evidence_submission_id', submissionId);
      fd.append('reporter_name', form.report_by.trim());
      fd.append('reporter_email', form.reporter_email.trim());
      fd.append('station_id', form.station_id);
      fd.append('station_code', station?.code || form.station_id);
      if (quickAccessSessionId) fd.append('quick_access_session_id', quickAccessSessionId);
      const uploadUrl = mode === 'public' ? '/api/uploads/evidence/public' : '/api/uploads/evidence';
      const headers: HeadersInit = token ? { 'X-Upload-Token': token } : {};
      const res = await fetch(uploadUrl, { method: 'POST', headers, body: fd });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error || 'Failed to upload evidence'); }
      return res.json();
    };
    const results = await Promise.all(files.map(uploadOne));
    const urls: string[] = []; const ids: string[] = [];
    for (const d of results) {
      if (d.url) urls.push(d.url);
      if (d.evidence_file_id || d.evidenceFileId) ids.push(d.evidence_file_id || d.evidenceFileId);
    }
    return { urls, ids };
  };

  const buildDocEdits = (stationCode: string, airlinesValue: string): DocEdits => {
    const eventDate = new Date(form.date_of_event);
    const month = eventDate.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const year = eventDate.getFullYear();
    return {
      reference_no: `CABANG ${stationCode}/CS/       /       / ${month}/${year}`,
      to: 'CUSTOMER SERVICE ON DUTY',
      from: 'GAPURA OPERATION STAFF',
      cc: '',
      subject: `${airlinesValue} ${form.flight_number.trim()} - JOUMPA ${form.category_report}`,
      attachment: files.length > 0 ? `${files.length} Files` : '',
      incident_date: form.date_of_event,
      branch: stationCode,
      flight_number: form.flight_number.trim(),
      aircraft_reg: '-',
      route: form.route.trim(),
      std_atd: '', pax: '', bge: '', gate_stand: '-',
      delay: '-',
      officers: [{ name: form.report_by.trim(), company: 'Gapura Angkasa', function: 'Reporter' }],
      chronology: [{ time: '', description: form.report.trim() }],
      root_cause: form.root_caused.trim(),
      action_taken: form.action_taken.trim(),
      preventive_action: form.preventive_action.trim(),
      reporter_name: form.report_by.trim(),
      reporter_title: 'Customer Service Officer',
      doc_title: 'JOUMPA REPORT FORM',
      acknowledge_label: 'Manager of Customer Service',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (createdReportId) {
      // A report was already successfully created in this session. Never
      // re-submit (which would create a duplicate) — just go back to the
      // success step and reuse the existing result.
      setStep(7);
      return;
    }
    if (!stepValid(6) || loading) return;
    submittingRef.current = true;
    setLoading(true); setError('');
    try {
      const { urls, ids } = await uploadEvidence();
      const station = stations.find((s) => s.id === form.station_id);
      const stationCode = station?.code || '';
      const airlinesValue = resolveOther(form.airlines, form.airlines_other);
      const payload = {
        reporter_email: form.reporter_email.trim(),
        report_by: form.report_by.trim(),
        date_of_event: form.date_of_event,
        airlines: airlinesValue,
        flight_number: form.flight_number.trim(),
        station: stationCode,
        route: form.route.trim(),
        category_report: form.category_report,
        customer_joumpa: form.customer_joumpa,
        corporate: isCorporate ? resolveOther(form.corporate, form.corporate_other) : '',
        customer_company_profile_corporate: isCorporate ? form.customer_company_profile_corporate.trim() : '',
        detail_customer_corporate: isCorporate ? form.detail_customer_corporate.trim() : '',
        non_corporate: isNonCorporate ? form.non_corporate : '',
        customer_background_non_corporate: isNonCorporate ? resolveOther(form.customer_background_non_corporate, form.customer_background_other) : '',
        detail_customer_non_corporate: isNonCorporate ? form.detail_customer_non_corporate.trim() : '',
        category_case_joumpa: form.category_case_joumpa,
        report: form.report.trim(),
        root_caused: form.root_caused.trim(),
        action_taken: form.action_taken.trim(),
        preventive_action: form.preventive_action.trim(),
        severity_level: form.severity_level,
        status: form.status,
        evidence_urls: urls,
        evidence_file_ids: ids,
        evidence_submission_id: submissionId,
      };
      const submitUrl = mode === 'public' ? '/api/joumpa/public' : '/api/joumpa';
      const res = await fetch(submitUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to submit JOUMPA report'); }
      const data = await res.json().catch(() => null);

      const createdData = { ...(data || {}) };
      delete createdData.document_finalization_token;
      setCreatedReportData(createdData);
      setCreatedReportId(data?.id ? String(data.id) : (data?.sheet_id ? String(data.sheet_id) : null));
      setDocumentFinalizationToken(
        typeof data?.document_finalization_token === 'string'
          ? data.document_finalization_token
          : null,
      );
      setDocEdits(buildDocEdits(stationCode, airlinesValue));
      setStep(7);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit JOUMPA report');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onSubmitted) { onSubmitted(createdReportData); return; }
    if (onClose) { onClose(); return; }
    setStep(1);
    setForm({ ...EMPTY, report_by: defaultReporterName || '', reporter_email: defaultReporterEmail || '' });
    setFiles([]);
    setDocEdits(null);
    setCreatedReportId(null);
    setDocumentFinalizationToken(null);
  };

  const body = step === 7 && docEdits ? (
    <div className="jm-form">
      <div className="jm-scroll">
        <DocumentEditorStep
          docEdits={docEdits}
          setDocEdits={setDocEdits as React.Dispatch<React.SetStateAction<DocEdits>>}
          onFinish={handleFinish}
          reportType="JOUMPA"
          reportId={createdReportId}
          finalizationToken={documentFinalizationToken}
        />
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="jm-form" noValidate>
          <div className="jm-scroll">
            <div className="jm-head">
              <h1 className="jm-title">JOUMPA Report</h1>
              <p className="jm-sub">File a hospitality service entry.</p>
            </div>

            <StepProgress step={step} total={TOTAL_STEPS} />

            {error && (
              <div className="jm-error" role="alert">
                <AlertTriangle size={15} strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <WizardStep isActive={step === 1}>
              <Section title="Reporter">
                <div className="jm-grid-2">
                  <Field label="Email" required>
                    <input type="email" className="jm-input" placeholder="you@example.com"
                      value={form.reporter_email} onChange={(e) => set('reporter_email', e.target.value)} />
                  </Field>
                  <Field label="Report by" required>
                    <input type="text" className="jm-input" placeholder="Full name"
                      value={form.report_by} onChange={(e) => set('report_by', e.target.value)} />
                  </Field>
                </div>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 2}>
              <Section title="Flight">
                <div className="jm-grid-2">
                  <Field label="Date of event" required>
                    <input type="date" className="jm-input"
                      value={form.date_of_event} onChange={(e) => set('date_of_event', e.target.value)} />
                  </Field>
                  <Field label="Flight number" required>
                    <input type="text" className="jm-input" placeholder="e.g. GA 152"
                      value={form.flight_number} onChange={(e) => set('flight_number', e.target.value)} />
                  </Field>
                </div>
                <Field label="Airlines" required>
                  <Options options={JOUMPA_AIRLINES} value={form.airlines} onChange={(v) => set('airlines', v)}
                    allowOther otherValue={form.airlines_other} onOtherChange={(v) => set('airlines_other', v)} />
                </Field>
                <div className="jm-grid-2">
                  <Field label="Station" required hint="e.g. CGK, UPG, DPS">
                    <select className="jm-input jm-select"
                      value={form.station_id} onChange={(e) => set('station_id', e.target.value)}>
                      <option value="">Select station</option>
                      {stations.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Route" required>
                    <input type="text" className="jm-input" placeholder="e.g. CGK → DPS"
                      value={form.route} onChange={(e) => set('route', e.target.value)} />
                  </Field>
                </div>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 3}>
              <Section title="Classification">
                <Field label="Category report" required>
                  <Options options={JOUMPA_CATEGORY_REPORT} value={form.category_report} onChange={(v) => set('category_report', v)} />
                </Field>
                <Field label="Customer" required>
                  <Options options={JOUMPA_CUSTOMER} value={form.customer_joumpa} onChange={(v) => set('customer_joumpa', v)} />
                </Field>

                {isCorporate && (
                  <div className="jm-nested">
                    <Field label="Corporate type" required>
                      <Options options={JOUMPA_CORPORATE_TYPES} value={form.corporate} onChange={(v) => set('corporate', v)}
                        allowOther otherValue={form.corporate_other} onOtherChange={(v) => set('corporate_other', v)} />
                    </Field>
                    <Field label="Company profile" required hint="e.g. DPR RI Komisi V, Hotel Hyatt, RS Mandaya">
                      <input type="text" className="jm-input"
                        value={form.customer_company_profile_corporate} onChange={(e) => set('customer_company_profile_corporate', e.target.value)} />
                    </Field>
                    <Field label="Detail customer" required hint="e.g. Liza Ananda (passenger name)">
                      <input type="text" className="jm-input"
                        value={form.detail_customer_corporate} onChange={(e) => set('detail_customer_corporate', e.target.value)} />
                    </Field>
                  </div>
                )}

                {isNonCorporate && (
                  <div className="jm-nested">
                    <Field label="Non-corporate type" required>
                      <Options options={JOUMPA_NON_CORPORATE_TYPES} value={form.non_corporate} onChange={(v) => set('non_corporate', v)} />
                    </Field>
                    <Field label="Customer background" required>
                      <Options options={JOUMPA_CUSTOMER_BACKGROUND} value={form.customer_background_non_corporate} onChange={(v) => set('customer_background_non_corporate', v)}
                        allowOther otherValue={form.customer_background_other} onOtherChange={(v) => set('customer_background_other', v)} />
                    </Field>
                    <Field label="Detail customer" required hint="e.g. Liza — Lombok (name — domicile)">
                      <input type="text" className="jm-input"
                        value={form.detail_customer_non_corporate} onChange={(e) => set('detail_customer_non_corporate', e.target.value)} />
                    </Field>
                  </div>
                )}
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 4}>
              <Section title="Case">
                <Field label="Category case" required>
                  <Options options={JOUMPA_CATEGORY_CASE} value={form.category_case_joumpa} onChange={(v) => set('category_case_joumpa', v)} variant="list" />
                </Field>
                <Field label="Report" required hint="Report detail or service feedback">
                  <textarea className="jm-input jm-textarea" rows={3}
                    value={form.report} onChange={(e) => set('report', e.target.value)} />
                </Field>
                <Field label="Root cause" required>
                  <textarea className="jm-input jm-textarea" rows={2}
                    value={form.root_caused} onChange={(e) => set('root_caused', e.target.value)} />
                </Field>
                <Field label="Action taken" required>
                  <textarea className="jm-input jm-textarea" rows={2}
                    value={form.action_taken} onChange={(e) => set('action_taken', e.target.value)} />
                </Field>
                <Field label="Preventive action" required>
                  <textarea className="jm-input jm-textarea" rows={2}
                    value={form.preventive_action} onChange={(e) => set('preventive_action', e.target.value)} />
                </Field>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 5}>
              <Section title="Priority">
                <Field label="Severity" required>
                  <Options options={JOUMPA_SEVERITY_LEVELS} value={form.severity_level} onChange={(v) => set('severity_level', v)} />
                </Field>
                <Field label="Status" required>
                  <Options options={JOUMPA_STATUSES} value={form.status} onChange={(v) => set('status', v)} />
                </Field>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 6}>
              <Section
                title={<>Evidence<span className="jm-req" aria-hidden>*</span></>}
                subtitle={`At least 1 photo required — up to ${MAX_FILES} images, 10 MB each`}
              >
                <label className={cn('jm-drop', files.length >= MAX_FILES && 'jm-drop--full')}>
                  <Upload size={20} strokeWidth={1.6} />
                  <span className="jm-drop__title">Add photos</span>
                  <span className="jm-drop__hint">Click to select images</span>
                  <input type="file" multiple accept="image/*" className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                    disabled={files.length >= MAX_FILES} />
                </label>
                {files.length === 0 && (
                  <p className="jm-evidence-required-msg">At least one photo is required to submit this report.</p>
                )}
                {files.length > 0 && (
                  <ul className="jm-files">
                    {files.map((file, i) => (
                      <li key={i} className="jm-file">
                        <span className="jm-file__name">{file.name}</span>
                        <span className="jm-file__size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                          className="jm-file__remove" aria-label={`Remove ${file.name}`}>
                          <X size={14} strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </WizardStep>
          </div>

          <div className="jm-footer">
            <StepFooter
              onBack={() => setStep((s) => Math.max(s - 1, 1))}
              backDisabled={step === 1 || loading}
              isLast={step === TOTAL_STEPS}
              onNext={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS))}
              nextDisabled={!stepValid(step) || loading}
              submitting={loading}
            />
          </div>
        </form>
  );

  if (inline) {
    return <InlineShell ariaLabel="JOUMPA Report">{body}</InlineShell>;
  }
  return (
    <FormShell onClose={onClose ?? (() => {})} ariaLabel="JOUMPA Report" wide={step === 7}>
      {body}
    </FormShell>
  );
}
