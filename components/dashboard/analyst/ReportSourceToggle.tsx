'use client';

import { resolveAreaType } from '@/lib/report-normalization';
import type { Report } from '@/types';

export type ReportSourceValue = 'all' | 'landside' | 'airside' | 'general' | 'gse' | 'joumpa' | 'cgo';

const SOURCE_OPTIONS: { value: ReportSourceValue; label: string; areaType?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'landside', label: 'Landside', areaType: 'Terminal Area' },
  { value: 'airside', label: 'Airside', areaType: 'Apron Area' },
  { value: 'general', label: 'General', areaType: 'General' },
  { value: 'gse', label: 'GSE', areaType: 'GSE Availability' },
  { value: 'joumpa', label: 'JOUMPA', areaType: 'Joumpa' },
  { value: 'cgo', label: 'CGO', areaType: 'Cargo (CGO)' },
];

const AREA_TYPE_BY_VALUE = new Map(
  SOURCE_OPTIONS.filter((opt) => opt.areaType).map((opt) => [opt.value, opt.areaType as string])
);

export function matchesReportSource(report: Report, value: ReportSourceValue): boolean {
  if (value === 'all') return true;
  return resolveAreaType(report) === AREA_TYPE_BY_VALUE.get(value);
}

export function ReportSourceToggle({
  value,
  onChange,
}: {
  value: ReportSourceValue;
  onChange: (value: ReportSourceValue) => void;
}) {
  return (
    <div className="flex w-full flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border border-[color:var(--sr-border)] bg-white p-0.5 hide-scrollbar sm:inline-flex sm:w-auto sm:flex-wrap sm:overflow-visible">
      {SOURCE_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`shrink-0 min-h-[44px] rounded-full px-3 text-[10px] font-black uppercase tracking-[0.06em] leading-none transition inline-flex items-center ${
              active
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_2px_0_#064e3b]'
                : 'text-[color:var(--sr-text-3)] hover:text-[color:var(--sr-text)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
