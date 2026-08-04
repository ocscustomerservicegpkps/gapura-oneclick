
'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  QueryDefinition,
  QueryDimension,
  QueryMeasure,
  QueryFilter,
  QuerySort,
} from '@/types/builder';
import { getJoinsForSource, getFieldsForTable, JOINS } from '@/lib/builder/schema';
import type { FieldDef } from '@/types/builder';

const defaultQuery: QueryDefinition = {
  source: 'reports',
  joins: [],
  dimensions: [],
  measures: [],
  filters: [],
  sorts: [],
  limit: 1000,
};

export function useQueryBuilder(initial?: Partial<QueryDefinition>) {
  const [query, setQuery] = useState<QueryDefinition>({ ...defaultQuery, ...initial });

  const setSource = useCallback((source: string) => {
    setQuery(() => ({
      ...defaultQuery,
      source,

    }));
  }, []);

  const addDimension = useCallback((dim: QueryDimension) => {
    setQuery(prev => ({
      ...prev,
      dimensions: [...prev.dimensions, dim],
    }));
  }, []);

  const removeDimension = useCallback((index: number) => {
    setQuery(prev => ({
      ...prev,
      dimensions: prev.dimensions.filter((_, i) => i !== index),
    }));
  }, []);

  const updateDimension = useCallback((index: number, updates: Partial<QueryDimension>) => {
    setQuery(prev => ({
      ...prev,
      dimensions: prev.dimensions.map((d, i) => i === index ? { ...d, ...updates } : d),
    }));
  }, []);

  const addMeasure = useCallback((measure: QueryMeasure) => {
    setQuery(prev => ({
      ...prev,
      measures: [...prev.measures, measure],
    }));
  }, []);

  const removeMeasure = useCallback((index: number) => {
    setQuery(prev => ({
      ...prev,
      measures: prev.measures.filter((_, i) => i !== index),
    }));
  }, []);

  const updateMeasure = useCallback((index: number, updates: Partial<QueryMeasure>) => {
    setQuery(prev => ({
      ...prev,
      measures: prev.measures.map((m, i) => i === index ? { ...m, ...updates } : m),
    }));
  }, []);

  const addFilter = useCallback((filter: QueryFilter) => {
    setQuery(prev => ({
      ...prev,
      filters: [...prev.filters, filter],
    }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  }, []);

  const updateFilter = useCallback((index: number, updates: Partial<QueryFilter>) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.map((f, i) => i === index ? { ...f, ...updates } : f),
    }));
  }, []);

  const addSort = useCallback((sort: QuerySort) => {
    setQuery(prev => ({
      ...prev,
      sorts: [...prev.sorts, sort],
    }));
  }, []);

  const removeSort = useCallback((index: number) => {
    setQuery(prev => ({
      ...prev,
      sorts: prev.sorts.filter((_, i) => i !== index),
    }));
  }, []);

  const toggleJoin = useCallback((joinKey: string) => {
    setQuery(prev => {
      const exists = prev.joins.some(j => j.joinKey === joinKey);
      if (exists) {

        const joinDef = JOINS.find(j => j.key === joinKey);
        const removedTable = joinDef?.to;
        return {
          ...prev,
          joins: prev.joins.filter(j => j.joinKey !== joinKey),
          dimensions: removedTable ? prev.dimensions.filter(d => d.table !== removedTable) : prev.dimensions,
          measures: removedTable ? prev.measures.filter(m => m.table !== removedTable) : prev.measures,
          filters: removedTable ? prev.filters.filter(f => f.table !== removedTable) : prev.filters,
        };
      } else {
        const joinDef = JOINS.find(j => j.key === joinKey);
        if (!joinDef) return prev;
        return {
          ...prev,
          joins: [...prev.joins, { from: joinDef.from, to: joinDef.to, joinKey }],
        };
      }
    });
  }, []);

  const setLimit = useCallback((limit: number) => {
    setQuery(prev => ({ ...prev, limit: Math.min(limit, 5000) }));
  }, []);

  const reset = useCallback(() => {
    setQuery({ ...defaultQuery });
  }, []);

  const loadQuery = useCallback((q: QueryDefinition) => {
    setQuery(q);
  }, []);

  const availableTables = useMemo(() => {
    const tables = [query.source];
    for (const j of query.joins) {
      const joinDef = JOINS.find(jd => jd.key === j.joinKey);
      if (joinDef) tables.push(joinDef.to);
    }
    return [...new Set(tables)];
  }, [query.source, query.joins]);

  const availableFields = useMemo(() => {
    const fields: Array<{ table: string; field: FieldDef }> = [];
    for (const table of availableTables) {
      for (const f of getFieldsForTable(table)) {
        fields.push({ table, field: f });
      }
    }
    return fields;
  }, [availableTables]);

  const availableJoins = useMemo(() => {
    return getJoinsForSource(query.source);
  }, [query.source]);

  return {
    query,
    setQuery,
    setSource,
    addDimension,
    removeDimension,
    updateDimension,
    addMeasure,
    removeMeasure,
    updateMeasure,
    addFilter,
    removeFilter,
    updateFilter,
    addSort,
    removeSort,
    toggleJoin,
    setLimit,
    reset,
    loadQuery,
    availableTables,
    availableFields,
    availableJoins,
  };
}
