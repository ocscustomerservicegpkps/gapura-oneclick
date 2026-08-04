'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AreaSubCategoryDetail from '@/components/charts/area-sub-category/AreaSubCategoryDetail';
import { EmbedDetailLayout } from '@/components/EmbedDetailLayout';

interface FilterState {
  hub: string;
  branch: string;
  airlines: string;
  area: string;
  sourceSheet: 'NON CARGO' | 'CGO';
}

function EmbedGeneralCategoryContent() {
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
  };

  return (
    <EmbedDetailLayout
      title="General Category"
      subtitle="Cross-area category analysis"
      onBack={() => router.push(getBackUrl())}
      isStatic={isStatic}
      filters={filters}
    >
      <AreaSubCategoryDetail
        filters={filters}
        categoryField="general_category"
        title="General Category Detail"
        subtitle="Which general categories dominate, where they occur, and what drives them."
      />
    </EmbedDetailLayout>
  );
}

export default function EmbedGeneralCategoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6b8e3d]"></div>
      </div>
    }>
      <EmbedGeneralCategoryContent />
    </Suspense>
  );
}
