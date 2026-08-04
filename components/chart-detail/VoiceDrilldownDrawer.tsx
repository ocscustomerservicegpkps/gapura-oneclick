'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Plane, AlertTriangle, Link as LinkIcon, FileText, ChevronDown, ChevronUp, CalendarDays, Star, Users, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VoiceDrawerRecord } from './useVoiceDrilldown';

interface VoiceDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: VoiceDrawerRecord[];
}

function getText(record: VoiceDrawerRecord, keys: string[], fallback = '-'): string {
  for (const key of keys) {
    const value = record?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return fallback;
}

function formatDate(rawDate: string): string {
  if (!rawDate || rawDate === '-') return '-';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getUrlList(record: VoiceDrawerRecord, keys: string[]): string[] {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) {
      const urls = value.map(v => String(v).trim()).filter(v => v.startsWith('http'));
      if (urls.length > 0) return urls;
    }
    if (typeof value === 'string') {
      const urls = value
        .split(/\s*[;|\n,]\s*/)
        .map(v => v.trim())
        .filter(v => v.startsWith('http'));
      if (urls.length > 0) return urls;
    }
  }
  return [];
}

function getReportTypeTone(value: string) {
  const n = value.toLowerCase();
  if (n.includes('complaint') || n.includes('complain')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (n.includes('compliment') || n.includes('appreciation')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (n.includes('suggestion') || n.includes('feedback')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-violet-50 text-violet-700 border-violet-200';
}

function getCategoryTone(value: string) {
  const n = value.toLowerCase();
  if (n.includes('complaint') || n.includes('complain')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (n.includes('accident') || n.includes('incident')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (n.includes('delay')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (n.includes('damage') || n.includes('baggage')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (n.includes('compliment')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-violet-50 text-violet-700 border-violet-200';
}

function getSatisfactionColor(value: string): { bg: string; text: string } {
  const n = value.toLowerCase().trim();
  if (n.includes('sangat puas') || n.includes('very satisfied') || n === '5')
    return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' };
  if (n.includes('puas') || n.includes('satisfied') || n === '4')
    return { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' };
  if (n.includes('cukup') || n.includes('neutral') || n === '3')
    return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' };
  if (n.includes('tidak puas') || n.includes('dissatisfied') || n === '2')
    return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' };
  if (n.includes('sangat tidak') || n.includes('very dissatisfied') || n === '1')
    return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' };
  return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' };
}

export function VoiceDrilldownDrawer({ isOpen, onClose, title, data }: VoiceDrilldownDrawerProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  }, [isOpen, onClose]);

  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[85vh] max-h-[800px] md:h-auto md:max-h-[85vh] md:w-[600px] md:right-4 md:bottom-4 md:left-auto bg-white/95 backdrop-blur-xl md:rounded-3xl rounded-t-3xl border border-white/20 shadow-[-10px_-10px_30px_rgba(0,0,0,0.05)] overflow-hidden"
          >
            <div className="md:hidden flex justify-center pt-3 pb-1 w-full" onClick={onClose}>
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/50">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
                <p className="text-sm font-medium text-slate-500">{data.length} voice records found</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
              {data.map((record, idx) => {
                const rowKey = `voice-${idx}-${record.timestamp || ''}`;
                const isExpanded = !!expandedRows[rowKey];

                const dateVal = getText(record, ['date', 'date_of_event', 'Date of Event', 'timestamp']);
                const dateLabel = formatDate(dateVal);
                const branch = getText(record, ['branch', 'Branch', 'Station', 'branch_code'], 'N/A').toUpperCase();
                const airline = getText(record, ['airlines', 'airline', 'Airlines'], '-');
                const flightNumber = getText(record, ['flightNumber', 'flight_number', 'Flight Number', 'No Penerbangan'], '-');
                const category = getText(record, ['category', 'categoryReport', 'case_category', 'Category'], 'N/A');
                const reportType = getText(record, ['reportType', 'report_type', 'Report Type'], '-');
                const serviceType = getText(record, ['serviceType', 'service_type', 'Joumpa Service Type'], '-');
                const reportText = getText(record, ['report', 'detailed_report', 'Report', 'description'], '-');
                const reportBy = getText(record, ['reportBy', 'report_by', 'Report By'], '-');
                const satisfaction = getText(record, ['satisfactionRating', 'satisfaction_rating'], '-');
                const avgRating = getText(record, ['averageRating', 'average_rating', 'Rating'], '-');
                const satColor = getSatisfactionColor(satisfaction);

                const evidenceUrls = getUrlList(record, ['evidence_urls', 'evidence', 'evidence_url', 'supporting_evidence']);
                const hasEvidence = evidenceUrls.length > 0;

                return (
                  <div
                    key={rowKey}
                    className="p-5 rounded-[28px] bg-white border border-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-300 group overflow-hidden relative"
                  >
                    <div className="mb-4 relative z-10">
                      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                            <CalendarDays size={10} strokeWidth={3} />
                            Date
                          </div>
                          <div className="font-black text-slate-900 text-base leading-none tracking-tight whitespace-nowrap">{dateLabel}</div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                            <MapPin size={10} strokeWidth={3} />
                            Station
                          </div>
                          <div className="font-black text-slate-900 text-lg leading-none tracking-tight whitespace-nowrap">{branch}</div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                            <Plane size={10} strokeWidth={3} />
                            Airlines
                          </div>
                          <div className="font-black text-slate-900 text-base leading-tight tracking-tight break-words">{airline}</div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                            <Plane size={10} strokeWidth={3} />
                            Flight
                          </div>
                          <div className="font-black text-slate-900 text-base leading-none tracking-tight whitespace-nowrap">{flightNumber}</div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                            <Users size={10} strokeWidth={3} />
                            Report By
                          </div>
                          <div className="font-black text-slate-900 text-base leading-tight tracking-tight break-words">{reportBy}</div>
                        </div>

                        {avgRating !== '-' && (
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">
                              <Star size={10} strokeWidth={3} />
                              Avg Rating
                            </div>
                            <div className="font-black text-slate-900 text-base leading-none tracking-tight">{avgRating}</div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex w-full flex-col gap-2.5">
                        <div className="grid w-full grid-cols-2 gap-2.5">
                          <div className={`inline-flex min-w-0 items-center justify-center rounded-full border px-4 py-3 text-center text-[0.9rem] font-black tracking-tight shadow-[0_1px_0_rgba(15,23,42,0.03)] ${getCategoryTone(category)}`}>
                            {category}
                          </div>
                          <div className={`inline-flex min-w-0 items-center justify-center rounded-full border px-4 py-3 text-center text-[0.9rem] font-black uppercase tracking-wide ${getReportTypeTone(reportType)}`}>
                            {reportType}
                          </div>
                        </div>

                        {serviceType !== '-' && (
                          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border px-5 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] bg-slate-50 border-slate-200 w-full">
                            <span className="shrink-0 text-[0.85rem] font-black uppercase tracking-[0.16em] text-slate-600">Service</span>
                            <span className="min-w-0 text-[0.9rem] font-bold leading-tight text-slate-800">{serviceType}</span>
                          </div>
                        )}

                        {satisfaction !== '-' && (
                          <div className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-5 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] ${satColor.bg} w-full`}>
                            <Star size={14} className={satColor.text} />
                            <span className={`min-w-0 text-[0.9rem] font-bold leading-tight ${satColor.text}`}>{satisfaction}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {reportText !== '-' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 relative z-10">
                        <div className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 flex items-center gap-1.5">
                          <MessageSquare size={10} strokeWidth={3} />
                          Report
                        </div>
                        <div className="text-sm leading-relaxed text-slate-700">{reportText}</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 relative z-10">
                      <button
                        type="button"
                        onClick={() => toggleRow(rowKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors text-[0.7rem] font-bold uppercase tracking-wider"
                      >
                        {isExpanded ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
                        {isExpanded ? 'Hide details' : 'See details'}
                      </button>
                      <span className="text-[0.65rem] font-semibold text-slate-400">Detail</span>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200/80 space-y-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                              <div className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Timestamp</div>
                              <div className="text-sm leading-relaxed text-slate-700">{formatDate(record.timestamp || '')}</div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                              <div className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Email</div>
                              <div className="text-sm leading-relaxed text-slate-700 break-all">{record.email || '-'}</div>
                            </div>

                            {hasEvidence && (
                              <div className="p-3 rounded-xl bg-violet-50/40 border border-violet-100/50">
                                <div className="flex items-center gap-1.5 text-[0.62rem] font-black uppercase tracking-[0.2em] text-violet-500 mb-2">
                                  <FileText size={10} strokeWidth={3} />
                                  Supporting Evidence
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {evidenceUrls.map((url, sIdx) => (
                                    <a
                                      key={sIdx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all duration-200 shadow-sm"
                                    >
                                      <LinkIcon size={12} strokeWidth={2.5} />
                                      <span className="text-[0.65rem] font-bold">
                                        {evidenceUrls.length > 1 ? `Evidence ${sIdx + 1}` : 'Evidence'}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none">
                      <FileText size={120} />
                    </div>
                  </div>
                );
              })}

              {data.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center">
                  <div className="w-20 h-20 rounded-[32px] bg-slate-100 border border-slate-200 flex items-center justify-center mb-6 text-slate-300">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="text-slate-500 font-bold text-lg">No records found</div>
                  <div className="text-slate-400 text-sm mt-1">This segment contains no detailed data.</div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
