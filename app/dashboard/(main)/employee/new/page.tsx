'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/use-auth';
import { getReportReturnPath } from '@/lib/permissions';
import PublicIrregularityForm from '@/components/public-report/PublicIrregularityForm';
import PublicJoumpaForm from '@/components/public-report/PublicJoumpaForm';

type CreateReportTab = 'irregularity' | 'joumpa';

export default function NewReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<CreateReportTab>(
    searchParams.get('type') === 'joumpa' ? 'joumpa' : 'irregularity'
  );

  const onSubmitted = () => {
    const from = searchParams.get('from');
    const returnPath = from && from.startsWith('/dashboard/') ? from : getReportReturnPath(user?.role || '');
    router.push(returnPath);
  };

  return (
    <div className="w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        .cr-page { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; -webkit-font-smoothing: antialiased; color: #101013; }
        .cr-tabs {
          display: inline-flex; gap: 4px;
          padding: 4px;
          background: rgba(0,0,0,0.05);
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .cr-tab {
          padding: 10px 22px;
          border-radius: 999px;
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 600;
          letter-spacing: -0.005em;
          color: #6b6b73;
          cursor: pointer;
          transition: background .2s ease, color .2s ease, transform .1s ease;
        }
        .cr-tab:hover { color: #101013; }
        .cr-tab:active { transform: scale(0.97); }
        .cr-tab--active {
          background: #047857;
          color: #ffffff;
          box-shadow: 0 4px 12px -4px rgba(4,120,87,0.45);
        }
        .cr-tab--active:hover { color: #ffffff; }
      ` }} />

      <div className="cr-page mx-auto w-full max-w-3xl px-4 sm:px-6 pt-8 pb-16">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[#6b6b73] hover:bg-black/5 hover:text-[#101013] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex justify-center mb-8">
          <div className="cr-tabs" role="tablist" aria-label="Report type">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'irregularity'}
              onClick={() => setTab('irregularity')}
              className={cn('cr-tab', tab === 'irregularity' && 'cr-tab--active')}
            >
              Ground Handling Irregularity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'joumpa'}
              onClick={() => setTab('joumpa')}
              className={cn('cr-tab', tab === 'joumpa' && 'cr-tab--active')}
            >
              JOUMPA Report
            </button>
          </div>
        </div>

        {tab === 'irregularity' ? (
          <PublicIrregularityForm
            inline
            mode="internal"
            defaultReporterName={user?.full_name || ''}
            defaultReporterEmail={user?.email || ''}
            onSubmitted={onSubmitted}
          />
        ) : (
          <PublicJoumpaForm
            inline
            mode="internal"
            defaultReporterName={user?.full_name || ''}
            defaultReporterEmail={user?.email || ''}
            onSubmitted={onSubmitted}
          />
        )}
      </div>
    </div>
  );
}
