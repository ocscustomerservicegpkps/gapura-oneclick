'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
}

interface FeedbackDonutChartProps {
  title: string;
  data: ChartDataItem[];
  colors?: string[];
  height?: number | `${number}%`;
}

// Editorial accent cycle — teal, amber, coral, lime, slate (by rank).
const CF_ACCENT_CYCLE = ['#0f766e', '#f59e0b', '#ef4444', '#65a30d', '#78716c'];

function getSliceColor(colors: string[], index: number): string {
  const palette = colors.length > 0 ? colors : CF_ACCENT_CYCLE;
  return palette[index % palette.length];
}

export function FeedbackDonutChart({ title, data, colors = [], height = 170 }: FeedbackDonutChartProps) {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  const isCompact = typeof height === 'number' && height <= 180;

  const innerR = isCompact ? 50 : 78;
  const outerR = isCompact ? 66 : 96;

  const rankedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.value - a.value)
      .map((entry, index) => ({
        ...entry,
        fill: getSliceColor(colors, index),
      }));
  }, [data, colors]);

  const totalFontSize = isCompact ? 'text-[18px]' : 'text-[28px]';
  const totalLabelSize = isCompact ? 'text-[6px]' : 'text-[8px]';
  const legendDotSize = isCompact ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const legendNameSize = isCompact ? 'text-[8px]' : 'text-[10px]';
  const legendValueSize = isCompact ? 'text-[9px]' : 'text-[11px]';
  const labelFontSize = isCompact ? 8 : 10;
  const centerOffset = isCompact ? 'translate-y-[-4px]' : 'translate-y-[-6px]';
  const chartSize = height;
  // A percentage height resolves against the parent's height; reusing that
  // same percentage string as `width` would resolve against the parent's
  // *width* instead, making the chart wrapper claim the full flex-row width
  // and squeeze the legend. Derive width from height via aspect-ratio instead.
  const isPercentHeight = typeof chartSize === 'string';

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {title ? (
        <h4 className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--cf-ink-2,#57534e)]">{title}</h4>
      ) : null}
      <div className="min-h-0 flex-1 flex items-center gap-3">
      <div
        className="relative shrink-0"
        style={isPercentHeight ? { height: chartSize, aspectRatio: '1 / 1' } : { width: chartSize, height: chartSize }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={rankedData}
              cx="50%"
              cy="50%"
              innerRadius={innerR}
              outerRadius={outerR}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              stroke="none"
              startAngle={90}
              endAngle={-270}
              labelLine={false}
              label={({ cx, cy, midAngle, outerRadius, value }) => {
                const RADIAN = Math.PI / 180;
                const radius = Number(outerRadius || 0) + (isCompact ? 4 : 6);
                const x = Number(cx || 0) + radius * Math.cos(-Number(midAngle || 0) * RADIAN);
                const y = Number(cy || 0) + radius * Math.sin(-Number(midAngle || 0) * RADIAN);
                return (
                  <text
                    x={x}
                    y={y}
                    fill="#4b5563"
                    textAnchor={x > Number(cx || 0) ? 'start' : 'end'}
                    dominantBaseline="central"
                    fontSize={labelFontSize}
                    fontWeight={800}
                  >
                    {Number(value || 0).toLocaleString('id-ID')}
                  </text>
                );
              }}
              animationBegin={0}
              animationDuration={600}
            >
              {rankedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 8px 12px -3px rgba(0,0,0,0.1)',
                fontSize: '11px',
                padding: '6px 10px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none ${centerOffset}`}>
          <span className={`cf-display cf-tabular ${totalFontSize} font-semibold text-[var(--cf-ink,#1c1917)] leading-none`}>
            {total.toLocaleString('id-ID')}
          </span>
          <span className={`${totalLabelSize} font-black text-[var(--cf-ink-3,#a8a29e)] uppercase tracking-[0.22em] mt-1`}>
            Total
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 h-full flex flex-col justify-center gap-1.5 overflow-y-auto custom-scrollbar">
        {rankedData.map((entry, index) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={`${entry.name}-${index}`} className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-0.5 min-w-0 ${legendNameSize} font-black uppercase tracking-tight`}
                  style={{ backgroundColor: `${entry.fill}18`, color: entry.fill }}
                >
                  <span className={`${legendDotSize} rounded-full shrink-0`} style={{ backgroundColor: entry.fill }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className={`${legendValueSize} font-black tabular-nums shrink-0`} style={{ color: entry.fill }}>
                  {entry.value.toLocaleString('id-ID')} <span className="opacity-50 font-bold">· {pct}%</span>
                </span>
              </div>
              <div className="h-1 rounded-full bg-[var(--cf-line-soft,#f0ead9)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: entry.fill }} />
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
