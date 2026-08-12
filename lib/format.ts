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
