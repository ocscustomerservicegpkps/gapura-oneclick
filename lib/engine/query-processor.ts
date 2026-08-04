
import type { QueryDefinition } from '@/types/builder';
import { toLocalYMD, wibYearMonth } from '@/lib/utils/wib-date';

interface QueryResult {

  columns: string[];

  rows: Record<string, unknown>[];

  rowCount: number;

  executionTimeMs: number;

  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getVal = (row: any, field: string) => {

  if (field === 'category' || field === 'main_category') {
    return row.category || row.main_category || row[field];
  }

  if (field === 'airline' || field === 'airlines') {
    return row.airline || row.airlines || row[field];
  }

  if (field === 'branch' || field === 'station_code' || field === 'station') {
    return row.branch || row.station_code || row.reporting_branch || row[field];
  }

  if (field === 'maskapai' || field === 'jenis_maskapai') {
    return row.maskapai || row.jenis_maskapai || row[field];
  }

  if (['year', 'month', 'day', 'quarter'].includes(field)) {
    const dateVal = row.date_of_event || row.event_date || row.created_at;
    if (dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        if (field === 'year') return d.getFullYear();
        if (field === 'month') return d.toLocaleString('en-US', { month: 'long' });
        if (field === 'day') return d.getDate();
        if (field === 'quarter') return `Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      }
    }
  }

  return row[field];
};

const getDateKey = (dateStr: string, granularity?: string) => {
  if (!dateStr) return 'Unknown';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    // Bucket by WIB (UTC+7) calendar day/month/quarter/year, not the host process's
    // local/UTC calendar day, so timestamps near WIB midnight land in the right bucket.
    const { year, month } = wibYearMonth(d);

    if (granularity === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${year} ${months[month]}`;
    }
    if (granularity === 'year') return year.toString();
    if (granularity === 'day') return toLocalYMD(d);
    if (granularity === 'quarter') {
      const q = Math.ceil((month + 1) / 3);
      return `${year} Q${q}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processQuery(query: QueryDefinition, data: any[]): QueryResult {
  const startTime = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultRows: any[] = [];

  let filtered = data;
  if (query.filters && query.filters.length > 0) {
    filtered = data.filter(row => {
      return query.filters!.every(f => {
        const val = getVal(row, f.field);
        const compareVal = f.value;
        const op = f.operator as string;

        if (op === 'is_null') return val === null || val === undefined || val === '';
        if (op === 'is_not_null') return val !== null && val !== undefined && val !== '';

        if (op === 'eq') return String(val) == String(compareVal);
        if (op === 'neq') return String(val) != String(compareVal);
        if (op === 'contains') return String(val).toLowerCase().includes(String(compareVal ?? '').toLowerCase());
        if (op === 'like' || op === 'ilike') {
          const pattern = String(compareVal ?? '').replace(/%/g, '');
          return String(val).toLowerCase().includes(pattern.toLowerCase());
        }
        if (op === 'gt' && compareVal != null) return val > compareVal;
        if (op === 'lt' && compareVal != null) return val < compareVal;
        if (op === 'gte' && compareVal != null) return val >= compareVal;
        if (op === 'lte' && compareVal != null) return val <= compareVal;
        if (op === 'in') return Array.isArray(compareVal) && compareVal.map(String).includes(String(val));
        if (op === 'not_in') return Array.isArray(compareVal) && !compareVal.map(String).includes(String(val));

        return true;
      });
    });
  }

  if (query.dimensions && query.dimensions.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups: Record<string, any> = {};

    filtered.forEach(row => {

      const dimValues = query.dimensions!.map(d => {
        const rawVal = getVal(row, d.field);
        if (d.dateGranularity) {
          return getDateKey(rawVal, d.dateGranularity);
        }
        return rawVal;
      });
      const key = dimValues.join('::');

      if (!groups[key]) {
        groups[key] = { _count: 0, _records: [] };

        query.dimensions!.forEach((d, idx) => {
          const alias = d.alias || d.field;
          groups[key][alias] = dimValues[idx];
          if (d.dateGranularity) {
            groups[key][`_raw_${alias}`] = getVal(row, d.field);
          }
        });

        query.measures?.forEach(m => {
          const alias = m.alias || m.field || 'count';
          if (['COUNT', 'count', 'SUM', 'sum'].includes(m.function)) groups[key][alias] = 0;
          if (m.function === 'COUNT_DISTINCT') groups[key][`_set_${alias}`] = new Set();
        });
      }

      groups[key]._count++;
      groups[key]._records.push(row);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateMetric = (m: any) => {
          const alias = m.alias || m.field || 'count';
          const val = getVal(row, m.field);

          if (m.function === 'COUNT') {
              groups[key][alias]++;
          }
          if (m.function === 'SUM') {
              let num = Number(val);
              if (isNaN(num) && typeof val === 'string') {
                  num = Number(val.replace(/[^0-9.-]+/g, ''));
              }
              groups[key][alias] += (isNaN(num) ? 0 : num);
          }
          if (m.function === 'COUNT_DISTINCT') {
              if (val !== undefined && val !== null) {
                  groups[key][`_set_${alias}`].add(val);
              }
          }
      };

      query.measures?.forEach(updateMetric);
    });

    resultRows = Object.values(groups).map(g => {
      const newG = { ...g };
      Object.keys(newG).forEach(k => {
        if (k.startsWith('_set_')) {
          const alias = k.replace('_set_', '');
          newG[alias] = newG[k].size;
          delete newG[k];
        }
      });
      return newG;
    });

  } 

  else if (query.measures && query.measures.length > 0) {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const result: any = { _count: 0 };
     const measures = query.measures;

     measures.forEach(m => {
       const alias = m.alias || m.field || 'count';
       if (['COUNT', 'count', 'SUM', 'sum'].includes(m.function)) result[alias] = 0;
       if (m.function === 'COUNT_DISTINCT') result[`_set_${alias}`] = new Set();
     });

     filtered.forEach(row => {
       measures.forEach(m => {
         const alias = m.alias || m.field || 'count';
         const val = getVal(row, m.field);

         if (m.function === 'COUNT') result[alias]++;
         if (m.function === 'SUM') {
             let num = Number(val);
             if (isNaN(num) && typeof val === 'string') {
                 num = Number(val.replace(/[^0-9.-]+/g, ''));
             }
             result[alias] += (isNaN(num) ? 0 : num);
         }
         if (m.function === 'COUNT_DISTINCT') {
             if (val !== undefined && val !== null) {
                 result[`_set_${alias}`].add(val);
             }
         }
       });
     });

     Object.keys(result).forEach(k => {
         if (k.startsWith('_set_')) {
             const alias = k.replace('_set_', '');
             result[alias] = result[k].size;
             delete result[k];
        }
    });

     resultRows = [result];
  } 

  else {
      resultRows = filtered;
  }

  if (query.sorts && query.sorts.length > 0) {
    resultRows.sort((a, b) => {
      for (const s of query.sorts!) {

        const field = s.alias || s.field;

        let valA = a[`_raw_${field}`] ?? a[field];
        let valB = b[`_raw_${field}`] ?? b[field];

        if (valA === undefined) valA = a[s.field] || 0;
        if (valB === undefined) valB = b[s.field] || 0;

        if (typeof valA === 'string' && !isNaN(Date.parse(valA))) valA = new Date(valA).getTime();
        if (typeof valB === 'string' && !isNaN(Date.parse(valB))) valB = new Date(valB).getTime();

        if (valA < valB) return s.direction === 'asc' ? -1 : 1;
        if (valA > valB) return s.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  if (query.limit && query.limit > 0) {
    resultRows = resultRows.slice(0, query.limit);
  }

  const columns = resultRows.length > 0 ? Object.keys(resultRows[0]).filter(k => k !== '_records') : [];

  return {
    columns,
    rows: resultRows,
    rowCount: resultRows.length,
    executionTimeMs: Date.now() - startTime
  };
}
