
import { z } from 'zod';

export const Severity = z.enum(['TOP RISK', 'HIGH RISK', 'MEDIUM', 'LOW']);
export type Severity = z.infer<typeof Severity>;

const ExecHeadline = z.object({
  sentence: z.string(),
  signal: z.enum(['ok', 'watch', 'risk', 'opportunity']),
  confidence: z.number().min(0).max(1),
});

const ForecastPoint = z.object({
  period: z.string(),
  yhat: z.number(),
  yhat_lower: z.number(),
  yhat_upper: z.number(),
});

export const ForecastSeries = z.object({
  series_key: z.string(),
  history_points: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
  points: z.array(ForecastPoint),
});

export const CaseInsightResponse = z.object({
  headline: ExecHeadline,
  as_of: z.string(),
  records_basis: z.number().int().nonnegative(),
  severity_predicted: Severity.nullable().optional(),
  severity_confidence: z.number().min(0).max(1).nullable().optional(),
  forecast: ForecastSeries.nullable().optional(),
  warnings: z.array(z.string()).default([]),
  model_versions: z.record(z.string(), z.string()).default({}),
});

export type CaseInsightResponse = z.infer<typeof CaseInsightResponse>;
export type ForecastSeries = z.infer<typeof ForecastSeries>;
