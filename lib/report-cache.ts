import type { Report } from '@/types';

export function mergeReportUpdate(
  reports: Report[] | undefined,
  updatedReport: Report,
): Report[] | undefined {
  if (!reports) return reports;

  const reportIndex = reports.findIndex((report) => report.id === updatedReport.id);
  if (reportIndex === -1) return reports;

  const nextReports = [...reports];
  nextReports[reportIndex] = {
    ...reports[reportIndex],
    ...updatedReport,
  };
  return nextReports;
}
