/**
 * A point estimate, its interval, and the threshold it was tested against.
 *
 * Used where a pre-registered hypothesis named a number in advance. The chart
 * exists to show the relationship between three values on one axis: what was
 * predicted, what was observed, and how much of the observation is noise.
 */

import { scaleLinear } from "d3-scale";

import { formatPercentage } from "@/lib/format";
import { ChartTable, CHART } from "./ChartFrame";
import type { IntervalResult } from "@/lib/uncertainty";

const WIDTH = 640;
const HEIGHT = 128;
const MARGIN = { top: 30, right: 28, bottom: 42, left: 28 };

export function IntervalPlot({
  interval,
  threshold,
  thresholdLabel,
  label,
}: {
  interval: IntervalResult;
  threshold: number;
  thresholdLabel: string;
  label: string;
}) {
  if (interval.kind === "unavailable") {
    return null;
  }

  const max = Math.ceil(Math.max(threshold, interval.upper) / 10) * 10 + 10;
  const x = scaleLinear().domain([0, max]).range([MARGIN.left, WIDTH - MARGIN.right]);
  const midY = MARGIN.top + (HEIGHT - MARGIN.top - MARGIN.bottom) / 2;

  return (
    <>
      <svg
        className="chart-svg"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label}. Observed ${formatPercentage(interval.point)}, 95% interval ${formatPercentage(interval.lower)} to ${formatPercentage(interval.upper)}, against a predicted threshold of ${formatPercentage(threshold, 0)}.`}
      >
        <line className="axis" x1={MARGIN.left} y1={midY + 30} x2={WIDTH - MARGIN.right} y2={midY + 30} />
        {x.ticks(5).map((tick) => (
          <text key={tick} className="tick" x={x(tick)} y={midY + 50} textAnchor="middle">
            {formatPercentage(tick, 0)}
          </text>
        ))}

        <line
          className="threshold-rule"
          x1={x(threshold)}
          y1={MARGIN.top - 12}
          x2={x(threshold)}
          y2={midY + 30}
        />
        <text className="tick threshold-label" x={x(threshold) + 8} y={MARGIN.top - 4}>
          {thresholdLabel}
        </text>

        <line
          className="interval-rule"
          x1={x(interval.lower)}
          y1={midY}
          x2={x(interval.upper)}
          y2={midY}
        />
        <line className="interval-cap" x1={x(interval.lower)} y1={midY - 7} x2={x(interval.lower)} y2={midY + 7} />
        <line className="interval-cap" x1={x(interval.upper)} y1={midY - 7} x2={x(interval.upper)} y2={midY + 7} />
        <circle className="marker-accent" cx={x(interval.point)} cy={midY} r={CHART.markerRadius} />
        <text className="value-label" x={x(interval.point)} y={midY - 16} textAnchor="middle">
          {formatPercentage(interval.point)}
        </text>
      </svg>

      <ChartTable
        summary={label}
        columns={["Quantity", "Value"]}
        rows={[
          ["Predicted threshold", formatPercentage(threshold, 0)],
          ["Observed", formatPercentage(interval.point)],
          ["95% interval lower bound", formatPercentage(interval.lower)],
          ["95% interval upper bound", formatPercentage(interval.upper)],
        ]}
      />
    </>
  );
}
