'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList
} from 'recharts';
import { Info } from 'lucide-react';
import type { QueryResult, ChartVisualization } from '@/types/builder';

interface GroupedBarChartProps {
  visualization: ChartVisualization;
  result: QueryResult;
  title?: string;
  explanation?: string;
  className?: string;
}

const COLORS = {
  irregularity: '#10b981',
  complaint: '#f43f5e',
  compliment: '#0ea5e9',
  default: '#9ca3af'
};

const CATEGORIES = ['Irregularity', 'Complaint', 'Compliment'];

export function GroupedBarChart({ visualization, result, title, explanation, className }: GroupedBarChartProps) {

  const processedData = useMemo(() => {
    if (!result || !result.rows.length) return [];

    const xKey = visualization.xAxis || 'airlines'; 
    const catKey = 'category'; 
    const valKey = 'jumlah';

     
    const grouped: Record<string, any> = {};

     
    result.rows.forEach((row: any) => {
      const xVal = row[xKey];
      const catVal = row[catKey];
      const val = Number(row[valKey]) || 0;

      if (!grouped[xVal]) {
        grouped[xVal] = { name: xVal, total: 0 };

        CATEGORIES.forEach(c => grouped[xVal][c] = 0);
      }

      const normalizedCat = CATEGORIES.find(c => 
        c.toLowerCase() === String(catVal).toLowerCase()
      ) || String(catVal);

      grouped[xVal][normalizedCat] = (grouped[xVal][normalizedCat] || 0) + val;
      grouped[xVal].total += val;
    });

    return Object.values(grouped)
       
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 8);
  }, [result, visualization]);

  if (processedData.length === 0) return null;

  return (
    <div className={`flex flex-col h-full bg-white font-sans text-sm rounded-3xl border border-gray-100 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] overflow-hidden ${className}`}>

      {}
      <div className="px-5 py-3 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10 gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-tight leading-tight">
              {title || 'Kategori per Maskapai'}
            </h3>
            <p className="text-[9px] text-gray-400 font-medium">
              Top 8 Maskapai by Volume
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-3">
          {CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full ring-1 ring-inset ring-black/5"
                style={{ backgroundColor: COLORS[cat.toLowerCase() as keyof typeof COLORS] || COLORS.default }}
              />
              <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="flex-1 w-full min-h-[300px] p-4 pt-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={processedData}
            margin={{ top: 30, right: 10, left: 0, bottom: 20 }}
            barGap={2}
            barCategoryGap="20%"
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="#f1f5f9" 
            />

            <XAxis 
              dataKey="name" 
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
              dy={10}
              interval={0} 
              angle={-45}
              textAnchor="end"
              height={60}
            />

            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickCount={5}
            />

            <Tooltip
              cursor={{ fill: '#f8fafc', opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);

                return (
                  <div className="bg-white/95 backdrop-blur shadow-xl border border-gray-100 rounded-xl p-3 min-w-[160px]">
                    <div className="text-xs font-bold text-gray-800 mb-2 pb-2 border-b border-dashed border-gray-100 flex justify-between">
                       <span>{label}</span>
                       <span className="text-gray-400">Total: {total}</span>
                    </div>
                    {payload.map((entry: any) => (
                      <div key={entry.name} className="flex items-center justify-between text-[10px] mb-1 last:mb-0">
                        <div className="flex items-center gap-1.5">
                          <div 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: entry.color }} 
                          />
                          <span className="text-gray-500 font-medium">{entry.name}</span>
                        </div>
                        <span className="font-bold text-gray-700">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {}
            {CATEGORIES.map((cat) => {
              const color = COLORS[cat.toLowerCase() as keyof typeof COLORS] || COLORS.default;

              return (
                <Bar
                  key={cat}
                  dataKey={cat}
                  fill={color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                  animationDuration={1000}
                >
                  <LabelList 
                    dataKey={cat} 
                    position="top" 
                     
                    formatter={(val: any) => (typeof val === 'number' && val > 0) ? val : ''}
                    style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} 
                  />
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {}
      {explanation && (
        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-50 flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed max-w-2xl">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
