'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AirlineIntelligenceDetail from '@/components/charts/case-category-by-airline/AirlineIntelligenceDetail';
import { EmbedDetailLayout } from '@/components/EmbedDetailLayout';

interface FilterState {
  hub: string;
  branch: string;
  airlines: string;
  area: string;
  sourceSheet: 'NON CARGO' | 'CGO';
  dateFrom: string;
  dateTo: string;
}

function EmbedCaseCategoryByAirlineContent() {
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

  const [filters] = useState<FilterState>({
    hub: searchParams.get('hub') || 'all',
    branch: searchParams.get('branch') || 'all',
    airlines: searchParams.get('airlines') || 'all',
    area: searchParams.get('area') || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    sourceSheet,
  });

  return (
    <EmbedDetailLayout
      title="Case Category by Airlines"
      subtitle="Cross-dimensional analysis (Airline × Category)"
      onBack={() => router.push(getBackUrl())}
      isStatic={isStatic}
      filters={filters}
    >
      <AirlineIntelligenceDetail filters={filters} />
    </EmbedDetailLayout>
  );
}

export default function EmbedCaseCategoryByAirlinePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6b8e3d]"></div>
      </div>
    }>
      <EmbedCaseCategoryByAirlineContent />
    </Suspense>
  );
}
