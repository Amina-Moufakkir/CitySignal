/**
 * Weekday versus weekend daily means.
 *
 * Emphasis form: weekend carries the accent because it is what the section is
 * about; weekday is context. When the reader has guessed, their guess is drawn
 * as a ghost mark on the same axis, converted from a percentage into the weekend
 * level it implies - so guess and outcome are directly comparable.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import type { Comparison } from "@/lib/analysis";
import { ChartTable, niceMax, roundedBarPath, CHART } from "./ChartFrame";

// Sized so one viewBox unit renders as one CSS pixel, which is what makes the
// 24px bar cap in the mark spec actually 24px on screen. Two categories, so the
// canvas stays small and the bars keep their air rather than filling the band.
const WIDTH = 430;
const HEIGHT = 280;
const MARGIN = { top: 34, right: 24, bottom: 48, left: 52 };

export function DayTypeColumns({
  comparison,
  weekdayDays,
  weekendDays,
  label,
  guessPercent = null,
  compact = false,
}: {
  comparison: Comparison;
  weekdayDays: number;
  weekendDays: number;
  label: string;
  guessPercent?: number | null;
  compact?: boolean;
}) {
  if (comparison.kind === "no-data") {
    return null;
  }

  const weekdayAverage = comparison.kind === "computed" ? comparison.weekdayAverage : 0;
  const weekendAverage = comparison.weekendAverage;
  const guessLevel =
    guessPercent === null || comparison.kind !== "computed"
      ? null
      : weekdayAverage * (1 + guessPercent / 100);

  const height = compact ? 220 : HEIGHT;
  const margin = compact ? { ...MARGIN, top: 28, bottom: 44 } : MARGIN;
  const plotWidth = WIDTH - margin.left - margin.right;
  const max = niceMax(Math.max(weekdayAverage, weekendAverage, guessLevel ?? 0) * 1.12);
  const y = scaleLinear().domain([0, max]).range([height - margin.bottom, margin.top]);

  const bars = [
    { key: "weekday", label: "Weekday", value: weekdayAverage, days: weekdayDays, accent: false },
    { key: "weekend", label: "Weekend", value: weekendAverage, days: weekendDays, accent: true },
  ];

  const band = plotWidth / bars.length;
  const barWidth = CHART.maxBarThickness;

  return (
    <>
      <svg
        className="chart-svg"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`${label}. Weekday average ${formatNumber(weekdayAverage, 1)} complaints per day, weekend average ${formatNumber(weekendAverage, 1)}.`}
      >
        {y.ticks(3).map((tick) => (
          <g key={tick}>
            <line
              className="grid"
              x1={margin.left}
              y1={y(tick)}
              x2={WIDTH - margin.right}
              y2={y(tick)}
            />
            <text className="tick" x={margin.left - 10} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <line
          className="axis"
          x1={margin.left}
          y1={y(0)}
          x2={WIDTH - margin.right}
          y2={y(0)}
        />

        {bars.map((bar, index) => {
          const centre = margin.left + band * index + band / 2;
          const x = centre - barWidth / 2;
          const top = y(bar.value);

          return (
            <g key={bar.key}>
              <path
                className={bar.accent ? "mark-accent" : "mark-muted"}
                d={roundedBarPath(x, top, barWidth, y(0) - top, CHART.barRadius, "top")}
              />
              <text className="value-label" x={centre} y={top - 12} textAnchor="middle">
                {formatNumber(bar.value, 1)}
              </text>
              <text className="tick" x={centre} y={y(0) + 24} textAnchor="middle">
                {bar.label}
              </text>
              <text className="tick tick-faint" x={centre} y={y(0) + 40} textAnchor="middle">
                {formatNumber(bar.days)} days
              </text>
            </g>
          );
        })}

        {guessLevel !== null && (
          <g>
            <line
              className="guess-line"
              x1={margin.left}
              y1={y(guessLevel)}
              x2={WIDTH - margin.right}
              y2={y(guessLevel)}
            />
            <text
              className="tick guess-label"
              x={WIDTH - margin.right}
              y={y(guessLevel) - 8}
              textAnchor="end"
            >
              your guess: {formatNumber(guessLevel, 1)}
            </text>
          </g>
        )}
      </svg>

      <ChartTable
        summary={`${label}: average complaints per day by day type`}
        columns={["Day type", "Average per day", "Days"]}
        rows={bars.map((bar) => [bar.label, formatNumber(bar.value, 1), formatNumber(bar.days)])}
      />
    </>
  );
}
