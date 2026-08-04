'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, FileText, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import {
  generatePDF,
  generateWord,
} from '@/lib/utils/document-generator';
import type { DocEdits, TextDocEditKey } from './wizard-shared';
import { finalizeReportDocuments } from '@/lib/report-documents-client';
import type { ReportDocumentType } from '@/lib/report-document-contract';

interface Props {
  docEdits: DocEdits;
  setDocEdits: React.Dispatch<React.SetStateAction<DocEdits>>;
  onFinish: () => void | Promise<void>;
  reportType: ReportDocumentType;
  reportId?: string | null;
  finalizationToken?: string | null;
}

const FLIGHT_FIELDS_LEFT: Array<{ label: string; key: TextDocEditKey }> = [
  { label: 'Date Of Occurrence', key: 'incident_date' },
  { label: 'Branch', key: 'branch' },
  { label: 'Flight Number', key: 'flight_number' },
  { label: 'Aircraft Registration', key: 'aircraft_reg' },
  { label: 'Route', key: 'route' },
];

const FLIGHT_FIELDS_RIGHT: Array<{ label: string; key: TextDocEditKey }> = [
  { label: 'STD/ATD', key: 'std_atd' },
  { label: 'PAX', key: 'pax' },
  { label: 'BGE', key: 'bge' },
  { label: 'Gate/Parking Stand', key: 'gate_stand' },
  { label: 'Delay (Code/Duration)*', key: 'delay' },
];

const NARRATIVE_SECTIONS: Array<{ title: string; key: TextDocEditKey }> = [
  { title: 'IV. POTENTIAL/ROOT CAUSE(S)', key: 'root_cause' },
  { title: 'V. CORRECTIVE ACTION(S)', key: 'action_taken' },
  { title: 'VI. PREVENTIVE ACTION(S)', key: 'preventive_action' },
];

export default function DocumentEditorStep({
  docEdits,
  setDocEdits,
  onFinish,
  reportType,
  reportId,
  finalizationToken,
}: Props) {
  const signatureRef = useRef<SignaturePadHandle | null>(null);
  const finalizingRef = useRef(false);
  const [exporting, setExporting] = useState<'pdf' | 'word' | 'finish' | null>(null);
  const [error, setError] = useState('');

  const set = <K extends TextDocEditKey>(key: K, value: string) => setDocEdits((prev) => ({ ...prev, [key]: value }));

  const handleExportPDF = async () => {
    setExporting('pdf');
    setError('');
    try {
      await generatePDF(docEdits, signatureRef.current?.getSignature() ?? null);
    } catch {
      setError('Failed to create PDF. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportWord = async () => {
    setExporting('word');
    setError('');
    try {
      const signature = signatureRef.current?.getSignature() ?? null;
      const prefix = (docEdits.doc_title || 'Report').replace(/[^a-zA-Z0-9]+/g, '_');
      const filename = `${prefix}_${docEdits.flight_number || 'Ref'}.docx`;
      await generateWord(docEdits, signature, { filename, download: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Word document.');
    } finally {
      setExporting(null);
    }
  };

  const handleFinish = async () => {
    if (finalizingRef.current) return;
    if (!reportId) {
      setError('The report ID is unavailable. Please keep this window open and try again.');
      return;
    }

    finalizingRef.current = true;
    setExporting('finish');
    setError('');
    try {
      await finalizeReportDocuments({
        reportId,
        reportType,
        editedSnapshot: docEdits,
        signatureDataUrl: signatureRef.current?.getSignature() ?? null,
        finalizationToken,
      });
      await onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save final report documents.');
    } finally {
      finalizingRef.current = false;
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-xl font-bold text-[var(--ink,#101013)]">Finalize document</h2>
        <p className="text-sm text-[var(--mute,#7c7c85)]">Edit the fields directly, sign, then export your copy.</p>

        {error && (
          <div className="jm-error mx-auto max-w-md" role="alert">
            <AlertTriangle size={15} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <button type="button" onClick={handleExportPDF} disabled={exporting !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-full text-sm font-bold shadow-md hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50">
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button type="button" onClick={handleExportWord} disabled={exporting !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
            {exporting === 'word' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {exporting === 'word' ? 'Saving Word…' : 'Download Word'}
          </button>
          <button type="button" onClick={handleFinish} disabled={exporting !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
            {exporting === 'finish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {exporting === 'finish' ? 'Saving final documents…' : 'Finish'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-slate-200 shadow-xl">
        <div className="min-w-[380px] sm:min-w-[640px] bg-white p-4 sm:p-8 text-slate-900">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gapura Logo" className="h-14 w-auto" />
            <h1 className="text-xl font-black tracking-tighter text-right">{docEdits.doc_title || 'IRREGULARITY REPORT FORM'}</h1>
          </div>

          <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[180px_1fr] border border-slate-900 mb-8 text-sm">
            {([
              ['REFERENCE NO', 'reference_no'],
              ['TO', 'to'],
              ['FROM', 'from'],
              ['CC', 'cc'],
              ['SUBJECT', 'subject'],
              ['ATTACHMENT', 'attachment'],
            ] satisfies Array<[string, TextDocEditKey]>).map(([label, key], i, arr) => (
              <div key={key} className="contents">
                <div className={`bg-slate-50 p-2 font-bold border-r ${i < arr.length - 1 ? 'border-b' : ''} border-slate-900`}>{label}</div>
                <div className={`p-2 ${i < arr.length - 1 ? 'border-b' : ''} border-slate-900`}>
                  <input className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                    value={docEdits[key]} onChange={(e) => set(key, e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-8">
            <h3 className="font-bold border-b-2 border-slate-900 mb-2">I. FLIGHT DATA</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 border border-slate-900 text-sm">
              <div className="sm:border-r border-b sm:border-b-0 border-slate-900">
                {FLIGHT_FIELDS_LEFT.map((field, i) => (
                  <div key={field.key} className={`grid grid-cols-[110px_1fr] sm:grid-cols-[180px_1fr] ${i < FLIGHT_FIELDS_LEFT.length - 1 ? 'border-b border-slate-300' : ''}`}>
                    <div className="bg-slate-50 p-1.5 font-semibold border-r border-slate-300">{field.label}</div>
                    <div className="p-1.5">
                      <input className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                        value={docEdits[field.key]} onChange={(e) => set(field.key, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                {FLIGHT_FIELDS_RIGHT.map((field, i) => (
                  <div key={field.key} className={`grid grid-cols-[110px_1fr] sm:grid-cols-[180px_1fr] ${i < FLIGHT_FIELDS_RIGHT.length - 1 ? 'border-b border-slate-300' : ''}`}>
                    <div className="bg-slate-50 p-1.5 font-semibold border-r border-slate-300">{field.label}</div>
                    <div className="p-1.5">
                      <input className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                        value={docEdits[field.key]} onChange={(e) => set(field.key, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center border-b-2 border-slate-900 mb-2">
              <h3 className="font-bold">II. OFFICER(S) ON DUTY</h3>
              <button type="button"
                onClick={() => setDocEdits((prev) => ({ ...prev, officers: [...prev.officers, { name: '', company: '', function: '' }] }))}
                className="text-xs flex items-center gap-1 text-emerald-600 font-bold">
                <PlusCircle className="w-3 h-3" /> Add Officer
              </button>
            </div>
            <table className="w-full border-collapse border border-slate-900 text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-900 p-1 w-10">NO</th>
                  <th className="border border-slate-900 p-1">NAME</th>
                  <th className="border border-slate-900 p-1">COMPANY</th>
                  <th className="border border-slate-900 p-1">FUNCTION</th>
                  <th className="border border-slate-900 p-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {docEdits.officers.map((officer, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-900 p-1 text-center">{idx + 1}</td>
                    {(['name', 'company', 'function'] as const).map((field) => (
                      <td key={field} className="border border-slate-900 p-1">
                        <input className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                          value={officer[field]}
                          onChange={(e) => setDocEdits((prev) => {
                            const officers = [...prev.officers];
                            officers[idx] = { ...officers[idx], [field]: e.target.value };
                            return { ...prev, officers };
                          })} />
                      </td>
                    ))}
                    <td className="border border-slate-900 p-1 text-center">
                      <button type="button" onClick={() => setDocEdits((prev) => ({ ...prev, officers: prev.officers.filter((_, i) => i !== idx) }))}
                        className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 3 - docEdits.officers.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border border-slate-900 p-1 text-center h-7">{docEdits.officers.length + i + 1}</td>
                    <td className="border border-slate-900 p-1" colSpan={3}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center border-b-2 border-slate-900 mb-2">
              <h3 className="font-bold">III. CHRONOLOGY OF EVENT</h3>
              <button type="button"
                onClick={() => setDocEdits((prev) => ({ ...prev, chronology: [...prev.chronology, { time: '', description: '' }] }))}
                className="text-xs flex items-center gap-1 text-emerald-600 font-bold">
                <PlusCircle className="w-3 h-3" /> Add Entry
              </button>
            </div>
            <table className="w-full border-collapse border border-slate-900 text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-900 p-1 w-32">TIME IN LOCAL</th>
                  <th className="border border-slate-900 p-1">DESCRIPTION / REMARK</th>
                  <th className="border border-slate-900 p-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {docEdits.chronology.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-900 p-1 text-center">
                      <input className="w-full bg-transparent border-none p-0 text-center focus:ring-0 focus:outline-none" placeholder="HH:mm"
                        value={entry.time}
                        onChange={(e) => setDocEdits((prev) => {
                          const chronology = [...prev.chronology];
                          chronology[idx] = { ...chronology[idx], time: e.target.value };
                          return { ...prev, chronology };
                        })} />
                    </td>
                    <td className="border border-slate-900 p-1">
                      <textarea className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none resize-none min-h-[50px]"
                        value={entry.description}
                        onChange={(e) => setDocEdits((prev) => {
                          const chronology = [...prev.chronology];
                          chronology[idx] = { ...chronology[idx], description: e.target.value };
                          return { ...prev, chronology };
                        })} />
                    </td>
                    <td className="border border-slate-900 p-1 text-center">
                      <button type="button" onClick={() => setDocEdits((prev) => ({ ...prev, chronology: prev.chronology.filter((_, i) => i !== idx) }))}
                        className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {NARRATIVE_SECTIONS.map((section) => (
            <div key={section.key} className="mb-6">
              <h3 className="font-bold border-b-2 border-slate-900 mb-2">{section.title}</h3>
              <div className="border border-slate-900 p-2 min-h-[70px] text-sm">
                <textarea className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none resize-none min-h-[54px]"
                  value={docEdits[section.key]} onChange={(e) => set(section.key, e.target.value)} />
              </div>
            </div>
          ))}

          <div className="mt-10 border border-slate-900 text-sm">
            <div className="grid grid-cols-2 border-b border-slate-900">
              <div className="p-2 border-r border-slate-900 flex items-center gap-2">
                <span className="font-bold">Location:</span>
                <input className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                  value={docEdits.branch} onChange={(e) => set('branch', e.target.value)} />
              </div>
              <div className="p-2 flex items-center gap-2">
                <span className="font-bold">Date of Prepared:</span>
                <input type="date" className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                  value={docEdits.incident_date} onChange={(e) => set('incident_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 h-48">
              <div className="border-r border-slate-900 p-2 flex flex-col items-center justify-between">
                <div className="font-bold">Prepared by,</div>
                <SignaturePad ref={signatureRef} width={220} height={70} />
                <div className="w-full text-center">
                  <input className="w-full bg-transparent border-none p-0 text-center focus:ring-0 focus:outline-none font-bold"
                    value={docEdits.reporter_name} onChange={(e) => set('reporter_name', e.target.value)} />
                  <input className="w-full bg-transparent border-none p-0 text-center text-[10px] focus:ring-0 focus:outline-none text-slate-500 uppercase"
                    value={docEdits.reporter_title} onChange={(e) => set('reporter_title', e.target.value)} />
                </div>
              </div>
              <div className="p-2 flex flex-col items-center justify-between text-slate-400 italic">
                <div className="font-bold text-slate-900 not-italic">Acknowledge by,</div>
                <div className="flex-1 flex items-center justify-center">{docEdits.acknowledge_label || 'Manager of Airside Service'}</div>
                <div className="font-bold text-slate-900 not-italic">( ........................ )</div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-[10px] flex justify-between text-slate-400">
            <span>*) Additional Information (if required/if existing)</span>
            <span className="font-bold">F-OP-02</span>
          </div>
        </div>
      </div>
    </div>
  );
}
