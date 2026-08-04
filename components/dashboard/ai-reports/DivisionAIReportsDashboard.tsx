'use client';

/**
 * DivisionAIReportsDashboard — iOS/macOS 26 aesthetic AI insights page.
 * Composes the shared blocks in ml-overview-sections. No model/algorithm
 * details are surfaced to the user.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useMLOverview,
  buildExecutiveSummary,
  Masthead, EditorialSummary, HeroFigures, ForecastChart,
  SeasonalityPanel, RiskTable, MoversPanel, ReportCountForecast,
  CategoryOutlook, CaseRecurrencePanel,
} from '@/components/ai/ml-overview-sections';

interface DivisionAIReportsDashboardProps {
  division?: string;
  branchFilter?: string | null;
}

const DIVISION_NAMES: Record<string, string> = {
  OS: 'Operation Support',
  OP: 'Operation',
  HC: 'Hub Control',
  HT: 'Hub Terminal',
  OCS: 'Operation Control & Services',
  EMPLOYEE: 'Employee',
};

/** Staggered enter animation for the section stack. */
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={
        'rounded-[28px] bg-white/90 ring-1 ring-black/[0.04] ' +
        'shadow-[0_1px_2px_rgba(15,15,15,0.04),0_10px_28px_-14px_rgba(15,15,15,0.10)] ' +
        'animate-pulse ' + (className ?? '')
      }
    />
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <SkeletonCard className="h-36 md:h-44" />
        <SkeletonCard className="h-36 md:h-44" />
        <SkeletonCard className="h-36 md:h-44" />
      </div>
      <SkeletonCard className="h-80 md:h-96" />
      <SkeletonCard className="h-80 md:h-96" />
      <SkeletonCard className="h-64 md:h-72" />
    </div>
  );
}

export function DivisionAIReportsDashboard({ division = 'OS' }: DivisionAIReportsDashboardProps) {
  const { loading, error, data, refresh } = useMLOverview();
  const divisionName = DIVISION_NAMES[division] || division;
  const summary = useMemo(() => (data ? buildExecutiveSummary(data) : []), [data]);

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      {/* Ambient warm gradient behind everything for iOS 26 canvas feel */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(1200px 800px at 15% -10%, rgba(0,113,227,0.06), transparent 60%),' +
            'radial-gradient(1000px 600px at 100% 0%, rgba(255,149,0,0.05), transparent 60%),' +
            'radial-gradient(1400px 900px at 80% 100%, rgba(52,199,89,0.04), transparent 60%)',
        }}
      />

      <div className="px-4 sm:px-6 md:px-8 lg:px-10 max-w-[1200px] mx-auto pb-16 md:pb-24">
        <Masthead
          divisionName={divisionName}
          data={data}
          onRefresh={() => refresh(true)}
          refreshing={loading}
        />

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Skeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={
                'rounded-[28px] bg-white/90 backdrop-blur-2xl ring-1 ring-black/[0.05] ' +
                'shadow-[0_2px_4px_rgba(15,15,15,0.04),0_20px_48px_-20px_rgba(15,15,15,0.15)] ' +
                'p-8 md:p-12 text-center'
              }
            >
              <p className="text-[18px] md:text-[20px] font-semibold text-neutral-900">{error}</p>
              <button
                onClick={() => refresh()}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0071E3] hover:underline min-h-[44px] px-3"
              >
                Coba lagi
              </button>
            </motion.div>
          )}

          {!loading && !error && data && (
            <motion.div
              key="content"
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-4 md:space-y-6"
            >
              {summary.length > 0 && (
                <motion.div variants={item}>
                  <EditorialSummary sentences={summary} />
                </motion.div>
              )}
              <motion.div variants={item}>
                <HeroFigures data={data} />
              </motion.div>
              {data.forecast?.forecast?.length ? (
                <motion.div variants={item}>
                  <ForecastChart forecast={data.forecast} />
                </motion.div>
              ) : null}
              {data.seasonality ? (
                <motion.div variants={item}>
                  <SeasonalityPanel seasonality={data.seasonality} />
                </motion.div>
              ) : null}
              {data.risk ? (
                <motion.div variants={item}>
                  <RiskTable risk={data.risk} />
                </motion.div>
              ) : null}
              <motion.div variants={item}>
                <MoversPanel trends={data.trends} />
              </motion.div>
              {data.reportCounts ? (
                <motion.div variants={item}>
                  <ReportCountForecast reportCounts={data.reportCounts} />
                </motion.div>
              ) : null}
              {(data.categoryForecast || data.subcategoryForecast) ? (
                <motion.div variants={item}>
                  <CategoryOutlook
                    categoryForecast={data.categoryForecast}
                    subcategoryForecast={data.subcategoryForecast}
                  />
                </motion.div>
              ) : null}
              {data.caseRecurrence ? (
                <motion.div variants={item}>
                  <CaseRecurrencePanel recurrence={data.caseRecurrence} />
                </motion.div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default DivisionAIReportsDashboard;
