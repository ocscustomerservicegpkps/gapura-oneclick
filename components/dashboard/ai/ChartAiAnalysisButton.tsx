'use client';

export interface ChartAiContext {
  section: string;
  chartTitle: string;
  chartType: string;
  chartData: unknown;
  filters?: Record<string, unknown>;
  featureHints?: string[];
}

export function ChartAiAnalysisButton({ context }: { context: ChartAiContext }) {
  void context;
  return null;
}
