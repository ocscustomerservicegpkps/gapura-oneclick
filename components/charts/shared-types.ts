// Shared chart types. Extracted from per-chart data.ts files that defined
// byte-identical copies. Add here only types that are truly identical across
// charts — divergent shapes (e.g. TrendDataPoint) intentionally stay local.

export interface SeverityDistribution {
  name: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}
