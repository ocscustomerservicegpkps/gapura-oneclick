'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportByCaseCategoryDetail from '@/components/charts/report-by-case-category/ReportByCaseCategoryDetail';
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

function EmbedReportByCaseCategoryContent() {
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
  const hideFilters = searchParams.get('hideFilters') === 'true' || isStatic;
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');

  const filters: FilterState = {
    hub: searchParams.get('hub') || 'all',
    branch: searchParams.get('branch') || 'all',
    airlines: searchParams.get('airlines') || 'all',
    area: searchParams.get('area') || 'all',
    dateFrom: dateFromParam || '',
    dateTo: dateToParam || '',
    sourceSheet,
  };

  return (
    <EmbedDetailLayout
      title="Report by Case Category"
      subtitle="Detailed analysis by category (Irregularity, Complaint, Compliment)"
      onBack={() => router.push(getBackUrl())}
      isStatic={isStatic}
      filters={filters}
    >
      <ReportByCaseCategoryDetail filters={filters} dateRange={hideFilters ? { from: filters.dateFrom, to: filters.dateTo } : undefined} />
    </EmbedDetailLayout>
  );
}

export default function EmbedReportByCaseCategoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6b8e3d]"></div>
      </div>
    }>
      <EmbedReportByCaseCategoryContent />
    </Suspense>
  );
}
