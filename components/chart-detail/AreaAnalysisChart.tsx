'use client';

import React, { useMemo } from 'react';
import { Plane, Building2, Globe, AlertTriangle, MessageSquare, ThumbsUp } from 'lucide-react';
import type { QueryResult, ChartVisualization } from '@/types/builder';

interface AreaAnalysisChartProps {
  visualization: ChartVisualization;
  result: QueryResult;
  title?: string;
  explanation?: string;
}

const COLORS = {
  irregularity: '#ef4444',
  complaint: '#f97316',
  compliment: '#22c55e',
  default: '#9ca3af'
};

const AREA_ICONS = {
  TERMINAL: Building2,
  APRON: Plane,
  GENERAL: Globe,
  DEFAULT: Globe
};

const AREA_LABELS: Record<string, string> = {
  TERMINAL: 'Terminal Area',
  APRON: 'Apron Area',
  GENERAL: 'General Area'
};

export function AreaAnalysisChart({ result, title, explanation }: AreaAnalysisChartProps) {

  const areaData = useMemo(() => {
    if (!result || !result.rows.length) return [];

    const groups: Record<string, Record<string, number>> = {
      TERMINAL: { Irregularity: 0, Complaint: 0, Compliment: 0, Total: 0 },
      APRON: { Irregularity: 0, Complaint: 0, Compliment: 0, Total: 0 },
      GENERAL: { Irregularity: 0, Complaint: 0, Compliment: 0, Total: 0 }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.rows.forEach((row: any) => {

      let area = 'GENERAL';
      const rowArea = String(row.area || row.AREA || row.Area || '').toUpperCase();
      if (rowArea.includes('TERMINAL')) area = 'TERMINAL';
      else if (rowArea.includes('APRON')) area = 'APRON';
      else if (rowArea.includes('GENERAL')) area = 'GENERAL';

      let category = 'Irregularity';
      const rowCat = String(row.category || row.CATEGORY || row.Category || '').toLowerCase();
      if (rowCat.includes('irregularity')) category = 'Irregularity';
      else if (rowCat.includes('complaint') || rowCat.includes('keluhan')) category = 'Complaint';
      else if (rowCat.includes('compliment') || rowCat.includes('pujian')) category = 'Compliment';

      const val = Number(row.jumlah || row.JUMLAH || row.count || row.COUNT || row.total || row.TOTAL || 0);

      if (groups[area]) {
        groups[area][category] = (groups[area][category] || 0) + val;
        groups[area].Total += val;
      }
    });

    return Object.entries(groups).map(([key, stats]) => ({
      key,
      label: AREA_LABELS[key] || key,
      stats
    }));
  }, [result]);

  if (!areaData.length) return null;

  return (
    <div className="flex flex-col h-auto bg-white font-sans text-sm rounded-3xl border border-gray-100 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] overflow-hidden">

      {}
      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-tight leading-tight">
            {title || 'Analisis Area Operasional'}
          </h3>
        </div>
      </div>

      {}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {areaData.map((item) => {
          const Icon = AREA_ICONS[item.key as keyof typeof AREA_ICONS] || AREA_ICONS.DEFAULT;
          const total = item.stats.Total;

          return (
            <div key={item.key} className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">

              {}
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-xl ${
                  item.key === 'TERMINAL' ? 'bg-blue-100 text-blue-600' :
                  item.key === 'APRON' ? 'bg-amber-100 text-amber-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  <Icon size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">{item.label}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">{total} Reports</p>
                </div>
              </div>

              {}
              <div className="space-y-2">
                {}
                <StatRow 
                  label="Irregularity" 
                  value={item.stats.Irregularity} 
                  total={total}
                  color={COLORS.irregularity}
                  icon={<AlertTriangle size={10} />}
                />

                {}
                <StatRow 
                  label="Complaint" 
                  value={item.stats.Complaint} 
                  total={total}
                  color={COLORS.complaint}
                  icon={<MessageSquare size={10} />}
                />

                {}
                <StatRow 
                  label="Compliment" 
                  value={item.stats.Compliment} 
                  total={total}
                  color={COLORS.compliment}
                  icon={<ThumbsUp size={10} />}
                />
              </div>

            </div>
          );
        })}
      </div>

      {}
      {explanation && (
        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-50 flex gap-2 items-start">
          <div className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed max-w-2xl">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, total, color, icon }: { label: string, value: number, total: number, color: string, icon: React.ReactNode }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-1.5 text-slate-600">
        <span style={{ color }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800">{value}</span>
        <span className="text-[9px] text-slate-400 w-8 text-right">({percent}%)</span>
      </div>
    </div>
  );
}
