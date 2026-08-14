/**
 * Presentation helpers, ported from `legacy/app.js`.
 *
 * `formatPercentage` no longer accepts null. Absence is represented by a variant
 * of `Comparison`, so a missing value can never reach a formatter.
 */

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercentage(value: number, digits = 1): string {
  return `${formatNumber(value, digits)}%`;
}

export function formatSignedPercentage(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${formatPercentage(value, digits)}`;
}

export function hourLabel(hour: number): string {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour < 12) {
    return `${hour} AM`;
  }

  if (hour === 12) {
    return "12 PM";
  }

  return `${hour - 12} PM`;
}

export function possessiveLabel(label: string): string {
  return label.endsWith("s") ? `${label}'` : `${label}'s`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A `YYYY-MM-DD` day, written the way a person writes a date.
 *
 * Parsed from its components. `new Date("2025-08-04")` would be read as UTC and
 * then printed through the host zone, which turns the 4th into the 3rd for every
 * reader west of Greenwich.
 */
export function formatDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match) {
    return iso;
  }

  const [, year, month, day] = match;

  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/**
 * An inclusive span of days. The year is dropped from the opening date when both
 * ends share it, because "1 January to 29 December 2024" reads and the repeated
 * year does not.
 */
export function formatDaySpan(startIso: string, endInclusiveIso: string): string {
  const start = formatDay(startIso);
  const end = formatDay(endInclusiveIso);
  const sameYear = startIso.slice(0, 4) === endInclusiveIso.slice(0, 4);

  return `${sameYear ? start.replace(/ \d{4}$/, "") : start} to ${end}`;
}

/**
 * A machine timestamp rendered for a reader. Parsed from its components rather
 * than through `new Date(string)`, keeping the same discipline the analysis uses,
 * and printed in UTC so the server and any reader see the same words.
 */
export function formatTimestamp(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);

  if (!match) {
    return "an unrecorded time";
  }

  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1] ?? month;

  return `${Number(day)} ${monthName} ${year} at ${hour}:${minute} UTC`;
}
