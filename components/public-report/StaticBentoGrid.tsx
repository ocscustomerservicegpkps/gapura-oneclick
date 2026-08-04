
type BentoItem = {
  title: string;
  description: string;
  color: string;
  span: string;
  badge: string;
};

const BENTO_SECTIONS: { label: string; items: BentoItem[] }[] = [
  {
    label: 'AI Assistant',
    items: [
      {
        title: "I'm in Charge Virtual Assistant",
        description: 'Ask the AI assistant for operational help.',
        color: 'oklch(0.60 0.18 260)',
        span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
        badge: 'Launch',
      },
    ],
  },
  {
    label: 'Irregularity, Complaint & Compliment Reports',
    items: [
      {
        title: 'Ground Handling Irregularity Report',
        description: 'Report ground handling operational issues, damage, or irregularities.',
        color: 'oklch(0.55 0.22 30)',
        span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
        badge: 'Launch',
      },
      {
        title: 'Joumpa Irregularity Report',
        description: 'Report operational issues, damage, or irregularities related to JOUMPA service.',
        color: 'oklch(0.50 0.15 190)',
        span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
        badge: 'Quick Access',
      },
    ],
  },
  {
    label: 'Passenger Survey Reports',
    items: [
      {
        title: 'Customer Airline Passenger Survey',
        description: 'Help us improve our service via passenger survey.',
        color: 'oklch(0.60 0.20 340)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'Joumpa Customer Survey',
        description: 'Help us improve JOUMPA service via customer survey.',
        color: 'oklch(0.52 0.17 300)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
    ],
  },
  {
    label: 'Form & Reports',
    items: [
      {
        title: '[DOS] Direct Observation Form',
        description: 'Quick access to the Direct Observation Form submission.',
        color: 'oklch(0.50 0.18 250)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'Form SLA Report',
        description: 'Quick access to SLA report submission.',
        color: 'oklch(0.45 0.18 240)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'Form Inspeksi Health, Safety & Environment',
        description: 'HEALTH, SAFETY & ENVIRONMENT (HSE)',
        color: 'oklch(0.62 0.22 28)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'HSSE Report',
        description: 'Quick QR access and redirect to the HSSE Report portal.',
        color: 'oklch(0.58 0.2 35)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
    ],
  },
  {
    label: 'Documents / Guideline',
    items: [
      {
        title: 'Standard Appearance Manual (SAM)',
        description: 'Operational standard appearance guideline.',
        color: 'oklch(0.50 0.16 200)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'Weekly Service Notice',
        description: 'Access the Weekly Service Notice in one link.',
        color: 'oklch(0.55 0.18 180)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Quick Access',
      },
      {
        title: 'Handbook SLA',
        description: 'Operational service standards handbook.',
        color: 'oklch(0.45 0.20 160)',
        span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
        badge: 'Launch',
      },
    ],
  },
];

export function StaticBentoGrid() {
  return (
    <main className="max-w-7xl mx-auto mb-32 relative z-10">
      <div className="px-4 md:px-0">
        {BENTO_SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[oklch(0.50_0.02_200)]">{section.label}</span>
              <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] lg:auto-rows-[minmax(220px,auto)] grid-flow-row-dense">
              {section.items.map((item) => (
                <div
                  key={item.title}
                  className={`${item.span} group relative cursor-pointer animate-[fadeInUp_0.5s_ease-out_both]`}
                >
                  <div
                    className="h-full rounded-[24px] border border-[oklch(0.15_0.02_200_/_0.05)] bg-[oklch(1_0_0_/_0.6)] backdrop-blur-xl hover:border-emerald-500/30 transition-all duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                  >
                    <div className="p-5 md:p-7 h-full flex flex-col justify-between relative z-10 overflow-hidden">
                      <div className="space-y-1.5 md:space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-[oklch(1_0_0_/_0.4)] border border-white/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
                            <div className="w-4 h-4 md:w-6 md:h-6 rounded-full" style={{ background: item.color }} />
                          </div>
                        </div>
                        <div className="space-y-0.5 md:space-y-2">
                          <h3 className="text-base md:text-2xl font-black tracking-tight text-[oklch(0.15_0.05_200)] leading-tight">
                            {item.title}
                          </h3>
                          <p className="hidden md:block text-sm text-[oklch(0.45_0.02_200)] leading-relaxed font-medium">{item.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[oklch(0.15_0.02_200_/_0.2)] mt-auto">
                        <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase">{item.badge}</span>
                        <svg className="w-4 h-4 md:w-5 md:h-5 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-[24px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` }} />
    </main>
  );
}
