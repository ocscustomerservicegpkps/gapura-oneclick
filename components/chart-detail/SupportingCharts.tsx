'use client';

import React from 'react';
import { ChartPreview } from '@/components/builder/ChartPreview';
import { GroupedBarChart } from './GroupedBarChart';
import { Info } from 'lucide-react';
import type { DashboardTile, QueryResult } from '@/types/builder';
import { ViewMode, Normalization } from './GlobalControlBar';

import { StatusBreakdownChart } from './custom-charts/StatusBreakdownChart';
import { SubCategoryDetailChart } from './custom-charts/SubCategoryDetailChart';
import { AreaSubCategoryChart } from './custom-charts/AreaSubCategoryChart';
import { PriorityChart } from './custom-charts/PriorityChart';
import { AirlineTypeCategoryChart } from './custom-charts/AirlineTypeCategoryChart';
import { MonthlyTrendChart } from './custom-charts/MonthlyTrendChart';
import { CategoryDistributionChart } from './custom-charts/CategoryDistributionChart';
import { AreaAnalysisChart } from './AreaAnalysisChart';
import { CategoryByBranchChart } from './custom-charts/CategoryByBranchChart';
export type CustomChartType = 
  | 'status_breakdown'
  | 'subcategory_detail'
  | 'area_subcategory'
  | 'priority_analysis'
  | 'airline_type_category'
  | 'monthly_trend'
  | 'category_distribution'
  | 'category_branch'
  | 'area_breakdown'
  | 'severity_distribution';

interface SupportingChart {
  visualization: DashboardTile['visualization'];
  query: DashboardTile['query'];
  explanation: string;
  customChartType?: CustomChartType;
}

interface SupportingChartsProps {
  charts: SupportingChart[];
  dataMap: Record<number, QueryResult>;
  loading: boolean;
  source?: 'system' | 'ai';
  viewMode?: ViewMode;
  normalization?: Normalization;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeRender(value: any): React.ReactNode {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return value.label || value.text || JSON.stringify(value);
  }
  return String(value);
}

function transformToStatusData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }
  const total = result.rows.reduce((sum, row) => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);
  return result.rows.map(row => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return {
      status: String(row.status || row.STATUS || row.Status || 'OPEN'),
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  });
}

function transformToSubCategoryData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }

  const columns = result.columns || Object.keys(result.rows[0] || {});
  const subCategoryColumn = columns.find(col =>
    col.toLowerCase().includes('irregularity_complain') ||
    col.toLowerCase().includes('sub_category') ||
    col.toLowerCase().includes('subcategory')
  ) || columns.find(col => col !== 'jumlah' && col !== 'count' && col !== 'JUMLAH' && col !== 'COUNT') || columns[0];

  const validRows = result.rows.filter(row => {
    const subCategory = String(row[subCategoryColumn] || row.irregularity_complain_category || row.sub_category || row.SUB_CATEGORY || '').trim();
    return subCategory && subCategory !== '' && subCategory !== 'null' && subCategory !== 'undefined';
  });

  if (validRows.length === 0) {
    return [];
  }

  const total = validRows.reduce((sum, row) => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);

  return validRows.map(row => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    const subCategory = String(row[subCategoryColumn] || row.irregularity_complain_category || row.sub_category || row.SUB_CATEGORY || 'Tidak Terkategori').trim();
    const category = String(row.category || row.CATEGORY || row.Category || 'Lainnya');

    return {
      category: category,
      subCategory: subCategory,
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      parentCategory: category
    };
  });
}

function transformToBranchCategoryData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }

  const columns = result.columns || Object.keys(result.rows[0] || {});

  const branchKeys = ['branch', 'reporting_branch', 'BRANCH', 'Reporting_Branch', 'Reporting Station', 'Station ', 'lokal_mpa_lookup', 'Lokal / MPA (VLOOKUP)'];
  const categoryKeys = ['category', 'main_category', 'CATEGORY', 'Report_Category', 'Report Category', 'Irregularity_Complain_Category'];
  const countKeys = ['jumlah', 'count', 'JUMLAH', 'COUNT', 'jumlah_kasus', 'jumlah kasus'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getVal = (row: any, keys: string[]) => {

    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
      const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
      if (foundKey && row[foundKey] !== undefined) return row[foundKey];
    }

    const colName = columns.find(c => keys.includes(c) || keys.includes(c.toLowerCase()));
    if (colName) return row[colName];
    return null;
  };

  return result.rows.map(row => {
    const branch = String(getVal(row, branchKeys) || 'Unknown');
    const category = String(getVal(row, categoryKeys) || 'Unknown');
    const count = Number(getVal(row, countKeys) || 1);

    return {
      branch,
      category,
      count
    };
  });
}

function transformToAreaSubCategoryData(result: QueryResult, forcedArea?: string) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }

  const total = result.rows.reduce((sum, row) => {
    const count = Number(row.Total) || Number(row.total) || Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);

  const columns = result.columns || Object.keys(result.rows[0] || {});

  const subCategoryColumn = columns.find(col =>
    col.toLowerCase() === 'category' ||
    col.toLowerCase() === 'terminal_area_category' ||
    col.toLowerCase() === 'apron_area_category' ||
    col.toLowerCase() === 'general_category'
  ) || columns.find(col => {
    const lower = col.toLowerCase();
    return lower !== 'total' && lower !== 'jumlah' && lower !== 'count' && lower !== 'area';
  }) || columns[0];

  const areaColumn = columns.find(col => {
    const lower = col.toLowerCase();
    return lower === 'area' || lower === 'Area' || lower.includes('area');
  });

  const transformed = result.rows.map(row => {
    const count = Number(row.Total) || Number(row.total) || Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    const subCategory = String(row[subCategoryColumn] || row.Category || row.category || 'Tidak Terkategori');

    let area = forcedArea || 'GENERAL';
    if (areaColumn && row[areaColumn]) {
      area = String(row[areaColumn]).toUpperCase();
    } else if (!forcedArea) {

      if (subCategoryColumn.toLowerCase().includes('terminal')) {
        area = 'TERMINAL';
      } else if (subCategoryColumn.toLowerCase().includes('apron')) {
        area = 'APRON';
      } else if (subCategoryColumn.toLowerCase().includes('general')) {
        area = 'GENERAL';
      }
    }

    return {
      area: area,
      subCategory: subCategory,
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  }).filter(item => item.subCategory && item.subCategory !== 'null' && item.subCategory !== 'undefined' && item.subCategory !== '');

  console.groupEnd();

  return transformed;
}

function transformToPriorityData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }
  const total = result.rows.reduce((sum, row) => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);
  return result.rows.map(row => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return {
      priority: String(row.priority || row.PRIORITY || row.Priority || 'MEDIUM').toUpperCase(),
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  });
}

function transformToAirlineTypeCategoryData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }
  const total = result.rows.reduce((sum, row) => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);
  return result.rows.map(row => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return {
      airlineType: String(row.jenis_maskapai || row.JENIS_MASKAPAI || row.airline_type || row.airlineType || 'Lokal').toUpperCase(),
      category: String(row.category || row.CATEGORY || row.Category || 'IRREGULARITY').toUpperCase(),
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  });
}

function transformToMonthlyTrendData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }
  const sortedRows = [...result.rows].sort((a, b) => {
    const aYear = Number(a.year || a.YEAR || a.Year) || new Date().getFullYear();
    const bYear = Number(b.year || b.YEAR || b.Year) || new Date().getFullYear();
    if (aYear !== bYear) return aYear - bYear;
    const aMonth = String(a.month || a.MONTH || a.Month || '00').padStart(2, '0');
    const bMonth = String(b.month || b.MONTH || b.Month || '00').padStart(2, '0');
    return aMonth.localeCompare(bMonth);
  });

  return sortedRows.map((row, idx) => {
    const currentCount = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    const previousCount = idx > 0 ? (Number(sortedRows[idx - 1].jumlah) || Number(sortedRows[idx - 1].count) || Number(sortedRows[idx - 1].JUMLAH) || Number(sortedRows[idx - 1].COUNT) || 0) : currentCount;
    const change = currentCount - previousCount;
    const changePercent = previousCount > 0 ? (change / previousCount) * 100 : 0;

    return {
      month: String(row.month || row.MONTH || row.Month || '00').padStart(2, '0'),
      year: Number(row.year || row.YEAR || row.Year) || new Date().getFullYear(),
      count: currentCount,
      previousCount: idx > 0 ? previousCount : undefined,
      change: idx > 0 ? change : undefined,
      changePercent: idx > 0 ? changePercent : undefined
    };
  });
}

function transformToCategoryDistributionData(result: QueryResult) {
  if (!result?.rows || result.rows.length === 0) {
    return [];
  }
  const total = result.rows.reduce((sum, row) => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return sum + count;
  }, 0);
  return result.rows.map(row => {
    const count = Number(row.jumlah) || Number(row.count) || Number(row.JUMLAH) || Number(row.COUNT) || 0;
    return {
      category: String(row.category || row.CATEGORY || row.Category || 'LAINNYA').toUpperCase(),
      count: count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  });
}

function calculateChartHeight(chartType: string, rowCount: number): string {
  switch (chartType) {
    case 'horizontal_bar': {
      const barHeight = Math.max(rowCount * 38 + 70, 220);
      return `${Math.min(barHeight, 450)}px`;
    }
    case 'pie':
    case 'donut':
      return '240px';
    case 'heatmap': {

      const hmHeight = Math.max(rowCount * 28 + 80, 260);
      return `${Math.min(hmHeight, 500)}px`;
    }
    case 'stacked_bar':
      return '280px';
    case 'bar':
    case 'line':
    case 'area':
      return '280px';
    case 'grouped_bar':
      return '400px';
    case 'table':
      return '400px';
    default:
      return '220px';
  }
}

export function SupportingCharts({ charts, dataMap, loading, source = 'ai', viewMode = 'values', normalization = 'none' }: SupportingChartsProps) {

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-slate-200 rounded-full animate-pulse" />
          <div className="w-24 h-3 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#e0e0e0] h-[280px] animate-pulse flex flex-col">
              <div className="px-4 py-3 border-b border-[#f0f0f0] flex justify-between">
                <div className="w-32 h-3 bg-slate-100 rounded" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
              </div>
              <div className="flex-1 p-4 flex items-end gap-2">
                <div className="w-full bg-slate-50 rounded-t h-[40%]" />
                <div className="w-full bg-slate-50 rounded-t h-[70%]" />
                <div className="w-full bg-slate-50 rounded-t h-[55%]" />
                <div className="w-full bg-slate-50 rounded-t h-[90%]" />
              </div>
              <div className="px-4 py-3 bg-[#fcfcfc] border-t border-[#f0f0f0]">
                <div className="w-full h-2 bg-slate-50 rounded mb-1" />
                <div className="w-2/3 h-2 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!charts || charts.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-[#6b8e3d] rounded-full" />
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">
            Eksplorasi Pendukung
          </h3>
          {source === 'ai' ? (
            <span className="ml-2 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1">
              ✨ Dibuat oleh AI
            </span>
          ) : (
            <span className="ml-2 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
              📊 From Report Data
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {charts.map((chart, idx) => {
          const result = dataMap[idx];

          const chartHeight = calculateChartHeight(
            chart.visualization.chartType || 'bar',
            result?.rowCount || result?.rows?.length || 0
          );

          if (!result && !loading) {
            return (
              <div 
                key={idx} 
                className="bg-white rounded-xl border border-red-100 flex flex-col overflow-hidden min-h-[280px] justify-center items-center p-6 text-center"
              >
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-3">
                  <Info className="w-5 h-5 text-red-400" />
                </div>
                <h4 className="text-[11px] font-bold text-slate-700 uppercase mb-1">Failed to Load Chart</h4>
                <p className="text-[10px] text-slate-400">Terjadi kesalahan saat mengambil data untuk visualisasi ini.</p>
              </div>
            );
          }

          if (chart.customChartType) {
            const customChartProps = {
              title: chart.visualization.title,
              explanation: chart.explanation
            };

            switch (chart.customChartType) {
              case 'status_breakdown':
                return (
                  <StatusBreakdownChart
                    key={idx}
                    data={transformToStatusData(result)}
                    {...customChartProps}
                  />
                );
              case 'subcategory_detail':
                return (
                  <SubCategoryDetailChart
                    key={idx}
                    data={transformToSubCategoryData(result)}
                    {...customChartProps}
                  />
                );
              case 'area_subcategory':
                return (
                  <AreaSubCategoryChart
                    key={idx}
                    data={transformToAreaSubCategoryData(result)}
                    {...customChartProps}
                  />
                );
              case 'priority_analysis':
                return (
                  <PriorityChart
                    key={idx}
                    data={transformToPriorityData(result)}
                    {...customChartProps}
                  />
                );
              case 'airline_type_category':
                return (
                  <AirlineTypeCategoryChart
                    key={idx}
                    data={transformToAirlineTypeCategoryData(result)}
                    {...customChartProps}
                  />
                );
              case 'monthly_trend':
                return (
                  <MonthlyTrendChart
                    key={idx}
                    data={transformToMonthlyTrendData(result)}
                    {...customChartProps}
                  />
                );
              case 'category_distribution':
                return (
                  <CategoryDistributionChart
                    key={idx}
                    data={transformToCategoryDistributionData(result)}
                    {...customChartProps}
                  />
                );
              case 'category_branch':
                return (
                  <CategoryByBranchChart
                    key={idx}
                    data={transformToBranchCategoryData(result)}
                    {...customChartProps}
                  />
                );
              case 'area_breakdown':
                return (
                  <AreaAnalysisChart
                    key={idx}
                    visualization={chart.visualization}
                    result={result}
                    title={chart.visualization.title}
                    explanation={chart.explanation}
                  />
                );
              default:
                break;
            }
          }

          if (chart.visualization.chartType === 'grouped_bar') {
            return (
              <GroupedBarChart 
                key={idx}
                visualization={chart.visualization}
                result={result}
                title={chart.visualization.title}
                explanation={chart.explanation}
              />
            );
          }

          if (chart.visualization.chartType === 'kpi') {
            const rawY = chart.visualization.yAxis;
            const rawYArray = Array.isArray(rawY) ? rawY : (rawY ? [String(rawY)] : []);

            let yKey = '';

            const exactMatch = rawYArray.find(y => result.columns.includes(y));
            if (exactMatch) {
              yKey = exactMatch;
            } else {

              const targetY = rawYArray[0] || '';
              const normalizedTarget = targetY.toLowerCase().replace(/[_\s]/g, '');
              const matches = result.columns.map(c => {
                const normalizedC = c.toLowerCase().replace(/[_\s]/g, '');
                let score = 0;
                if (normalizedC === normalizedTarget) score = 100;
                else if (normalizedC.includes(normalizedTarget) || normalizedTarget.includes(normalizedC)) score = 50;
                if (normalizedC.includes('total') || normalizedC.includes('count') || normalizedC.includes('jumlah')) score += 10;
                return { col: c, score };
              }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

              if (matches.length > 0) {
                yKey = matches[0].col;
              } else {

                const firstNumeric = result.columns.find(c => {
                  const val = result.rows[0]?.[c];
                  return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)));
                });
                yKey = firstNumeric || result.columns[result.columns.length - 1];
              }
            }

            const value = Number(result.rows[0]?.[yKey]) || 0;

            return (
              <div 
                key={idx} 
                className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-[#e0e0e0] flex flex-col overflow-hidden transition-all hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] hover:border-[#6b8e3d]/30"
              >
                <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-[#333] uppercase tracking-tight">
                    {chart.visualization.title}
                  </h4>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6b8e3d]" />
                </div>

                <div className="p-6 flex flex-col justify-center items-center min-h-[200px] text-center">
                  <span className="text-4xl font-black text-[#333] tracking-tighter">
                    {value.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] font-medium text-[#999] mt-2 uppercase">Total Terkumpul</span>
                </div>
                {chart.explanation && (
                  <div className="px-4 py-3 bg-[#fcfcfc] border-t border-[#f0f0f0] flex gap-2.5 items-start">
                    <Info className="w-3.5 h-3.5 text-[#6b8e3d] mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-[#777] leading-relaxed italic">
                      {safeRender(chart.explanation)}
                    </p>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div 
              key={idx} 
              className={`bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-[#e0e0e0] flex flex-col overflow-hidden transition-all hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] hover:border-[#6b8e3d]/30 ${chart.visualization.chartType === 'table' ? 'md:col-span-2' : ''}`}
            >
              <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#333] uppercase tracking-tight">
                  {chart.visualization.title}
                </h4>
                <div className="w-1.5 h-1.5 rounded-full bg-[#6b8e3d]" />
              </div>

              <div 
                className="p-3 pt-6 overflow-hidden"
                style={{ height: chartHeight }}
              >
                <ChartPreview 
                  visualization={chart.visualization}
                  result={result}
                  compact={true}
                  viewMode={viewMode}
                  normalization={normalization}
                />
              </div>

              {chart.explanation && (
                <div className="px-4 py-3 bg-[#fcfcfc] border-t border-[#f0f0f0] flex gap-2.5 items-start">
                  <Info className="w-3.5 h-3.5 text-[#6b8e3d] mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-[#777] leading-relaxed italic">
                    {safeRender(chart.explanation)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
