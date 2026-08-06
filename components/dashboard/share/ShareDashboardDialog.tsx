'use client';

import { useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Copy,
  Link2,
  Check,
  Trash2,
  RefreshCw,
  Loader2,
  Share2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrismMultiSelect } from '@/components/ui/PrismMultiSelect';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { ALL_TABS, SHARE_TAB_LABELS, type ShareScope } from '@/lib/share/types';
import type { PublishedDashboardRecord } from '@/lib/share/types';

export interface ShareFilterOptions {
  hubs: string[];
  branches: string[];
  airlines: string[];
  categories: string[];
}

interface ShareDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardKey: string;
  tabs: readonly string[];
  initialScope: ShareScope;
  availableOptions: ShareFilterOptions;
}

type DateRangeChoice = 'all' | 'week' | 'month' | 'custom';

function toLocalDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

function scopeDateRange(scope: ShareScope): DateRangeChoice {
  if (scope.dateFrom && scope.dateTo) return 'custom';
  return scope.dateRange === 'week' || scope.dateRange === 'month' ? scope.dateRange : 'all';
}

function scopeSummary(scope: ShareScope): string {
  const parts: string[] = [];
  const range = scopeDateRange(scope);
  if (range === 'custom') parts.push(`${scope.dateFrom} → ${scope.dateTo}`);
  else if (range === 'week') parts.push('Last 7 days');
  else if (range === 'month') parts.push('Last 30 days');
  else parts.push('All time');
  if (scope.hubs.length > 0) parts.push(`${scope.hubs.length} hub${scope.hubs.length > 1 ? 's' : ''}`);
  if (scope.stations.length > 0) parts.push(`${scope.stations.length} station${scope.stations.length > 1 ? 's' : ''}`);
  if (scope.airlines.length > 0) parts.push(`${scope.airlines.length} airline${scope.airlines.length > 1 ? 's' : ''}`);
  if (scope.categories.length > 0) parts.push(`${scope.categories.length} categor${scope.categories.length > 1 ? 'ies' : 'y'}`);
  return parts.join(' · ') || 'All data';
}

function emptyScope(): ShareScope {
  return { hubs: [], stations: [], airlines: [], categories: [] };
}

export function ShareDashboardDialog({
  open,
  onOpenChange,
  dashboardKey,
  tabs,
  initialScope,
  availableOptions,
}: ShareDashboardDialogProps) {
  const [scope, setScope] = useState<ShareScope>(() => ({ ...emptyScope(), ...initialScope }));
  const [dateChoice, setDateChoice] = useState<DateRangeChoice>(() => scopeDateRange(initialScope));
  const [dateFrom, setDateFrom] = useState(() => initialScope.dateFrom || toLocalDateInput(new Date()));
  const [dateTo, setDateTo] = useState(() => initialScope.dateTo || toLocalDateInput(new Date()));
  const [name, setName] = useState('');
  const [publishSingle, setPublishSingle] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>(tabs[0] ?? ALL_TABS);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const [links, setLinks] = useState<PublishedDashboardRecord[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/share?dashboardKey=${encodeURIComponent(dashboardKey)}`);
      if (!res.ok) throw new Error('Failed to load published links');
      const payload = (await res.json()) as { links?: PublishedDashboardRecord[] };
      setLinks(payload.links ?? []);
    } catch {
      setError('Could not load your published links. Please try again.');
    } finally {
      setLoadingLinks(false);
    }
  }, [dashboardKey]);

  useEffect(() => {
    if (open) {
      setScope({ ...emptyScope(), ...initialScope });
      setDateChoice(scopeDateRange(initialScope));
      setSelectedTab(tabs[0] ?? ALL_TABS);
      setEditingSlug(null);
      setPublishedUrl(null);
      setError(null);
      void reloadLinks();
    }
  }, [open, initialScope, tabs, reloadLinks]);

  const buildScope = (): ShareScope => {
    const base: ShareScope = { ...scope };
    if (dateChoice === 'custom') {
      base.dateRange = undefined;
      base.dateFrom = dateFrom;
      base.dateTo = dateTo;
    } else {
      base.dateRange = dateChoice === 'all' ? 'all' : dateChoice;
      base.dateFrom = undefined;
      base.dateTo = undefined;
    }
    return base;
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const finalScope = buildScope();
      const tab = publishSingle ? selectedTab : ALL_TABS;
      const res = await fetch(`/api/share${editingSlug ? `/${editingSlug}` : ''}`, {
        method: editingSlug ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardKey,
          tab,
          name: name || undefined,
          config: { scope: finalScope },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Publish failed');
      }
      const record = (await res.json()) as PublishedDashboardRecord;
      setPublishedUrl(`${window.location.origin}/share/${record.slug}`);
      setEditingSlug(null);
      void reloadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleRevoke = async (slug: string) => {
    if (!window.confirm('Revoke this link? Viewers will no longer be able to open it.')) return;
    const res = await fetch(`/api/share/${slug}`, { method: 'DELETE' });
    if (res.ok) void reloadLinks();
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy the link automatically — select and copy it manually.');
    }
  };

  const handleEditLink = (record: PublishedDashboardRecord) => {
    setEditingSlug(record.slug);
    setPublishedUrl(null);
    setScope({ ...emptyScope(), ...(record.config?.scope ?? {}) });
    setDateChoice(scopeDateRange(record.config?.scope ?? emptyScope()));
    if (record.config?.scope?.dateFrom) setDateFrom(record.config.scope.dateFrom);
    if (record.config?.scope?.dateTo) setDateTo(record.config.scope.dateTo);
    setPublishSingle(record.tab !== ALL_TABS);
    if (record.tab !== ALL_TABS) setSelectedTab(record.tab);
    setName(record.name || '');
  };

  const dateOptions: { value: DateRangeChoice; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: '30 Days' },
    { value: 'custom', label: 'Custom' },
  ];

  const selectOptions = (key: keyof ShareFilterOptions) =>
    availableOptions[key].map((option) => ({ label: option, value: option }));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <Dialog.Content className="pointer-events-auto w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[var(--surface-1)] border border-[oklch(0.92_0.01_90/0.8)] rounded-2xl shadow-[var(--shadow-spatial-lg)] animate-scale-in focus:outline-none">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[oklch(0.94_0.01_90/0.6)]">
            <Dialog.Title className="flex items-center gap-2.5 text-lg font-bold font-display tracking-tight text-[var(--text-primary)]">
              <Share2 size={18} className="text-emerald-600" />
              Share Dashboard
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-lg min-h-11 min-w-11 p-2.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 sm:p-5 space-y-6">
            {/* Published success panel */}
            {publishedUrl && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                <p className="text-sm font-bold text-emerald-900">Dashboard published — public link is live.</p>
                <p className="mt-1 text-xs text-emerald-700">Viewers can open it without logging in. They see read-only data within the scope below; revoke the link anytime.</p>
                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">Public URL</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900">{publishedUrl}</code>
                      <button
                        onClick={() => void handleCopy(publishedUrl)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <QRCodeWithLogo value={publishedUrl} size={104} fgColor="#047857" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* Scope editor — captured at publish time, applied to live data */}
            <section>
              <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                <Calendar size={12} className="text-emerald-600" />
                Data Scope — what viewers will see
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Pre-filled from your current filters. Data stays live; viewers cannot change this scope.
              </p>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {dateOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateChoice(option.value)}
                    className={cn(
                      'min-h-11 sm:min-h-10 rounded-lg border px-3 py-2 text-xs font-bold transition-all',
                      dateChoice === option.value
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                        : 'border-[var(--surface-3)] bg-white text-[var(--text-secondary)] hover:border-emerald-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {dateChoice === 'custom' && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <label className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="mt-1 w-full min-h-11 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">To</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="mt-1 w-full min-h-11 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </label>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PrismMultiSelect
                  label="Hub"
                  placeholder="All Hubs..."
                  options={selectOptions('hubs')}
                  values={scope.hubs}
                  onChange={(values) => setScope((prev) => ({ ...prev, hubs: values }))}
                />
                <PrismMultiSelect
                  label="Station"
                  placeholder="All Stations..."
                  options={selectOptions('branches')}
                  values={scope.stations}
                  onChange={(values) => setScope((prev) => ({ ...prev, stations: values }))}
                />
                <PrismMultiSelect
                  label="Airline"
                  placeholder="All Airlines..."
                  options={selectOptions('airlines')}
                  values={scope.airlines}
                  onChange={(values) => setScope((prev) => ({ ...prev, airlines: values }))}
                />
                <PrismMultiSelect
                  label="Category"
                  placeholder="All Categories..."
                  options={selectOptions('categories')}
                  values={scope.categories}
                  onChange={(values) => setScope((prev) => ({ ...prev, categories: values }))}
                />
              </div>
            </section>

            {/* Publish target + name */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Publish scope</h3>
                <div className="mt-2 space-y-1.5">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2.5 cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="radio"
                      checked={publishSingle}
                      onChange={() => setPublishSingle(true)}
                      className="accent-emerald-600"
                    />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Single tab</span>
                  </label>
                  {publishSingle && (
                    <select
                      value={selectedTab}
                      onChange={(e) => setSelectedTab(e.target.value)}
                      className="w-full min-h-11 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {tabs.map((tab) => (
                        <option key={tab} value={tab}>{SHARE_TAB_LABELS[tab] || tab}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2.5 cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="radio"
                      checked={!publishSingle}
                      onChange={() => setPublishSingle(false)}
                      className="accent-emerald-600"
                    />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Whole dashboard (all tabs)</span>
                  </label>
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Presentation name</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Optional label shown to viewers.</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 HUB CGK Performance"
                  maxLength={120}
                  className="mt-2 w-full min-h-11 rounded-lg border border-[var(--surface-3)] bg-white px-3 py-2 text-xs font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => void handlePublish()}
                  disabled={publishing}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  {editingSlug ? 'Update Link' : 'Publish Public Link'}
                </button>
              </div>
            </section>

            {/* Manage existing links */}
            <section>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                Active links {loadingLinks && <Loader2 size={11} className="ml-1 inline animate-spin text-emerald-600" />}
              </h3>
              {links.length === 0 && !loadingLinks && (
                <p className="mt-2 rounded-xl border border-dashed border-[var(--surface-3)] px-4 py-4 text-center text-xs text-[var(--text-muted)]">
                  No published links yet. Publish one above to share this dashboard.
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {links.map((record) => {
                  const url = `${window.location.origin}/share/${record.slug}`;
                  return (
                    <li key={record.slug} className="rounded-xl border border-[var(--surface-3)] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {record.name || SHARE_TAB_LABELS[record.tab] || record.tab}
                            <span className="ml-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              {record.tab === ALL_TABS ? 'Whole dashboard' : 'Single tab'}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                            {scopeSummary(record.config?.scope ?? emptyScope())} ·{' '}
                            {new Date(record.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => void handleCopy(url)}
                            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-lg border border-[var(--surface-3)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                          >
                            <Copy size={11} /> Copy
                          </button>
                          <button
                            onClick={() => handleEditLink(record)}
                            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-lg border border-[var(--surface-3)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                          >
                            <RefreshCw size={11} /> Update
                          </button>
                          <button
                            onClick={() => void handleRevoke(record.slug)}
                            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={11} /> Revoke
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
