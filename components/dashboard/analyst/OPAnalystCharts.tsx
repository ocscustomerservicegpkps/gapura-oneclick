'use client';

import AnalystCharts, { type AnalystChartsProps } from '@/components/dashboard/analyst/AnalystCharts';

export default function OPAnalystCharts(props: AnalystChartsProps) {
  return <AnalystCharts {...props} showDelayCodeTab />;
}
