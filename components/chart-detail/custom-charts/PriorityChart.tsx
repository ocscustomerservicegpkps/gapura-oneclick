'use client';

import React from 'react';
import { AlertCircle, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';

interface PriorityData {
  priority: string;
  count: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

interface PriorityChartProps {
  data: PriorityData[];
  title?: string;
  explanation?: string;
}

const PRIORITY_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  label: string;
  description: string;
}> = {
  'HIGH': { 
    color: '#dc2626', 
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'High',
    description: 'Prioritas Tinggi'
  },
  'MEDIUM': { 
    color: '#ca8a04', 
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Medium',
    description: 'Prioritas Sedang'
  },
  'LOW': { 
    color: '#16a34a', 
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Low',
    description: 'Prioritas Rendah'
  },
};

export function PriorityChart({ 
  data, 
  title = 'Analisis Prioritas',
  explanation 
}: PriorityChartProps) {

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#e0e0e0] flex flex-col overflow-hidden h-full">
        <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-[#333] uppercase tracking-tight">
            {title}
          </h4>
          <div className="w-1.5 h-1.5 rounded-full bg-[#6b8e3d]" />
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-500">No priority data</p>
            <p className="text-[9px] text-gray-400 mt-1">Data may not be available yet or is empty</p>
          </div>
        </div>
        {explanation && (
          <div className="px-4 py-3 bg-[#fcfcfc] border-t border-[#f0f0f0] flex gap-2.5 items-start">
            <Info className="w-3.5 h-3.5 text-[#6b8e3d] mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-[#777] leading-relaxed italic">
              {explanation}
            </p>
          </div>
        )}
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  const sortedData = [...data].sort((a, b) => {
    const order = ['HIGH', 'MEDIUM', 'LOW'];
    return order.indexOf(a.priority) - order.indexOf(b.priority);
  });

  const highPriorityCount = sortedData.find(d => d.priority === 'HIGH')?.count || 0;
  const highPriorityPercentage = total > 0 ? (highPriorityCount / total) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e0] flex flex-col overflow-hidden transition-all hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] hover:border-[#6b8e3d]/30 h-full">
      <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-[#333] uppercase tracking-tight">
          {title}
        </h4>
        <div className="w-1.5 h-1.5 rounded-full bg-[#6b8e3d]" />
      </div>

      <div className="p-4 pt-10 flex-1 flex flex-col">
        {}
        <div className={`p-3 rounded-lg border mb-4 ${
          highPriorityPercentage > 30 
            ? 'bg-red-50 border-red-200' 
            : highPriorityPercentage > 15 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className={`w-4 h-4 ${
              highPriorityPercentage > 30 ? 'text-red-600' : 
              highPriorityPercentage > 15 ? 'text-yellow-600' : 'text-green-600'
            }`} />
            <span className={`text-[10px] font-bold uppercase ${
              highPriorityPercentage > 30 ? 'text-red-700' : 
              highPriorityPercentage > 15 ? 'text-yellow-700' : 'text-green-700'
            }`}>
              High Priority Cases
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-800">
              {highPriorityCount.toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-gray-500">
              ({highPriorityPercentage.toFixed(1)}% dari total)
            </span>
          </div>
        </div>

        {}
        <div className="flex-1 space-y-3">
          {sortedData.map((item) => {
            const config = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG['MEDIUM'];
            const TrendIcon = item.trend === 'up' ? ArrowUp : 
                             item.trend === 'down' ? ArrowDown : Minus;

            return (
              <div 
                key={item.priority}
                className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-[10px] font-bold text-gray-700 uppercase">
                      {config.label}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {config.description}
                    </span>
                  </div>
                  {item.trend && (
                    <div className={`flex items-center gap-1 text-[9px] ${
                      item.trend === 'up' ? 'text-red-600' : 
                      item.trend === 'down' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      <TrendIcon className="w-3 h-3" />
                      {item.trendValue && `${item.trendValue > 0 ? '+' : ''}${item.trendValue}%`}
                    </div>
                  )}
                </div>

                <div className="flex items-end gap-3">
                  <div className="text-2xl font-black" style={{ color: config.color }}>
                    {item.count.toLocaleString('id-ID')}
                  </div>
                  <div className="flex-1 pb-1.5">
                    <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: config.color
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-600 pb-1">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center text-[10px] text-gray-500">
            <span>Total Kasus</span>
            <span className="font-bold text-gray-800">{total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {explanation && (
        <div className="px-4 py-3 bg-[#fcfcfc] border-t border-[#f0f0f0] flex gap-2.5 items-start">
          <Info className="w-3.5 h-3.5 text-[#6b8e3d] mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-[#777] leading-relaxed italic">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
