'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Tag, Info } from 'lucide-react';

interface SubCategoryData {
  subCategory: string;
  parentCategory: string;
  count: number;
}

interface SubCategoryDetailChartProps {

  result?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: any[];
  };

  data?: SubCategoryData[];
  title?: string;
  explanation?: string;
  limit?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'IRREGULARITY': '#ef4444',
  'COMPLAINT': '#f97316',
  'COMPLIMENT': '#22c55e',
  'DEFAULT': '#3b82f6'
};

export function SubCategoryDetailChart({ 
  result,
  data: initialData, 
  title = 'Detail Sub-Kategori',
  explanation,
  limit = 20
}: SubCategoryDetailChartProps) {

  const data = useMemo(() => {
    if (initialData) return initialData;
    if (!result?.rows) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.rows.map((row: any) => ({
      subCategory: row.subCategory || row.subcategory || 'Unknown',
      parentCategory: row.parentCategory || row.parentcategory || 'Lainnya',
      count: Number(row.count || row.COUNT || 0)
    }));
  }, [result, initialData]);

  const [expanded, setExpanded] = useState(false);
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const displayData = expanded ? sortedData : sortedData.slice(0, limit);
  const maxCount = Math.max(...sortedData.map(d => d.count), 1);

  const groupedByParent = useMemo(() => {
    return displayData.reduce((acc, item) => {
      const parent = item.parentCategory || 'Lainnya';
      if (!acc[parent]) acc[parent] = [];
      acc[parent].push(item);
      return acc;
    }, {} as Record<string, typeof data>);
  }, [displayData]);

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
              <Tag className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Belum ada data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col overflow-hidden transition-all hover:shadow-md h-full">
      {}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Tag size={14} />
          </div>
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-tight">
            {title}
          </h4>
        </div>
        <div className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-500">
          Total: {total.toLocaleString('id-ID')}
        </div>
      </div>

      <div className="p-0 flex-1 flex flex-col min-h-[300px]">
        {}
        <div className="flex-1 overflow-y-auto max-h-[400px] p-5">
          {Object.entries(groupedByParent).map(([parent, items]) => {
            const parentColor = CATEGORY_COLORS[parent.toUpperCase()] || CATEGORY_COLORS.DEFAULT;

            return (
              <div key={parent} className="mb-6 last:mb-0">
                <div className="sticky top-0 bg-white/95 backdrop-blur z-10 py-1 mb-2 border-b border-dashed border-gray-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: parentColor }} />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{parent}</span>
                  <span className="text-[10px] text-gray-300">({items.length})</span>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const percentage = (item.count / total) * 100;
                    const barWidth = (item.count / maxCount) * 100;

                    return (
                      <div key={`${item.subCategory}-${idx}`} className="group">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[11px] text-gray-700 font-medium group-hover:text-gray-900 transition-colors truncate max-w-[200px]" title={item.subCategory}>
                            {item.subCategory}
                          </span>
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-gray-800">{item.count}</span>
                            <span className="text-[9px] text-gray-400 ml-1">({percentage.toFixed(1)}%)</span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-95"
                            style={{ 
                              width: `${Math.max(barWidth, 2)}%`,
                              backgroundColor: parentColor
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {}
        {sortedData.length > limit && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-3 border-t border-gray-50 text-[10px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
          >
            {expanded ? (
              <>Show Less <ChevronUp size={12} /></>
            ) : (
              <>View All ({sortedData.length - limit} more) <ChevronDown size={12} /></>
            )}
          </button>
        )}
      </div>

      {}
      {explanation && (
        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-50 flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
