import 'server-only';
import { Report } from '@/types';
import {
  normalizeReportCategory,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
  resolveReportHub,
  resolveRootCause,
} from '@/lib/report-normalization';
import { toLocalYMD } from '@/lib/utils/wib-date';

type LowerCategoryCounts = {
  irregularity: number;
  complaint: number;
  compliment: number;
  occurrence: number;
  accidentIncident: number;
};

type TitleCategoryCounts = {
  Irregularity: number;
  Complaint: number;
  Compliment: number;
  Occurrence: number;
  'Accident / Incident': number;
};

export class AnalyticsProcessor {

  private static normalizeCategory(category: string | undefined): string | null {
    const normalized = normalizeReportCategory(category);
    return normalized ? String(normalized) : null;
  }

  private static getCategory(report: Report): string | null {
    return resolveReportCategory(report) || null;
  }

  private static emptyLowerCounts(): LowerCategoryCounts {
    return { irregularity: 0, complaint: 0, compliment: 0, occurrence: 0, accidentIncident: 0 };
  }

  private static emptyTitleCounts(): TitleCategoryCounts {
    return { Irregularity: 0, Complaint: 0, Compliment: 0, Occurrence: 0, 'Accident / Incident': 0 };
  }

  private static bumpCategory(data: Record<string, number>, category: string | null): void {
    if (!category) return;
    if (category === 'Irregularity') {
      if ('irregularity' in data) data.irregularity++;
      if ('Irregularity' in data) data.Irregularity++;
    } else if (category === 'Complaint') {
      if ('complaint' in data) data.complaint++;
      if ('Complaint' in data) data.Complaint++;
    } else if (category === 'Compliment') {
      if ('compliment' in data) data.compliment++;
      if ('Compliment' in data) data.Compliment++;
    } else if (category === 'Occurrence') {
      if ('occurrence' in data) data.occurrence++;
      if ('Occurrence' in data) data.Occurrence++;
    } else if (category === 'Accident / Incident') {
      if ('accidentIncident' in data) data.accidentIncident++;
      if ('Accident / Incident' in data) data['Accident / Incident']++;
    }
  }

  private static getMonthKey(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      let date: Date;
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, day] = dateStr.split('-').map(Number);
          date = new Date(y, m - 1, day);
      } else {
          date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } catch {
      return '';
    }
  }

  private static isValidRootCause(value: string | undefined | null): boolean {
    const INVALID_CAUSE_VALUES = ['#n/a', 'unknown', 'nil', '-', '', 'null', 'none', 'na', 'n/a', 'tidak ada', 'belum diketahui'];
    if (!value) return false;
    const normalized = String(value).trim().toLowerCase();
    return !INVALID_CAUSE_VALUES.includes(normalized);
  }

  private static getBranch(report: Report): string {
    return resolveReportBranch(report) || 'Unknown';

  }

  private static getHub(report: Report): string {
    return resolveReportHub(report) || 'Unknown';

  }

  private static getAirline(report: Report): string {
    return resolveReportAirline(report) || 'Unknown';

  }

  public static processCaseCategory(reports: Report[]) {
    const categoryMap = new Map<string, { count: number }>();
    const monthMap = new Map<string, TitleCategoryCounts>();
    const branchMap = new Map<string, TitleCategoryCounts>();
    const airlineMap = new Map<string, TitleCategoryCounts & { total: number }>();
    const causeMap = new Map<string, { category: string; count: number }>();

    reports.forEach(report => {
      const category = this.getCategory(report);
      if (!category) return;

      if (!categoryMap.has(category)) categoryMap.set(category, { count: 0 });
      categoryMap.get(category)!.count++;

      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (monthKey) {
        if (!monthMap.has(monthKey)) monthMap.set(monthKey, this.emptyTitleCounts());
        const mData = monthMap.get(monthKey)!;
        this.bumpCategory(mData, category);
      }

      const branch = this.getBranch(report);
      if (branch !== 'Unknown') {
        if (!branchMap.has(branch)) branchMap.set(branch, this.emptyTitleCounts());
        const bData = branchMap.get(branch)!;
        this.bumpCategory(bData, category);
      }

      const airline = this.getAirline(report);
      if (airline !== 'Unknown') {
        if (!airlineMap.has(airline)) airlineMap.set(airline, { ...this.emptyTitleCounts(), total: 0 });
        const aData = airlineMap.get(airline)!;
        aData.total++;
        this.bumpCategory(aData, category);
      }

      const rootCause = resolveRootCause(report);
      if (this.isValidRootCause(rootCause)) {
        const rcKey = `${rootCause}-${category}`;
        if (!causeMap.has(rcKey)) causeMap.set(rcKey, { category, count: 0 });
        causeMap.get(rcKey)!.count++;
      }
    });

    const totalCount = reports.length;

    const categoryData = Array.from(categoryMap.entries()).map(([name, d]) => ({
      name,
      count: d.count,
      percentage: totalCount > 0 ? (d.count / totalCount) * 100 : 0,
      growth: 0
    })).sort((a, b) => b.count - a.count);

    const trendData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([month, data]) => ({ month, ...data }));

    const branchData = Array.from(branchMap.entries())
      .map(([branch, data]) => ({ branch, ...data }))
      .sort((a, b) => b.Irregularity - a.Irregularity)
      .slice(0, 15);

    const airlineData = Array.from(airlineMap.entries())
      .map(([airline, data]) => ({ airline, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const kpis = {
      totalReports: totalCount,
      mostAffectedBranch: branchData.length > 0 ? { name: branchData[0].branch, count: branchData[0].Irregularity + branchData[0].Complaint } : { name: '-', count: 0 },
      topAirline: airlineData.length > 0 ? { name: airlineData[0].airline, count: airlineData[0].total } : { name: '-', count: 0 },
      avgResolutionTime: 0
    };

    return {
      categoryData,
      trendData,
      branchData,
      airlineData,
      kpis
    };
  }

  public static processMonthlyReport(reports: Report[]) {
    const monthMap = new Map<string, LowerCategoryCounts & { 
      total: number;
      prevMonthTotal?: number;
      prevYearTotal?: number;
    }>();

    const dateMap = new Map<string, TitleCategoryCounts & { total: number }>();
    const branchCounters = new Map<string, number>();
    const airlineCounters = new Map<string, number>();

    reports.forEach(report => {
      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (monthKey) {
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { total: 0, ...this.emptyLowerCounts() });
        }
        const data = monthMap.get(monthKey)!;
        data.total++;
        this.bumpCategory(data, this.getCategory(report));
      }

      const d = new Date(report.date_of_event || report.created_at || '');
      if (!isNaN(d.getTime())) {
        const dateKeyFull = toLocalYMD(d);
        if (!dateMap.has(dateKeyFull)) dateMap.set(dateKeyFull, { total: 0, ...this.emptyTitleCounts() });
        const dData = dateMap.get(dateKeyFull)!;
        dData.total++;
        this.bumpCategory(dData, this.getCategory(report));
      }

      const b = this.getBranch(report);
      const a = this.getAirline(report);
      if (b !== 'Unknown') branchCounters.set(b, (branchCounters.get(b) || 0) + 1);
      if (a !== 'Unknown') airlineCounters.set(a, (airlineCounters.get(a) || 0) + 1);
    });

    const sortedMonths = Array.from(monthMap.keys()).sort();

    const summary = sortedMonths.map((month) => {
      const data = monthMap.get(month)!;

      const [year, monthNum] = month.split('-').map(Number);
      const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
      const prevYearNum = monthNum === 1 ? year - 1 : year;
      const prevMonthKey = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`;
      const prevYearKey = `${year - 1}-${String(monthNum).padStart(2, '0')}`;

      const prevMonthData = monthMap.get(prevMonthKey);
      const prevYearData = monthMap.get(prevYearKey);

      const prevMonthTotal = prevMonthData?.total || 0;
      const prevYearTotal = prevYearData?.total || 0;

      return {
        month,
        total: data.total,
        irregularity: data.irregularity,
        complaint: data.complaint,
        compliment: data.compliment,
        occurrence: data.occurrence,
        accidentIncident: data.accidentIncident,
        irregularityRate: data.total > 0 ? (data.irregularity / data.total) * 100 : 0,
        netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
        momGrowth: prevMonthTotal > 0 ? ((data.total - prevMonthTotal) / prevMonthTotal) * 100 : 0,
        yoyGrowth: prevYearTotal > 0 ? ((data.total - prevYearTotal) / prevYearTotal) * 100 : undefined,
        prevMonthTotal,
        prevYearTotal
      };
    });

    const current = summary[summary.length - 1];
    const previous = summary.length > 1 ? summary[summary.length - 2] : null;

    const kpis = {
      currentMonthTotal: current?.total || 0,
      previousMonthTotal: previous?.total || 0,
      momChange: previous && previous.total > 0 ? Math.round(((current.total - previous.total) / previous.total) * 100) : 0,
      highestPeakMonth: summary.reduce((max, m) => (m.total > max.count ? { month: m.month, count: m.total } : max), { month: '-', count: 0 })
    };

    const rollingData = summary.map((m, idx) => {
      const prev3 = summary.slice(Math.max(0, idx - 2), idx + 1).map(v => v.total);
      const prev6 = summary.slice(Math.max(0, idx - 5), idx + 1).map(v => v.total);
      return {
        month: m.month,
        actual: m.total,
        rollingAvg3: prev3.reduce((s, v) => s + v, 0) / prev3.length,
        rollingAvg6: prev6.reduce((s, v) => s + v, 0) / prev6.length,
      };
    }).slice(-14);

    const dailyData = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-60)
      .map(([date, data]) => ({ date, ...data }));

    let peakCount = 0;
    let peakDate = '-';
    dateMap.forEach((data, date) => {
      if (data.total > peakCount) {
        peakCount = data.total;
        peakDate = date;
      }
    });
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDay = { 
      date: peakDate, 
      count: peakCount, 
      dayOfWeek: peakDate !== '-' ? days[new Date(peakDate).getDay()] : '-' 
    };

    const getDominant = (map: Map<string, number>, total: number) => {
      let topName = '-';
      let topCount = 0;
      map.forEach((c, n) => { if (c > topCount) { topCount = c; topName = n; } });
      return { name: topName, count: topCount, percent: total > 0 ? (topCount / total) * 100 : 0 };
    };

    return {
      summary,
      kpis,
      rollingData,
      dailyData,
      peakDay,
      dominantBranch: getDominant(branchCounters, reports.length),
      dominantAirline: getDominant(airlineCounters, reports.length),
      trend: summary.slice(-12)
    };
  }

  public static processAreaReport(reports: Report[]) {
    const areaMap = new Map<string, LowerCategoryCounts & { total: number }>();

    reports.forEach(report => {
      const area = report.area || 'Unknown';
      if (!areaMap.has(area)) areaMap.set(area, { total: 0, ...this.emptyLowerCounts() });
      const data = areaMap.get(area)!;
      data.total++;

      this.bumpCategory(data, this.getCategory(report));
    });

    const totalCount = reports.length;
    const sortedAreas = Array.from(areaMap.entries())
      .map(([area, data]) => {
        const irregularityRate = data.total > 0 ? (data.irregularity / data.total) * 100 : 0;
        const netSentiment = (data.compliment + data.complaint) > 0 
          ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0;
        const riskIndex = (irregularityRate * 0.7) + (data.total > 0 ? (data.complaint / data.total * 30) : 0);

        return {
          area,
          ...data,
          rank: 0,
          contribution: totalCount > 0 ? (data.total / totalCount) * 100 : 0,
          irregularityRate,
          netSentiment,
          riskIndex
        };
      })
      .sort((a, b) => b.total - a.total)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const monthMap = new Map<string, TitleCategoryCounts & { total: number }>();
    reports.forEach(report => {
      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (!monthKey) return;
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, ...this.emptyTitleCounts() });
      const data = monthMap.get(monthKey)!;
      data.total++;
      this.bumpCategory(data, this.getCategory(report));
    });

    const trendData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([month, data]) => ({ month, ...data }));

    return {
      areaData: sortedAreas,
      trendData,
      categoryData: sortedAreas.slice(0, 10).map(a => ({
        area: a.area,
        Irregularity: a.irregularity,
        Complaint: a.complaint,
        Compliment: a.compliment,
        Occurrence: a.occurrence,
        'Accident / Incident': a.accidentIncident
      })),
      kpis: {
        totalReports: totalCount,
        areasTracked: areaMap.size,
        overallIrregRate: totalCount > 0 ? (reports.filter(r => this.getCategory(r) === 'Irregularity').length / totalCount) * 100 : 0
      }
    };
  }

  public static processAirlineReport(reports: Report[]) {
    const airlineMap = new Map<string, LowerCategoryCounts & { total: number }>();

    reports.forEach(report => {
      const airline = this.getAirline(report);
      if (airline === 'Unknown') return;

      if (!airlineMap.has(airline)) airlineMap.set(airline, { total: 0, ...this.emptyLowerCounts() });
      const data = airlineMap.get(airline)!;
      data.total++;

      this.bumpCategory(data, this.getCategory(report));
    });

    const totalCount = reports.length;
    const airlineSummaries = Array.from(airlineMap.entries())
      .map(([airline, data]) => {
        const total = data.total;
        return {
          airline,
          total,
          irregularity: data.irregularity,
          complaint: data.complaint,
          compliment: data.compliment,
          occurrence: data.occurrence,
          accidentIncident: data.accidentIncident,
          irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
          netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
          riskIndex: (data.irregularity * 2) + data.complaint,
          rank: 0,
          contribution: totalCount > 0 ? (total / totalCount) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const monthMap = new Map<string, TitleCategoryCounts & { total: number }>();
    reports.forEach(report => {
      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (!monthKey) return;
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, ...this.emptyTitleCounts() });
      const data = monthMap.get(monthKey)!;
      data.total++;
      this.bumpCategory(data, this.getCategory(report));
    });

    const trendData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([month, data]) => ({ month, ...data }));

    return {
      airlineData: airlineSummaries,
      trendData,
      categoryData: airlineSummaries.slice(0, 10).map(a => ({
        airline: a.airline,
        Irregularity: a.irregularity,
        Complaint: a.complaint,
        Compliment: a.compliment,
        Occurrence: a.occurrence,
        'Accident / Incident': a.accidentIncident
      })),
      categoryBreakdown: airlineSummaries.slice(0, 10).map(a => ({
        airline: a.airline,
        irregularity: a.irregularity,
        complaint: a.complaint,
        compliment: a.compliment,
        occurrence: a.occurrence,
        accidentIncident: a.accidentIncident
      })),
      kpis: {
        totalAirlines: airlineMap.size,
        topAirline: airlineSummaries.length > 0 ? { name: airlineSummaries[0].airline, count: airlineSummaries[0].total } : { name: '-', count: 0 },
        bestPerformer: airlineSummaries.length > 0 ? { name: airlineSummaries[airlineSummaries.length - 1].airline, count: airlineSummaries[airlineSummaries.length - 1].total } : { name: '-', count: 0 },
        avgReportsPerAirline: airlineMap.size > 0 ? Math.round(totalCount / airlineMap.size) : 0,
        complimentRatio: totalCount > 0 ? Math.round((Array.from(airlineMap.values()).reduce((sum, a) => sum + a.compliment, 0) / totalCount) * 100) : 0
      }
    };
  }

  public static processHubReport(reports: Report[]) {
    const hubMap = new Map<string, LowerCategoryCounts & { total: number }>();

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    let currentMonthCount = 0;
    let lastMonthCount = 0;

    const monthMap = new Map<string, TitleCategoryCounts & { total: number }>();

    reports.forEach(report => {
      const hub = this.getHub(report);
      if (hub === 'Unknown') return;

      if (!hubMap.has(hub)) hubMap.set(hub, { total: 0, ...this.emptyLowerCounts() });
      const data = hubMap.get(hub)!;
      data.total++;

      const category = this.getCategory(report);
      this.bumpCategory(data, category);

      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (monthKey) {
        if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, ...this.emptyTitleCounts() });
        const mData = monthMap.get(monthKey)!;
        mData.total++;
        this.bumpCategory(mData, category);
        if (monthKey === currentMonthKey) currentMonthCount++;
        if (monthKey === lastMonthKey) lastMonthCount++;
      }
    });

    const totalCount = reports.length;
    const hubSummaries = Array.from(hubMap.entries())
      .map(([hub, data]) => {
        const total = data.total;
        return {
          hub,
          total,
          irregularity: data.irregularity,
          complaint: data.complaint,
          compliment: data.compliment,
          occurrence: data.occurrence,
          accidentIncident: data.accidentIncident,
          irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
          netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
          riskIndex: (data.irregularity * 2) + data.complaint,
          rank: 0,
          contribution: totalCount > 0 ? (total / totalCount) * 100 : 0,
          growth: 0
        };
      })
      .sort((a, b) => b.total - a.total)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const trendData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([month, data]) => ({ month, ...data }));

    const totalHubs = hubMap.size;
    const sortedByCount = [...hubSummaries].sort((a, b) => a.total - b.total);
    const topPerformer = sortedByCount[0] || { hub: '-', total: 0 };
    const worstPerformer = sortedByCount[sortedByCount.length - 1] || { hub: '-', total: 0 };

    const momChange = lastMonthCount > 0 ? ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100 : 0;

    return {
      hubData: hubSummaries,
      trendData,
      categoryDistribution: hubSummaries.slice(0, 10).map(b => ({
        hub: b.hub,
        irregularity: b.irregularity,
        complaint: b.complaint,
        compliment: b.compliment,
        occurrence: b.occurrence,
        accidentIncident: b.accidentIncident
      })),
      kpis: {
        totalHubs,
        topPerformer: { name: topPerformer.hub, count: topPerformer.total },
        worstPerformer: { name: worstPerformer.hub, count: worstPerformer.total },
        avgReportsPerHub: totalHubs > 0 ? Math.round(totalCount / totalHubs) : 0,
        momChange: Math.round(momChange * 10) / 10
      }
    };
  }

  public static processBranchReport(reports: Report[]) {
    const branchMap = new Map<string, LowerCategoryCounts & { total: number }>();

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    let currentMonthCount = 0;
    let lastMonthCount = 0;

    const monthMap = new Map<string, TitleCategoryCounts & { total: number }>();

    reports.forEach(report => {
      const branch = this.getBranch(report);
      if (branch === 'Unknown') return;

      if (!branchMap.has(branch)) branchMap.set(branch, { total: 0, ...this.emptyLowerCounts() });
      const data = branchMap.get(branch)!;
      data.total++;

      const category = this.getCategory(report);
      this.bumpCategory(data, category);

      const monthKey = this.getMonthKey(report.date_of_event || report.created_at);
      if (monthKey) {
        if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, ...this.emptyTitleCounts() });
        const mData = monthMap.get(monthKey)!;
        mData.total++;
        this.bumpCategory(mData, category);
        if (monthKey === currentMonthKey) currentMonthCount++;
        if (monthKey === lastMonthKey) lastMonthCount++;
      }
    });

    const totalCount = reports.length;
    const branchSummaries = Array.from(branchMap.entries())
      .map(([branch, data]) => {
        const total = data.total;
        return {
          branch,
          total,
          irregularity: data.irregularity,
          complaint: data.complaint,
          compliment: data.compliment,
          occurrence: data.occurrence,
          accidentIncident: data.accidentIncident,
          irregularityRate: total > 0 ? (data.irregularity / total) * 100 : 0,
          netSentiment: (data.compliment + data.complaint) > 0 ? ((data.compliment - data.complaint) / (data.compliment + data.complaint)) * 100 : 0,
          riskIndex: (data.irregularity * 2) + data.complaint,
          rank: 0,
          contribution: totalCount > 0 ? (total / totalCount) * 100 : 0,
          growth: 0
        };
      })
      .sort((a, b) => b.total - a.total)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const trendData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([month, data]) => ({ month, ...data }));

    const totalBranches = branchMap.size;
    const sortedByCount = [...branchSummaries].sort((a, b) => a.total - b.total);
    const topPerformer = sortedByCount[0] || { branch: '-', total: 0 };
    const worstPerformer = sortedByCount[sortedByCount.length - 1] || { branch: '-', total: 0 };

    const momChange = lastMonthCount > 0 ? ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100 : 0;

    return {
      branchData: branchSummaries,
      trendData,
      categoryDistribution: branchSummaries.slice(0, 10).map(b => ({
        branch: b.branch,
        irregularity: b.irregularity,
        complaint: b.complaint,
        compliment: b.compliment,
        occurrence: b.occurrence,
        accidentIncident: b.accidentIncident
      })),
      kpis: {
        totalBranches,
        topPerformer: { name: topPerformer.branch, count: topPerformer.total },
        worstPerformer: { name: worstPerformer.branch, count: worstPerformer.total },
        avgReportsPerBranch: totalBranches > 0 ? Math.round(totalCount / totalBranches) : 0,
        momChange: Math.round(momChange * 10) / 10
      }
    };
  }
}
