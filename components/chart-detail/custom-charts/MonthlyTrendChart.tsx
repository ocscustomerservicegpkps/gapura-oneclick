'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Info } from 'lucide-react';

interface MonthlyTrendData {
  month: string;
  year?: number;
  count: number;
  previousCount?: number;
  change?: number;
  changePercent?: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyTrendData[];
  title?: string;
  explanation?: string;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mei',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Agu',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Des'
};

export function MonthlyTrendChart({ 
  data, 
  title = 'Monthly Trend',
  explanation 
}: MonthlyTrendChartProps) {

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
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-500">No monthly trend data</p>
            <p className="text-[9px] text-gray-400 mt-1">Data mungkin belum tersedia atau kosong</p>
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

  const sortedData = [...data].sort((a, b) => {
    const ay = Number(a.year ?? 0);
    const by = Number(b.year ?? 0);
    const aMonthKey = String(a.month ?? '00').padStart(2, '0');
    const bMonthKey = String(b.month ?? '00').padStart(2, '0');
    if (ay !== by) return ay - by;
    return aMonthKey.localeCompare(bMonthKey);
  });

  const total = sortedData.reduce((sum, item) => sum + item.count, 0);
  const avg = total / sortedData.length || 0;
  const maxCount = Math.max(...sortedData.map(d => d.count), 1);
  const minCount = Math.min(...sortedData.map(d => d.count));

  const firstValue = sortedData.length > 0 ? sortedData[0].count : 0;
  const lastValue = sortedData.length > 0 ? sortedData[sortedData.length - 1].count : 0;
  const overallTrend = lastValue - firstValue;
  const overallTrendPercent = firstValue > 0 ? (overallTrend / firstValue) * 100 : 0;

  const TrendIcon = overallTrend > 0 ? TrendingUp : overallTrend < 0 ? TrendingDown : Minus;
  const trendColor = overallTrend > 0 ? 'text-red-600' : overallTrend < 0 ? 'text-green-600' : 'text-gray-500';

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e0] flex flex-col overflow-hidden transition-all hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] hover:border-[#6b8e3d]/30">
      <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-[#333] uppercase tracking-tight">
          {title}
        </h4>
        <div className="w-1.5 h-1.5 rounded-full bg-[#6b8e3d]" />
      </div>

      <div className="p-4 flex flex-col gap-4">
        {}
        <div className="p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-[10px] font-bold text-gray-700 uppercase">Tren Keseluruhan</span>
            </div>
            <div className={`flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="text-sm font-bold">
                {overallTrendPercent > 0 ? '+' : ''}{overallTrendPercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-gray-500">
            <span>Rata-rata: {avg.toFixed(0)} kasus/bulan</span>
            <span>Min: {minCount} | Max: {maxCount}</span>
          </div>
        </div>

        {}
        <div className="flex flex-col">
          {}
          <div className="relative flex h-40 md:h-48 items-end gap-1">
        {sortedData.map((item, idx) => {
          const height = (item.count / maxCount) * 100;
          const monthKey = String(item.month ?? '00').padStart(2, '0');
          const monthName = MONTH_NAMES[monthKey] ?? monthKey;
          const isPeak = item.count === maxCount;
          const isLow = item.count === minCount;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full">
                  {}
                  {item.change !== undefined && (
                    <div className={`text-[8px] mb-1 ${
                      item.change > 0 ? 'text-red-500' : 
                      item.change < 0 ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {item.change > 0 ? '+' : ''}{item.change}
                    </div>
                  )}

                  {}
                  <div className="flex-1 flex items-end w-full">
                    <div 
                      className={`w-full min-h-[6px] rounded-t-md transition-all duration-500 relative group cursor-pointer ${
                        isPeak 
                          ? 'bg-red-500 bg-gradient-to-t from-red-500 to-red-400 border border-red-600/60' 
                          : isLow 
                          ? 'bg-green-500 bg-gradient-to-t from-green-500 to-green-400 border border-green-600/60' 
                          : 'bg-emerald-500 bg-gradient-to-t from-emerald-600 to-emerald-400 border border-emerald-700/50'
                      }`}
                      style={{ height: `${Math.max(height, 5)}%` }}
                      aria-label={`${monthName}: ${item.count} kasus`}
                    >
                      {}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {item.count} kasus
                      </div>

                      {}
                      {height > 40 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white">
                            {item.count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {}
                  <div className="text-[9px] text-gray-500 mt-1 text-center">
                    {monthName}
                  </div>
                </div>
              );
            })}
          </div>

          {}
          <div className="mt-2 flex justify-between text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-gray-500">Puncak: {maxCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-500">Terendah: {minCount}</span>
            </div>
          </div>
        </div>

        {}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[9px] font-bold text-gray-500 uppercase mb-2">Last 3 Months</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {sortedData.slice(-3).map((item, idx) => {
              const monthKey = String(item.month ?? '00').padStart(2, '0');
              const monthName = MONTH_NAMES[monthKey] ?? monthKey;
              const changePercent = item.changePercent || 0;

              return (
                <div key={idx} className="min-h-[74px] rounded-lg bg-gray-50 p-2 text-center">
                  <div className="text-[9px] text-gray-500 uppercase">{monthName}</div>
                  <div className="text-lg font-bold text-gray-800">{item.count}</div>
                  {item.change !== undefined && (
                    <div className={`text-[9px] ${
                      changePercent > 0 ? 'text-red-500' : 
                      changePercent < 0 ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {changePercent > 0 ? '↑' : changePercent < 0 ? '↓' : '→'} {Math.abs(changePercent).toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Total Periode</span>
          <span className="text-sm font-bold text-gray-800">{total.toLocaleString('id-ID')}</span>
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
