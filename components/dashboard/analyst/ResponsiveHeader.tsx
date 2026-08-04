'use client';

import { useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  Plus,
  LayoutDashboard,
  Shield,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileActionMenu } from '@/components/ui/MobileActionMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toLocalYMD } from '@/lib/utils/wib-date';

type HeaderVariant = 'default' | 'op-executive';
type HeaderView = 'dashboard' | 'reports';

interface ResponsiveHeaderProps {
  dateRange: 'all' | 'week' | 'month' | { from: string; to: string };
  onDateRangeChange: (range: 'all' | 'week' | 'month' | { from: string; to: string }) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onCustomerFeedback?: () => void;
  cfLoading?: boolean;
  onFilterClick?: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  exporting: 'excel' | 'pdf' | null;
  divisionDashboardLabel?: string;
  onOpenDivisionDashboard?: () => void;
  divisionDashboardActions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  onSwitchDivision?: () => void;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  variant?: HeaderVariant;
  activeView?: HeaderView;
  onViewChange?: (view: HeaderView) => void;
  hideDateRangeSelector?: boolean;
  createReportHref?: string;
}

export function ResponsiveHeader({
  dateRange,
  onDateRangeChange,
  onRefresh,
  refreshing,
  onCustomerFeedback,
  cfLoading,
  onFilterClick,
  onExportExcel,
  exporting,
  divisionDashboardLabel,
  onOpenDivisionDashboard,
  divisionDashboardActions,
  eyebrow,
  title,
  subtitle,
  variant = 'default',
  activeView,
  onViewChange,
  hideDateRangeSelector = false,
  createReportHref = '/dashboard/employee/new',
}: ResponsiveHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(typeof dateRange === 'object');
  const [customRange, setCustomRange] = useState(
    typeof dateRange === 'object'
      ? dateRange
      : { from: toLocalYMD(new Date()), to: toLocalYMD(new Date()) }
  );

  const headerTitle = title ?? 'Analytics Center';
  const headerSubtitle = subtitle ?? 'Operational Services Division';
  const isExecutiveVariant = variant === 'op-executive';
  const canToggleView = Boolean(activeView && onViewChange);

  const dateRangeOptions = [
    { value: 'all' as const, label: 'All' },
    { value: 'month' as const, label: '30 Days' },
    { value: 'week' as const, label: '7 Days' },
    { value: 'custom' as const, label: 'Custom Date' },
  ];

  const currentDateLabel =
    typeof dateRange === 'string'
      ? dateRangeOptions.find((option) => option.value === dateRange)
      : { label: 'Custom Date', value: 'custom' as const };

  const handleDateRangeSelection = (value: 'all' | 'month' | 'week' | 'custom') => {
    if (value === 'custom') {
      setShowCustomPicker(true);
      return;
    }

    setShowCustomPicker(false);
    onDateRangeChange(value);
  };

  const mobileMenuActions: { label: string; icon?: ReactNode; onClick: () => void }[] = [];
  if (onCustomerFeedback) {
    mobileMenuActions.push({
      label: 'Customer Feedback',
      icon: <LayoutDashboard className="w-4 h-4" />,
      onClick: onCustomerFeedback,
    });
  }
  if (onFilterClick) {
    mobileMenuActions.push({
      label: 'Filter Dashboard',
      icon: <Shield className="w-4 h-4" />,
      onClick: onFilterClick,
    });
  }
  const dashboardActions =
    divisionDashboardActions && divisionDashboardActions.length > 0
      ? divisionDashboardActions
      : onOpenDivisionDashboard && divisionDashboardLabel
        ? [{ label: divisionDashboardLabel, onClick: onOpenDivisionDashboard }]
        : [];
  dashboardActions.forEach((action) => {
    mobileMenuActions.push({
      label: action.label,
      icon: <LayoutDashboard className="w-4 h-4" />,
      onClick: action.onClick,
    });
  });
  mobileMenuActions.push({
    label: 'Export',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    onClick: onExportExcel,
  });

  const dateRangeSelector = (
    <div className={cn('flex flex-col gap-2', isExecutiveVariant ? 'w-full lg:w-auto' : 'w-full sm:w-auto')}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'hidden sm:flex items-center p-1.5 rounded-2xl border',
            isExecutiveVariant
              ? 'bg-[var(--surface-1)]/85 border-[var(--surface-3)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
              : 'bg-[oklch(0.97_0.012_160_/_0.6)] backdrop-blur-xl border-[oklch(0.65_0.18_160_/_0.15)] shadow-[inset_0_1px_2px_oklch(0.45_0.06_160_/_0.06)]'
          )}
        >
          {dateRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleDateRangeSelection(option.value)}
              className={cn(
                'px-5 py-2.5 text-[11px] font-display font-black uppercase tracking-widest rounded-xl transition-all duration-300 whitespace-nowrap min-h-[44px]',
                (typeof dateRange === 'string' ? dateRange === option.value : option.value === 'custom')
                  ? 'bg-gradient-to-br from-[var(--brand-emerald-500)] to-[var(--brand-emerald-600)] text-[var(--text-on-brand)] shadow-lg shadow-emerald-500/20'
                  : isExecutiveVariant
                    ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[oklch(0.95_0.015_160_/_0.5)]'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showCustomPicker && (
          <div className="hidden sm:flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div
              className={cn(
                'flex items-center p-1 rounded-xl border',
                isExecutiveVariant
                  ? 'bg-[var(--surface-1)]/90 border-[var(--surface-3)]'
                  : 'bg-[oklch(0.97_0.012_160_/_0.6)] border-[oklch(0.65_0.18_160_/_0.15)]'
              )}
            >
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => {
                  const newRange = { ...customRange, from: e.target.value };
                  setCustomRange(newRange);
                  onDateRangeChange(newRange);
                }}
                className="bg-transparent border-0 text-[11px] font-bold p-1 w-[120px] focus:ring-0"
              />
              <span className="text-[10px] px-1 text-[var(--text-muted)]">→</span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => {
                  const newRange = { ...customRange, to: e.target.value };
                  setCustomRange(newRange);
                  onDateRangeChange(newRange);
                }}
                className="bg-transparent border-0 text-[11px] font-bold p-1 w-[120px] focus:ring-0"
              />
            </div>
          </div>
        )}

        <div className="sm:hidden w-full">
          <DropdownMenu open={isDateOpen} onOpenChange={setIsDateOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full min-h-[44px] justify-between rounded-2xl',
                  isExecutiveVariant && 'bg-[var(--surface-1)]/85 border-[var(--surface-3)] text-[var(--text-primary)]'
                )}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {currentDateLabel?.label}
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[220px] bg-[var(--surface-1)] border border-[var(--surface-3)] shadow-xl rounded-xl p-1">
              {dateRangeOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    handleDateRangeSelection(option.value);
                    setIsDateOpen(false);
                  }}
                  className={cn(
                    'min-h-[44px] cursor-pointer',
                    (typeof dateRange === 'string' ? dateRange === option.value : option.value === 'custom') &&
                      'bg-emerald-50 text-emerald-700'
                  )}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showCustomPicker && (
        <div
          className={cn(
            'sm:hidden w-full space-y-2 p-3 rounded-2xl border animate-in fade-in slide-in-from-top-2',
            isExecutiveVariant
              ? 'bg-[var(--surface-1)]/90 border-[var(--surface-3)]'
              : 'bg-[oklch(0.97_0.012_160_/_0.6)] border-[oklch(0.65_0.18_160_/_0.15)]'
          )}
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">
                Mulai
              </span>
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => {
                  const newRange = { ...customRange, from: e.target.value };
                  setCustomRange(newRange);
                  onDateRangeChange(newRange);
                }}
                className="bg-[var(--surface-1)]/50 border border-surface-3 rounded-xl p-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">
                Selesai
              </span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => {
                  const newRange = { ...customRange, to: e.target.value };
                  setCustomRange(newRange);
                  onDateRangeChange(newRange);
                }}
                className="bg-[var(--surface-1)]/50 border border-surface-3 rounded-xl p-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const createReportButton = (
    <Button
      onClick={() => {
        const [path, query] = createReportHref.split('?');
        const params = new URLSearchParams(query);
        params.set('from', pathname);
        router.push(`${path}?${params.toString()}`);
      }}
      className={cn(
        'col-span-2 min-h-[48px] px-5 sm:px-6 rounded-2xl font-display font-bold tracking-tight transition-all duration-300 w-full sm:w-auto justify-center',
        'bg-gradient-to-br from-[var(--brand-emerald-500)] to-[var(--brand-emerald-600)] text-[var(--text-on-brand)]',
        'hover:shadow-xl hover:-translate-y-0.5 active:scale-95'
      )}
    >
      <Plus size={18} className="mr-2" />
      <span>Create Report</span>
    </Button>
  );

  const refreshButton = (
    <Button
      onClick={onRefresh}
      disabled={refreshing}
      variant={isExecutiveVariant ? 'ghost' : 'outline'}
      className={cn(
        'min-h-[44px] min-w-[44px] sm:min-w-fit w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4',
        isExecutiveVariant &&
          'bg-[var(--surface-1)]/85 border border-[var(--surface-3)] text-[var(--text-primary)] hover:bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        refreshing && 'opacity-50'
      )}
    >
      <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
      <span>{refreshing ? 'Loading...' : 'Refresh'}</span>
    </Button>
  );

  const divisionDashboardButtons =
    dashboardActions.length > 0 ? (
      <>
        {dashboardActions.map((action) => (
          <Button
            key={action.label}
            onClick={action.onClick}
            aria-label={action.label}
            className={cn(
              'w-full sm:w-auto items-center justify-center sm:justify-start gap-2 min-h-[48px] px-4 sm:px-5 rounded-2xl border-0 transition-all duration-300 font-display font-bold',
              isExecutiveVariant
                ? 'inline-flex bg-[var(--surface-1)]/85 text-[var(--text-primary)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-[var(--surface-3)] hover:bg-white hover:-translate-y-0.5 active:scale-95'
                : 'hidden xl:inline-flex bg-gradient-to-br from-[var(--brand-emerald-600)] to-[var(--brand-emerald-700,#065f46)] text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:scale-95'
            )}
          >
            <LayoutDashboard size={16} className={isExecutiveVariant ? 'text-[var(--brand-emerald-700,#047857)]' : undefined} />
            <span className={cn('min-w-0 truncate text-left tracking-tight', !isExecutiveVariant && 'hidden 2xl:inline')}>
              {action.label}
            </span>
          </Button>
        ))}
      </>
    ) : null;

  if (isExecutiveVariant) {
    return (
      <div className="animate-fade-in-up">
        <div className="rounded-[28px] border border-[var(--surface-3)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-4 sm:p-5 lg:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                {eyebrow && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--signal-amber-rim)] bg-[var(--signal-amber-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--signal-amber-strong)]">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[var(--signal-amber)]" />
                    {eyebrow}
                  </div>
                )}
                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl lg:text-[3.4rem] leading-[0.95] font-display font-black tracking-[-0.05em] text-[var(--text-primary)]">
                    {headerTitle}
                  </h1>
                  <p className="max-w-2xl text-sm sm:text-base text-[var(--text-secondary)]">
                    {headerSubtitle}
                  </p>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                {divisionDashboardButtons}
                {onCustomerFeedback && (
                  <Button
                    onClick={onCustomerFeedback}
                    disabled={cfLoading}
                    aria-label="Feedback"
                    className="w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 min-h-[48px] px-4 sm:px-5 rounded-2xl border-0 bg-[var(--surface-1)]/85 text-[var(--text-primary)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-[var(--surface-3)] hover:bg-white hover:-translate-y-0.5 active:scale-95 transition-all duration-300 font-display font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {cfLoading ? <Loader2 size={16} className="animate-spin text-[var(--brand-emerald-700,#047857)]" /> : <LayoutDashboard size={16} className="text-[var(--brand-emerald-700,#047857)]" />}
                    <span className="min-w-0 truncate text-left tracking-tight">Customer Feedback</span>
                  </Button>
                )}
                {refreshButton}
                <Button
                  onClick={onExportExcel}
                  disabled={exporting !== null}
                  variant="ghost"
                  className="min-h-[48px] w-full justify-center gap-2 rounded-2xl bg-emerald-50 px-4 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 sm:w-auto"
                >
                  {exporting === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                  <span className="font-bold tracking-tight">Export</span>
                </Button>
                {createReportButton}
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--surface-3)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.92))] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                {canToggleView && (
                  <div className="inline-flex w-full sm:w-auto items-center rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-2)] p-1">
                    {(['dashboard', 'reports'] as HeaderView[]).map((viewOption) => (
                      <button
                        key={viewOption}
                        onClick={() => onViewChange?.(viewOption)}
                        className={cn(
                          'flex-1 sm:flex-none rounded-xl px-3 sm:px-4 py-2.5 text-[10px] sm:text-[11px] leading-none font-black uppercase tracking-[0.16em] sm:tracking-[0.22em] transition-all',
                          activeView === viewOption
                            ? 'bg-white text-[var(--text-primary)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        {viewOption === 'dashboard' ? 'Dashboard' : 'All Reports'}
                      </button>
                    ))}
                  </div>
                )}

                {!hideDateRangeSelector && <div className="w-full xl:w-auto">{dateRangeSelector}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-text-primary">
          {headerTitle}
        </h1>
        <p className="text-sm sm:text-base font-body font-medium text-brand-emerald-700">
          {headerSubtitle}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between flex-wrap">
        {!hideDateRangeSelector && dateRangeSelector}

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:ml-auto">
          {onCustomerFeedback && (
            <Button
              onClick={onCustomerFeedback}
              disabled={cfLoading}
              aria-label="Feedback"
              className={cn(
                'hidden xl:inline-flex items-center gap-2 min-h-[48px] px-6',
                'bg-gradient-to-br from-[var(--brand-emerald-500)] to-[var(--brand-emerald-600)] text-[var(--text-on-brand)]',
                'rounded-2xl border-0 shadow-lg shadow-emerald-500/20 transition-all duration-300',
                'hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-95 font-display font-bold',
                cfLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {cfLoading ? <Loader2 size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
              <span className="hidden 2xl:inline tracking-tight">Feedback</span>
            </Button>
          )}

          {onFilterClick && (
            <Button
              onClick={onFilterClick}
              variant="ghost"
              aria-label="Filter"
              className={cn(
                'hidden xl:inline-flex items-center gap-2 min-h-[48px] px-5',
                'bg-[oklch(1_0_0_/_0.3)] backdrop-blur-xl border border-[oklch(1_0_0_/_0.1)] text-[var(--text-primary)] transition-all duration-300',
                'rounded-2xl hover:bg-[oklch(1_0_0_/_0.5)] hover:-translate-y-0.5 active:scale-95'
              )}
            >
              <Shield size={16} className="text-emerald-600" />
              <span className="hidden 2xl:inline font-bold tracking-tight">Filter</span>
            </Button>
          )}

          {divisionDashboardButtons}

          <Button
            onClick={onExportExcel}
            disabled={exporting !== null}
            variant="ghost"
            aria-label="Export"
            className={cn(
              'hidden xl:inline-flex items-center gap-2 min-h-[48px] px-5',
              'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold',
              'rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95',
              exporting === 'excel' && 'opacity-50'
            )}
          >
            {exporting === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            <span className="hidden 2xl:inline">Export</span>
          </Button>

          <div className="xl:hidden w-full sm:w-auto">
            <MobileActionMenu actions={mobileMenuActions} triggerLabel="Menu" align="end" />
          </div>

          {createReportButton}

          <div className="hidden sm:block h-8 w-px bg-[var(--surface-4)]" />

          {refreshButton}
        </div>
      </div>
    </div>
  );
}
