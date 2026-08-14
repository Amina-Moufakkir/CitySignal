/**
 * UTC day arithmetic for the rolling current period.
 *
 * These are deliberately duplicated from `analysis.ts` rather than shared with
 * it. `analysis.ts` is the audited module and `config.ts` cannot import from it
 * anyway - analysis imports config, so the dependency only runs one way. Rather
 * than move primitives out of an audited file to break the cycle, the two copies
 * are kept and `dates.test.ts` asserts they agree across a multi-year sweep. The
 * duplication is therefore checked rather than merely tolerated.
 *
 * Everything here works in whole UTC days. The host timezone never enters, which
 * is the same property the analysis holds and the CI matrix enforces.
 */

export const DAY_MS = 86_400_000;

/** Sunday is 0, matching `Date.prototype.getUTCDay`. */
export const SUNDAY = 0;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DD` for the UTC day a timestamp falls in. */
export function isoDayUtc(time: number | Date): string {
  const date = time instanceof Date ? time : new Date(time);

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Midnight UTC on the day a timestamp falls in, as epoch milliseconds.
 *
 * Reading the components and rebuilding through `Date.UTC` is what drops the
 * clock time without ever consulting the host zone.
 */
export function utcDayStart(time: number | Date): number {
  const date = time instanceof Date ? time : new Date(time);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Adds (or subtracts) whole UTC days. */
export function shiftDays(time: number, days: number): number {
  return time + days * DAY_MS;
}

/**
 * Epoch milliseconds for midnight UTC on a `YYYY-MM-DD` day.
 *
 * Built from the components rather than by handing the string to `new Date`,
 * which is the same rule the analysis follows for Socrata timestamps. Returns
 * `NaN` for anything that is not a plain day, so a malformed value fails loudly
 * instead of silently becoming a date.
 */
export function utcDayFromIso(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match) {
    return Number.NaN;
  }

  const [, year, month, day] = match;

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/**
 * The most recent Sunday at or before a day. A day that is already Sunday is
 * returned unchanged, which is what makes the week snap idempotent.
 */
export function previousSunday(time: number): number {
  const start = utcDayStart(time);

  return shiftDays(start, -new Date(start).getUTCDay());
}
