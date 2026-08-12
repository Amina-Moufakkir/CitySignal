/**
 * Shared chart chrome.
 *
 * Every chart in the piece is emphasis form: one accent hue for the series the
 * section is about, de-emphasis gray for context. Colours are validated, not
 * eyeballed - see AGENTS.md. Identity is never carried by colour alone, so every
 * chart ships direct labels and a table twin.
 */

import type { ReactNode } from "react";

export const CHART = {
  /** Bars are capped rather than filling their band; the leftover is air. */
  maxBarThickness: 24,
  barRadius: 4,
  lineWidth: 2,
  markerRadius: 5,
  surfaceGap: 2,
} as const;

export function ChartFigure({
  caption,
  children,
  table,
  note,
}: {
  caption: ReactNode;
  children: ReactNode;
  table: ReactNode;
  note?: ReactNode;
}) {
  return (
    <figure className="chart">
      <figcaption className="chart-caption">{caption}</figcaption>
      {children}
      {table}
      {note ? <p className="chart-note">{note}</p> : null}
    </figure>
  );
}

/**
 * The WCAG-clean twin of a chart. Visually hidden, present in the DOM, and
 * readable by a screen reader or with styles off. No value in this piece is
 * reachable only by looking at a mark.
 */
export function ChartTable({
  summary,
  columns,
  rows,
}: {
  summary: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  // The table is wrapped rather than hidden directly: a table ignores the 1px
  // width the visually-hidden recipe sets and lays out at its natural size, which
  // pushed the whole page into horizontal scroll. A div respects it.
  return (
    <div className="visually-hidden">
      <table>
        <caption>{summary}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A solid hairline gridline. Never dashed - dashing reads as a threshold. */
export function GridLine(props: { x1: number; y1: number; x2: number; y2: number }) {
  return <line className="grid" {...props} />;
}

export function AxisTick({
  x,
  y,
  children,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text className="tick" x={x} y={y} textAnchor={anchor}>
      {children}
    </text>
  );
}

/**
 * A rounded data-end that stays square at the baseline, per the mark spec.
 * `side` names the end the value grows toward.
 */
export function roundedBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  side: "top" | "right",
): string {
  if (width <= 0 || height <= 0) {
    return "";
  }

  const r = Math.max(0, Math.min(radius, side === "top" ? height : width, Math.min(width, height) / 2));

  if (side === "top") {
    return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  }

  return `M${x},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x},${y + height} Z`;
}

/**
 * Rounds an axis maximum up to a clean number so ticks read 0 / 200 / 400.
 *
 * The step ladder is deliberately fine. A coarse 1/2/5/10 ladder rounds 656 up
 * to 1,000 and 44.7 up to 100, which leaves the data sitting in the bottom half
 * of the plot and makes every pattern look flatter than it is. These steps put
 * the axis just above the data instead.
 *
 * Callers pass the raw maximum: the rounding is the headroom, so multiplying by
 * a padding factor first only re-introduces the problem.
 */
const STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10];

export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = STEPS.find((candidate) => normalized <= candidate) ?? 10;

  return step * magnitude;
}
