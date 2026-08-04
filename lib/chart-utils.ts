
export const ISO_DATETIME_RE = /^\d{4}(?:-\d{2}(?:-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?)?)?$/;

const DATE_HINT_TOKENS = new Set(['date', 'datetime', 'timestamp', 'created', 'updated', 'time']);

function isDateLikeColumnName(colName: string): boolean {
  const tokens = colName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens.some(token => DATE_HINT_TOKENS.has(token));
}

const MonthMap: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, ags: 7, agt: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, 
  november: 10, nov: 10,
  desember: 11, des: 11
};

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val !== 'string') return null;

  const str = val.trim();
  if (!str) return null;

  if (ISO_DATETIME_RE.test(str)) {
    const d = new Date(str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str);
    if (!isNaN(d.getTime())) return d;
  }

  const parts = str.toLowerCase().split(/[\s,/-]+/);
  if (parts.length >= 2) {
    let day = 1;
    let month = -1;
    let year = -1;

    const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
    if (yearIdx !== -1) {
      year = parseInt(parts[yearIdx]);

      for (let i = 0; i < parts.length; i++) {
        if (i === yearIdx) continue;
        if (MonthMap[parts[i]] !== undefined) {
          month = MonthMap[parts[i]];

          const dayCandidates = [parts[i-1], parts[i+1]].filter(p => p && /^\d{1,2}$/.test(p));
          if (dayCandidates.length > 0) {
            day = parseInt(dayCandidates[0]);
          }
          break;
        }
      }
    }

    if (year !== -1 && month !== -1) {
      return new Date(year, month, day);
    }
  }

  const numericMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    const year = parseInt(numericMatch[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateValue(val: unknown): string {
  const d = parseDate(val);
  if (!d) return String(val ?? '');

  if (typeof val === 'string' && /^\d{4}-\d{2}$/.test(val)) {
    const monthStr = d.toLocaleDateString('id-ID', { month: 'short' });
    const year = d.getFullYear();
    return `${monthStr} ${year}`;
  }

  const day = d.getDate();
  const month = d.toLocaleDateString('id-ID', { month: 'short' });
  const year = d.getFullYear();

  if (day === 1 && d.getHours() === 0 && d.getMinutes() === 0) {
    return `${month} ${year}`;
  }

  return `${day} ${month} ${year}`;
}

export function formatDisplayValue(val: unknown, colName?: string): string {
  if (val === null || val === undefined) return '-';

  if (typeof val === 'string' && ISO_DATETIME_RE.test(val)) {
    return formatDateValue(val);
  }

  if (colName) {
    if (isDateLikeColumnName(colName)) {
      const d = new Date(String(val));
      // Pass the Date instance straight through — formatDateValue/parseDate already
      // handle Date objects directly, so there is no need to re-encode via
      // toISOString() first, which was an unnecessary UTC round-trip.
      if (!isNaN(d.getTime())) return formatDateValue(d);
    }
  }

  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString('id-ID');
    return val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  }

  if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';

  return String(val);
}

export function isDateColumn(rows: Record<string, unknown>[], key: string): boolean {
  if (!rows || rows.length === 0) return false;
  for (const row of rows.slice(0, 5)) {
    const v = row[key];
    if (typeof v === 'string' && ISO_DATETIME_RE.test(v)) return true;
  }
  return false;
}

export function processChartData(
  rows: Record<string, unknown>[],
  xKey: string,
): Record<string, unknown>[] {
  if (!isDateColumn(rows, xKey)) return rows;

  const sorted = [...rows].sort((a, b) => {
    const aVal = String(a[xKey] ?? '');
    const bVal = String(b[xKey] ?? '');
    return aVal.localeCompare(bVal);
  });
  return sorted.map(row => ({
    ...row,
    [xKey]: formatDateValue(row[xKey]),
  }));
}
