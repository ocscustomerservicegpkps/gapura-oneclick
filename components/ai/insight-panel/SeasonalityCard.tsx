'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { SeasonalityResult } from '@/lib/ml-client';
import { longDateEn, shortDateEn } from './format';
import { CAPTION, Section } from './primitives';

const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SeasonalityCard({ seasonality }: { seasonality: SeasonalityResult }) {
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
    return DOW_LABEL.map((label, i) => ({ label, value: counts[i] > 0 ? sums[i] / counts[i] : 0 }));
  }, [seasonality]);

  const trendSeries = useMemo(() => {
    const dates = seasonality.dates ?? [];
    const trend = seasonality.trend ?? [];
    const observed = seasonality.observed ?? [];
    const n = Math.min(dates.length, trend.length, observed.length);
    if (n === 0) return [];
    const step = Math.max(1, Math.floor(n / 90));
    const points: { date: string; trend: number; actual: number }[] = [];
    for (let i = 0; i < n; i += step) {
      points.push({ date: dates[i], trend: Number(trend[i].toFixed(2)), actual: Number(observed[i].toFixed(0)) });
    }
    return points;
  }, [seasonality]);

  if (!dow && trendSeries.length === 0) return null;

  const dowMax = dow ? Math.max(...dow.map((d) => Math.abs(d.value)), 0.01) : 1;
  const dowPeak = dow ? dow.reduce((m, d) => (d.value > m.value ? d : m), dow[0]) : null;
  const dowLow = dow ? dow.reduce((m, d) => (d.value < m.value ? d : m), dow[0]) : null;
  const peakISO = seasonality.peak_season_date;
  const peak = longDateEn(peakISO);

  return (
    <Section
      title="Seasonal Pattern"
      right={peak ? <span className="text-[11px] font-bold text-amber-700">Historical peak: {peak}</span> : undefined}
    >
      <p className={cn(CAPTION, '-mt-1 mb-3')}>Historical data, not a future prediction. Shows the long-term trend and which days are usually busiest.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {trendSeries.length > 0 && (
          <div className="lg:col-span-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-600">Report History</p>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#475569' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(v: string) => shortDateEn(v)}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}
                    labelFormatter={(v: string) => longDateEn(v) ?? v}
                    formatter={(value: number, name: string) => [`${value} reports`, name === 'trend' ? 'Trend average' : 'Daily actual']}
                  />
                  <Area dataKey="actual" stroke="none" fill="#05966915" isAnimationActive={false} />
                  <Line dataKey="trend" stroke="#059669" strokeWidth={2.5} dot={false} type="monotone" />
                  {peakISO && trendSeries.some((p) => p.date === peakISO) && (
                    <ReferenceDot x={peakISO} y={trendSeries.find((p) => p.date === peakISO)!.trend} r={6} fill="#d97706" stroke="#fff" strokeWidth={2} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {dow && (
          <div className="lg:col-span-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-600">Weekly Rhythm</p>
            <ul className="mt-2 space-y-1.5">
              {dow.map((d) => {
                const pct = (Math.abs(d.value) / dowMax) * 100;
                const positive = d.value >= 0;
                return (
                  <li key={d.label} className="grid grid-cols-[30px_1fr_auto] items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-800">{d.label}</span>
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('absolute top-0 h-full rounded-full transition-[width] duration-500', positive ? 'left-0 bg-rose-500' : 'right-0 bg-emerald-500')}
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                    <span className={cn('text-[11px] font-bold tabular-nums', positive ? 'text-rose-600' : 'text-emerald-600')}>
                      {d.value > 0 ? '+' : ''}{d.value.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {dowPeak && dowLow && (
              <p className={cn(CAPTION, 'mt-3 border-t border-slate-100 pt-3')}>
                <b className="text-rose-600">{dowPeak.label}</b> is usually busiest, and <b className="text-emerald-600">{dowLow.label}</b> is usually quietest.
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
