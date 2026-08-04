
'use client';

import { useEffect, useMemo, useState } from 'react';
import { PrismSelect } from '@/components/ui/PrismSelect';

interface SelectOption {
  value: string;
  label: string;
}

export interface FilterData {
  hub?: string;
  branch?: string;
  maskapai?: string;
  airline?: string;
  main_category?: string;
  area?: string;
}

interface FilterOptionsState {
  hub: SelectOption[];
  branch: SelectOption[];
  airline: SelectOption[];
  airline_type: SelectOption[];
  main_category: SelectOption[];
  area: SelectOption[];
}

interface DynamicFilterHeaderProps {
  onFilterChange: (filters: FilterData) => void;
  initialFilters?: FilterData;
  variant?: 'default' | 'white' | 'pill';
}

export function DynamicFilterHeader({ onFilterChange, initialFilters, variant = 'default' }: DynamicFilterHeaderProps) {
  const current = useMemo(() => ({
    hub: initialFilters?.hub || 'all',
    branch: initialFilters?.branch || 'all',
    maskapai: initialFilters?.maskapai || 'all',
    airline: initialFilters?.airline || 'all',
    main_category: initialFilters?.main_category || 'all',
    area: initialFilters?.area || 'all',
  }), [initialFilters]);

  const [options, setOptions] = useState<FilterOptionsState>({
    hub: [{ value: 'all', label: 'HUB: All' }],
    branch: [{ value: 'all', label: 'Station: All' }],
    airline: [{ value: 'all', label: 'Airlines: All' }],
    airline_type: [{ value: 'all', label: 'Maskapai: All' }],
    main_category: [{ value: 'all', label: 'Category: All' }],
    area: [{ value: 'all', label: 'Area: All' }]
  });

  useEffect(() => {
    async function fetchFilters() {
      try {
        const fields = ['hub', 'branch', 'airline', 'airline_type', 'main_category', 'area'].join(',');
        const res = await fetch(`/api/dashboards/filter-options?fields=${fields}`);
        const data = await res.json();

        const mapToOptions = (vals: string[]) => [
          { value: 'all', label: 'All' },
          ...(vals || []).map(v => ({ value: v, label: v }))
        ];

        setOptions({
          hub: mapToOptions(data.hub),
          branch: mapToOptions(data.branch),
          airline: mapToOptions(data.airline),
          airline_type: mapToOptions(data.airline_type),
          main_category: mapToOptions(data.main_category),
          area: mapToOptions(data.area)
        });
      } catch (err) {
        console.error('Error loading filters:', err);
      }
    }
    fetchFilters();
  }, []);

  const mergeAndChange = (partial: Partial<FilterData>) => {
    onFilterChange({ ...(initialFilters || {}), ...partial });
  };

  const isChipStrip = variant === 'pill';
  const rowClass = isChipStrip
    ? 'flex flex-nowrap items-center gap-3 w-full overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:overflow-visible md:mx-0 md:px-0'
    : 'flex flex-wrap items-center justify-center gap-3 w-full';
  const itemClass = isChipStrip
    ? 'flex-none w-[168px] md:flex-1 md:min-w-[140px] md:max-w-[200px]'
    : 'flex-1 min-w-[140px] max-w-[200px]';

  return (
    <div className={rowClass}>
      <div className={itemClass}>
        <PrismSelect
          options={options.hub}
          value={current.hub}
          onChange={(v) => mergeAndChange({ hub: v })}
          placeholder="HUB"
          variant={variant}
          label="HUB Area"
        />
      </div>
      <div className={itemClass}>
        <PrismSelect
          options={options.branch}
          value={current.branch}
          onChange={(v) => mergeAndChange({ branch: v })}
          placeholder="Station"
          variant={variant}
          label="Station"
        />
      </div>
      <div className={itemClass}>
        <PrismSelect
          options={options.airline_type}
          value={current.maskapai}
          onChange={(v) => mergeAndChange({ maskapai: v })}
          placeholder="Maskapai"
          variant={variant}
          label="Full Service Airlines / LCC Airlines"
        />
      </div>
      <div className={itemClass}>
        <PrismSelect
          options={options.airline}
          value={current.airline}
          onChange={(v) => mergeAndChange({ airline: v })}
          placeholder="Airlines"
          variant={variant}
          label="Airlines Name"
        />
      </div>
      <div className={itemClass}>
        <PrismSelect
          options={options.main_category}
          value={current.main_category}
          onChange={(v) => mergeAndChange({ main_category: v })}
          placeholder="Category"
          variant={variant}
          label="Case Category"
        />
      </div>
      <div className={itemClass}>
        <PrismSelect
          options={options.area}
          value={current.area}
          onChange={(v) => mergeAndChange({ area: v })}
          placeholder="Area"
          variant={variant}
          label="Ops. Area"
        />
      </div>
    </div>
  );
}
