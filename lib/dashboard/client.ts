import type { CompleteDashboardReportsResponse } from './contracts';
import type { Report } from '@/types';

export async function fetchCompleteDashboardReports(url: string): Promise<Report[]> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to load complete dashboard reports (${response.status})`);
  const payload = await response.json() as Partial<CompleteDashboardReportsResponse>;
  if (
    payload.completeness !== 'complete'
    || payload.source !== 'ground_handling'
    || !Array.isArray(payload.reports)
    || payload.returnedCount !== payload.eligibleCount
    || payload.reports.length !== payload.returnedCount
  ) {
    throw new Error('Dashboard report response is incomplete');
  }
  return payload.reports;
}
