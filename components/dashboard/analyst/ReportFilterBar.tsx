"use client";

import { FC, useState, type ElementType, type ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Filter,
  Plane,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ReportFilterOptions } from '@/lib/reports-export';

type ScreenReportFilterOptions = ReportFilterOptions & {
  hubs: string[];
  categories: string[];
  areas: string[];
};

interface ReportFilterBarProps {
  search: string;
  onSearch: (v: string) => void;
  startDate: string;
  onStartDate: (v: string) => void;
  endDate: string;
  onEndDate: (v: string) => void;
  hub: string;
  onHub: (v: string) => void;
  branch: string;
  onBranch: (v: string) => void;
  airline: string;
  onAirline: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  caseClassification: string;
  onCaseClassification: (v: string) => void;
  area: string;
  onArea: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  severity: string;
  onSeverity: (v: string) => void;
  options: ScreenReportFilterOptions;
  totalCount: number;
  filteredCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onReset: () => void;
}

export const ReportFilterBar: FC<ReportFilterBarProps> = ({
  search,
  onSearch,
  startDate,
  onStartDate,
  endDate,
  onEndDate,
  hub,
  onHub,
  branch,
  onBranch,
  airline,
  onAirline,
  category,
  onCategory,
  caseClassification,
  onCaseClassification,
  area,
  onArea,
  status,
  onStatus,
  severity,
  onSeverity,
  options,
  totalCount,
  filteredCount,
  refreshing,
  onRefresh,
  onReset,
}) => {
  const [open, setOpen] = useState(false);
  const activeCount = [
    search,
    startDate,
    endDate,
    hub,
    branch,
    airline,
    category,
    caseClassification,
    area,
    status !== 'all' ? status : '',
    severity !== 'all' ? severity : '',
  ]
    .filter(Boolean)
    .length;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-emerald-100/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <Filter className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Filter All Reports</p>
            <p className="truncate text-xs font-semibold text-[var(--text-secondary)]">
              {activeCount > 0
                ? `${activeCount} filter${activeCount === 1 ? '' : 's'} active • ${filteredCount.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} reports`
                : 'Date, hub, station, airline, category, classification, area, status, severity'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {activeCount > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Active
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-emerald-100/70 bg-[#fbfcf8] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput label="Start Date" icon={CalendarDays}>
              <input
                type="date"
                value={startDate}
                onChange={(event) => onStartDate(event.target.value)}
                className={fieldClass}
              />
            </FilterInput>
            <FilterInput label="End Date" icon={CalendarDays}>
              <input
                type="date"
                value={endDate}
                onChange={(event) => onEndDate(event.target.value)}
                className={fieldClass}
              />
            </FilterInput>
            <FilterSelect label="Hub" icon={Building2} value={hub} onChange={onHub} emptyLabel="All hubs" options={options.hubs} />
            <FilterSelect label="Station" icon={Building2} value={branch} onChange={onBranch} emptyLabel="All stations" options={options.branches} />
            <FilterSelect label="Airlines" icon={Plane} value={airline} onChange={onAirline} emptyLabel="All airlines" options={options.airlines} />
            <FilterSelect label="Category" icon={Tag} value={category} onChange={onCategory} emptyLabel="All categories" options={options.categories} />
            <FilterSelect label="Case Classification" icon={Tag} value={caseClassification} onChange={onCaseClassification} emptyLabel="All classifications" options={options.caseClassifications} />
            <FilterSelect label="Area" icon={Building2} value={area} onChange={onArea} emptyLabel="All areas" options={options.areas} />
            <FilterSelect label="Status" icon={ShieldAlert} value={status} onChange={onStatus} emptyLabel="All statuses" options={['OPEN', 'ON PROGRESS', 'CLOSED']} allValue="all" />
            <FilterSelect label="Severity" icon={ShieldAlert} value={severity} onChange={onSeverity} emptyLabel="All severities" options={['LOW', 'MEDIUM', 'HIGH', 'TOP RISK']} allValue="all" />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
            <FilterInput label="Manual Search" icon={Search}>
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="ID, reference number, report, flight, route, station, airlines..."
                className={fieldClass}
              />
            </FilterInput>

            <div className="flex items-end">
              <button
                type="button"
                onClick={onReset}
                disabled={activeCount === 0}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--surface-4)] bg-white px-5 text-sm font-black text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--surface-4)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-45 lg:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            </div>
            <div className="flex items-end">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Refresh
            </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-800">
              {filteredCount.toLocaleString('en-US')} / {totalCount.toLocaleString('en-US')} reports match
            </p>
            <p className="text-xs font-semibold text-[var(--text-muted)]">
              These filters apply to the Report List view. Export keeps its own scope.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const fieldClass = "h-12 w-full rounded-2xl border border-[var(--surface-4)] bg-white pl-12 pr-4 text-sm font-semibold text-[var(--text-primary)] transition placeholder:text-[var(--text-muted)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1";

function FilterInput({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <Icon className="pointer-events-none absolute bottom-3.5 left-4 h-5 w-5 text-emerald-700" />
      {children}
    </label>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  options,
  emptyLabel,
  allValue = "",
  onChange,
}: {
  label: string;
  icon: ElementType;
  value: string;
  options: string[];
  emptyLabel: string;
  allValue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterInput label={label} icon={icon}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClass, "appearance-none")}
      >
        <option value={allValue}>{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FilterInput>
  );
}
