'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
}

interface FeedbackBarChartProps {
  title: string;
  data: ChartDataItem[];
  limit?: number;
  sortByValue?: boolean;
  compact?: boolean;
  barColor?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WrappedTick = (props: any) => {
  const { x, y, payload } = props;
  const compact = props.compact ?? false;
  const words = payload.value.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = compact ? 16 : 20;

  words.forEach((word: string) => {
    if ((currentLine + word).length > maxLineLength) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  const lineHeight = compact ? 9 : 11;

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={-8}
          y={i * lineHeight}
          dy={-((lines.length - 1) * (lineHeight / 2))}
          textAnchor="end"
          fill="#57534e"
          fontSize={compact ? 8 : 9}
          fontWeight={700}
          className="tracking-tighter"
        >
          {line}
        </text>
      ))}
    </g>
  );
};

export function FeedbackBarChart({ title, data, limit = 6, sortByValue = true, compact = false, barColor: barColorProp }: FeedbackBarChartProps) {
  const displayData = React.useMemo(() => {
    let result = [...data];
    if (sortByValue) {
      result = result.sort((a, b) => b.value - a.value);
    }
    if (limit > 0) {
      result = result.slice(0, limit);
    }
    return result;
  }, [data, limit, sortByValue]);

  const lowerTitle = title.toLowerCase();
  const barColor = barColorProp || (lowerTitle.includes('complaint')
    ? '#ef4444'
    : lowerTitle.includes('irregularity')
    ? '#f59e0b'
    : lowerTitle.includes('compliment')
    ? '#84cc16'
    : '#0f766e');

  const pxPerBar = compact ? 32 : 55;
  const chartHeight = Math.max(compact ? 140 : 220, displayData.length * pxPerBar);
  const barSize = compact ? 12 : 18;
  const labelFontSize = compact ? 8 : 10;
  const margin = compact
    ? { top: 8, right: 40, left: 4, bottom: 8 }
    : { top: 20, right: 60, left: 10, bottom: 20 };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div style={{ height: chartHeight, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={displayData}
            margin={margin}
            barCategoryGap={compact ? '30%' : '40%'}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#efe9d9" />
            <XAxis
              type="number"
              fontSize={compact ? 8 : 10}
              stroke="#94a3b8"
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => val.toLocaleString('id-ID')}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={compact ? 90 : 125}
              fontSize={compact ? 8 : 9}
              stroke="#64748b"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={<WrappedTick compact={compact} />}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc', opacity: 0.4 }}
              contentStyle={{
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 8px 12px -3px rgba(0,0,0,0.1)',
                fontSize: compact ? '10px' : '11px',
                padding: compact ? '6px 10px' : undefined,
              }}
            />
            <Bar
              dataKey="value"
              fill={barColor}
              radius={[0, 8, 8, 0]}
              barSize={barSize}
              animationDuration={600}
            >
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: labelFontSize, fontWeight: 800, fill: '#57534e' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
