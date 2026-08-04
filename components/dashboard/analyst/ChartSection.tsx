'use client';

import { useMemo } from 'react';
import { calculateComparisonData } from '@/lib/utils/comparison-utils';
import type { Report, AnalyticsData } from '@/types';
import type { DivisionConfig } from '@/components/dashboard/AnalyticsDashboard';

import dynamic from 'next/dynamic';

export const AnalystCharts = dynamic(
  () => import('@/components/dashboard/analyst/AnalystCharts'),
  { ssr: false, loading: () => <ChartSpinner /> }
);
const OPAnalystCharts = dynamic(
  () => import('@/components/dashboard/analyst/OPAnalystCharts'),
  { ssr: false, loading: () => <ChartSpinner /> }
);

function ChartSpinner() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full border-4 animate-spin"
        style={{ borderColor: 'var(--surface-4)', borderTopColor: 'var(--brand-primary)' }}
      />
    </div>
  );
}

interface ChartSectionProps {
  division: DivisionConfig;
  filteredReports: Report[];
  reports: Report[];
  analytics: AnalyticsData | null;
  globalFilters: {
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  };
  setGlobalFilters: React.Dispatch<React.SetStateAction<{
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  }>>;
  availableOptions: {
    hubs: string[];
    branches: string[];
    airlines: string[];
    categories: string[];
  };
  drilldownUrl: (type: string, value: string) => string;
  onDrilldown: (url: string) => void;
}

export function ChartSection({
  division,
  filteredReports,
  reports,
  analytics,
  globalFilters,
  setGlobalFilters,
  availableOptions,
  drilldownUrl,
  onDrilldown,
}: ChartSectionProps) {

  const chartData = useMemo(() => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {
      _irregularity: 0,
      _complaint: 0,
      _compliment: 0,
      caseCategoryData: [],
      branchReportData: [],
      monthlyReportData: [],
      categoryByAreaData: [],
      categoryByBranchData: [],
      areaSubCategoryData: [],
      categoryByAirlinesData: [],

      monthlyComparisonData: [],
      hubDistributionData: [],
      resolutionByBranchData: [],
      caseReportByAreaData: [],
      terminalAreaCategoryData: [],
      apronAreaCategoryData: [],
      generalCategoryData: [],
      caseClassificationData: [],
      comparisonData: undefined,
    };

    const stations: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchData: Record<string, any> = {};
    const dataMap = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const areas: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const areaSubMap: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const airlinesData: Record<string, any> = {};

    const monthlyCompMap = new Map();
    const hubMap: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchResMap: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchAreaMap: Record<string, any> = {};
    const terminalCat: Record<string, number> = {};
    const apronCat: Record<string, number> = {};
    const generalCat: Record<string, number> = {};
    const caseClass: Record<string, number> = {};

    for (const r of filteredReports) {

      if (r.category === 'Irregularity') result._irregularity++;
      else if (r.category === 'Complaint') result._complaint++;
      else if (r.category === 'Compliment') result._compliment++;

      const station = r.stations?.code || 'Unknown';
      stations[station] = (stations[station] || 0) + 1;

      const dateStr = r.date_of_event || r.created_at;
      if (dateStr) {
        let d;
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, day] = dateStr.split('-').map(Number);
          d = new Date(y, m - 1, day);
        } else {
          d = new Date(dateStr);
        }
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!dataMap.has(key)) dataMap.set(key, { irregularity: 0, complaint: 0, compliment: 0, date: d });
          const entry = dataMap.get(key);
          if (r.category === 'Irregularity') entry.irregularity++;
          else if (r.category === 'Complaint') entry.complaint++;
          else if (r.category === 'Compliment') entry.compliment++;
        }
      }

      const raw = (r.area || '').toString().trim().toLowerCase();
      let area = null;
      if (raw.includes('terminal')) area = 'Terminal Area';
      else if (raw.includes('apron')) area = 'Apron Area';
      else if (raw.includes('general')) area = 'General';
      if (area) areas[area] = (areas[area] || 0) + 1;
      if (area) {
        const subCat = r.category || 'Uncategorized';
        if (!areaSubMap[area]) areaSubMap[area] = {};
        areaSubMap[area][subCat] = (areaSubMap[area][subCat] || 0) + 1;
      }

      if (!branchData[station]) branchData[station] = { irregularity: 0, complaint: 0, compliment: 0 };
      if (r.category === 'Irregularity') branchData[station].irregularity++;
      else if (r.category === 'Complaint') branchData[station].complaint++;
      else if (r.category === 'Compliment') branchData[station].compliment++;

      const airline = r.airlines || 'Unknown';
      if (!airlinesData[airline]) airlinesData[airline] = { irregularity: 0, complaint: 0, compliment: 0 };
      if (r.category === 'Irregularity') airlinesData[airline].irregularity++;
      else if (r.category === 'Complaint') airlinesData[airline].complaint++;
      else if (r.category === 'Compliment') airlinesData[airline].compliment++;

      const dateStrCreated = r.date_of_event || r.created_at;
      if (dateStrCreated) {
        let dCreated;
        if (typeof dateStrCreated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStrCreated)) {
          const [y, m, day] = dateStrCreated.split('-').map(Number);
          dCreated = new Date(y, m - 1, day);
        } else {
          dCreated = new Date(dateStrCreated);
        }
        if (!isNaN(dCreated.getTime())) {
          const keyCreated = `${dCreated.getFullYear()}-${String(dCreated.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyCompMap.has(keyCreated)) monthlyCompMap.set(keyCreated, { masuk: 0, selesai: 0, date: dCreated });
          monthlyCompMap.get(keyCreated).masuk++;
        }
      }
      if (r.resolved_at) {
        const dResolved = new Date(r.resolved_at);
        if (!isNaN(dResolved.getTime())) {
          const keyResolved = `${dResolved.getFullYear()}-${String(dResolved.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyCompMap.has(keyResolved)) monthlyCompMap.set(keyResolved, { masuk: 0, selesai: 0, date: dResolved });
          monthlyCompMap.get(keyResolved).selesai++;
        }
      }

      const hub = r.hub || 'Unknown';
      hubMap[hub] = (hubMap[hub] || 0) + 1;

      if (!branchResMap[station]) branchResMap[station] = { total: 0, resolved: 0 };
      branchResMap[station].total++;
      if (r.status === 'CLOSED') branchResMap[station].resolved++;

      const branch = r.branch || r.stations?.code || 'Unknown';
      const airline2 = (r.airlines || r.airline || 'Unknown').trim() || 'Unknown';
      const area2 = (r.area || '').toLowerCase();
      if (!branchAreaMap[branch]) branchAreaMap[branch] = {};
      if (!branchAreaMap[branch][airline2]) branchAreaMap[branch][airline2] = { terminal: 0, apron: 0, general: 0 };
      if (area2.includes('terminal')) branchAreaMap[branch][airline2].terminal++;
      else if (area2.includes('apron')) branchAreaMap[branch][airline2].apron++;
      else if (area2.includes('general')) branchAreaMap[branch][airline2].general++;

      const rawArea = (r.area || '').toString().trim().toLowerCase();
      if (rawArea.includes('terminal')) {
        const cat = r.terminal_area_category;
        if (cat) terminalCat[cat] = (terminalCat[cat] || 0) + 1;
      }

      if (rawArea.includes('apron')) {
        const cat = r.apron_area_category;
        if (cat) apronCat[cat] = (apronCat[cat] || 0) + 1;
      }

      if (rawArea.includes('general')) {
        const cat = r.general_category;
        if (cat) generalCat[cat] = (generalCat[cat] || 0) + 1;
      }

      const caseClassVal = r.case_classification;
      if (caseClassVal) caseClass[caseClassVal] = (caseClass[caseClassVal] || 0) + 1;
    }

    result.caseCategoryData = [
      { name: "Irregularity", value: result._irregularity },
      { name: "Complaint", value: result._complaint },
      { name: "Compliment", value: result._compliment },
    ];
    result.branchReportData = Object.entries(stations)
      .map(([station, count]) => ({ station, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    result.monthlyReportData = Array.from(dataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => ({
        month: `${val.date.getFullYear()} ${val.date.toLocaleString('en-US', { month: 'short' })}`,
        irregularity: val.irregularity,
        complaint: val.complaint,
        compliment: val.compliment,
      }))
      .slice(-14);
    const fills = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
    result.categoryByAreaData = Object.entries(areas)
      .map(([area, count], i) => ({ name: area, value: count, fill: fills[i % fills.length] }))
      .sort((a, b) => b.value - a.value);
    result.categoryByBranchData = Object.entries(branchData)
      .map(([branch, data]) => ({ branch, ...data }))
      .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment))
      .slice(0, 10);
    result.areaSubCategoryData = Object.entries(areaSubMap).map(([area, counts]) => ({ area, ...counts }));
    result.categoryByAirlinesData = Object.entries(airlinesData)
      .map(([airline, data]) => ({ airline, ...data }))
      .sort((a, b) => (b.irregularity + b.complaint + b.compliment) - (a.irregularity + a.complaint + a.compliment))
      .slice(0, 8);

    result.monthlyComparisonData = Array.from(monthlyCompMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => {
        const rate = val.masuk > 0 ? Math.round((val.selesai / val.masuk) * 100) : 0;
        return {
          month: `${val.date.getFullYear()} ${val.date.toLocaleString('en-US', { month: 'short' })}`,
          masuk: val.masuk,
          selesai: val.selesai,
          rate,
        };
      })
      .slice(-14);
    result.hubDistributionData = Object.entries(hubMap).map(([hub, count]) => ({ hub, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    result.resolutionByBranchData = Object.entries(branchResMap)
      .map(([branch, data]) => ({ branch, total: data.total, resolved: data.resolved, rate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    result.caseReportByAreaData = Object.entries(branchAreaMap)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(([branch, airlineData]: [string, Record<string, any>]) => {
        const airlines = Object.entries(airlineData)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(([name, c]: [string, any]) => ({
            name,
            terminal: c.terminal,
            apron: c.apron,
            general: c.general,
            total: c.terminal + c.apron + c.general
          }))
          .sort((a, b) => b.total - a.total);
        return {
          branch, airlines,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalTerminal: Object.values(airlineData).reduce((s: number, v: any) => s + v.terminal, 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalApron: Object.values(airlineData).reduce((s: number, v: any) => s + v.apron, 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalGeneral: Object.values(airlineData).reduce((s: number, v: any) => s + v.general, 0),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          grandTotal: Object.values(airlineData).reduce((s: number, v: any) => s + v.terminal + v.apron + v.general, 0),
        };
      })
      .sort((a, b) => b.grandTotal - a.grandTotal);
    result.terminalAreaCategoryData = Object.entries(terminalCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    result.apronAreaCategoryData = Object.entries(apronCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    result.generalCategoryData = Object.entries(generalCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    result.caseClassificationData = Object.entries(caseClass).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    result.comparisonData = calculateComparisonData(filteredReports);
    return result;
  }, [filteredReports]);

  const chartProps = {
    analytics,
    ...chartData,
    filteredReports,
    onDrilldown,
    drilldownUrl,
    globalFilters,
    setGlobalFilters,
    availableOptions,
  };

  if (division.code === 'OP') {
    return <OPAnalystCharts {...chartProps} allReports={reports} />;
  }
  return <AnalystCharts {...chartProps} allReports={reports} />;
}
