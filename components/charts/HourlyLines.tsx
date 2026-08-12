/**
 * Complaints by hour of day, weekday against weekend.
 *
 * The axis runs 6 AM to 6 AM, not midnight to midnight. A midnight-anchored axis
 * cuts the night in half and puts a spike at each edge with the shaded window in
 * two pieces, which makes the chart argue against the point it is illustrating.
 * Rebasing to 6 AM - the genuine trough - gives one contiguous hump inside one
 * contiguous band, and sets up the next section's "a night does not stop at
 * midnight" before that sentence is written.
 *
 * It is still an INTERVAL scale, not a point scale: hour 22 occupies the band
 * from 22 to 23, so the shaded window has exact edges rather than approximate
 * ones.
 *
 * Two series, so identity gets three channels: the accent hue, a dash pattern on
 * the context line, and direct labels at both line ends.
 */

import { scaleLinear } from "d3-scale";
import { line as d3Line, curveMonotoneX } from "d3-shape";

import { formatNumber, hourLabel } from "@/lib/format";
import { NIGHT_END_HOUR, NIGHT_START_HOUR, type HourRow, type HourlyGap } from "@/lib/analysis";
import { ChartTable, niceMax, CHART, chartStyle } from "./ChartFrame";

const WIDTH = 860;
const HEIGHT = 400;
const MARGIN = { top: 44, right: 96, bottom: 56, left: 56 };

/** The hour the axis begins on. 6 AM is the quietest hour, so the day is cut
 *  where nothing is happening rather than through the middle of the story. */
export const DAY_START_HOUR = 6;

/** Position of a clock hour on the rebased axis, 0 to 23. */
function shift(hour: number): number {
  return (hour - DAY_START_HOUR + 24) % 24;
}

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
  const max = niceMax(Math.max(...hours.flatMap((row) => [row.weekdayAverage, row.weekendAverage])));

  const x = scaleLinear().domain([0, 24]).range([MARGIN.left, WIDTH - MARGIN.right]);
  const y = scaleLinear().domain([0, max]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  // Plotted at the midpoint of each hour's band, which is where its value applies.
  const centre = (hour: number) => x(shift(hour) + 0.5);

  // Drawn in axis order, not clock order, or the line would jump the wrap point.
  const ordered = [...hours].sort((a, b) => shift(a.hour) - shift(b.hour));
  const last = ordered[ordered.length - 1];

  const path = (key: "weekdayAverage" | "weekendAverage") =>
    d3Line<HourRow>()
      .x((row) => centre(row.hour))
      .y((row) => y(row[key]))
      .curve(curveMonotoneX)(ordered) ?? "";

  // 22:00 through 03:59 is contiguous on this axis: one band, not two.
  const nightStart = shift(NIGHT_START_HOUR);
  const nightEnd = shift(NIGHT_END_HOUR - 1) + 1;

  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <>
      <svg
        className="chart-svg"
        style={chartStyle(WIDTH)}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          peak.kind === "gap"
            ? `${label}. The axis runs from 6 AM to 6 AM so the night is unbroken. The weekend-weekday gap is widest at ${hourLabel(peak.hour)}, where weekend days average ${formatNumber(peak.weekendAverage, 1)} complaints against ${formatNumber(peak.weekdayAverage, 1)} on weekdays.`
            : `${label}. No hour shows a positive weekend-weekday gap.`
        }
      >
        <rect
          className="night-band"
          x={x(nightStart)}
          y={MARGIN.top}
          width={x(nightEnd) - x(nightStart)}
          height={plotHeight}
        />
        <text
          className="tick tick-faint"
          x={x((nightStart + nightEnd) / 2)}
          y={MARGIN.top - 12}
          textAnchor="middle"
        >
          10 PM – 4 AM
        </text>

        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={MARGIN.left} y1={y(tick)} x2={WIDTH - MARGIN.right} y2={y(tick)} />
            <text className="tick" x={MARGIN.left - 10} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <line className="axis" x1={MARGIN.left} y1={y(0)} x2={WIDTH - MARGIN.right} y2={y(0)} />

        {/*
          Every other hour label is marked droppable. The full set fits while the
          chart is near full size; on a phone the labels are scaled up to stay
          readable and there is no longer room for all of them, so the stylesheet
          hides the alternates rather than letting them run together. Dropping
          every second one keeps the axis evenly spaced and keeps both ends.
        */}
        {ticks.map((position, index) => (
          <text
            key={position}
            className={index % 2 === 1 && index < ticks.length - 1 ? "tick tick-alternate" : "tick"}
            x={x(position)}
            y={y(0) + 22}
            textAnchor="middle"
          >
            {hourLabel((position + DAY_START_HOUR) % 24)}
          </text>
        ))}

        <path className="line-muted" d={path("weekdayAverage")} />
        <path className="line-accent" d={path("weekendAverage")} />

        {/*
          Direct end labels rather than a legend box: identity rides the mark.

          The two series converge by the end of the day, so at the last hour the
          labels sit almost on top of each other and collide outright once chart
          text is scaled up on a narrow screen. Each is nudged clear of its own
          marker, in `em` so the nudge grows with the type rather than needing a
          value per breakpoint. Which one goes up is read off the marks - the
          higher series at the last hour takes the upper label - so nothing here
          assumes weekends run above weekdays.
        */}
        {(() => {
          const weekendY = y(last.weekendAverage);
          const weekdayY = y(last.weekdayAverage);
          const weekendOnTop = weekendY <= weekdayY;

          return (
            <g>
              <circle className="marker-accent" cx={centre(last.hour)} cy={weekendY} r={CHART.markerRadius} />
              <text
                className="series-label"
                x={centre(last.hour) + 12}
                y={weekendY}
                dy={weekendOnTop ? "-0.35em" : "1.15em"}
              >
                weekend
              </text>
              <circle className="marker-muted" cx={centre(last.hour)} cy={weekdayY} r={CHART.markerRadius} />
              <text
                className="series-label"
                x={centre(last.hour) + 12}
                y={weekdayY}
                dy={weekendOnTop ? "1.15em" : "-0.35em"}
              >
                weekday
              </text>
            </g>
          );
        })()}

        {peak.kind === "gap" &&
          (() => {
            const px = centre(peak.hour);
            const nearLeft = px - MARGIN.left < 80;
            const nearRight = WIDTH - MARGIN.right - px < 80;
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
        summary={`${label}: average complaints per day by hour, from ${hourLabel(DAY_START_HOUR)} to ${hourLabel(DAY_START_HOUR)}`}
        columns={["Hour", "Weekday average", "Weekend average"]}
        rows={ordered.map((row) => [
          hourLabel(row.hour),
          formatNumber(row.weekdayAverage, 1),
          formatNumber(row.weekendAverage, 1),
        ])}
      />
    </>
  );
}
