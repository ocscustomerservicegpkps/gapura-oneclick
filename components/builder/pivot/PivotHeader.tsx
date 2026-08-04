import { LayoutGrid, ArrowRight, ArrowDown } from 'lucide-react';
import { Normalization } from '@/components/chart-detail/GlobalControlBar';
import { cn } from '@/lib/utils';

export interface HeatmapScaleStep {
  bg: string;
  text: string;
  min: number;
  label: string;
}

export const HEATMAP_SCALE: HeatmapScaleStep[] = [
  { bg: 'oklch(0.96 0.05 150)', text: 'oklch(0.3 0.05 150)', min: 0.00, label: 'Very Low' },
  { bg: 'oklch(0.9 0.1 150)', text: 'oklch(0.25 0.1 150)', min: 0.15, label: 'Low' },
  { bg: 'oklch(0.8 0.15 150)', text: 'oklch(0.2 0.15 150)', min: 0.40, label: 'Medium' },
  { bg: 'oklch(0.6 0.2 150)', text: '#FFFFFF', min: 0.60, label: 'High' },
  { bg: 'oklch(0.4 0.2 150)', text: '#FFFFFF', min: 0.80, label: 'Very High' }
];

interface PivotHeaderProps {
  title?: string;
  totalRecords: number;
  normalization: Normalization;
  onNormalizationChange: (norm: Normalization) => void;
  compact?: boolean;
}

export function PivotHeader({ 
  title, 
  totalRecords, 
  normalization, 
  onNormalizationChange,
  compact 
}: PivotHeaderProps) {

  return (
    <div className={cn(
      "flex items-center justify-between bg-[var(--surface-glass)]/60 backdrop-blur-md z-20 border-b border-[var(--surface-border)]",
      compact ? "px-4 py-2" : "px-6 py-4"
    )}>

      {}
      <div className="flex items-center gap-6">
        {title && (
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--surface-900)] hidden sm:block">
             {title}
           </h3>
        )}

        {}
        <div className="flex items-center gap-1.5 p-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-0)]/40 shadow-inner">
            {[
                { id: 'none', label: 'Values', icon: LayoutGrid },
                { id: 'row', label: 'Row %', icon: ArrowRight },
                { id: 'col', label: 'Col %', icon: ArrowDown },
            ].map(m => (
                <button
                    key={m.id}
                    onClick={() => onNormalizationChange(m.id as Normalization)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all",
                        normalization === m.id 
                            ? "bg-[var(--brand-primary)] text-white shadow-[0_4px_12px_-2px_rgba(var(--brand-primary-rgb),0.3)] scale-[1.02]" 
                            : "text-[var(--surface-400)] hover:text-[var(--surface-700)] hover:bg-[var(--surface-50)]"
                    )}
                    title={`View mode: ${m.label}`}
                >
                    <m.icon size={12} strokeWidth={3} />
                    <span className="hidden sm:inline">{m.label}</span>
                </button>
            ))}
        </div>
      </div>

      {}
      <div className="flex items-center gap-6">
           {}
           <div className="hidden md:flex items-center gap-3 pr-6 border-r border-[var(--surface-border)]">
              <span className="text-[9px] font-black text-[var(--surface-300)] uppercase tracking-[0.2em]">Intensity</span>
              <div className="flex gap-1">
                  {HEATMAP_SCALE.map((step, i) => (
                      <div 
                          key={i} 
                          className="w-3 h-3 rounded-full shadow-sm ring-1 ring-black/5 transition-all hover:scale-150 hover:z-10 cursor-help" 
                          style={{ backgroundColor: step.bg }} 
                          title={`${step.label} (>${Math.round(step.min * 100)}%)`}
                      />
                  ))}
              </div>
           </div>

           {}
           <div className="flex items-center gap-3 text-[10px] font-black text-[var(--surface-600)] uppercase tracking-widest tabular-nums">
               <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse shadow-[0_0_12px_rgba(var(--brand-primary-rgb),0.5)]" />
               <span>{totalRecords.toLocaleString('id-ID')} <span className="opacity-40">Records</span></span>
           </div>
      </div>
    </div>
  );
}
