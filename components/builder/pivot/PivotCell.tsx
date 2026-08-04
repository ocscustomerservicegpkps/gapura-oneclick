import { Normalization } from '@/components/chart-detail/GlobalControlBar';
import { cn } from '@/lib/utils';
import { HEATMAP_SCALE } from './PivotHeader';

interface PivotCellProps {
  value: number;
  rowLabel: string;
  colLabel: string;
  rowTotal: number;
  colTotal: number;
  grandTotal: number;
  normalization: Normalization;
  contextMax: number;
  onClick?: () => void;
}

const ZERO_STATE = { bg: 'transparent', text: 'var(--surface-300)' };

export function PivotCell({
  value,
  rowLabel,
  colLabel,
  rowTotal,
  normalization,
  contextMax,
  onClick
}: PivotCellProps) {

  const getIntensity = (val: number, max: number) => {
    if (val === 0) return ZERO_STATE;
    const ratio = val / (max || 1);

    for (let i = HEATMAP_SCALE.length - 1; i >= 0; i--) {
        if (ratio >= HEATMAP_SCALE[i].min) return HEATMAP_SCALE[i];
    }
    return HEATMAP_SCALE[0];
  };

  const displayValue = (() => {
      if (value === 0) return '-';
      if (normalization === 'row') return ((value / rowTotal) * 100).toFixed(1) + '%';
      return value.toLocaleString('id-ID');
  })();

  const style = getIntensity(value, contextMax);
  const percentOfRow = ((value / rowTotal) * 100).toFixed(1);

  return (
    <td className="p-1 text-center align-middle">
        <div
          className={cn(
            "w-full h-9 flex items-center justify-center rounded-lg text-[9px] font-black tracking-tight transition-all relative group",
            value > 0 && onClick ? "hover:scale-[1.12] hover:shadow-xl hover:z-40 hover:ring-2 hover:ring-[var(--brand-primary)]/20 cursor-pointer" : "cursor-default",
            value > 0 && !onClick && "hover:scale-[1.12] hover:shadow-xl hover:z-40 hover:ring-2 hover:ring-[var(--brand-primary)]/20"
          )}
          style={{
              backgroundColor: style.bg,
              color: style.text
          }}
          title={`${rowLabel} • ${colLabel}\nValue: ${value}\nRow Share: ${percentOfRow}%`}
          onClick={onClick}
        >
            <div className="absolute inset-0 rounded-lg border border-black/5 pointer-events-none" />
            <span className="relative z-10">{displayValue}</span>
        </div>
    </td>
  );
}
