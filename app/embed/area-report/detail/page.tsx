'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AreaReportDetail from '@/components/charts/area-report/AreaReportDetail';
import { EmbedDetailLayout } from '@/components/EmbedDetailLayout';

interface FilterState {
  hub: string;
  branch: string;
  airlines: string;
  area: string;
  sourceSheet: 'NON CARGO' | 'CGO';
  dateFrom?: string;
  dateTo?: string;
  pageIndex?: number;
}

function EmbedAreaReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSheet = searchParams.get('sourceSheet') === 'CGO' ? 'CGO' : 'NON CARGO';
  const sourcePage = searchParams.get('sourcePage') || 'customer-feedback-main';

  const getBackUrl = () => {
    const baseUrl = sourcePage && sourcePage !== 'main' 
      ? `/embed/custom/${sourcePage.toLowerCase().replace(/\s+/g, '-')}`
      : '/embed/custom/customer-feedback-main';
    return `${baseUrl}?${searchParams.toString()}`;
  };

  const isStatic = searchParams.get('viewMode') === 'static';

  const filters: FilterState = {
    hub: searchParams.get('hub') || 'all',
    branch: searchParams.get('branch') || 'all',
    airlines: searchParams.get('airlines') || 'all',
    area: searchParams.get('area') || 'all',
    sourceSheet,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    pageIndex: searchParams.get('pageIndex') ? parseInt(searchParams.get('pageIndex')!) : undefined,
  };

  return (
    <EmbedDetailLayout
      title="Case Report by Area"
      subtitle="Multi-dimensional geographic analysis (Station × Airline × Area)"
      onBack={() => router.push(getBackUrl())}
      isStatic={isStatic}
      filters={filters}
    >
      <AreaReportDetail filters={filters} />
    </EmbedDetailLayout>
  );
}

export default function EmbedAreaReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6b8e3d]"></div>
      </div>
    }>
      <EmbedAreaReportContent />
    </Suspense>
  );
}
