'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Plane, AlertTriangle, Link as LinkIcon, ClipboardList, Tag, FileText, Route, Building2, ChevronDown, ChevronUp, CalendarDays, CheckCircle, Edit3, Loader } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Report } from '@/types';
import { normalizeSeverityLevel } from '@/lib/constants/report-status';
import { StatusUpdateSuccessDialog } from '@/components/dashboard/StatusUpdateSuccessDialog';

interface DrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: DrawerRecord[];
}

type DrawerRecord = Report & Record<string, unknown>;

type StatusFormState = {
  status: string;
  finalRemarks: string;
  remarksBy: string;
  loading: boolean;
  success: boolean;
  error: string;
};

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
];

type RiskDrawerFilter = 'TOP RISK' | 'HIGH RISK';

function getSeverity(record: DrawerRecord): string {
  return normalizeSeverityLevel(
    record?.severity_level
    || record?.['Severity Level']
    || record?.Severity_Level
    || record?.severity
  );
}

export function DrilldownDrawer({ isOpen, onClose, title, data }: DrilldownDrawerProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [statusForms, setStatusForms] = useState<Record<string, StatusFormState>>({});
  const [showStatusForm, setShowStatusForm] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<{ rowKey: string; status: string } | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskDrawerFilter>('TOP RISK');

  const isRiskSelectorDrawer = /top risk/i.test(title) && /high risk/i.test(title);
  const riskCounts = useMemo(() => {
    return data.reduce(
      (counts, record) => {
        const severity = getSeverity(record);
        if (severity === 'TOP RISK') counts.topRisk += 1;
        if (severity === 'HIGH RISK') counts.highRisk += 1;
        return counts;
      },
      { topRisk: 0, highRisk: 0 }
    );
  }, [data]);
  const activeRiskFilter = riskFilter === 'TOP RISK' && riskCounts.topRisk === 0 && riskCounts.highRisk > 0
    ? 'HIGH RISK'
    : riskFilter;
  const visibleData = useMemo(() => {
    if (!isRiskSelectorDrawer) return data;
    return data.filter((record) => {
      const severity = getSeverity(record);
      if (activeRiskFilter === 'TOP RISK') return severity === 'TOP RISK';
      return severity === 'HIGH RISK';
    });
  }, [activeRiskFilter, data, isRiskSelectorDrawer]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (statusUpdateSuccess) {
        setStatusUpdateSuccess(null);
        setShowStatusForm((previous) => ({ ...previous, [statusUpdateSuccess.rowKey]: false }));
        setStatusForms((previous) => ({ ...previous, [statusUpdateSuccess.rowKey]: { ...previous[statusUpdateSuccess.rowKey], success: false } }));
        return;
      }
      onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, statusUpdateSuccess]);

  const getText = (record: DrawerRecord, keys: string[], fallback = '-'): string => {
    for (const key of keys) {
      const value = record?.[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'object') continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return fallback;
  };

  const getStation = (record: DrawerRecord): string => {
    const nestedStation = record?.stations;
    if (nestedStation && typeof nestedStation === 'object' && 'code' in nestedStation) {
      const code = String((nestedStation as { code?: unknown }).code || '').trim();
      if (code) return code.toUpperCase();
    }
    return getText(record, ['station_code', 'Station', 'Station', 'branch', 'reporting_branch', 'kode_cabang'], 'N/A').toUpperCase();
  };

  const formatDate = (rawDate: string): string => {
    if (!rawDate || rawDate === '-') return '-';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getUrlList = (record: DrawerRecord, keys: string[]): string[] => {
    for (const key of keys) {
      const value = record?.[key];
      if (Array.isArray(value)) {
        const urls = value.map(v => String(v).trim()).filter(v => v.startsWith('http'));
        if (urls.length > 0) return urls;
      }
      if (typeof value === 'string') {
        const urls = value.split(/\s*[;|\n,]\s*/).map(v => v.trim()).filter(v => v.startsWith('http'));
        if (urls.length > 0) return urls;
      }
    }
    return [];
  };

  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  const toggleStatusForm = (rowKey: string, currentStatus: string) => {
    setShowStatusForm(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
    if (!statusForms[rowKey]) {
      setStatusForms(prev => ({
        ...prev,
        [rowKey]: { status: currentStatus.toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN', finalRemarks: '', remarksBy: '', loading: false, success: false, error: '' },
      }));
    }
  };

  const updateStatusForm = (rowKey: string, field: keyof StatusFormState, value: string) => {
    setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: value, error: '' } }));
  };

  const submitStatusUpdate = async (rowKey: string, reportId: string) => {
    const form = statusForms[rowKey];
    if (!form) return;

    if (!form.finalRemarks.trim()) {
      setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], error: 'Final remarks are required before changing status.' } }));
      return;
    }
    if (!form.remarksBy.trim()) {
      setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], error: 'Remarks by is required before changing status.' } }));
      return;
    }

    setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], loading: true, error: '' } }));
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status: form.status,
          final_remarks: form.finalRemarks,
          kps_remarks: form.finalRemarks,
          remarks_by: form.remarksBy,
        }),
      });
      if (res.ok) {
        setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], loading: false, success: true } }));
        setStatusOverrides((previous) => ({ ...previous, [rowKey]: form.status }));
        setStatusUpdateSuccess({ rowKey, status: form.status });
      } else {
        const payload = await res.json().catch(() => null) as { error?: unknown } | null;
        const apiError = typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Failed to update status. Try again.';
        setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], loading: false, error: apiError } }));
      }
    } catch {
      setStatusForms(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], loading: false, error: 'Connection error.' } }));
    }
  };

  const getStatusTone = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('resolved')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (normalized.includes('open') || normalized.includes('pending') || normalized.includes('progress')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getAreaChipTone = (label: string) => {
    const normalized = label.toLowerCase();
    if (normalized === 'terminal') return { wrap: 'bg-sky-50 border-sky-200', label: 'text-sky-700', value: 'text-sky-900' };
    if (normalized === 'apron') return { wrap: 'bg-violet-50 border-violet-200', label: 'text-violet-700', value: 'text-violet-900' };
    if (normalized === 'general') return { wrap: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-700', value: 'text-emerald-900' };
    return { wrap: 'bg-slate-50 border-slate-200', label: 'text-slate-600', value: 'text-slate-800' };
  };

  const getCategoryChipTone = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('complaint') || normalized.includes('complain')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (normalized.includes('accident') || normalized.includes('incident')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (normalized.includes('delay')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (normalized.includes('damage') || normalized.includes('baggage')) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-violet-50 text-violet-700 border-violet-200';
  };

  // Portal to <body> so `position: fixed` escapes any ancestor with
  // transform/filter/will-change (which creates a new containing block and
  // clips the backdrop to the main content — leaving header/sidebar uncovered).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 2147483000,
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          />

          {}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="px-4 sm:px-6 md:px-10 lg:px-[max(16px,10%)] 2xl:px-[max(16px,20%)]"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 2147483000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '16px',
              paddingBottom: '16px',
              pointerEvents: 'none',
            }}
          >
            <div
              className="pointer-events-auto flex w-full max-w-[1140px] flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.22),0_0_0_1px_rgba(255,255,255,0.8)_inset]"
              style={{ maxHeight: 'min(88vh, 860px)', pointerEvents: 'auto' }}
            >
              {}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-7 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <ClipboardList size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-black text-slate-900 tracking-tight leading-none">{title}</h3>
                    <p className="text-[13px] font-medium text-slate-500 mt-0.5">{visibleData.length} records found</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8f9fb]">
                {isRiskSelectorDrawer && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'TOP RISK' as const, label: 'Top Risk', count: riskCounts.topRisk },
                        { value: 'HIGH RISK' as const, label: 'High Risk', count: riskCounts.highRisk },
                      ].map((option) => {
                        const active = activeRiskFilter === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRiskFilter(option.value)}
                            className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                              active
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                            aria-pressed={active}
                          >
                            <span className="text-[12px] font-black uppercase tracking-[0.14em]">{option.label}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${active ? 'bg-white/15 text-white' : 'bg-white text-slate-700'}`}>
                              {option.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {visibleData.map((record, idx) => {
                  const rowKey = String(record?.id || record?.original_id || idx);
                  const isExpanded = !!expandedRows[rowKey];
                  const isStatusOpen = !!showStatusForm[rowKey];
                  const form = statusForms[rowKey];

                  const station = getStation(record);
                  const airline = getText(record, ['Airlines', 'airlines', 'airline', 'maskapai_lookup'], 'Unknown Airline');
                  const classification = getText(record, ['case_classification', 'Case Classification', 'Case_Classification', 'case_category', 'remarks_case', 'category_case_gse', 'category_case_joumpa', 'category_case_cargo', 'terminal_area_category', 'apron_area_category', 'general_category'], 'N/A');
                  const category = getText(record, ['category', 'main_category', 'case_category', 'irregularity_complain_category', 'Category'], 'N/A');
                  const identificationOfRoot = getText(record, ['identification_of_root', 'Identification of Root', 'Identification_of_Root', 'root_caused', 'root_cause', 'issue_caused', 'breakdown_caused'], '-');
                  const rootCaused = getText(record, ['root_caused', 'root_cause', 'Root Cause', 'Root Caused', 'Root_Caused', 'breakdown_caused', 'issue_caused'], '-');
                  const reportText = getText(record, ['report', 'description', 'Report', 'title'], '-');
                  const terminalAreaCategory = getText(record, ['terminal_area_category', 'Terminal Area Category', 'Terminal_Area_Category']);
                  const apronAreaCategory = getText(record, ['apron_area_category', 'Apron Area Category', 'Apron_Area_Category']);
                  const generalAreaCategory = getText(record, ['general_category', 'General Category', 'General_Category']);
                  const areaCategoryItems = [
                    { label: 'Terminal', value: terminalAreaCategory },
                    { label: 'Apron', value: apronAreaCategory },
                    { label: 'General', value: generalAreaCategory },
                  ].filter(item => item.value !== '-');
                  const flightNumber = getText(record, ['flight_number', 'Flight Number', 'Flight_Number', 'No Penerbangan']);
                  const route = getText(record, ['route', 'Route']);
                  const eventDate = getText(record, ['date_of_event', 'Date of Event', 'Date_of_Event', 'created_at']);
                  const eventDateLabel = formatDate(eventDate);
                  const hub = getText(record, ['hub', 'HUB', 'kode_hub']);
                  const status = statusOverrides[rowKey] ?? getText(record, ['status', 'Status']);
                  const delayCode = getText(record, ['delay_code', 'Delay Code', 'Delay_Code']);
                  const actionTaken = getText(record, ['action_taken', 'Action Taken', 'Action_Taken'], '-');
                  const preventiveAction = getText(record, ['preventive_action', 'Preventive Action', 'Preventive_Action'], '-');
                  const finalRemarks = getText(record, ['final_remarks', 'Final Remarks', 'Final_Remarks', 'kps_remarks', 'Gapura_KPS_Remarks', 'Gapura KPS Remarks', 'KPS Remarks']);
                  const evidenceUrls = getUrlList(record, ['evidence_urls', 'evidence', 'evidence_url', 'Link Evidence', 'Upload Irregularity Photo']);
                  const supportingUrls = getUrlList(record, ['supporting_urls', 'Supporting Evidence', 'supporting_evidence', 'supportingEvidence']);

                  return (
                    <div
                      key={rowKey}
                      className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)] overflow-hidden"
                    >
                      {}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-slate-50/80 to-white">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <CalendarDays size={11} strokeWidth={2.5} />
                            {eventDateLabel}
                          </div>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            <MapPin size={11} strokeWidth={2.5} />
                            {station}
                          </div>
                          {hub !== '-' && (
                            <>
                              <span className="text-slate-300">·</span>
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                <Building2 size={11} strokeWidth={2.5} />
                                {hub}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getStatusTone(status)}`}>
                            {status}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleStatusForm(rowKey, status)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                            title="Change report status"
                          >
                            <Edit3 size={11} strokeWidth={2.5} />
                            Change Status
                          </button>
                        </div>
                      </div>

                      {}
                      <AnimatePresence initial={false}>
                        {isStatusOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden border-b border-slate-100"
                          >
                            {form?.success ? (
                              <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4 text-emerald-700">
                                <CheckCircle size={18} strokeWidth={2} />
                                <span className="text-sm font-bold">Status updated.</span>
                              </div>
                            ) : (
                              <div className="bg-slate-50/80 px-5 py-4 space-y-3">
                                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Update Report Status</div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">New Status <span className="text-rose-500">*</span></label>
                                    <select
                                      value={form?.status || status}
                                      onChange={(e) => updateStatusForm(rowKey, 'status', e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                      {STATUS_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Remarks By <span className="text-rose-500">*</span></label>
                                    <input
                                      type="text"
                                      placeholder="Division - Name"
                                      value={form?.remarksBy || ''}
                                      onChange={(e) => updateStatusForm(rowKey, 'remarksBy', e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => submitStatusUpdate(rowKey, String(record.id || record.original_id || ''))}
                                      disabled={form?.loading}
                                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 transition-all"
                                      style={{
                                        background: 'linear-gradient(to bottom, #10b981, #047857)',
                                        boxShadow: '0 2px 0 #064e3b, 0 3px 8px rgba(4,120,87,0.28)',
                                      }}
                                    >
                                      {form?.loading ? <Loader size={14} strokeWidth={2.5} className="animate-spin" /> : <CheckCircle size={14} strokeWidth={2.5} />}
                                      {form?.loading ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Final Remarks <span className="text-rose-500">*</span></label>
                                  <textarea
                                    rows={3}
                                    placeholder="Write final remarks before saving status."
                                    value={form?.finalRemarks || ''}
                                    onChange={(e) => updateStatusForm(rowKey, 'finalRemarks', e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
                                  />
                                </div>
                                {form?.error && (
                                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                                    <AlertTriangle size={14} strokeWidth={2} />
                                    {form.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {}
                      <div className="p-5">
                        {}
                        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                          {[
                            { icon: Plane, label: 'Airline', val: airline },
                            { icon: Route, label: 'Route', val: route },
                            { icon: Plane, label: 'Flight', val: flightNumber },
                          ].map(({ icon: Icon, label, val }) => (
                            <div key={label} className="min-w-0">
                              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                                <Icon size={9} strokeWidth={3} />
                                {label}
                              </div>
                              <div className="text-sm font-bold text-slate-800 leading-tight break-words">{val}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mb-4 flex min-w-0 flex-col gap-1.5">
                          <span className={`flex w-full min-w-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 font-bold leading-none ${getCategoryChipTone(category)}`}>
                            <span className="min-w-0 truncate text-[clamp(10px,1.25vw,12px)]">{category}</span>
                          </span>
                          {areaCategoryItems.map((item) => {
                            const tone = getAreaChipTone(item.label);
                            return (
                              <span key={item.label} className={`flex w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 leading-none ${tone.wrap}`}>
                                <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${tone.label}`}>{item.label}</span>
                                <span className={`min-w-0 truncate text-[clamp(10px,1.25vw,12px)] font-bold ${tone.value}`}>{item.value}</span>
                              </span>
                            );
                          })}
                        </div>

                        {}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                              <ClipboardList size={10} strokeWidth={3} />Case Classification
                            </div>
                            <div className="text-[13px] font-bold text-slate-700">{classification}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                              <AlertTriangle size={10} strokeWidth={3} />Identification of Root
                            </div>
                            <div className="text-[13px] font-bold text-slate-700">{identificationOfRoot}</div>
                          </div>
                        </div>

                        {}
                        {evidenceUrls.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {evidenceUrls.map((url, uIdx) => (
                              <a
                                key={uIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <LinkIcon size={11} strokeWidth={2.5} />
                                {evidenceUrls.length > 1 ? `Evidence ${uIdx + 1}` : 'Evidence'}
                              </a>
                            ))}
                          </div>
                        )}

                        {}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => toggleRow(rowKey)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider transition hover:bg-slate-50"
                          >
                            {isExpanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                            {isExpanded ? 'Hide detail' : 'View full detail'}
                          </button>
                        </div>

                        {}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 space-y-2.5">
                                {[
                                  { label: 'Delay Code', value: delayCode, icon: Tag },
                                  { label: 'Final Remarks', value: finalRemarks, icon: FileText },
                                  { label: 'Root Caused', value: rootCaused, icon: AlertTriangle },
                                  { label: 'Report / Deskripsi', value: reportText, icon: FileText },
                                  { label: 'Action Taken', value: actionTaken, icon: CheckCircle },
                                  { label: 'Preventive Action', value: preventiveAction, icon: CheckCircle },
                                ].map(({ label, value, icon: Icon }) => (
                                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                                      <Icon size={10} strokeWidth={3} />
                                      {label}
                                    </div>
                                    <div className="text-[13px] leading-relaxed text-slate-700">{value}</div>
                                  </div>
                                ))}
                                {supportingUrls.length > 0 && (
                                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 mb-2">
                                      <FileText size={10} strokeWidth={3} />Supporting Evidence
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {supportingUrls.map((url, sIdx) => (
                                        <a key={sIdx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 border border-violet-200 px-3 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100">
                                          <LinkIcon size={11} strokeWidth={2.5} />
                                          {supportingUrls.length > 1 ? `Doc ${sIdx + 1}` : 'Document'}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}

                {visibleData.length === 0 && (
                  <div className="py-20 text-center flex flex-col items-center">
                    <div className="w-20 h-20 rounded-[32px] bg-slate-100 border border-slate-200 flex items-center justify-center mb-6 text-slate-300">
                      <AlertTriangle size={32} />
                    </div>
                    <div className="text-slate-500 font-bold text-lg">No reports found</div>
                    <div className="text-slate-400 text-sm mt-1">This segment has no detail data.</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <StatusUpdateSuccessDialog
            open={statusUpdateSuccess !== null}
            status={statusUpdateSuccess?.status ?? ''}
            onClose={() => {
              if (statusUpdateSuccess) {
                setShowStatusForm((previous) => ({ ...previous, [statusUpdateSuccess.rowKey]: false }));
                setStatusForms((previous) => ({ ...previous, [statusUpdateSuccess.rowKey]: { ...previous[statusUpdateSuccess.rowKey], success: false } }));
              }
              setStatusUpdateSuccess(null);
            }}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
