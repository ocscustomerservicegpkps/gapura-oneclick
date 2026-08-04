/**
 * Local (WIB / UTC+7) calendar-day helpers.
 *
 * This app operates in WIB (Waktu Indonesia Barat, UTC+7), but server code often runs
 * on hosts whose process timezone is UTC (e.g. serverless). Naively doing
 * `date.toISOString().split('T')[0]` (or `getUTCFullYear()`/`getUTCMonth()`/`getUTCDate()`)
 * converts an instant to UTC first, which silently shifts the calendar day for anything
 * evaluated between local midnight and 07:00 WIB (or, for TIMESTAMPTZ values, whenever the
 * UTC and WIB calendar days differ). Client-side code has the same problem in reverse if it
 * relies on `date.getTimezoneOffset()` and the browser's clock isn't set to WIB.
 *
 * These helpers shift the instant by a fixed +7h offset before reading its UTC parts, so the
 * result reflects WIB wall-clock time regardless of the host's configured timezone.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Returns a Date whose UTC getters read as WIB (UTC+7) wall-clock time for `date`. */
function toWibShifted(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** Formats `date` as a 'YYYY-MM-DD' string using WIB (UTC+7) calendar-day boundaries. */
export function toLocalYMD(date: Date): string {
  return toWibShifted(date).toISOString().slice(0, 10);
}

/** Extracts the WIB (UTC+7) calendar year and month (0-indexed) for `date`. */
export function wibYearMonth(date: Date): { year: number; month: number } {
  const shifted = toWibShifted(date);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}
