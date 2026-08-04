'use client';

import React, { useMemo } from 'react';
import { Plane, AlertCircle } from 'lucide-react';

interface CategoryByBranchChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  title?: string;
  explanation?: string;
}

const SCALE = [
  { bg: '#e8f5e9', text: '#374151', min: 0 },
  { bg: '#c8e6c9', text: '#1b5e20', min: 0.1 },
  { bg: '#a5d6a7', text: '#1b5e20', min: 0.3 },
  { bg: '#81c784', text: '#1b5e20', min: 0.5 },
  { bg: '#4caf50', text: '#ffffff', min: 0.7 },
];

const getCellColor = (value: number, max: number) => {
  if (value === 0) return { bg: 'transparent', text: '#94a3b8' };
  const ratio = value / (max || 1);
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (ratio >= SCALE[i].min) return SCALE[i];
  }
  return SCALE[0];
};

export function CategoryByBranchChart({ 
  data, 
  title = 'Case Category by Station',
  explanation 
}: CategoryByBranchChartProps) {

  const pivotData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getVal = (d: any, keys: string[]) => {
      for (const k of keys) {
        if (d[k] !== undefined && d[k] !== null && d[k] !== '') return d[k];
      }
      return null;
    };

    const branchKeys = ['branch', 'reporting_branch', 'BRANCH', 'Reporting_Branch', 'Reporting Station', 'lokal_mpa_lookup', 'Lokal / MPA (VLOOKUP)'];
    const categoryKeys = ['category', 'main_category', 'CATEGORY', 'Report_Category', 'Report Category', 'Irregularity_Complain_Category', 'Report_Category'];

    const branches = Array.from(new Set(data.map(d => getVal(d, branchKeys) || 'Unknown'))).sort();
    const categories = ['IRREGULARITY', 'COMPLAINT', 'COMPLIMENT'];

    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {
      'IRREGULARITY': 0,
      'COMPLAINT': 0,
      'COMPLIMENT': 0
    };
    let grandTotal = 0;
    let maxVal = 0;

    branches.forEach(b => {
      matrix[b] = {};
      rowTotals[b] = 0;
      categories.forEach(c => {

        const val = data.reduce((acc, d) => {
          const dBranch = d.branch || getVal(d, branchKeys) || 'Unknown';
          const dRawCat = (d.category || getVal(d, categoryKeys) || '').toString().toUpperCase();

          let dCat = 'UNKNOWN';
          if (dRawCat.includes('IRREGULARITY')) dCat = 'IRREGULARITY';
          else if (dRawCat.includes('COMPLAIN')) dCat = 'COMPLAINT';
          else if (dRawCat.includes('COMPLIMENT')) dCat = 'COMPLIMENT';

          if (dBranch === b && dCat === c) {
            return acc + Number(d.count || d.jumlah || d.jumlah_kasus || 1); 
          }
          return acc;
        }, 0);

        matrix[b][c] = val;
        rowTotals[b] += val;
        colTotals[c] += val;
        grandTotal += val;
        if (val > maxVal) maxVal = val;
      });
    });

    return { branches, categories, matrix, rowTotals, colTotals, grandTotal, maxVal };
  }, [data]);

  if (!pivotData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400">
        <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">No data available</p>
      </div>
    );
  }

  const { branches, categories, matrix, rowTotals, colTotals, grandTotal, maxVal } = pivotData;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden font-sans">
      {}
      <div className="px-6 py-5 border-b border-slate-50">
        <div className="flex justify-between items-baseline">
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {title}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Report Category / Record Count
          </span>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-slate-500 bg-white sticky left-0 z-10">Station</th>
              {categories.map(cat => (
                <th key={cat} className="p-3 text-center text-sm font-semibold text-slate-500 bg-white">
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </th>
              ))}
              <th className="p-3 text-right text-sm font-bold text-slate-800 bg-white">Grand total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {branches.map(branch => (
              <tr key={branch} className="hover:bg-slate-50/50 transition-colors group">
                {}
                <td className="p-3 text-sm font-medium text-slate-600 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors">
                  {branch}
                </td>

                {}
                {categories.map(cat => {
                  const val = matrix[branch][cat];
                  const style = getCellColor(val, maxVal);
                  return (
                    <td key={cat} className="p-1 text-center">
                      <div 
                        className="w-full h-10 flex items-center justify-center rounded-sm text-sm font-medium transition-all"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {val > 0 ? val : '-'}
                      </div>
                    </td>
                  );
                })}

                {}
                <td className="p-3 text-sm font-bold text-slate-800 text-right tabular-nums">
                  {rowTotals[branch].toLocaleString()}
                </td>
              </tr>
            ))}

            {}
            <tr className="bg-white">
              <td className="p-3 text-sm font-bold text-slate-800 uppercase tracking-tight">
                Grand total
              </td>
              {categories.map(cat => (
                <td key={cat} className="p-3 text-center text-sm font-bold text-slate-800 tabular-nums">
                  {colTotals[cat].toLocaleString()}
                </td>
              ))}
              <td className="p-3 text-sm font-black text-slate-900 text-right tabular-nums">
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {}
      {explanation && (
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex gap-3 items-start">
          <Plane className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed italic">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
