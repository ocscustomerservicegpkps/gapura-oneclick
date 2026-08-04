'use client';

import React from 'react';
import { Plane, Info, AlertCircle, MessageSquare, ThumbsUp } from 'lucide-react';

interface AirlineTypeCategoryData {
  airlineType: string;
  category: string;
  count: number;
  percentage: number;
}

interface AirlineTypeCategoryChartProps {
  data: AirlineTypeCategoryData[];
  title?: string;
  explanation?: string;
}

const AIRLINE_TYPE_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  label: string;
}> = {
  'LOKAL': { 
    color: '#0ea5e9',
    bgColor: 'bg-sky-50', 
    label: 'Lokal'
  },
  'MPA': { 
    color: '#3b82f6',
    bgColor: 'bg-blue-50', 
    label: 'MPA'
  },
  'GARUDA INDONESIA': { 
    color: '#0891b2',
    bgColor: 'bg-cyan-50', 
    label: 'Garuda'
  },
  'CITILINK': { 
    color: '#16a34a',
    bgColor: 'bg-green-50', 
    label: 'Citilink'
  },
  'PELITA AIR': { 
    color: '#8b5cf6',
    bgColor: 'bg-violet-50', 
    label: 'Pelita Air'
  },
  'LION AIR': { 
    color: '#f97316',
    bgColor: 'bg-orange-50', 
    label: 'Lion Air'
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_STYLES: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  'IRREGULARITY': { color: '#ef4444', bg: 'bg-red-500', icon: AlertCircle, label: 'Irregularity' },
  'COMPLAINT': { color: '#f59e0b', bg: 'bg-amber-500', icon: MessageSquare, label: 'Complaint' },
  'COMPLIMENT': { color: '#10b981', bg: 'bg-emerald-500', icon: ThumbsUp, label: 'Compliment' },
};

export function AirlineTypeCategoryChart({ 
  data, 
  title = 'Analisis Jenis Maskapai',
  explanation 
}: AirlineTypeCategoryChartProps) {

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plane className="w-3.5 h-3.5 text-slate-400" />
            {title}
          </h4>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
            <Plane className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-xs text-slate-500 font-medium">Data belum tersedia</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  const groupedByType = data.reduce((acc, item) => {
    const type = item.airlineType?.toUpperCase() || 'LAINNYA';
    if (!acc[type]) acc[type] = { total: 0, categories: {} };
    if (!acc[type].categories[item.category]) acc[type].categories[item.category] = 0;

    acc[type].categories[item.category] += item.count;
    acc[type].total += item.count;
    return acc;
  }, {} as Record<string, { total: number, categories: Record<string, number> }>);

  const sortedTypes = Object.keys(groupedByType).sort((a, b) => {
    return groupedByType[b].total - groupedByType[a].total;
  });

  const categories = ['IRREGULARITY', 'COMPLAINT', 'COMPLIMENT'];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden h-full">
      {}
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-white to-slate-50/50">
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plane className="w-3.5 h-3.5 text-blue-500" />
            {title}
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Distribusi kasus berdasarkan afiliasi maskapai</p>
        </div>
        <div className="flex items-center gap-2">
           {}
           {categories.map(cat => (
             <div key={cat} className="flex items-center gap-1">
               <div className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[cat]?.bg.replace('500', '400')}`} />
               <span className="text-[9px] text-slate-400 font-medium capitalize">{cat.toLowerCase()}</span>
             </div>
           ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        {}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {sortedTypes.slice(0, 3).map((type, idx) => {
            const config = AIRLINE_TYPE_CONFIG[type] || { color: '#64748b', bgColor: 'bg-slate-100', label: type };
            const typeStats = groupedByType[type];

            const dominantCat = categories.reduce((a, b) => (typeStats.categories[a] || 0) > (typeStats.categories[b] || 0) ? a : b);
            const domCount = typeStats.categories[dominantCat] || 0;
            const domRate = (domCount / typeStats.total) * 100;

            return (
              <div key={type} className="flex-1 min-w-[100px] bg-white rounded-xl border border-slate-100 p-3 shadow-sm relative overflow-hidden group">
                 <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${config.bgColor} to-transparent opacity-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
                 <div className="relative z-10">
                   <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                     <span className="text-[9px] font-bold uppercase tracking-wider">{idx + 1}. {config.label}</span>
                   </div>
                   <div className="text-xl font-black text-slate-800 mb-1">
                     {typeStats.total.toLocaleString('id-ID')}
                   </div>
                   <div className="flex items-center gap-1">
                     <div className={`w-1 h-1 rounded-full ${CATEGORY_STYLES[dominantCat]?.bg}`} />
                     <span className="text-[9px] text-slate-400">
                       {domRate.toFixed(0)}% {CATEGORY_STYLES[dominantCat]?.label}
                     </span>
                   </div>
                 </div>
              </div>
            );
          })}
        </div>

        {}
        <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
          {sortedTypes.map((type) => {
            const config = AIRLINE_TYPE_CONFIG[type] || { color: '#64748b', bgColor: 'bg-slate-100', label: type };
            const typeStats = groupedByType[type];

            return (
              <div key={type} className="group">
                {}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className={`w-6 h-6 rounded-lg ${config.bgColor} flex items-center justify-center text-[10px] font-black text-slate-700 shadow-sm`}
                      style={{ color: config.color }}
                    >
                      {config.label.slice(0, 1)}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 leading-tight">{config.label}</div>
                      <div className="text-[9px] text-slate-400">
                        {((typeStats.total / total) * 100).toFixed(1)}% dari total kasus
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-800">{typeStats.total}</div>
                  </div>
                </div>

                {}
                <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden flex w-full">
                  {categories.map((cat) => {
                    const count = typeStats.categories[cat] || 0;
                    const pct = (count / typeStats.total) * 100;
                    if (pct === 0) return null;

                    return (
                      <div 
                        key={cat}
                        className={`h-full ${CATEGORY_STYLES[cat]?.bg} relative group/bar`}
                        style={{ width: `${pct}%` }}
                      >
                         {}
                         <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap z-10 pointer-events-none transition-opacity">
                           {count} {CATEGORY_STYLES[cat]?.label}
                         </div>
                      </div>
                    );
                  })}
                </div>

                {}
                <div className="flex justify-start gap-4 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                   {categories.map(cat => {
                     const count = typeStats.categories[cat] || 0;
                     if (count === 0) return null;
                     return (
                       <span key={cat} className="text-[9px] text-slate-400 flex items-center gap-1">
                         <span className={`w-1 h-1 rounded-full ${CATEGORY_STYLES[cat]?.bg}`} />
                         {count} {CATEGORY_STYLES[cat]?.label}
                       </span>
                     )
                   })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {explanation && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-3 items-start">
          <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
