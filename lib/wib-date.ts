/**
 * Sheet dates, resolved in WIB.
 *
 * Operations are WIB and the spreadsheet's own timezone is Asia/Jakarta, but
 * the processes reading it are not: dev runs in Asia/Jakarta and deploy runs in
 * UTC. Anything built with `new Date(y, m, d)` therefore means a different
 * instant depending on where it ran, and the stored calendar day drifts by a
 * day between the two. Everything here is anchored to WIB explicitly so a date
 * round-trips to the same day in either process.
 *
 * Kept free of `server-only` and of any Supabase/Sheets import so the standalone
 * sync schedulers (plain .mjs) can share this exact implementation rather than
 * carrying a copy that drifts from it.
 *
 * Covered by scripts/verify-wib-dates.mts under both TZ=UTC and TZ=Asia/Jakarta.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60_000;

/**
 * English names sit alongside the Indonesian ones because the sheet holds both
 * — "Date of Event" on the NON CARGO tab renders as "January 25, 2025". Without
 * them that shape fell through to `new Date(str)` at the bottom of parseDate,
 * which reads a bare date as midnight in the *process* timezone: the same cell
 * became 2025-01-24T17:00Z in dev (WIB) and 2025-01-25T00:00Z on a UTC host.
 */
export const MonthMap: Record<string, number> = {
  januari: 0, january: 0, jan: 0,
  februari: 1, february: 1, feb: 1,
  maret: 2, march: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, june: 5, jun: 5,
  juli: 6, july: 6, jul: 6,
  agustus: 7, august: 7, ags: 7, agt: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, october: 9, okt: 9, oct: 9,
  november: 10, nov: 10,
  desember: 11, december: 11, des: 11, dec: 11,
};

/**
 * `YYYY-MM-DD` for the calendar day this instant falls on in WIB.
 *
 * Pinned to WIB rather than server-local so the stored day is the same whether
 * the process runs in Asia/Jakarta (dev) or UTC (deploy).
 */
export function formatWibDate(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The instant a WIB wall-clock reading refers to, or `null` if those components
 * are not a real date.
 *
 * `Date.UTC` rolls overflow forward — `Date.UTC(2025, 1, 30)` is 2 March — so a
 * corrupt or typo'd cell like `2025-02-30` used to become a plausible-looking
 * wrong date instead of being rejected. Re-reading the components back off the
 * constructed instant is what catches that.
 */
function wibInstant(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0
): Date | null {
  const utc = Date.UTC(year, month, day, hours, minutes, seconds, ms);
  if (Number.isNaN(utc)) return null;

  const probe = new Date(utc);
  const normalized =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hours &&
    probe.getUTCMinutes() === minutes &&
    probe.getUTCSeconds() === seconds;

  return normalized ? new Date(utc - WIB_OFFSET_MS) : null;
}

/**
 * Midnight WIB on the given calendar day, or `null` when the components are not
 * a real date. `new Date(y, m, d)` would anchor to the *process* timezone
 * instead, so the same bare date resolved to a different instant in dev
 * (Asia/Jakarta) than on deploy (UTC) — and formatWibDate() then disagreed by a
 * day about which day it was.
 */
export function wibMidnight(year: number, month: number, day: number): Date | null {
  return wibInstant(year, month, day);
}

/**
 * `Z` or a numeric offset suffix — the only forms that pin a timestamp to an
 * instant on their own. The hour-only spelling is included because that is what
 * Postgres hands back: `2025-07-15 00:00:00+00`.
 */
const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** `YYYY-MM-DD` + time, with no trailing zone designator. */
const NAIVE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3})\d*)?$/;

export function parseDate(dateStr: string | number | Date): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  if (typeof dateStr === 'number') {
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  // A full timestamp is an instant, not a calendar date, and must be parsed as
  // one. The bare-date branch below builds midnight WIB, so feeding it an ISO
  // timestamp made it read the *UTC* calendar day and re-anchor it to WIB
  // midnight — shifting the value back one day. Since the sync pushes stored
  // timestamps to Sheets and parses them again on the next pull, affected rows
  // lost a day on every single sync.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
    // Only `Z` or a numeric offset makes a timestamp self-describing. Without
    // one, ES2016+ resolves `new Date('2025-07-15T09:00')` in the *process*
    // timezone, so a UTC host and a Jakarta host read the same cell seven hours
    // apart — the exact drift this module exists to prevent. Sheets writes its
    // timestamps as WIB wall-clock, so that is what a bare one means.
    const naive = EXPLICIT_OFFSET.test(str) ? null : NAIVE_TIMESTAMP.exec(str);
    if (naive) {
      const instant = wibInstant(
        parseInt(naive[1], 10),
        parseInt(naive[2], 10) - 1,
        parseInt(naive[3], 10),
        parseInt(naive[4], 10),
        parseInt(naive[5], 10),
        naive[6] ? parseInt(naive[6], 10) : 0,
        naive[7] ? parseInt(naive[7].padEnd(3, '0'), 10) : 0
      );
      // Shaped like a timestamp but not a real one (2025-02-30T10:00) — reject
      // rather than fall through to a parser that would normalise it forward.
      return instant;
    }

    const instant = new Date(str);
    if (!isNaN(instant.getTime())) return instant;
  }

  // Bare `YYYY-MM-DD` (no time part) is a calendar date: an event dated
  // 2025-07-12 means 2025-07-12 in WIB, not in UTC and not in whatever
  // timezone the process happens to run in.
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    // Authoritative for this shape: an unreal day (2025-02-30) is rejected here
    // rather than left to the lenient `new Date` fallback, which would roll it
    // forward to 2 March and store a date the sheet never contained.
    return wibMidnight(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10) - 1,
      parseInt(isoMatch[3], 10)
    );
  }

  const parts = str.toLowerCase().split(/[\s,/-]+/);
  if (parts.length >= 2) {
    let day = 1;
    let month = -1;
    let year = -1;

    const yearIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
    if (yearIdx !== -1) {
      year = parseInt(parts[yearIdx]);
      for (let i = 0; i < parts.length; i++) {
        if (i === yearIdx) continue;
        if (MonthMap[parts[i]] !== undefined) {
          month = MonthMap[parts[i]];
          const dayCandidates = [parts[i - 1], parts[i + 1]].filter((p) => p && /^\d{1,2}$/.test(p));
          if (dayCandidates.length > 0) {
            day = parseInt(dayCandidates[0]);
          }
          break;
        }
      }
    }

    if (year !== -1 && month !== -1) {
      return wibMidnight(year, month, day);
    }
  }

  const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    let day = parseInt(ddmmyyyy[1], 10);
    let month = parseInt(ddmmyyyy[2], 10) - 1;
    // Sheets hands some rows back as M/D/YYYY. A "month" past December can only
    // be a day, so swap — otherwise it overflowed into the following year
    // (7/15/2025 landed on 2026-03-07).
    if (month > 11) [day, month] = [month + 1, day - 1];
    const year = parseInt(ddmmyyyy[3], 10);
    // Authoritative for this shape, for the same reason as the ISO branch above.
    return wibMidnight(year, month, day);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
