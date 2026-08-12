/**
 * Complaints by hour of day, weekday against weekend.
 *
 * The x axis is an INTERVAL scale over [0, 24], not a point scale over [0, 23].
 * Hour 22 covers 22:00-22:59, so it occupies the band from 22 to 23 and the
 * late-night window runs from 22:00 to the axis end plus 00:00 to 04:00. The
 * previous build used a point scale, which made the same band ambiguous and
 * under-drew the evening half.
 *
 * Two series, so identity gets three channels: the accent hue, a dash pattern on
 * the context line, and direct labels at both line ends.
 */

import { scaleLinear } from "d3-scale";
import { line as d3Line, curveMonotoneX } from "d3-shape";

import { formatNumber, hourLabel } from "@/lib/format";
import { NIGHT_END_HOUR, NIGHT_START_HOUR, type HourRow, type HourlyGap } from "@/lib/analysis";
import { ChartTable, niceMax, CHART } from "./ChartFrame";

const WIDTH = 720;
const HEIGHT = 340;
const MARGIN = { top: 30, right: 92, bottom: 52, left: 52 };

export function HourlyLines({
  hours,
  peak,
  label,
}: {
  hours: HourRow[];
  peak: HourlyGap;
  label: string;
}) {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = niceMax(
    Math.max(...hours.flatMap((row) => [row.weekdayAverage, row.weekendAverage])),
  );

  const x = scaleLinear().domain([0, 24]).range([MARGIN.left, WIDTH - MARGIN.right]);
  const y = scaleLinear().domain([0, max]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  // Plotted at the midpoint of each hour band, which is where the value applies.
  const centre = (hour: number) => x(hour + 0.5);

  const path = (key: "weekdayAverage" | "weekendAverage") =>
    d3Line<HourRow>()
      .x((row) => centre(row.hour))
      .y((row) => y(row[key]))
      .curve(curveMonotoneX)(hours) ?? "";

  const last = hours[hours.length - 1];

  return (
    <>
      <svg
        className="chart-svg"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          peak.kind === "gap"
            ? `${label}. The weekend-weekday gap is widest at ${hourLabel(peak.hour)}, where weekend days average ${formatNumber(peak.weekendAverage, 1)} complaints against ${formatNumber(peak.weekdayAverage, 1)} on weekdays.`
            : `${label}. No hour shows a positive weekend-weekday gap.`
        }
      >
        {/* Late night: 22:00 to the end of the axis, and 00:00 to 04:00. */}
        <rect
          className="night-band"
          x={x(NIGHT_START_HOUR)}
          y={MARGIN.top}
          width={x(24) - x(NIGHT_START_HOUR)}
          height={plotHeight}
        />
        <rect
          className="night-band"
          x={x(0)}
          y={MARGIN.top}
          width={x(NIGHT_END_HOUR) - x(0)}
          height={plotHeight}
        />
        <text className="tick tick-faint" x={x(2)} y={MARGIN.top - 10} textAnchor="middle">
          late night
        </text>

        {y.ticks(3).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={MARGIN.left} y1={y(tick)} x2={WIDTH - MARGIN.right} y2={y(tick)} />
            <text className="tick" x={MARGIN.left - 10} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <line className="axis" x1={MARGIN.left} y1={y(0)} x2={WIDTH - MARGIN.right} y2={y(0)} />

        {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
          <text key={hour} className="tick" x={x(hour)} y={y(0) + 22} textAnchor="middle">
            {hour === 24 ? "24" : hour}
          </text>
        ))}
        <text
          className="tick tick-faint"
          x={MARGIN.left + plotWidth / 2}
          y={HEIGHT - 12}
          textAnchor="middle"
        >
          hour of day
        </text>

        <path className="line-muted" d={path("weekdayAverage")} />
        <path className="line-accent" d={path("weekendAverage")} />

        {/* Direct end labels rather than a legend box: identity rides the mark. */}
        <g>
          <circle
            className="marker-accent"
            cx={centre(last.hour)}
            cy={y(last.weekendAverage)}
            r={CHART.markerRadius}
          />
          <text className="series-label" x={centre(last.hour) + 12} y={y(last.weekendAverage) + 4}>
            weekend
          </text>
          <circle
            className="marker-muted"
            cx={centre(last.hour)}
            cy={y(last.weekdayAverage)}
            r={CHART.markerRadius}
          />
          <text className="series-label" x={centre(last.hour) + 12} y={y(last.weekdayAverage) + 4}>
            weekday
          </text>
        </g>

        {peak.kind === "gap" &&
          (() => {
            // The peak often sits at midnight, hard against the y axis. Anchor the
            // annotation away from whichever edge it is near so it never overlaps
            // the axis or runs outside the plot.
            const px = centre(peak.hour);
            const nearLeft = px - MARGIN.left < 70;
            const nearRight = WIDTH - MARGIN.right - px < 70;
            const anchor = nearLeft ? "start" : nearRight ? "end" : "middle";
            const offset = nearLeft ? 8 : nearRight ? -8 : 0;

            return (
              <g>
                <line
                  className="gap-rule"
                  x1={px}
                  y1={y(peak.weekdayAverage)}
                  x2={px}
                  y2={y(peak.weekendAverage)}
                />
                <text
                  className="value-label"
                  x={px + offset}
                  y={y(peak.weekendAverage) - 14}
                  textAnchor={anchor}
                >
                  +{formatNumber(peak.gap, 1)} at {hourLabel(peak.hour)}
                </text>
              </g>
            );
          })()}
      </svg>

      <ChartTable
        summary={`${label}: average complaints per day by hour`}
        columns={["Hour", "Weekday average", "Weekend average"]}
        rows={hours.map((row) => [
          hourLabel(row.hour),
          formatNumber(row.weekdayAverage, 1),
          formatNumber(row.weekendAverage, 1),
        ])}
      />
    </>
  );
}
