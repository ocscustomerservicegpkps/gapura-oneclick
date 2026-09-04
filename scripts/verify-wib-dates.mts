/**
 * The sheet date round-trip must land on the same WIB calendar day whatever
 * timezone the process runs in — dev is Asia/Jakarta, deploy is UTC, and a
 * disagreement here walks stored dates backwards one day per sync.
 *
 * Run: TZ=UTC npx tsx --conditions=react-server scripts/verify-wib-dates.mts
 *  and TZ=Asia/Jakarta npx tsx --conditions=react-server scripts/verify-wib-dates.mts
 */
import assert from 'node:assert/strict';
import { config } from 'dotenv';
config({ path: '.env' });

const { parseDate, formatWibDate } = await import('../lib/services/reports-service');

const day = (input: string | number) => {
  const parsed = parseDate(input);
  assert.ok(parsed, `parseDate returned null for ${input}`);
  return formatWibDate(parsed);
};

// Every shape a Date_of_Event cell can hold, all meaning 15 July 2025.
assert.equal(day('2025-07-15'), '2025-07-15', 'bare ISO date');
assert.equal(day('15/07/2025'), '2025-07-15', 'D/M/Y');
assert.equal(day('7/15/2025'), '2025-07-15', 'M/D/Y (month past December => swap)');
assert.equal(day('15 Juli 2025'), '2025-07-15', 'Indonesian long form');
assert.equal(day('July 15, 2025'), '2025-07-15', 'English long form (NON CARGO tab renders these)');
assert.equal(day('15 July 2025'), '2025-07-15', 'English day-first');
assert.equal(
  parseDate('July 15, 2025')!.toISOString(),
  '2025-07-14T17:00:00.000Z',
  'English long form anchors to WIB midnight, not to the process timezone'
);
assert.equal(day(45853), '2025-07-15', 'Excel serial number');
assert.equal(day('2025-07-15T02:00:00.000Z'), '2025-07-15', 'ISO instant, 09:00 WIB');
assert.equal(day('2025-07-15T18:00:00.000Z'), '2025-07-16', 'ISO instant past 17:00Z is the next WIB day');

// A timestamp carrying no `Z` and no offset is a WIB wall-clock reading. Left to
// `new Date`, ES2016+ resolves it in the *process* timezone, so the same cell
// was seven hours apart between a UTC host and a Jakarta one.
assert.equal(
  parseDate('2025-07-15T09:00:00')!.toISOString(),
  '2025-07-15T02:00:00.000Z',
  'offset-less timestamp is WIB wall-clock'
);
assert.equal(
  parseDate('2025-07-15 09:00')!.toISOString(),
  '2025-07-15T02:00:00.000Z',
  'space-separated, second-less timestamp is WIB wall-clock'
);
assert.equal(day('2025-07-15T23:30:00'), '2025-07-15', 'late-evening WIB timestamp stays on its own day');

// Explicit zone designators still pin their own instant — including the
// hour-only offset Postgres returns.
assert.equal(
  parseDate('2025-07-15 02:00:00+00')!.toISOString(),
  '2025-07-15T02:00:00.000Z',
  'Postgres +00 offset is honoured, not re-read as WIB'
);
assert.equal(
  parseDate('2025-07-15T09:00:00+07:00')!.toISOString(),
  '2025-07-15T02:00:00.000Z',
  'explicit +07:00 offset is honoured'
);

// Date.UTC rolls overflow forward (2025-02-30 -> 2 March), so a corrupt cell
// used to become a plausible-looking wrong date instead of being rejected.
assert.equal(parseDate('2025-02-30'), null, 'impossible ISO day is rejected, not rolled forward');
assert.equal(parseDate('31/02/2025'), null, 'impossible D/M/Y day is rejected');
assert.equal(parseDate('2025-02-30T10:00:00'), null, 'impossible timestamp is rejected');
assert.equal(parseDate('2025-13-01'), null, 'impossible month is rejected');
assert.equal(day('2024-02-29'), '2024-02-29', 'a real leap day still parses');

// Re-reading what we wrote must not move the day (the sync does this every run).
assert.equal(day(day('15/07/2025')), '2025-07-15', 'round-trip is stable');

// The instant itself, not just the rendered day: a bare date is midnight WIB
// everywhere. This is what date-range filtering compares against, and what
// `new Date(y, m, d)` got wrong by anchoring to the process timezone.
assert.equal(parseDate('2025-07-15')!.toISOString(), '2025-07-14T17:00:00.000Z', 'bare date anchors to WIB midnight');

console.log(`OK (TZ=${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone})`);
