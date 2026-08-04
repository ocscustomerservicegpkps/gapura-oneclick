'use client';

/**
 * Shared presentation blocks for the AI insights dashboard.
 * Aesthetic: iOS/macOS 26 Liquid Glass — soft warm canvas, layered glass
 * surfaces, generous rounded corners, 3D depth via layered shadows,
 * Plus Jakarta Sans typography (already global). Every number is captioned
 * so a non-technical reader knows exactly what it means. All copy in id-ID.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Sparkles, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Minus, ChevronRight, Info, Plane, Building2, MapPin, Layers, Tag,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';
import { cn } from '@/lib/utils';
import { buildCacheKey, readClientCache, writeClientCache } from '@/lib/ai/client-cache';
import type {
  ForecastResult, TrendsResult, TrendEntry, RiskScoreResult, RiskEntry,
  DimensionForecastResult, MLHealthResult, SeasonalityResult,
  ReportCountsResult, ReportCountDimension, ReportCountEntry,
} from '@/lib/ml-client';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export interface MLOverview {
  status: string;
  forecast: ForecastResult | null;
  trends: {
    branch: TrendsResult | null;
    subcategory: TrendsResult | null;
    airline: TrendsResult | null;
    category: TrendsResult | null;
    area: TrendsResult | null;
  };
  risk: RiskScoreResult | null;
  subcategoryForecast: DimensionForecastResult | null;
  categoryForecast: DimensionForecastResult | null;
  reportCounts: ReportCountsResult | null;
  caseRecurrence: ReportCountDimension | null;
  health: MLHealthResult | null;
  seasonality: SeasonalityResult | null;
  generatedAt?: string;
}

const OVERVIEW_CACHE_KEY = buildCacheKey('ml-overview', 'v4');
const OVERVIEW_CACHE_TTL_MS = 15 * 60 * 1000;

export function useMLOverview({ enabled = true }: { enabled?: boolean } = {}) {
  const [data, setData] = useState<MLOverview | null>(() =>
    readClientCache<MLOverview>(OVERVIEW_CACHE_KEY, OVERVIEW_CACHE_TTL_MS),
  );
  const [loading, setLoading] = useState(() => enabled && data === null);
  const [error, setError] = useState('');

  const refresh = useCallback(async (bypassCache = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ai/overview${bypassCache ? '?bypass_cache=true' : ''}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load analysis (${res.status})`);
      }
      const json = (await res.json()) as MLOverview;
      setData(json);
      writeClientCache(OVERVIEW_CACHE_KEY, json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !data) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh]);

  return { loading, error, data, refresh };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function riskEntityName(entry: RiskEntry): string {
  const named = Object.entries(entry).find(([, value]) => typeof value === 'string');
  return named ? String(named[1]) : '—';
}

export function severityLabel(score: number): string {
  if (score >= 0.92) return 'Sangat Tinggi';
  if (score >= 0.78) return 'Tinggi';
  if (score >= 0.58) return 'Sedang-Tinggi';
  if (score >= 0.33) return 'Sedang';
  return 'Rendah';
}

export function signedChange(entry: TrendEntry): number {
  const raw = typeof entry.half_period_change === 'number' ? entry.half_period_change : entry.percent_change;
  const s = entry.direction === 'falling' ? -Math.abs(raw) : Math.abs(raw);
  return Math.max(-100, Math.round(s));
}

export function isNotable(entry: TrendEntry): boolean {
  if (entry.notable === false) return false;
  return entry.recent_count >= 5 && Math.abs(signedChange(entry)) >= 15;
}

export function fmtNumber(x: number, digits = 0): string {
  return x.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSignedPct(x: number): string {
  return `${x > 0 ? '+' : ''}${x.toFixed(0)}%`;
}

export function momentumLabel(m: number): string {
  if (m > 0.75) return 'menaik tajam';
  if (m > 0.62) return 'menaik';
  if (m < 0.25) return 'menurun tajam';
  if (m < 0.38) return 'menurun';
  return 'stabil';
}

export function momentumTone(m: number): string {
  if (m > 0.62) return 'text-[#FF3B30]';
  if (m < 0.38) return 'text-[#34C759]';
  return 'text-neutral-600';
}

// ---------------------------------------------------------------------------
// Executive summary — plain-language sentences a non-technical reader can act on
// ---------------------------------------------------------------------------

export function buildExecutiveSummary(data: MLOverview): string[] {
  const sentences: string[] = [];

  const rc = data.reportCounts?.forecasts?.branch;
  const rcTotal = rc?.total_forecast;
  if (rcTotal) {
    const lo = Math.round(rcTotal.forecast.reduce((s, p) => s + (p.lower ?? 0), 0));
    const hi = Math.round(rcTotal.forecast.reduce((s, p) => s + (p.upper ?? 0), 0));
    sentences.push(
      `Dalam ${rc?.n_periods ?? 4} minggu ke depan, seluruh stasiun diperkirakan menerima sekitar ${Math.round(rcTotal.predicted_total)} laporan baru (rentang ${lo}–${hi}).`,
    );
  } else if ((data.forecast?.forecast ?? []).length > 0) {
    const points = data.forecast!.forecast!;
    const total = points.reduce((s, p) => s + (p.predicted_count || 0), 0);
    sentences.push(
      `Dalam ${points.length} hari ke depan diperkirakan ada sekitar ${Math.round(total)} laporan baru, atau rata-rata ${(total / points.length).toFixed(1)} per hari.`,
    );
  }

  const risingAll = [
    ...(data.trends.airline?.rising ?? []),
    ...(data.trends.branch?.rising ?? []),
    ...(data.trends.category?.rising ?? []),
    ...(data.trends.subcategory?.rising ?? []),
  ].filter(isNotable).sort((a, b) => Math.abs(signedChange(b)) - Math.abs(signedChange(a)));
  const fallingAll = [
    ...(data.trends.airline?.falling ?? []),
    ...(data.trends.branch?.falling ?? []),
    ...(data.trends.category?.falling ?? []),
    ...(data.trends.subcategory?.falling ?? []),
  ].filter(isNotable).sort((a, b) => Math.abs(signedChange(b)) - Math.abs(signedChange(a)));

  const topRising = risingAll[0];
  const topFalling = fallingAll[0];
  if (topRising) {
    sentences.push(
      `Waspada: ${topRising.entity} mengalami kenaikan ${fmtSignedPct(signedChange(topRising))} dibanding periode sebelumnya, dengan ${topRising.recent_count} laporan pada 12 minggu terakhir.`,
    );
  }
  if (topFalling) {
    sentences.push(
      `Membaik: ${topFalling.entity} turun ${fmtSignedPct(signedChange(topFalling))} pada periode yang sama.`,
    );
  }

  const topAirline = data.risk?.rankings?.airline?.[0];
  if (topAirline) {
    const sev = typeof topAirline.severity === 'number' ? severityLabel(topAirline.severity).toLowerCase() : null;
    const recent = typeof topAirline.recent_30d === 'number' ? topAirline.recent_30d : null;
    sentences.push(
      `Maskapai paling perlu diperhatikan: ${riskEntityName(topAirline)} — tercatat ${fmtNumber(topAirline.incident_count)} laporan sepanjang waktu${recent !== null ? `, ${recent} di antaranya dalam 30 hari terakhir` : ''}${sev ? `, dengan tingkat keparahan ${sev}` : ''}.`,
    );
  }

  const caseTop = data.caseRecurrence?.forecasts
    ?.filter((e) => e.entity.toLowerCase() !== 'other' && (e.prob_appear_next ?? 0) >= 0.5)?.[0];
  if (caseTop) {
    const prob = Math.round((caseTop.prob_appear_next ?? 0) * 100);
    sentences.push(
      `Kasus paling mungkin berulang: "${caseTop.entity}" (${prob}% kemungkinan muncul lagi di periode berikutnya).`,
    );
  }

  if (data.seasonality?.peak_season_date) {
    const peak = longDate(data.seasonality.peak_season_date);
    if (peak) sentences.push(`Berdasarkan pola historis, laporan mencapai puncak musim di sekitar ${peak}.`);
  }

  if (sentences.length === 0) {
    sentences.push('Data belum cukup untuk membuat ringkasan.');
  }
  return sentences;
}

// ---------------------------------------------------------------------------
// Design primitives — Liquid Glass surfaces, layered shadows for 3D depth
// ---------------------------------------------------------------------------

/** Base card: soft float on a warm cream canvas. */
const CARD =
  'bg-white/95 backdrop-blur-2xl rounded-[28px] ring-1 ring-black/[0.04] ' +
  'shadow-[0_1px_2px_rgba(15,15,15,0.04),0_10px_28px_-14px_rgba(15,15,15,0.12)]';

/** Elevated card (hero, primary): more depth. */
const CARD_HERO =
  'bg-white/95 backdrop-blur-2xl rounded-[32px] ring-1 ring-black/[0.05] ' +
  'shadow-[0_2px_4px_rgba(15,15,15,0.04),0_24px_56px_-20px_rgba(15,15,15,0.18)]';

/** Nested panel inside a card. */
const PANEL =
  'bg-[#F7F5EF] rounded-2xl ring-1 ring-black/[0.03]';

const KICKER = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500';
const CAPTION = 'text-[12.5px] md:text-[13px] text-neutral-500 leading-relaxed';
const BODY = 'text-[14px] md:text-[15px] text-neutral-700 leading-relaxed';

function Card({
  eyebrow, title, description, right, children, className, elevated = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <section className={cn(elevated ? CARD_HERO : CARD, 'overflow-hidden', className)}>
      <header className="px-5 md:px-7 pt-6 md:pt-7 pb-4 md:pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className={KICKER}>{eyebrow}</p>}
          <h2 className="text-[20px] md:text-[24px] lg:text-[26px] font-semibold text-neutral-900 tracking-[-0.02em] mt-1">
            {title}
          </h2>
          {description && (
            <p className={cn(CAPTION, 'mt-1.5 md:mt-2 max-w-2xl')}>{description}</p>
          )}
        </div>
        {right && <div className="shrink-0 self-start sm:self-auto">{right}</div>}
      </header>
      <div className="px-5 md:px-7 pb-6 md:pb-7">{children}</div>
    </section>
  );
}

/** Small pill tab used for dimension switching. */
function PillTabs({
  tabs, active, onChange,
}: {
  tabs: readonly { key: string; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-neutral-100 ring-1 ring-black/[0.03] max-w-full">
      {tabs.map((t) => {
        const on = t.key === active;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold',
              'transition-all duration-200 min-h-[32px]',
              on
                ? 'bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_6px_-2px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
          >
            {Icon && <Icon size={13} className="opacity-70" />}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Masthead — clean title, no model/algorithm details
// ---------------------------------------------------------------------------

export function Masthead({
  divisionName, onRefresh, refreshing,
}: {
  divisionName: string;
  data?: MLOverview | null; // kept for backward-compat, unused
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="pt-6 md:pt-10 pb-4 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <p className={KICKER}>Wawasan AI</p>
          <h1 className="mt-2 text-[36px] md:text-[52px] lg:text-[64px] font-bold tracking-[-0.03em] text-neutral-900 leading-[1.02]">
            Ringkasan
            <span className="text-neutral-400"> · </span>
            <span className="text-neutral-500 font-semibold">{divisionName}</span>
          </h1>
          <p className={cn(BODY, 'mt-3 md:mt-4 max-w-2xl text-neutral-600')}>
            Prakiraan volume laporan, prioritas perhatian, dan pola pergerakan
            berdasarkan riwayat laporan iregularitas seluruh stasiun.
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-full',
              'bg-white text-neutral-800 text-[13px] font-semibold',
              'ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_-8px_rgba(0,0,0,0.08)]',
              'hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_10px_24px_-8px_rgba(0,0,0,0.12)]',
              'transition-all duration-200 min-h-[44px]',
              'disabled:opacity-50',
            )}
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            Perbarui
          </button>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Highlights — the "read me first" card
// ---------------------------------------------------------------------------

export function EditorialSummary({ sentences }: { sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <section
      className={cn(
        'rounded-[28px] overflow-hidden ring-1 ring-black/[0.05]',
        'bg-gradient-to-br from-white via-white to-[#F7F5EF]',
        'shadow-[0_2px_4px_rgba(15,15,15,0.04),0_20px_48px_-20px_rgba(15,15,15,0.15)]',
      )}
    >
      <div className="px-5 md:px-8 py-6 md:py-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
            <Sparkles size={15} className="text-[#0071E3]" />
          </div>
          <p className={KICKER}>Sorotan Utama</p>
        </div>
        <ol className="mt-4 md:mt-5 space-y-3 md:space-y-4">
          {sentences.map((s, i) => (
            <li key={i} className="flex gap-3 md:gap-4">
              <span className="shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full bg-neutral-900 text-white text-[11.5px] md:text-[12px] font-semibold flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <p className="text-[15px] md:text-[17px] text-neutral-800 leading-[1.55] tracking-[-0.005em]">
                {s}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Key numbers — three big captioned figures
// ---------------------------------------------------------------------------

function KeyNumberCard({
  eyebrow, value, unit, title, description, tone = 'default',
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  title: string;
  description: string;
  tone?: 'default' | 'signal' | 'positive' | 'amber';
}) {
  const toneClass = tone === 'signal' ? 'text-[#FF3B30]'
    : tone === 'positive' ? 'text-[#34C759]'
    : tone === 'amber' ? 'text-[#FF9500]'
    : 'text-neutral-900';

  return (
    <div
      className={cn(
        CARD_HERO,
        'p-5 md:p-6 lg:p-7 flex flex-col justify-between h-full',
        'transition-transform duration-300 hover:-translate-y-0.5',
      )}
    >
      <div>
        <p className={KICKER}>{eyebrow}</p>
        <div className="mt-3 md:mt-4 flex items-baseline gap-2 flex-wrap">
          <span className={cn(toneClass, 'text-[44px] md:text-[56px] lg:text-[64px] font-bold tabular-nums tracking-[-0.04em] leading-none')}>
            {value}
          </span>
          {unit && (
            <span className="text-[13px] md:text-[14px] font-semibold text-neutral-500">{unit}</span>
          )}
        </div>
      </div>
      <div className="mt-4 md:mt-5 pt-4 md:pt-5 border-t border-black/[0.06]">
        <p className="text-[13.5px] md:text-[14.5px] font-semibold text-neutral-900 leading-snug">{title}</p>
        <p className={cn(CAPTION, 'mt-1')}>{description}</p>
      </div>
    </div>
  );
}

export function HeroFigures({ data }: { data: MLOverview }) {
  const rcBranch = data.reportCounts?.forecasts?.branch;
  const rcTotal = rcBranch?.total_forecast;
  const dailyPoints = data.forecast?.forecast ?? [];
  const dailyTotal = dailyPoints.reduce((s, p) => s + (p.predicted_count || 0), 0);
  const useWeekly = Boolean(rcTotal);

  const primaryValue = useWeekly
    ? fmtNumber(Math.round(rcTotal!.predicted_total))
    : fmtNumber(Math.round(dailyTotal));
  const primaryTitle = useWeekly
    ? `Total perkiraan laporan baru`
    : `Total perkiraan laporan baru`;
  const primaryDescription = useWeekly
    ? `Perkiraan jumlah total laporan yang akan diterima seluruh stasiun dalam ${rcBranch?.n_periods ?? 4} minggu ke depan. Angka ini adalah proyeksi berdasarkan tren historis.`
    : `Perkiraan jumlah total laporan baru dalam ${dailyPoints.length} hari ke depan pada seluruh stasiun.`;

  const topAirline = data.risk?.rankings?.airline?.[0];
  const topBranch = data.risk?.rankings?.branch?.[0];

  const airlineDescription = topAirline
    ? `Tercatat ${fmtNumber(topAirline.incident_count)} laporan sepanjang waktu${
        typeof topAirline.recent_30d === 'number' ? `, ${topAirline.recent_30d} di antaranya dalam 30 hari terakhir` : ''
      }${
        typeof topAirline.severity === 'number' ? `. Rata-rata tingkat keparahan: ${severityLabel(topAirline.severity).toLowerCase()}.` : '.'
      }`
    : 'Belum ada data maskapai.';

  const branchDescription = topBranch
    ? `Tercatat ${fmtNumber(topBranch.incident_count)} laporan sepanjang waktu${
        typeof topBranch.recent_30d === 'number' ? `, ${topBranch.recent_30d} di antaranya dalam 30 hari terakhir` : ''
      }${
        typeof topBranch.momentum === 'number' ? `. Momentum saat ini: ${momentumLabel(topBranch.momentum)}.` : '.'
      }`
    : 'Belum ada data stasiun.';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <KeyNumberCard
        eyebrow="Volume Diperkirakan"
        value={primaryValue}
        unit="laporan"
        title={primaryTitle}
        description={primaryDescription}
      />
      <KeyNumberCard
        eyebrow="Maskapai Prioritas"
        value={topAirline ? riskEntityName(topAirline) : '—'}
        title="Maskapai yang paling perlu diawasi"
        description={airlineDescription}
        tone="signal"
      />
      <KeyNumberCard
        eyebrow="Stasiun Prioritas"
        value={topBranch ? riskEntityName(topBranch) : '—'}
        title="Stasiun dengan tingkat risiko tertinggi"
        description={branchDescription}
        tone="amber"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily forecast chart
// ---------------------------------------------------------------------------

export function ForecastChart({
  forecast,
}: {
  forecast: ForecastResult;
  dailyWape?: number | null;
}) {
  const data = useMemo(
    () =>
      (forecast.forecast ?? []).map((p) => ({
        date: shortDate(p.date),
        prediksi: Number(p.predicted_count.toFixed(2)),
        bawah: Number((p.lower ?? 0).toFixed(2)),
        rentang: Number(((p.upper ?? 0) - (p.lower ?? 0)).toFixed(2)),
        upper: Number((p.upper ?? 0).toFixed(2)),
      })),
    [forecast],
  );
  if (data.length === 0) return null;

  const maxUpper = Math.max(...data.map((d) => d.upper), 1);
  const yMax = Math.ceil(maxUpper * 1.1);
  const total = Math.round(data.reduce((s, d) => s + d.prediksi, 0));
  const avg = (total / data.length).toFixed(1);
  const peak = data.reduce((m, d) => (d.prediksi > m.prediksi ? d : m), data[0]);
  const trough = data.reduce((m, d) => (d.prediksi < m.prediksi ? d : m), data[0]);

  return (
    <Card
      eyebrow="Prakiraan Harian"
      title={`${data.length} hari ke depan`}
      description="Perkiraan jumlah laporan yang akan masuk setiap harinya di seluruh stasiun. Area terang menunjukkan rentang kemungkinan; garis tegas adalah nilai perkiraan utama."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <MiniStat label={`Total ${data.length} hari`} value={fmtNumber(total)} unit="laporan" />
        <MiniStat label="Rata-rata per hari" value={avg} unit="laporan" />
        <MiniStat label="Hari terpadat" value={peak.date} unit={`~${Math.round(peak.prediksi)} laporan`} tone="signal" />
        <MiniStat label="Hari tersepi" value={trough.date} unit={`~${Math.round(trough.prediksi)} laporan`} tone="positive" />
      </div>

      <div className="h-56 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0071E3" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#0071E3" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#737373' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#737373' }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              allowDecimals
            />
            <Tooltip
              cursor={{ stroke: '#0071E3', strokeDasharray: '2 4', strokeOpacity: 0.4 }}
              contentStyle={{
                fontSize: 12,
                border: 'none',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 10px 28px -8px rgba(0,0,0,0.14)',
                backdropFilter: 'blur(20px)',
                padding: '8px 12px',
              }}
              formatter={(value: number | string, name: string) =>
                name === 'rentang' || name === 'bawah' ? [null, null] : [`~${value} laporan`, 'Perkiraan']}
              labelStyle={{ color: '#171717', fontWeight: 600, marginBottom: 2 }}
            />
            <Area dataKey="bawah" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="rentang" stackId="band" stroke="none" fill="url(#bandFill)" isAnimationActive={false} />
            <Line
              dataKey="prediksi"
              stroke="#0071E3"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0071E3', stroke: '#fff', strokeWidth: 1.5 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function MiniStat({
  label, value, unit, tone,
}: {
  label: string; value: string; unit?: string; tone?: 'signal' | 'positive';
}) {
  const t = tone === 'signal' ? 'text-[#FF3B30]' : tone === 'positive' ? 'text-[#34C759]' : 'text-neutral-900';
  return (
    <div className={cn(PANEL, 'px-3 py-3 md:px-4 md:py-3.5')}>
      <p className="text-[10.5px] md:text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={cn('mt-1 text-[16px] md:text-[18px] font-semibold tabular-nums leading-tight', t)}>{value}</p>
      {unit && <p className="text-[11px] md:text-[11.5px] text-neutral-500 leading-tight mt-0.5 tabular-nums">{unit}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seasonality — long-term trend + weekday rhythm
// ---------------------------------------------------------------------------

const DOW_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function SeasonalityPanel({ seasonality }: { seasonality: SeasonalityResult }) {
  const dow = useMemo(() => {
    const dates = seasonality.dates ?? [];
    const seasonal = seasonality.seasonal ?? [];
    if (dates.length === 0 || seasonal.length === 0) return null;
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < Math.min(dates.length, seasonal.length); i++) {
      const d = new Date(`${dates[i]}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      sums[d.getDay()] += seasonal[i];
      counts[d.getDay()] += 1;
    }
    return DOW_LABEL.map((label, i) => ({
      label,
      value: counts[i] > 0 ? sums[i] / counts[i] : 0,
    }));
  }, [seasonality]);

  const trendSeries = useMemo(() => {
    const dates = seasonality.dates ?? [];
    const trend = seasonality.trend ?? [];
    const observed = seasonality.observed ?? [];
    const n = Math.min(dates.length, trend.length, observed.length);
    if (n === 0) return [];
    const step = Math.max(1, Math.floor(n / 90));
    const points: { date: string; tren: number; aktual: number }[] = [];
    for (let i = 0; i < n; i += step) {
      points.push({ date: dates[i], tren: Number(trend[i].toFixed(2)), aktual: Number(observed[i].toFixed(0)) });
    }
    return points;
  }, [seasonality]);

  if (!dow && trendSeries.length === 0) return null;

  const dowMax = dow ? Math.max(...dow.map((d) => Math.abs(d.value)), 0.01) : 1;
  const dowPeak = dow ? dow.reduce((m, d) => (d.value > m.value ? d : m), dow[0]) : null;
  const dowLow = dow ? dow.reduce((m, d) => (d.value < m.value ? d : m), dow[0]) : null;
  const peakISO = seasonality.peak_season_date;
  const peak = longDate(peakISO);

  return (
    <Card
      eyebrow="Pola Musiman"
      title="Kapan biasanya laporan naik atau turun"
      description="Grafik kiri menampilkan tren jumlah laporan sepanjang riwayat. Ritme mingguan menunjukkan hari apa yang biasanya paling ramai atau paling sepi."
      right={peak ? (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9500]/10 ring-1 ring-[#FF9500]/20">
          <TrendingUp size={13} className="text-[#FF9500]" />
          <span className="text-[12px] font-semibold text-[#FF9500]">Puncak historis: {peak}</span>
        </div>
      ) : null}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {trendSeries.length > 0 && (
          <div className="lg:col-span-3">
            <p className={KICKER}>Riwayat Jumlah Laporan</p>
            <div className="h-52 md:h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#737373' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                    tickFormatter={(v: string) => shortDate(v)}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#737373' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.95)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 10px 28px -8px rgba(0,0,0,0.14)',
                    }}
                    labelFormatter={(v: string) => longDate(v) ?? v}
                    formatter={(value: number, name: string) => [`${value} laporan`, name === 'tren' ? 'Tren rata-rata' : 'Aktual harian']}
                  />
                  <Area dataKey="aktual" stroke="none" fill="rgba(0,113,227,0.08)" isAnimationActive={false} />
                  <Line dataKey="tren" stroke="#0071E3" strokeWidth={2.5} dot={false} type="monotone" />
                  {peakISO && trendSeries.some((p) => p.date === peakISO) && (
                    <ReferenceDot
                      x={peakISO}
                      y={trendSeries.find((p) => p.date === peakISO)!.tren}
                      r={6}
                      fill="#FF9500"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {dow && (
          <div className="lg:col-span-2">
            <p className={KICKER}>Ritme Mingguan</p>
            <p className={cn(CAPTION, 'mt-1')}>
              Selisih rata-rata jumlah laporan setiap hari dibanding rata-rata mingguan.
            </p>
            <ul className="mt-3 space-y-2">
              {dow.map((d) => {
                const pct = (Math.abs(d.value) / dowMax) * 100;
                const positive = d.value >= 0;
                return (
                  <li key={d.label} className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
                    <span className="text-[12.5px] font-semibold text-neutral-800">{d.label}</span>
                    <div className="h-2.5 bg-neutral-100 rounded-full relative overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full absolute top-0 transition-[width] duration-500',
                          positive ? 'bg-[#FF3B30] left-0' : 'bg-[#34C759] right-0',
                        )}
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                    <span className={cn('text-[11.5px] tabular-nums font-semibold', positive ? 'text-[#FF3B30]' : 'text-[#34C759]')}>
                      {d.value > 0 ? '+' : ''}{d.value.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {dowPeak && dowLow && (
              <p className={cn(CAPTION, 'mt-4 pt-3 border-t border-black/[0.06]')}>
                Biasanya <b className="text-[#FF3B30]">{dowPeak.label}</b> paling ramai, dan <b className="text-[#34C759]">{dowLow.label}</b> paling sepi.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Priority board — table on desktop, stacked cards on mobile
// ---------------------------------------------------------------------------

const RISK_TABS = [
  { key: 'airline', label: 'Maskapai', icon: Plane },
  { key: 'branch', label: 'Stasiun', icon: Building2 },
  { key: 'area', label: 'Area', icon: MapPin },
  { key: 'category', label: 'Kategori', icon: Tag },
  { key: 'subcategory', label: 'Kategori Area', icon: Layers },
  { key: 'case_classification', label: 'Klasifikasi Kasus', icon: Tag },
] as const;
type RiskTabKey = (typeof RISK_TABS)[number]['key'];

function SeverityChip({ score }: { score: number }) {
  const tone =
    score >= 0.78 ? 'text-[#FF3B30] bg-[#FF3B30]/8 ring-[#FF3B30]/15'
    : score >= 0.58 ? 'text-[#FF9500] bg-[#FF9500]/10 ring-[#FF9500]/20'
    : 'text-neutral-700 bg-neutral-100 ring-black/5';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ring-1', tone)}>
      {severityLabel(score)}
    </span>
  );
}

export function RiskTable({ risk }: { risk: RiskScoreResult }) {
  const tabs = useMemo(
    () => RISK_TABS.filter((t) => (risk.rankings?.[t.key]?.length ?? 0) > 0),
    [risk],
  );
  const [tab, setTab] = useState<RiskTabKey>('airline');
  const active: RiskTabKey = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? 'airline');
  const entries = (risk.rankings?.[active] ?? []).slice(0, 8);
  const showSeverity = entries.some((e) => typeof e.severity === 'number');
  const activeLabel = tabs.find((t) => t.key === active)?.label.toLowerCase() ?? 'entitas';

  return (
    <Card
      eyebrow="Papan Prioritas"
      title="Yang paling perlu diperhatikan"
      description={`Diurutkan berdasarkan gabungan jumlah laporan, tingkat keparahan, momentum terkini, dan aktivitas 30 hari terakhir. Semakin atas, semakin butuh perhatian.`}
      right={<PillTabs tabs={tabs} active={active} onChange={(k) => setTab(k as RiskTabKey)} />}
    >
      {entries.length === 0 ? (
        <p className={CAPTION}>Belum ada data peringkat.</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="md:hidden space-y-3">
            {entries.map((entry, idx) => {
              const sev = typeof entry.severity === 'number' ? entry.severity : null;
              const mom = typeof entry.momentum === 'number' ? entry.momentum : null;
              return (
                <li key={riskEntityName(entry)} className={cn(PANEL, 'p-4')}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold tabular-nums',
                        idx === 0 ? 'bg-[#FF3B30] text-white' : 'bg-neutral-900 text-white',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-[15px] font-semibold text-neutral-900 break-words">
                          {riskEntityName(entry)}
                        </p>
                        {sev !== null && <SeverityChip score={sev} />}
                      </div>
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
                        <div>
                          <dt className="text-neutral-500">Total laporan</dt>
                          <dd className="font-semibold text-neutral-900 tabular-nums">{fmtNumber(entry.incident_count)}</dd>
                        </div>
                        <div>
                          <dt className="text-neutral-500">30 hari terakhir</dt>
                          <dd className="font-semibold text-neutral-900 tabular-nums">{entry.recent_30d ?? '—'}</dd>
                        </div>
                        {mom !== null && (
                          <div className="col-span-2">
                            <dt className="text-neutral-500">Momentum saat ini</dt>
                            <dd className={cn('font-semibold', momentumTone(mom))}>{momentumLabel(mom)}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto -mx-2 px-2">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="pb-3 pr-3 font-semibold">#</th>
                  <th className="pb-3 pr-3 font-semibold">Nama {activeLabel}</th>
                  <th className="pb-3 px-3 font-semibold text-right">
                    Total laporan<br />
                    <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">sepanjang waktu</span>
                  </th>
                  <th className="pb-3 px-3 font-semibold text-right">
                    Laporan baru<br />
                    <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">30 hari terakhir</span>
                  </th>
                  {showSeverity && (
                    <th className="pb-3 px-3 font-semibold">
                      Tingkat<br />keparahan
                    </th>
                  )}
                  <th className="pb-3 px-3 font-semibold">
                    Momentum<br />
                    <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">pergerakan terkini</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const sev = typeof entry.severity === 'number' ? entry.severity : null;
                  const mom = typeof entry.momentum === 'number' ? entry.momentum : null;
                  return (
                    <tr
                      key={riskEntityName(entry)}
                      className={cn(
                        'border-t border-black/[0.05] transition-colors',
                        idx === 0 && 'bg-[#FF3B30]/[0.03]',
                      )}
                    >
                      <td className="py-3.5 pr-3 align-middle">
                        <span
                          className={cn(
                            'inline-flex w-7 h-7 rounded-full items-center justify-center text-[12px] font-bold tabular-nums',
                            idx === 0 ? 'bg-[#FF3B30] text-white' : 'bg-neutral-100 text-neutral-700',
                          )}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 pr-3 align-middle font-semibold text-neutral-900 break-words">
                        {riskEntityName(entry)}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right tabular-nums text-neutral-900">
                        {fmtNumber(entry.incident_count)}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right tabular-nums text-neutral-700">
                        {entry.recent_30d ?? '—'}
                      </td>
                      {showSeverity && (
                        <td className="py-3.5 px-3 align-middle">
                          {sev != null ? <SeverityChip score={sev} /> : <span className="text-neutral-400">—</span>}
                        </td>
                      )}
                      <td className={cn('py-3.5 px-3 align-middle text-[12.5px] font-semibold', mom != null ? momentumTone(mom) : 'text-neutral-400')}>
                        {mom != null ? momentumLabel(mom) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className={cn(CAPTION, 'mt-5 pt-4 border-t border-black/[0.06]')}>
        <Info size={12} className="inline text-neutral-400 mr-1 -mt-0.5" />
        <span className="font-semibold text-neutral-700">Cara membaca:</span> Total laporan menghitung seluruh laporan sejak awal
        pencatatan, sementara &ldquo;30 hari terakhir&rdquo; adalah aktivitas terkini. Momentum
        menunjukkan apakah situasinya sedang membaik, memburuk, atau stabil dalam beberapa minggu terakhir.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Movers — trend movers across all 4 dimensions
// ---------------------------------------------------------------------------

const MOVER_TABS = [
  { key: 'airline', label: 'Maskapai', icon: Plane },
  { key: 'branch', label: 'Stasiun', icon: Building2 },
  { key: 'category', label: 'Kategori', icon: Tag },
  { key: 'subcategory', label: 'Kategori Area', icon: Layers },
] as const;
type MoverTabKey = (typeof MOVER_TABS)[number]['key'];

function TrendLine({ entry }: { entry: TrendEntry }) {
  const change = signedChange(entry);
  const rising = change > 0;
  const Arrow = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <li className={cn(PANEL, 'p-3.5 md:p-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4')}>
      <div
        className={cn(
          'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          rising ? 'bg-[#FF3B30]/10' : 'bg-[#34C759]/10',
        )}
      >
        <Arrow size={16} className={rising ? 'text-[#FF3B30]' : 'text-[#34C759]'} />
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] md:text-[14px] font-semibold text-neutral-900 break-words leading-snug">{entry.entity}</p>
        <p className={cn(CAPTION, 'mt-0.5')}>
          {entry.recent_count} laporan dalam 12 minggu terakhir · rata-rata {entry.recent_avg_week.toFixed(1)} per minggu
        </p>
      </div>
      <span className={cn('text-[20px] md:text-[24px] font-bold tabular-nums tracking-[-0.02em]', rising ? 'text-[#FF3B30]' : 'text-[#34C759]')}>
        {fmtSignedPct(change)}
      </span>
    </li>
  );
}

export function MoversPanel({ trends }: { trends: MLOverview['trends'] }) {
  const availableTabs = useMemo(
    () => MOVER_TABS.filter((t) => {
      const dim = trends[t.key];
      return ((dim?.rising ?? []).filter(isNotable).length + (dim?.falling ?? []).filter(isNotable).length) > 0;
    }),
    [trends],
  );
  const [tab, setTab] = useState<MoverTabKey>('airline');
  const active: MoverTabKey = availableTabs.some((t) => t.key === tab) ? tab : (availableTabs[0]?.key ?? 'airline');
  const current = trends[active];
  const rising = (current?.rising ?? []).filter(isNotable).slice(0, 5);
  const falling = (current?.falling ?? []).filter(isNotable).slice(0, 5);
  const suppressed = ((current?.rising?.length ?? 0) + (current?.falling?.length ?? 0)) - (rising.length + falling.length);

  return (
    <Card
      eyebrow="Yang Bergerak"
      title="Perubahan berarti dalam 12 minggu terakhir"
      description="Entitas dengan pergerakan minimal 15% dan sampel minimal 5 laporan. Perubahan yang terlalu kecil atau berbasis data yang terlalu sedikit disembunyikan supaya tidak menyesatkan."
      right={<PillTabs tabs={availableTabs.length ? availableTabs : MOVER_TABS} active={active} onChange={(k) => setTab(k as MoverTabKey)} />}
    >
      {rising.length + falling.length === 0 ? (
        <p className={CAPTION}>Tidak ada perubahan yang berarti — kondisi stabil.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
                <TrendingUp size={12} className="text-[#FF3B30]" />
              </div>
              <p className="text-[11.5px] font-bold text-[#FF3B30] uppercase tracking-[0.14em]">Sedang Naik</p>
            </div>
            {rising.length === 0
              ? <p className={cn(CAPTION, 'py-2')}>Tidak ada yang naik berarti.</p>
              : <ul className="space-y-2">{rising.map((e) => <TrendLine key={e.entity} entry={e} />)}</ul>
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#34C759]/10 flex items-center justify-center">
                <TrendingDown size={12} className="text-[#34C759]" />
              </div>
              <p className="text-[11.5px] font-bold text-[#34C759] uppercase tracking-[0.14em]">Sedang Turun</p>
            </div>
            {falling.length === 0
              ? <p className={cn(CAPTION, 'py-2')}>Tidak ada yang turun berarti.</p>
              : <ul className="space-y-2">{falling.map((e) => <TrendLine key={e.entity} entry={e} />)}</ul>
            }
          </div>
        </div>
      )}
      {suppressed > 0 && (
        <p className={cn(CAPTION, 'mt-5 pt-4 border-t border-black/[0.06]')}>
          <Info size={12} className="inline text-neutral-400 mr-1 -mt-0.5" />
          {suppressed} entitas disembunyikan karena sampel terlalu kecil atau perubahan terlalu tipis.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Report count outlook (per stasiun / kategori / klasifikasi kasus)
// ---------------------------------------------------------------------------

const COUNT_TABS = [
  { key: 'branch', label: 'Per Stasiun', icon: Building2 },
  { key: 'category', label: 'Per Kategori', icon: Tag },
  { key: 'case_classification', label: 'Per Klasifikasi Kasus', icon: Layers },
] as const;
type CountTabKey = (typeof COUNT_TABS)[number]['key'];

export function trendGlyph(dir: ReportCountEntry['trend_direction']): React.ReactNode {
  if (dir === 'rising') return <ArrowUpRight size={12} className="text-[#FF3B30]" />;
  if (dir === 'falling') return <ArrowDownRight size={12} className="text-[#34C759]" />;
  return <Minus size={12} className="text-neutral-400" />;
}
export function trendWord(dir: ReportCountEntry['trend_direction']): string {
  return dir === 'rising' ? 'sedang menaik' : dir === 'falling' ? 'sedang menurun' : 'relatif stabil';
}
export function entityRange(entry: ReportCountEntry): [number, number] {
  const lo = entry.forecast.reduce((s, p) => s + (p.lower ?? p.predicted_count), 0);
  const hi = entry.forecast.reduce((s, p) => s + (p.upper ?? p.predicted_count), 0);
  return [lo, hi];
}
export function isForecastConfident(entry: ReportCountEntry): boolean {
  const [lo, hi] = entityRange(entry);
  return (hi - lo) / (entry.predicted_total || 1) <= 1.5;
}

export function ReportCountForecast({ reportCounts }: { reportCounts: ReportCountsResult }) {
  const available = COUNT_TABS.filter((t) => (reportCounts.forecasts?.[t.key]?.forecasts?.length ?? 0) > 0);
  const [tab, setTab] = useState<CountTabKey>('branch');
  const activeKey = available.some((t) => t.key === tab) ? tab : (available[0]?.key ?? 'branch');
  const dim: ReportCountDimension | undefined = reportCounts.forecasts?.[activeKey];
  if (available.length === 0 || !dim) return null;

  const perLabel = dim.granularity === 'monthly' ? 'bulan' : 'minggu';
  const dimNoun = activeKey === 'branch' ? 'stasiun' : activeKey === 'category' ? 'kategori' : 'klasifikasi kasus';
  const allEntries = (dim.forecasts ?? []).filter((e) => e.entity.toLowerCase() !== 'other');
  const entries = allEntries.filter(isForecastConfident).slice(0, 8);
  const hidden = allEntries.length - entries.length;
  const maxTotal = Math.max(...entries.map((e) => e.predicted_total), 1);
  const total = dim.total_forecast;

  const totalLo = total ? Math.round(total.forecast.reduce((s, p) => s + (p.lower ?? 0), 0)) : null;
  const totalHi = total ? Math.round(total.forecast.reduce((s, p) => s + (p.upper ?? 0), 0)) : null;

  return (
    <Card
      eyebrow="Prakiraan Volume"
      title={`Perkiraan jumlah laporan · ${dim.n_periods} ${perLabel} ke depan`}
      description={`Perkiraan berapa banyak laporan baru per ${dimNoun} yang akan diterima dalam ${dim.n_periods} ${perLabel} ke depan. Angka pada setiap entitas menunjukkan perkiraan utamanya, sementara rentang di bawahnya adalah kemungkinan minimum dan maksimum.`}
      right={<PillTabs tabs={available} active={activeKey} onChange={(k) => setTab(k as CountTabKey)} />}
    >
      {total && (
        <div className={cn(PANEL, 'p-4 md:p-5 mb-5 md:mb-6')}>
          <p className={KICKER}>Total di semua {dimNoun} · {dim.n_periods} {perLabel} ke depan</p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[40px] md:text-[52px] font-bold tabular-nums tracking-[-0.03em] leading-none text-neutral-900">
              {Math.round(total.predicted_total)}
            </span>
            <span className="text-[13px] md:text-[14px] font-semibold text-neutral-500">laporan diperkirakan</span>
          </div>
          {totalLo !== null && totalHi !== null && (
            <p className={cn(CAPTION, 'mt-2')}>
              Kemungkinan besar antara <b className="text-neutral-900 tabular-nums">{totalLo}</b> dan <b className="text-neutral-900 tabular-nums">{totalHi}</b> laporan baru.
            </p>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <p className={CAPTION}>Belum ada entitas dengan sinyal yang cukup jelas.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry, idx) => {
            const [lo, hi] = entityRange(entry);
            const share = typeof entry.recent_share === 'number' ? entry.recent_share : null;
            return (
              <li key={entry.entity} className={cn(PANEL, 'p-3.5 md:p-4 grid grid-cols-[28px_1fr_auto] gap-3 items-center')}>
                <span
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold tabular-nums',
                    idx === 0 ? 'bg-[#0071E3] text-white' : 'bg-white text-neutral-700 ring-1 ring-black/[0.06]',
                  )}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] md:text-[14px] font-semibold text-neutral-900 break-words">{entry.entity}</p>
                  <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0071E3] to-[#00A6FF] rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.max(4, (entry.predicted_total / maxTotal) * 100)}%` }}
                    />
                  </div>
                  <p className={cn(CAPTION, 'mt-1.5 flex items-center gap-1.5 flex-wrap')}>
                    {trendGlyph(entry.trend_direction)}
                    <span>{trendWord(entry.trend_direction)}</span>
                    {share != null && <span>· berkontribusi {Math.round(share * 100)}% dari total</span>}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-[20px] md:text-[22px] font-bold tabular-nums tracking-[-0.02em] text-neutral-900 leading-none">
                    {Math.round(entry.predicted_total)}
                  </p>
                  <p className={cn(CAPTION, 'mt-1 tabular-nums')}>
                    kisaran {Math.round(lo)}–{Math.round(hi)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {(hidden > 0 || dim.aggregated_tail) && (
        <p className={cn(CAPTION, 'mt-5 pt-4 border-t border-black/[0.06]')}>
          <Info size={12} className="inline text-neutral-400 mr-1 -mt-0.5" />
          {hidden > 0 && <>{hidden} entitas disembunyikan karena rentang kemungkinannya terlalu lebar. </>}
          {dim.aggregated_tail && <>Entitas yang jarang muncul digabung sebagai &ldquo;Lainnya&rdquo;.</>}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Category outlook (weekly forecast per kategori / kategori area)
// ---------------------------------------------------------------------------

const CATEGORY_OUTLOOK_TABS = [
  { key: 'category', label: 'Kategori Laporan', icon: Tag },
  { key: 'subcategory', label: 'Kategori Area', icon: Layers },
] as const;
type CategoryOutlookKey = (typeof CATEGORY_OUTLOOK_TABS)[number]['key'];

export function CategoryOutlook({
  categoryForecast, subcategoryForecast,
}: {
  categoryForecast: DimensionForecastResult | null;
  subcategoryForecast: DimensionForecastResult | null;
}) {
  const sources: Record<CategoryOutlookKey, DimensionForecastResult | null> = {
    category: categoryForecast,
    subcategory: subcategoryForecast,
  };
  const available = CATEGORY_OUTLOOK_TABS.filter((t) => (sources[t.key]?.forecasts?.length ?? 0) > 0);
  const [tab, setTab] = useState<CategoryOutlookKey>('category');
  const active: CategoryOutlookKey = available.some((t) => t.key === tab) ? tab : (available[0]?.key ?? 'category');
  const outlook = sources[active];
  if (available.length === 0 || !outlook) return null;
  const entries = (outlook.forecasts ?? []).slice(0, 6);
  if (entries.length === 0) return null;
  const maxTotal = Math.max(...entries.map((e) => e.predicted_total), 1);

  return (
    <Card
      eyebrow="Kategori Berkembang"
      title={active === 'category' ? 'Kategori laporan yang akan paling banyak muncul' : 'Kategori area yang akan paling banyak muncul'}
      description={`Perkiraan jumlah laporan per ${active === 'category' ? 'kategori laporan' : 'kategori area'} dalam 4 minggu ke depan. Angka besar = perkiraan volume; ikon arah menunjukkan tren pergerakannya.`}
      right={<PillTabs tabs={available} active={active} onChange={(k) => setTab(k as CategoryOutlookKey)} />}
    >
      <ol className="space-y-3">
        {entries.map((entry, idx) => (
          <li key={entry.entity} className={cn(PANEL, 'p-3.5 md:p-4 grid grid-cols-[28px_1fr_auto] gap-3 items-center')}>
            <span
              className={cn(
                'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold tabular-nums',
                idx === 0 ? 'bg-[#0071E3] text-white' : 'bg-white text-neutral-700 ring-1 ring-black/[0.06]',
              )}
            >
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] md:text-[14px] font-semibold text-neutral-900 break-words">{entry.entity}</p>
              <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0071E3] to-[#00A6FF] rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(4, (entry.predicted_total / maxTotal) * 100)}%` }}
                />
              </div>
              <p className={cn(CAPTION, 'mt-1.5 flex items-center gap-1.5')}>
                {trendGlyph(entry.trend_direction)}
                <span>Volume {trendWord(entry.trend_direction)}</span>
              </p>
            </div>
            <div className="text-right whitespace-nowrap">
              <p className="text-[20px] md:text-[22px] font-bold tabular-nums tracking-[-0.02em] text-neutral-900 leading-none">
                {Math.round(entry.predicted_total)}
              </p>
              <p className={cn(CAPTION, 'mt-1')}>laporan diperkirakan</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Case recurrence
// ---------------------------------------------------------------------------

export function CaseRecurrencePanel({ recurrence }: { recurrence: ReportCountDimension }) {
  const entries = (recurrence.forecasts ?? [])
    .filter((e) => e.entity.toLowerCase() !== 'other')
    .sort((a, b) => (b.prob_appear_next ?? 0) - (a.prob_appear_next ?? 0))
    .slice(0, 8);
  if (entries.length === 0) return null;
  const perLabel = recurrence.granularity === 'monthly' ? 'bulan' : 'minggu';

  return (
    <Card
      eyebrow="Kasus Cenderung Berulang"
      title="Jenis kasus yang mungkin muncul lagi"
      description={`Angka persentase adalah perkiraan kemungkinan klasifikasi kasus tersebut muncul minimal sekali dalam ${recurrence.n_periods} ${perLabel} ke depan. Semakin tinggi persentasenya, semakin besar peluang kasus itu berulang.`}
    >
      {/* Mobile: stacked cards */}
      <ul className="md:hidden space-y-3">
        {entries.map((e, idx) => {
          const prob = e.prob_appear_next ?? 0;
          const probPct = Math.round(prob * 100);
          const probTone = prob >= 0.7 ? 'text-[#FF3B30]' : prob >= 0.4 ? 'text-[#FF9500]' : 'text-neutral-600';
          return (
            <li key={e.entity} className={cn(PANEL, 'p-4')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold text-neutral-400 tabular-nums">#{String(idx + 1).padStart(2, '0')}</p>
                  <p className="text-[15px] font-semibold text-neutral-900 break-words mt-0.5">{e.entity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-[28px] font-bold tabular-nums tracking-[-0.03em] leading-none', probTone)}>{probPct}%</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">kemungkinan berulang</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <dt className="text-neutral-500">Perkiraan jumlah</dt>
                  <dd className="font-semibold text-neutral-900 tabular-nums">±{Math.round(e.predicted_total)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Rata-rata terkini</dt>
                  <dd className="font-semibold text-neutral-900 tabular-nums">{(e.recent_avg ?? 0).toFixed(1)}</dd>
                </div>
              </dl>
              <p className={cn(CAPTION, 'mt-3 flex items-center gap-1.5')}>
                {trendGlyph(e.trend_direction)} Tren {trendWord(e.trend_direction)}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <th className="pb-3 pr-3">#</th>
              <th className="pb-3 pr-3">Klasifikasi kasus</th>
              <th className="pb-3 px-3 text-right">
                Kemungkinan berulang<br />
                <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">dalam {recurrence.n_periods} {perLabel} ke depan</span>
              </th>
              <th className="pb-3 px-3 text-right">
                Perkiraan jumlah<br />
                <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">jika terjadi</span>
              </th>
              <th className="pb-3 px-3 text-right">
                Rata-rata terkini<br />
                <span className="text-neutral-400 font-normal normal-case tracking-normal text-[10.5px]">per periode</span>
              </th>
              <th className="pb-3 pl-3 text-right">Arah</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
              const prob = e.prob_appear_next ?? 0;
              const probPct = Math.round(prob * 100);
              const probTone = prob >= 0.7 ? 'text-[#FF3B30]' : prob >= 0.4 ? 'text-[#FF9500]' : 'text-neutral-700';
              return (
                <tr key={e.entity} className="border-t border-black/[0.05]">
                  <td className="py-3 pr-3 align-middle text-neutral-400 tabular-nums text-[12px]">{String(idx + 1).padStart(2, '0')}</td>
                  <td className="py-3 pr-3 align-middle font-semibold text-neutral-900 break-words max-w-[280px]">{e.entity}</td>
                  <td className="py-3 px-3 align-middle text-right">
                    <span className={cn('text-[18px] font-bold tabular-nums', probTone)}>{probPct}%</span>
                  </td>
                  <td className="py-3 px-3 align-middle text-right tabular-nums text-neutral-800">±{Math.round(e.predicted_total)}</td>
                  <td className="py-3 px-3 align-middle text-right tabular-nums text-neutral-700">{(e.recent_avg ?? 0).toFixed(1)}</td>
                  <td className="py-3 pl-3 align-middle text-right">{trendGlyph(e.trend_direction)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={cn(CAPTION, 'mt-5 pt-4 border-t border-black/[0.06]')}>
        <ChevronRight size={12} className="inline text-neutral-400 mr-1 -mt-0.5" />
        Persentase &gt; 70% ditandai merah sebagai peringatan — kasus tersebut hampir pasti terjadi lagi.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Backward-compat exports (kept as no-ops or aliases so nothing else breaks)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ModelConfidenceRow = (_: { health: MLHealthResult }) => null;
export const ModelConfidenceStrip = ModelConfidenceRow;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const Colophon = (_: { generatedAt?: string }) => null;

export const SubcategoryOutlook = ({ outlook }: { outlook: DimensionForecastResult }) =>
  <CategoryOutlook categoryForecast={null} subcategoryForecast={outlook} />;
export const RiskLeaderboard = RiskTable;
export const TrendsPanel = ({ trends }: { trends: MLOverview['trends'] }) => <MoversPanel trends={trends} />;

export function StatTile({
  label, value, hint,
}: {
  icon?: unknown;
  label: string;
  value: string;
  hint?: string;
  tone?: unknown;
}) {
  return (
    <div className={cn(CARD, 'p-4 md:p-5')}>
      <p className={KICKER}>{label}</p>
      <p className="mt-1 text-[24px] md:text-[28px] font-bold tabular-nums tracking-[-0.02em] text-neutral-900">{value}</p>
      {hint && <p className={cn(CAPTION, 'mt-1')}>{hint}</p>}
    </div>
  );
}
