'use client';

import React from 'react';
import { PieChart, Info } from 'lucide-react';

interface CategoryDistributionData {
  category: string;
  count: number;
  percentage: number;
}

interface CategoryDistributionChartProps {
  data: CategoryDistributionData[];
  title?: string;
  explanation?: string;
}

const CATEGORY_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  label: string;
  icon: string;
}> = {
  'IRREGULARITY': { 
    color: '#ef5350', 
    bgColor: 'bg-red-100', 
    label: 'Irregularity',
    icon: '⚠️'
  },
  'COMPLAINT': { 
    color: '#ffa726', 
    bgColor: 'bg-orange-100', 
    label: 'Complaint',
    icon: '📢'
  },
  'COMPLIMENT': { 
    color: '#7cb342', 
    bgColor: 'bg-green-100', 
    label: 'Compliment',
    icon: '👍'
  },
};

export function CategoryDistributionChart({ 
  data, 
  title = 'Distribusi Kategori',
  explanation 
}: CategoryDistributionChartProps) {

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
              <PieChart className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[11px] text-gray-500">No category data</p>
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

  const sortedData = [...data].sort((a, b) => b.count - a.count);

  const complimentData = sortedData.find(d => d.category.toUpperCase() === 'COMPLIMENT');
  const complaintData = sortedData.find(d => d.category.toUpperCase() === 'COMPLAINT');
  const irregularityData = sortedData.find(d => d.category.toUpperCase() === 'IRREGULARITY');

  const complimentPercentage = complimentData?.percentage || 0;
  const complaintPercentage = complaintData?.percentage || 0;
  const irregularityPercentage = irregularityData?.percentage || 0;

  const healthScore = complimentPercentage + (complaintPercentage * 0.3);
  const healthStatus = healthScore > 50 ? 'Baik' : healthScore > 25 ? 'Perlu Perhatian' : 'Kritis';
  const healthColor = healthScore > 50 ? 'text-green-600' : healthScore > 25 ? 'text-yellow-600' : 'text-red-600';

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
        <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Health Score</div>
              <div className={`text-2xl font-black ${healthColor}`}>
                {healthScore.toFixed(0)}%
              </div>
            </div>
            <div className="text-right">
              <div className={`text-[10px] font-bold uppercase ${healthColor}`}>
                {healthStatus}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">
                {complimentPercentage.toFixed(1)}% Compliment
              </div>
            </div>
          </div>

          {}
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {}
        <div className="flex-1 flex items-center justify-center min-h-[150px]">
          <div className="relative">
            {}
            <div 
              className="w-32 h-32 rounded-full"
              style={{
                background: `conic-gradient(${
                  sortedData.map((item, idx) => {
                    const config = CATEGORY_CONFIG[item.category.toUpperCase()] || CATEGORY_CONFIG['IRREGULARITY'];
                    const prevPercentages = sortedData
                      .slice(0, idx)
                      .reduce((sum, d) => sum + d.percentage, 0);
                    return `${config.color} ${prevPercentages}% ${prevPercentages + item.percentage}%`;
                  }).join(', ')
                })`
              }}
            >
              {}
              <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center">
                <span className="text-[9px] text-gray-400 uppercase">Total</span>
                <span className="text-xl font-black text-gray-800">{total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {}
          <div className="ml-6 space-y-2">
            {sortedData.map((item) => {
              const config = CATEGORY_CONFIG[item.category.toUpperCase()] || CATEGORY_CONFIG['IRREGULARITY'];

              return (
                <div key={item.category} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-md flex items-center justify-center text-xs"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-gray-700">{config.label}</div>
                    <div className="text-[9px] text-gray-500">{item.count} kasus</div>
                  </div>
                  <div className="text-[10px] font-bold" style={{ color: config.color }}>
                    {item.percentage.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {sortedData.map((item) => {
            const config = CATEGORY_CONFIG[item.category.toUpperCase()] || CATEGORY_CONFIG['IRREGULARITY'];

            return (
              <div 
                key={item.category}
                className={`${config.bgColor} rounded-lg p-2 text-center border-2 border-transparent hover:border-current transition-all cursor-pointer`}
                style={{ borderColor: config.color }}
              >
                <div className="text-lg">{config.icon}</div>
                <div className="text-sm font-bold" style={{ color: config.color }}>
                  {item.count}
                </div>
                <div className="text-[9px] text-gray-600 uppercase">{config.label}</div>
              </div>
            );
          })}
        </div>

        {}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[9px] text-gray-500 text-center">
            <span className="font-bold text-red-500">{irregularityPercentage.toFixed(0)}%</span> Irregularity • 
            <span className="font-bold text-orange-500"> {complaintPercentage.toFixed(0)}%</span> Complaint • 
            <span className="font-bold text-green-500"> {complimentPercentage.toFixed(0)}%</span> Compliment
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
