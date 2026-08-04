
import { Suspense } from 'react';
import Image from 'next/image';
import { StaticBentoGrid } from '@/components/public-report/StaticBentoGrid';
import { PublicReportLoader } from '@/components/public-report/PublicReportLoader';

export default function PublicReportPage() {
  return (
    <div className="min-h-screen relative bg-[oklch(0.98_0.01_200)] text-[oklch(0.15_0.02_200)] selection:bg-emerald-500/10 overflow-x-hidden">
      {}
      <section className="mb-12 pt-10 text-center relative px-6 md:px-12">
        <div className="relative z-10">
          <div className="mb-10 flex justify-center">
            <Image src="/logo.png" alt="Gapura" width={140} height={48} className="opacity-90" style={{ width: 'auto', height: 'auto' }} priority />
          </div>
          <h1 className="text-5xl md:text-8xl font-display font-black tracking-tight mb-6 text-[oklch(0.15_0.05_200)] leading-[0.9]">
            One Click<br />
            <span className="text-emerald-600">Irregularity</span> Report
          </h1>
          <p className="text-lg md:text-2xl text-[oklch(0.40_0.02_200)] max-w-xl mx-auto font-medium leading-relaxed">
            Unified operational reporting platform.<br />
            Fast, accurate, and transparent.
          </p>
        </div>
        {}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-emerald-500/5 to-transparent blur-[120px] rounded-full pointer-events-none" />
      </section>

      {}
      <div id="bento-grid-ssr">
        <StaticBentoGrid />
      </div>

      {}
      <Suspense fallback={null}>
        <PublicReportLoader />
      </Suspense>
    </div>
  );
}
