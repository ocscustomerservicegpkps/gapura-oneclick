
'use client';

import { useState, useCallback } from 'react';
import type { QueryDefinition, QueryResult } from '@/types/builder';
import { fetchWithDemo } from '@/lib/utils';

export function useQueryExecution() {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (query: QueryDefinition) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithDemo('/api/dashboards/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();

      if (!res.ok) {
        const detail = json.details
          ? Array.isArray(json.details) ? json.details.join(', ') : json.details
          : json.error;
        setError(detail || 'Query gagal dijalankan');
        setData(null);
        return null;
      }

      const result: QueryResult = {
        columns: json.columns,
        rows: json.rows,
        rowCount: json.rowCount,
        executionTimeMs: json.executionTimeMs,
      };
      setData(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, execute, clear };
}
