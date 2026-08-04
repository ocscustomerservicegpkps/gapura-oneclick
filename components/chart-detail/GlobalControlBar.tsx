import React from 'react';
import { Percent, Hash, Divide, ArrowRightLeft, ArrowUpFromLine } from 'lucide-react';
import { motion } from 'framer-motion';

export type ViewMode = 'values' | 'percentage' | 'ratio';
export type Normalization = 'none' | 'row' | 'col';

interface GlobalControlBarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  normalization: Normalization;
  setNormalization: (norm: Normalization) => void;
}

export function GlobalControlBar({
  viewMode,
  setViewMode,
  normalization,
  setNormalization
}: GlobalControlBarProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-b border-[#e0e0e0] sticky top-16 z-40 w-full px-3 sm:px-6 py-3 shadow-sm flex items-center gap-4 overflow-x-auto"
    >
      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        {}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-[#666] uppercase tracking-wider whitespace-nowrap">Data View</span>
          <div className="flex bg-[#f5f5f5] rounded-lg p-1 border border-[#e0e0e0]">
            <ToggleButton
              active={viewMode === 'values'}
              onClick={() => setViewMode('values')}
              icon={<Hash size={14} />}
              label="Values"
            />
            <ToggleButton
              active={viewMode === 'percentage'}
              onClick={() => setViewMode('percentage')}
              icon={<Percent size={14} />}
              label="%"
            />
            <ToggleButton
              active={viewMode === 'ratio'}
              onClick={() => setViewMode('ratio')}
              icon={<Divide size={14} />}
              label="Ratio"
            />
          </div>
        </div>

        <div className="h-8 w-px bg-[#e0e0e0] shrink-0" />

        {}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-[#666] uppercase tracking-wider whitespace-nowrap">Normalize</span>
          <div className="flex bg-[#f5f5f5] rounded-lg p-1 border border-[#e0e0e0]">
            <ToggleButton
              active={normalization === 'none'}
              onClick={() => setNormalization('none')}
              label="None"
            />
            <ToggleButton
              active={normalization === 'row'}
              onClick={() => setNormalization('row')}
              icon={<ArrowRightLeft size={14} />}
              label="Row"
            />
            <ToggleButton
              active={normalization === 'col'}
              onClick={() => setNormalization('col')}
              icon={<ArrowUpFromLine size={14} />}
              label="Col"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-[#888] italic hidden lg:block ml-auto shrink-0">
        * Global controls affect all pivot tables and heatmaps below
      </div>
    </motion.div>
  );
}

function ToggleButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon?: React.ReactNode; 
  label: string; 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
        ${active 
          ? 'bg-white text-[#6b8e3d] shadow-sm border border-[#d0d0d0]' 
          : 'text-[#666] hover:bg-[#e0e0e0] hover:text-[#333]'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
