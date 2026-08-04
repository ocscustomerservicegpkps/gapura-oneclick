'use client';

import { useCallback, useMemo } from 'react';
import { useData } from '@/lib/swr';
import { mergeReportUpdate } from '@/lib/report-cache';
import type { Report } from '@/types';

type JoumpaReportsResponse = { reports?: Report[] };

export function useJoumpaReports(enabled = true) {
  const { data, error, isLoading, mutate } = useData<JoumpaReportsResponse>(enabled ? '/api/joumpa' : null);
  const reports = useMemo(() => data?.reports ?? [], [data]);

  const refresh = useCallback(() => mutate(), [mutate]);
  const patchReport = useCallback((updatedReport: Report) => mutate(
    (current) => current
      ? { ...current, reports: mergeReportUpdate(current.reports, updatedReport) }
      : current,
    false,
  ), [mutate]);

  return { reports, error, isLoading: enabled && isLoading, refresh, patchReport };
}
