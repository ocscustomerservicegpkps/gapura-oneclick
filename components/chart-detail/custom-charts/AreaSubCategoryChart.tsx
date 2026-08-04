'use client';

import React from 'react';
import { MapPin, Building, Plane, Info } from 'lucide-react';

interface AreaSubCategoryData {
  area: string;
  subCategory: string;
  count: number;
  percentage: number;
}

interface AreaSubCategoryChartProps {
  data: AreaSubCategoryData[];
  title?: string;
  explanation?: string;
}

const AREA_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  description: string;
}> = {
  'TERMINAL': { 
    color: '#2563eb', 
    bgColor: 'bg-blue-50', 
    icon: Building,
    label: 'Terminal',
    description: 'Area Terminal'
  },
  'APRON': { 
    color: '#ca8a04', 
    bgColor: 'bg-yellow-50', 
    icon: Plane,
    label: 'Apron',
    description: 'Sisi Udara'
  },
  'GENERAL': { 
    color: '#6b7280', 
    bgColor: 'bg-gray-50', 
    icon: MapPin,
    label: 'General',
    description: 'Area Umum'
  },
};

export function AreaSubCategoryChart({ 
  data, 
  title = 'Sub-Kategori per Area',
  explanation 
}: AreaSubCategoryChartProps) {

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 flex flex-col overflow-hidden h-full shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-tight">
            {title}
          </h4>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Belum ada data</p>
          </div>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  const primaryAreaKey = data[0]?.area?.toUpperCase() || 'GENERAL';

  let areaConfig = AREA_CONFIG[primaryAreaKey] || AREA_CONFIG['GENERAL'];

  if (title.toUpperCase().includes('TERMINAL')) areaConfig = AREA_CONFIG['TERMINAL'];
  else if (title.toUpperCase().includes('APRON')) areaConfig = AREA_CONFIG['APRON'];

  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedData.map(d => d.count), 1);
  const Icon = areaConfig.icon;

  return (
    <div className={`bg-white rounded-xl border border-gray-100 flex flex-col overflow-hidden transition-all hover:shadow-md h-full relative`}>
      {}
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: areaConfig.color }} />

      {}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-sm ml-1">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${areaConfig.bgColor}`}>
            <Icon size={14} style={{ color: areaConfig.color }} />
          </div>
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-tight">
            {title}
          </h4>
        </div>
        <div className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-500">
          Total: {total.toLocaleString('id-ID')}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-0 min-h-[300px] ml-1">
        <div className="flex-1 overflow-y-auto max-h-[400px] p-5 space-y-4">
          {sortedData.map((item, idx) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            const barWidth = (item.count / maxCount) * 100;

            return (
              <div key={idx} className="group">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors truncate max-w-[200px]" title={item.subCategory}>
                    {item.subCategory}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-800">{item.count}</span>
                    <span className="text-[9px] text-gray-400">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>

                <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-95"
                    style={{ 
                      width: `${Math.max(barWidth, 2)}%`,
                      backgroundColor: areaConfig.color,
                      opacity: 0.8
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {explanation && (
        <div className="ml-1 px-5 py-3 bg-gray-50/50 border-t border-gray-50 flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
