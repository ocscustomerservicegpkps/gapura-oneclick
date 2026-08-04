'use client';

import React from 'react';
import { CheckCircle2, Clock, Hourglass, Info } from 'lucide-react';

interface StatusData {
  status: string;
  count: number;
  percentage: number;
}

interface StatusBreakdownChartProps {
  data: StatusData[];
  title?: string;
  explanation?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
  'CLOSED': { 
    color: '#16a34a', 
    bgColor: 'bg-green-100', 
    icon: CheckCircle2,
    label: 'Selesai'
  },
  'OPEN': { 
    color: '#dc2626', 
    bgColor: 'bg-red-100', 
    icon: Clock,
    label: 'Terbuka'
  },
  'ON PROGRESS': { 
    color: '#ca8a04', 
    bgColor: 'bg-yellow-100', 
    icon: Hourglass,
    label: 'Dalam Proses'
  },
};

function normalizeStatus(status: string): string {
  const normalized = status.toUpperCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('CLOSED') || normalized.includes('SELESAI')) return 'CLOSED';
  if (normalized.includes('OPEN') || normalized.includes('TERBUKA') || normalized.includes('BARU') || normalized.includes('NEW') || normalized.includes('FEEDBACK') || normalized.includes('MENUNGGU') || normalized.includes('DITOLAK')) return 'OPEN';
  if (normalized.includes('PROGRESS') || normalized.includes('PROSES')) return 'ON PROGRESS';
  return normalized;
}

export function StatusBreakdownChart({ 
  data, 
  title = 'Status Penyelesaian',
  explanation 
}: StatusBreakdownChartProps) {

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
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-500">No status data</p>
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

  const processedData = data.map(item => ({
    ...item,
    normalizedStatus: normalizeStatus(item.status)
  }));

  const closedCount = processedData
    .filter(item => item.normalizedStatus === 'CLOSED')
    .reduce((sum, item) => sum + item.count, 0);
  const completionRate = total > 0 ? (closedCount / total) * 100 : 0;

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
        <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-green-800 uppercase">Tingkat Penyelesaian</span>
            <span className="text-lg font-black text-green-700">{completionRate.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-green-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="mt-1 text-[9px] text-green-600">
            {closedCount.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} kasus telah selesai
          </div>
        </div>

        {}
        <div className="flex-1 flex items-center justify-center min-h-[140px]">
          <div className="relative">
            {}
            <div 
              className="w-28 h-28 rounded-full"
              style={{
                background: `conic-gradient(${
                  processedData.map((item, idx) => {
                    const config = STATUS_CONFIG[item.normalizedStatus] || STATUS_CONFIG['OPEN'];
                    const prevPercentages = processedData
                      .slice(0, idx)
                      .reduce((sum, d) => sum + d.percentage, 0);
                    return `${config.color} ${prevPercentages}% ${prevPercentages + item.percentage}%`;
                  }).join(', ')
                })`
              }}
            >
              <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center">
                <span className="text-[9px] text-gray-500 uppercase">Total</span>
                <span className="text-lg font-black text-gray-800">{total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {}
          <div className="ml-4 space-y-1.5">
            {processedData.slice(0, 4).map((item) => {
              const config = STATUS_CONFIG[item.normalizedStatus] || STATUS_CONFIG['OPEN'];
              const Icon = config.icon;

              return (
                <div key={item.status} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: config.color }}
                  >
                    <Icon className="w-2 h-2 text-white" />
                  </div>
                  <span className="text-[9px] text-gray-600 truncate max-w-[80px]">{config.label}</span>
                  <span className="text-[9px] font-bold text-gray-800">{item.percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {}
        <div className="mt-3 space-y-2">
          {processedData.slice(0, 3).map((item) => {
            const config = STATUS_CONFIG[item.normalizedStatus] || STATUS_CONFIG['OPEN'];

            return (
              <div key={item.status} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-600 w-16 truncate">{config.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${item.percentage}%`,
                      backgroundColor: config.color
                    }}
                  />
                </div>
                <span className="text-[9px] font-medium text-gray-700 w-10 text-right">
                  {item.count.toLocaleString('id-ID')}
                </span>
              </div>
            );
          })}
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
