'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIRLINES } from '@/lib/constants/airlines';
import { AREA_CATEGORIES, AREA_LABELS, GSE_EQUIPMENT, GSE_TYPES } from '@/lib/constants/incident-areas';
import { ROOT_CAUSE_CLASSIFICATIONS, getAirlineType, getHubForStation, getWeekInMonth, type DocEdits } from './wizard-shared';
import { WizardStep } from '@/components/ui/WizardStep';
import { Field, FormShell, InlineShell, Options, Section, StepFooter, StepProgress, compressImage, resolveOther, toLocalDateInput } from './apple-form-shell';
import DocumentEditorStep from './DocumentEditorStep';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TOTAL_STEPS = 6;

const AIRLINE_OTHER = 'Other';
const AREAS = ['TERMINAL', 'APRON', 'GSE', 'CARGO', 'GENERAL'] as const;
type AreaKey = typeof AREAS[number];

const SEVERITIES = ['TOP RISK', 'HIGH RISK', 'MEDIUM', 'LOW'] as const;

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
  reporter_email: string;
  reporter_name: string;
  incident_date: string;
  airline: string; airline_other: string;
  flight_number: string;
  station_id: string;
  route: string;
  delay_code: string;
  area: AreaKey | '';
  area_category: string; area_category_other: string;
  gse_type: string;
  gse_equipment: string; gse_equipment_other: string;
  description: string;
  root_cause: string;
  root_cause_classification: string; root_cause_classification_other: string;
  action_taken: string;
  preventive_action: string;
  severity: string;
}

const EMPTY: Form = {
  reporter_email: '', reporter_name: '',
  incident_date: toLocalDateInput(new Date()),
  airline: '', airline_other: '',
  flight_number: '', station_id: '', route: '', delay_code: '',
  area: '', area_category: '', area_category_other: '',
  gse_type: '', gse_equipment: '', gse_equipment_other: '',
  description: '', root_cause: '',
  root_cause_classification: '', root_cause_classification_other: '',
  action_taken: '', preventive_action: '',
  severity: 'MEDIUM',
};

export default function PublicIrregularityForm({
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
    reporter_name: defaultReporterName || '',
    reporter_email: defaultReporterEmail || '',
  }));
  const [stations, setStations] = useState<Station[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [docEdits, setDocEdits] = useState<DocEdits | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [createdReportData, setCreatedReportData] = useState<unknown>(null);
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
      reporter_name: p.reporter_name || defaultReporterName || '',
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

  const isGse = form.area === 'GSE';
  const areaCategoryOptions = useMemo(() => (form.area ? AREA_CATEGORIES[form.area] || [] : []), [form.area]);
  const rootClassOptions = useMemo(() => (form.area ? ROOT_CAUSE_CLASSIFICATIONS[form.area] || [] : []), [form.area]);
  const gseEquipmentOptions = useMemo(() => {
    if (form.gse_type === 'GSE MOTORIZED' || form.gse_type === 'GSE NON - MOTORIZED') {
      return GSE_EQUIPMENT[form.gse_type as keyof typeof GSE_EQUIPMENT];
    }
    return [];
  }, [form.gse_type]);

  const stepValid = (n: number): boolean => {
    switch (n) {
      case 1:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reporter_email.trim()) && !!form.reporter_name.trim();
      case 2:
        return !!(form.incident_date && resolveOther(form.airline, form.airline_other) &&
          form.flight_number.trim() && form.station_id && form.route.trim());
      case 3: {
        if (!form.area) return false;
        const categoryOk = isGse
          ? !!(form.gse_type && resolveOther(form.gse_equipment, form.gse_equipment_other) &&
              resolveOther(form.area_category, form.area_category_other))
          : !!resolveOther(form.area_category, form.area_category_other);
        if (!categoryOk) return false;
        if (rootClassOptions.length > 0) return !!resolveOther(form.root_cause_classification, form.root_cause_classification_other);
        return true;
      }
      case 4:
        return !!(form.description.trim() && form.root_cause.trim() && form.action_taken.trim() && form.preventive_action.trim());
      case 5:
        return !!form.severity;
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
      if (next.length >= MAX_FILES) { setError(`Only ${MAX_FILES} images allowed; extra files were skipped.`); break; }
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
      fd.append('reporter_name', form.reporter_name.trim());
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

  const buildDocEdits = (stationCode: string, airlineValue: string): DocEdits => {
    const eventDate = new Date(form.incident_date);
    const month = eventDate.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const year = eventDate.getFullYear();
    return {
      reference_no: `CABANG ${stationCode}/LK/       /       / ${month}/${year}`,
      to: `SQC ${airlineValue} on duty`,
      from: 'GAPURA OPERATION STAFF',
      cc: '',
      subject: `${airlineValue} ${form.flight_number.trim()} - Irregularity`,
      attachment: files.length > 0 ? `${files.length} Files` : '',
      incident_date: form.incident_date,
      branch: stationCode,
      flight_number: form.flight_number.trim(),
      aircraft_reg: '-',
      route: form.route.trim(),
      std_atd: '', pax: '', bge: '', gate_stand: '-',
      delay: form.delay_code.trim() || '-',
      officers: [{ name: form.reporter_name.trim(), company: 'Gapura Angkasa', function: 'Reporter' }],
      chronology: [{ time: '', description: form.description.trim() }],
      root_cause: form.root_cause.trim(),
      action_taken: form.action_taken.trim(),
      preventive_action: form.preventive_action.trim(),
      reporter_name: form.reporter_name.trim(),
      reporter_title: 'Controller Operation Airside',
      doc_title: 'IRREGULARITY REPORT FORM',
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
      const stationCode = station?.code || form.station_id || '';
      const airlineValue = resolveOther(form.airline, form.airline_other);
      const areaCategoryValue = resolveOther(form.area_category, form.area_category_other);
      const gseEquipmentValue = resolveOther(form.gse_equipment, form.gse_equipment_other);
      const rootClassValue = resolveOther(form.root_cause_classification, form.root_cause_classification_other);
      const eventDate = new Date(form.incident_date);

      const payload = {
        incident_date: form.incident_date,
        airline: airlineValue,
        flight_number: form.flight_number.trim(),
        station_id: form.station_id,
        station: stationCode,
        station_code: stationCode,
        route: form.route.trim(),
        main_category: 'Irregularity',
        category: 'Irregularity',
        delay_code: form.delay_code.trim(),
        area: form.area,
        area_category: areaCategoryValue,
        incident_type_id: areaCategoryValue,
        gse_type: isGse ? form.gse_type : '',
        gse_equipment: isGse ? gseEquipmentValue : '',
        gse_available_requirement: isGse ? form.gse_type : undefined,
        gse_motorized: form.gse_type === 'GSE MOTORIZED' ? gseEquipmentValue : undefined,
        gse_non_motorized: form.gse_type === 'GSE NON - MOTORIZED' ? gseEquipmentValue : undefined,
        category_case_gse: isGse ? areaCategoryValue : undefined,
        terminal_area_category: form.area === 'TERMINAL' ? areaCategoryValue : undefined,
        apron_area_category: form.area === 'APRON' ? areaCategoryValue : undefined,
        general_category: form.area === 'GENERAL' ? areaCategoryValue : undefined,
        category_case_cargo: form.area === 'CARGO' ? areaCategoryValue : undefined,
        description: form.description.trim(),
        report: form.description.trim(),
        root_cause: form.root_cause.trim(),
        root_cause_classification: rootClassValue,
        case_classification: rootClassValue || null,
        action_taken: form.action_taken.trim(),
        preventive_action: form.preventive_action.trim(),
        severity: form.severity,
        reporter_name: form.reporter_name.trim(),
        reporter_email: form.reporter_email.trim(),
        evidence_urls: urls,
        evidence_url: urls[0],
        evidence_file_ids: ids,
        evidence_submission_id: submissionId,
        quick_access_session_id: quickAccessSessionId,
        title: `${airlineValue} ${form.flight_number.trim()} - Irregularity`,
        hub: getHubForStation(stationCode),
        jenis_maskapai: getAirlineType(form.airline),
        reporting_branch: stationCode,
        week_in_month: getWeekInMonth(eventDate),
        form_submitted_at: new Date().toISOString(),
        form_completed_at: new Date().toISOString(),
      };

      const submitUrl = mode === 'public' ? '/api/reports/public' : '/api/reports';
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        await res.text();
        throw new Error('Invalid server response. Please try again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit report');

      const reportId = data?.data?.id || data?.data?.original_id || data?.data?.sheet_id;
      setCreatedReportId(reportId ? String(reportId) : null);
      setDocumentFinalizationToken(
        typeof data?.document_finalization_token === 'string'
          ? data.document_finalization_token
          : null,
      );
      const createdData = { ...data };
      delete createdData.document_finalization_token;
      setCreatedReportData(createdData);
      setDocEdits(buildDocEdits(stationCode, airlineValue));
      setStep(7);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit irregularity report');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onSubmitted) { onSubmitted(createdReportData); return; }
    if (onClose) { onClose(); return; }
    setStep(1);
    setForm({ ...EMPTY, reporter_name: defaultReporterName || '', reporter_email: defaultReporterEmail || '' });
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
          reportType="IRREGULARITY"
          reportId={createdReportId}
          finalizationToken={documentFinalizationToken}
        />
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="jm-form" noValidate>
          <div className="jm-scroll">
            <div className="jm-head">
              <h1 className="jm-title">Irregularity Report</h1>
              <p className="jm-sub">File an operational irregularity, damage, or incident.</p>
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
                  <Field label="Full name" required>
                    <input type="text" className="jm-input" placeholder="Reporter name"
                      value={form.reporter_name} onChange={(e) => set('reporter_name', e.target.value)} />
                  </Field>
                </div>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 2}>
              <Section title="Flight">
                <div className="jm-grid-2">
                  <Field label="Date of event" required>
                    <input type="date" className="jm-input"
                      value={form.incident_date} onChange={(e) => set('incident_date', e.target.value)} />
                  </Field>
                  <Field label="Flight number" required>
                    <input type="text" className="jm-input" placeholder="e.g. GA 152"
                      value={form.flight_number} onChange={(e) => set('flight_number', e.target.value)} />
                  </Field>
                </div>
                <Field label="Airline" required>
                  <select className="jm-input jm-select"
                    value={form.airline} onChange={(e) => set('airline', e.target.value)}>
                    <option value="">Select airline</option>
                    {AIRLINES.map((a) => <option key={a.code} value={a.name}>{a.name} ({a.code})</option>)}
                  </select>
                  {form.airline === AIRLINE_OTHER && (
                    <input type="text" className="jm-input jm-input--nested"
                      placeholder="Please specify airline"
                      value={form.airline_other} onChange={(e) => set('airline_other', e.target.value)} />
                  )}
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
                <Field label="Delay code" hint="Optional — enter if flight was delayed">
                  <input type="text" className="jm-input" placeholder="e.g. 41 / 00:15"
                    value={form.delay_code} onChange={(e) => set('delay_code', e.target.value)} />
                </Field>
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 3}>
              <Section title="Location">
                <Field label="Area" required>
                  <Options
                    options={[...AREAS] as string[]}
                    value={form.area}
                    onChange={(v) => setForm((p) => ({ ...p, area: v as AreaKey, area_category: '', area_category_other: '', gse_type: '', gse_equipment: '', gse_equipment_other: '', root_cause_classification: '', root_cause_classification_other: '' }))}
                    getLabel={(v) => AREA_LABELS[v as AreaKey] ?? v}
                  />
                </Field>

                {form.area && !isGse && (
                  <Field label="Category" required>
                    <Options
                      options={areaCategoryOptions}
                      value={form.area_category}
                      onChange={(v) => set('area_category', v)}
                      allowOther={false}
                      variant="list"
                    />
                    {form.area_category === 'Other' && (
                      <input type="text" className="jm-input jm-input--nested"
                        placeholder="Please specify"
                        value={form.area_category_other} onChange={(e) => set('area_category_other', e.target.value)} />
                    )}
                  </Field>
                )}

                {isGse && (
                  <div className="jm-nested">
                    <Field label="GSE type" required>
                      <Options options={[...GSE_TYPES] as string[]}
                        value={form.gse_type}
                        onChange={(v) => setForm((p) => ({ ...p, gse_type: v, gse_equipment: '', gse_equipment_other: '' }))} />
                    </Field>
                    {form.gse_type && (
                      <Field label="Equipment" required>
                        <Options options={gseEquipmentOptions}
                          value={form.gse_equipment}
                          onChange={(v) => set('gse_equipment', v)}
                          variant="list" />
                        {form.gse_equipment === 'Other' && (
                          <input type="text" className="jm-input jm-input--nested"
                            placeholder="Please specify equipment"
                            value={form.gse_equipment_other} onChange={(e) => set('gse_equipment_other', e.target.value)} />
                        )}
                      </Field>
                    )}
                    <Field label="Case category" required>
                      <Options options={areaCategoryOptions}
                        value={form.area_category}
                        onChange={(v) => set('area_category', v)}
                        variant="list" />
                      {form.area_category === 'Other' && (
                        <input type="text" className="jm-input jm-input--nested"
                          placeholder="Please specify"
                          value={form.area_category_other} onChange={(e) => set('area_category_other', e.target.value)} />
                      )}
                    </Field>
                  </div>
                )}

                {rootClassOptions.length > 0 && (
                  <Field label="Root cause classification" required>
                    <Options options={rootClassOptions}
                      value={form.root_cause_classification}
                      onChange={(v) => set('root_cause_classification', v)}
                      variant="list" />
                    {form.root_cause_classification === 'Other' && (
                      <input type="text" className="jm-input jm-input--nested"
                        placeholder="Please specify"
                        value={form.root_cause_classification_other}
                        onChange={(e) => set('root_cause_classification_other', e.target.value)} />
                    )}
                  </Field>
                )}
              </Section>
            </WizardStep>

            <WizardStep isActive={step === 4}>
              <Section title="Case">
                <Field label="Report" required hint="What happened?">
                  <textarea className="jm-input jm-textarea" rows={3}
                    value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
                <Field label="Root cause" required>
                  <textarea className="jm-input jm-textarea" rows={2}
                    value={form.root_cause} onChange={(e) => set('root_cause', e.target.value)} />
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
                  <Options options={[...SEVERITIES] as string[]}
                    value={form.severity}
                    onChange={(v) => set('severity', v)} />
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
    return <InlineShell ariaLabel="Irregularity Report">{body}</InlineShell>;
  }
  return (
    <FormShell onClose={onClose ?? (() => {})} ariaLabel="Irregularity Report" wide={step === 7}>
      {body}
    </FormShell>
  );
}
