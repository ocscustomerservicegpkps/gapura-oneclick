'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIAnalysisFilterPanel, type AnalysisFilters } from '@/components/dashboard/ai-reports/AIAnalysisFilterPanel';
import { AIAssistantChat } from '@/components/dashboard/ai-reports/AIAssistantChat';
import { getAvailableHubs } from '@/app/actions/getHubs';
import { getAvailableBranches } from '@/app/actions/getFilterOptions';

export default function AIReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [analysisFilters, setAnalysisFilters] = useState<AnalysisFilters | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [availableHubs, setAvailableHubs] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const availableAirlines = ['GA', 'QZ', 'JT', 'ID', 'IU', 'SJ'];
  const availableCategories = ['Baggage Handling', 'Passenger Handling', 'Ramp Handling', 'Cargo Handling', 'GSE', 'Delay'];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    getAvailableHubs().then(setAvailableHubs).catch(() => {});
    getAvailableBranches().then(setAvailableBranches).catch(() => {});
  }, []);

  if (!mounted) {
    return <div className="flex-1 w-full bg-slate-50" />;
  }

  return (
    <div className="relative flex-1 h-screen w-full overflow-hidden bg-slate-50 selection:bg-emerald-500/30">

      {}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {}
        <div className="absolute -top-[20%] -left-[10%] h-[60%] w-[50%] rounded-full bg-emerald-300/20 blur-[100px]" />
        <div className="absolute top-[20%] right-[10%] h-[40%] w-[40%] rounded-full bg-purple-300/20 blur-[100px]" />
        <div className="absolute -bottom-[20%] left-[20%] h-[50%] w-[60%] rounded-full bg-blue-300/20 blur-[100px]" />
        {}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex h-full flex-col lg:flex-row">

        {}
        <AnimatePresence>
          {(showMobileFilters || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              className={`
                fixed inset-y-0 left-0 z-50 w-full flex-col border-r border-slate-200 bg-white/80 backdrop-blur-2xl
                lg:static lg:flex lg:w-[400px] xl:w-[480px] h-full overflow-y-auto
                ${showMobileFilters ? 'flex' : 'hidden'}
              `}
            >
              <div className="flex flex-col h-full p-6 lg:p-8 space-y-8">

                {}
                <div className="flex justify-between items-start shrink-0">
                  <div className="space-y-2">
                    <div className="inline-flex items-center justify-center rounded-xl bg-emerald-50 p-2 ring-1 ring-emerald-100 shadow-sm mb-4">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h1 className="text-3xl font-display font-medium tracking-tight text-slate-900">
                      AI <span className="text-emerald-600 italic">Analytics</span>
                    </h1>
                    <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
                      Intelligent Risk Analytics
                    </p>
                  </div>

                  {}
                  <button 
                    onClick={() => setShowMobileFilters(false)}
                    className="lg:hidden p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    Close
                  </button>
                </div>

                {}
                <div className="flex-1 overflow-visible">
                  <AIAnalysisFilterPanel 
                    onApply={(filters) => {
                      setAnalysisFilters(filters);
                      setFiltersApplied(true);
                      if (window.innerWidth < 1024) setShowMobileFilters(false);
                    }}
                    loading={false}
                    availableHubs={availableHubs}
                    availableBranches={availableBranches}
                    availableAirlines={availableAirlines}
                    availableCategories={availableCategories}
                    hasData={filtersApplied}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {}
        <div className="flex flex-1 flex-col h-full relative overflow-hidden">

          {}
          <div className="lg:hidden absolute top-4 left-4 right-4 z-40">
            <button 
              onClick={() => setShowMobileFilters(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-1.5 ring-1 ring-emerald-500/20">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Analytics</h3>
                  <p className="text-[10px] text-slate-500">Tap to change data filters</p>
                </div>
              </div>
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {}
          <div className="h-20 lg:hidden w-full shrink-0" />

          {}
          <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8 overflow-hidden flex flex-col min-h-0">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="flex-1 rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-3xl shadow-xl overflow-hidden ring-1 ring-slate-200/50 flex flex-col min-h-0"
            >
              <AIAssistantChat 
                filters={analysisFilters}
                filtersApplied={filtersApplied}
              />
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
