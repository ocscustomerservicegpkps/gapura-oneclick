'use client';

import { useState } from 'react';
import { Calendar, Filter, Loader2, Database, FileText, Play, RotateCcw } from 'lucide-react';
import { PrismMultiSelect } from '@/components/ui/PrismMultiSelect';
import { cn } from '@/lib/utils';
import { motion, Variants } from 'framer-motion';

interface AnalysisFilters {
  dateFrom: string;
  dateTo: string;
  hubs: string[];
  branches: string[];
  airlines: string[];
  categories: string[];
  source: 'all' | 'NON CARGO' | 'CGO';
}

interface AIAnalysisFilterPanelProps {
  onApply: (filters: AnalysisFilters) => void;
  loading?: boolean;
  availableHubs: string[];
  availableBranches: string[];
  availableAirlines: string[];
  availableCategories: string[];
  hasData: boolean;
}

const SOURCE_OPTIONS: { value: AnalysisFilters['source']; label: string; icon: typeof FileText }[] = [
  { value: 'all', label: 'Global Analytics', icon: Database },
  { value: 'NON CARGO', label: 'Landside & Airside', icon: FileText },
  { value: 'CGO', label: 'Cargo (CGO)', icon: Database },
];

export type { AnalysisFilters };

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};
const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function AIAnalysisFilterPanel({
  onApply,
  loading = false,
  availableHubs,
  availableBranches,
  availableAirlines,
  availableCategories,
}: AIAnalysisFilterPanelProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [source, setSource] = useState<AnalysisFilters['source']>('all');

  const activeFilterCount = [
    dateFrom && dateTo ? 1 : 0,
    selectedHubs.length > 0 ? 1 : 0,
    selectedBranches.length > 0 ? 1 : 0,
    selectedAirlines.length > 0 ? 1 : 0,
    selectedCategories.length > 0 ? 1 : 0,
    source !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleApply = () => {
    onApply({
      dateFrom,
      dateTo,
      hubs: selectedHubs,
      branches: selectedBranches,
      airlines: selectedAirlines,
      categories: selectedCategories,
      source,
    });
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedHubs([]);
    setSelectedBranches([]);
    setSelectedAirlines([]);
    setSelectedCategories([]);
    setSource('all');
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent">

      {}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 ring-1 ring-emerald-100">
            <Filter className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Data Parameters</h3>
            {activeFilterCount > 0 ? (
              <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">{activeFilterCount} Active Filters</p>
            ) : (
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Unfiltered State</p>
            )}
          </div>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            title="Reset Filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 flex-1 pr-1 overflow-y-auto 
                   scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300"
      >

        {}
        <motion.div variants={item} className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Data Source
          </label>
          <div className="flex flex-col gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={cn(
                  'group flex items-center justify-between px-4 py-3 rounded-xl text-xs font-medium transition-all duration-300 border backdrop-blur-md',
                  source === opt.value
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <opt.icon className={cn("w-4 h-4", source === opt.value ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600")} />
                  {opt.label}
                </div>
                {source === opt.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {}
        <motion.div variants={item} className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Timeframe
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative group">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10 transition-colors group-focus-within:text-emerald-600">START</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 pt-3 pb-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500/50 focus:bg-white outline-none transition-all text-sm"
              />
            </div>
            <div className="relative group">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10 transition-colors group-focus-within:text-emerald-600">END</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 pt-3 pb-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500/50 focus:bg-white outline-none transition-all text-sm"
              />
            </div>
          </div>
        </motion.div>

        {}
        <motion.div variants={item} className="grid grid-cols-1 gap-5 pt-2">
          {}
          <div className="space-y-1.5 [&_label]:text-[10px] [&_label]:font-bold [&_label]:text-slate-500 [&_label]:uppercase [&_label]:tracking-widest">
            <PrismMultiSelect
              label="Network Hub"
              placeholder="All Hubs..."
              options={availableHubs.map((h) => ({ label: h, value: h }))}
              values={selectedHubs}
              onChange={setSelectedHubs}
            />
          </div>
          <div className="space-y-1.5 [&_label]:text-[10px] [&_label]:font-bold [&_label]:text-slate-500 [&_label]:uppercase [&_label]:tracking-widest">
            <PrismMultiSelect
              label="Operating Station"
              placeholder="All Stations..."
              options={availableBranches.map((b) => ({ label: b, value: b }))}
              values={selectedBranches}
              onChange={setSelectedBranches}
            />
          </div>
          <div className="space-y-1.5 [&_label]:text-[10px] [&_label]:font-bold [&_label]:text-slate-500 [&_label]:uppercase [&_label]:tracking-widest">
            <PrismMultiSelect
              label="Carrier / Airline"
              placeholder="All Airlines..."
              options={availableAirlines.map((a) => ({ label: a, value: a }))}
              values={selectedAirlines}
              onChange={setSelectedAirlines}
            />
          </div>
          <div className="space-y-1.5 [&_label]:text-[10px] [&_label]:font-bold [&_label]:text-slate-500 [&_label]:uppercase [&_label]:tracking-widest">
            <PrismMultiSelect
              label="Incident Category"
              placeholder="All Categories..."
              options={availableCategories.map((c) => ({ label: c, value: c }))}
              values={selectedCategories}
              onChange={setSelectedCategories}
            />
          </div>
        </motion.div>
      </motion.div>

      {}
      <div className="pt-6 mt-4 border-t border-slate-200">
        <button
          onClick={handleApply}
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-500 hover:shadow-[0_6px_20px_rgba(16,185,129,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />

          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
          {loading ? 'INITIALIZING...' : 'INITIALIZE ANALYTICS'}
        </button>
      </div>
    </div>
  );
}
