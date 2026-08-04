'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { ForecastResult } from '@/lib/ml-client';
import { fmtNumberEn, shortDateEn } from './format';
import { CAPTION, Section, StatTile } from './primitives';

export function ForecastChartCard({ forecast }: { forecast: ForecastResult }) {
  const data = useMemo(
    () =>
      (forecast.forecast ?? []).map((p) => ({
        date: shortDateEn(p.date),
        predicted: Number(p.predicted_count.toFixed(2)),
        lower: Number((p.lower ?? 0).toFixed(2)),
        range: Number(((p.upper ?? 0) - (p.lower ?? 0)).toFixed(2)),
        upper: Number((p.upper ?? 0).toFixed(2)),
      })),
    [forecast],
  );
  if (data.length === 0) return null;

  const maxUpper = Math.max(...data.map((d) => d.upper), 1);
  const yMax = Math.ceil(maxUpper * 1.1);
  const total = Math.round(data.reduce((s, d) => s + d.predicted, 0));
  const avg = (total / data.length).toFixed(1);

  return (
    <Section title={`Daily Forecast · ${data.length} Days`}>
      <p className={CAPTION}>Overall reports across all stations combined, predicted day by day.</p>
      <div className="mb-4 mt-2 grid grid-cols-2 gap-2">
        <StatTile value={fmtNumberEn(total)} label={`Total over ${data.length} days`} />
        <StatTile value={avg} label="Average per day" />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#475569' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} domain={[0, yMax]} />
            <Tooltip
              cursor={{ stroke: '#059669', strokeDasharray: '2 4', strokeOpacity: 0.5 }}
              contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}
              formatter={(value: number | string, name: string) =>
                name === 'range' || name === 'lower' ? [null, null] : [`~${value} reports`, 'Predicted']}
              labelStyle={{ color: '#0f172a', fontWeight: 600, marginBottom: 2 }}
            />
            <Area dataKey="lower" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="range" stackId="band" stroke="none" fill="url(#forecastBand)" isAnimationActive={false} />
            <Line dataKey="predicted" stroke="#059669" strokeWidth={2.5} dot={{ r: 3, fill: '#059669', stroke: '#fff', strokeWidth: 1.5 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
