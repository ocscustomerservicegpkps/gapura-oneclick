/**
 * English-language formatting helpers for the insight panel.
 * Mirrors the Indonesian helpers in `ml-overview-sections.tsx`, which stay
 * untouched because they're also used by the separate (Indonesian) division
 * AI reports dashboard.
 */

import {
  isNotable, riskEntityName, severityLabel as severityLabelId, signedChange,
  type MLOverview,
} from '@/components/ai/ml-overview-sections';
import type { ReportCountEntry, TrendEntry, RiskEntry } from '@/lib/ml-client';

export function fmtNumberEn(x: number, digits = 0): string {
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSignedPct(x: number): string {
  return `${x > 0 ? '+' : ''}${x.toFixed(0)}%`;
}

export function shortDateEn(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export function longDateEn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SEVERITY_EN: Record<string, string> = {
  'Sangat Tinggi': 'Very High',
  Tinggi: 'High',
  'Sedang-Tinggi': 'Medium-High',
  Sedang: 'Medium',
  Rendah: 'Low',
};
export function severityLabelEn(score: number): string {
  return SEVERITY_EN[severityLabelId(score)] ?? severityLabelId(score);
}

export function momentumLabelEn(m: number): string {
  if (m > 0.75) return 'rising sharply';
  if (m > 0.62) return 'rising';
  if (m < 0.25) return 'falling sharply';
  if (m < 0.38) return 'falling';
  return 'stable';
}

export function momentumToneEn(m: number): string {
  if (m > 0.62) return 'text-rose-600';
  if (m < 0.38) return 'text-emerald-600';
  return 'text-slate-600';
}

export function trendWordEn(dir: ReportCountEntry['trend_direction']): string {
  return dir === 'rising' ? 'trending up' : dir === 'falling' ? 'trending down' : 'stable';
}

export function trendGlyphEn(dir: ReportCountEntry['trend_direction']): string {
  return dir === 'rising' ? '▲' : dir === 'falling' ? '▼' : '—';
}

/** English rewrite of buildExecutiveSummary — same underlying data/logic. */
export function buildExecutiveSummaryEn(data: MLOverview): string[] {
  const sentences: string[] = [];

  const rc = data.reportCounts?.forecasts?.branch;
  const rcTotal = rc?.total_forecast;
  if (rcTotal) {
    const lo = Math.round(rcTotal.forecast.reduce((s, p) => s + (p.lower ?? 0), 0));
    const hi = Math.round(rcTotal.forecast.reduce((s, p) => s + (p.upper ?? 0), 0));
    sentences.push(
      `Over the next ${rc?.n_periods ?? 4} weeks, all stations combined are expected to receive about ${Math.round(rcTotal.predicted_total)} new reports (range ${lo}–${hi}).`,
    );
  } else if ((data.forecast?.forecast ?? []).length > 0) {
    const points = data.forecast!.forecast!;
    const total = points.reduce((s, p) => s + (p.predicted_count || 0), 0);
    sentences.push(
      `Over the next ${points.length} days, about ${Math.round(total)} new reports are expected — an average of ${(total / points.length).toFixed(1)} per day.`,
    );
  }

  const risingAll = [
    ...(data.trends.airline?.rising ?? []),
    ...(data.trends.branch?.rising ?? []),
    ...(data.trends.category?.rising ?? []),
    ...(data.trends.subcategory?.rising ?? []),
  ].filter(isNotable).sort((a: TrendEntry, b: TrendEntry) => Math.abs(signedChange(b)) - Math.abs(signedChange(a)));
  const fallingAll = [
    ...(data.trends.airline?.falling ?? []),
    ...(data.trends.branch?.falling ?? []),
    ...(data.trends.category?.falling ?? []),
    ...(data.trends.subcategory?.falling ?? []),
  ].filter(isNotable).sort((a: TrendEntry, b: TrendEntry) => Math.abs(signedChange(b)) - Math.abs(signedChange(a)));

  const topRising = risingAll[0];
  const topFalling = fallingAll[0];
  if (topRising) {
    sentences.push(
      `Watch out: ${topRising.entity} is up ${fmtSignedPct(signedChange(topRising))} versus the prior period, with ${topRising.recent_count} reports in the last 12 weeks.`,
    );
  }
  if (topFalling) {
    sentences.push(
      `Improving: ${topFalling.entity} is down ${Math.abs(signedChange(topFalling)).toFixed(0)}% over the same period.`,
    );
  }

  const topAirline = data.risk?.rankings?.airline?.[0];
  if (topAirline) {
    const sev = typeof topAirline.severity === 'number' ? severityLabelEn(topAirline.severity).toLowerCase() : null;
    const recent = typeof topAirline.recent_30d === 'number' ? topAirline.recent_30d : null;
    sentences.push(
      `Airline needing the most attention: ${riskEntityName(topAirline as RiskEntry)}, with ${fmtNumberEn(topAirline.incident_count)} reports all-time${recent !== null ? `, ${recent} of them in the last 30 days` : ''}${sev ? `, at ${sev} severity` : ''}.`,
    );
  }

  const caseTop = data.caseRecurrence?.forecasts
    ?.filter((e) => e.entity.toLowerCase() !== 'other' && (e.prob_appear_next ?? 0) >= 0.5)?.[0];
  if (caseTop) {
    const prob = Math.round((caseTop.prob_appear_next ?? 0) * 100);
    sentences.push(
      `Case most likely to recur: "${caseTop.entity}" (${prob}% chance of appearing again next period).`,
    );
  }

  if (data.seasonality?.peak_season_date) {
    const peak = longDateEn(data.seasonality.peak_season_date);
    if (peak) sentences.push(`Based on historical patterns, reports peak for the season around ${peak}.`);
  }

  if (sentences.length === 0) {
    sentences.push('Not enough data yet to build a summary.');
  }
  return sentences;
}
