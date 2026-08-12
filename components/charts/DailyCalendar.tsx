/**
 * Every day of the range, one bar each, in calendar order.
 *
 * This is the corpus before it is filtered: 364 bars, no averaging, so the
 * reader sees the material the rest of the piece argues about. Colouring by day
 * type turns the same chart into the argument - the weekend gap becomes a visible
 * stripe rather than a computed statistic.
 *
 * Two deliberate departures from the mark spec, both forced by density:
 *
 *   - Bars are about 2px with a sub-pixel gap. The 2px surface gap between
 *     adjacent bars is for a handful of readable bars; at 364 marks it would
 *     consume the chart. This reads as a comb, and precision lives in the
 *     summary table.
 *   - Values are not labelled per bar. Only the anchors carry numbers, which is
 *     the "label selectively" rule doing its job at the scale it was written for.
 *
 * The text equivalent is a summary rather than 364 rows: a table nobody can read
 * is not an equivalent.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import type { Anchor, DailySeries } from "@/lib/series";
import { weekdayName } from "@/lib/series";
import { ChartTable, niceMax } from "./ChartFrame";

const WIDTH = 1180;
const HEIGHT = 520;
const MARGIN = { top: 132, right: 24, bottom: 52, left: 60 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DailyCalendar({
  series,
  anchors,
  colorByDayType = false,
  label,
}: {
  series: DailySeries;
  anchors: Anchor[];
  /** Off: the corpus. On: the same bars, split by day type. */
  colorByDayType?: boolean;
  label: string;
}) {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / series.days.length;
  const barWidth = Math.max(1, band * 0.78);
  const max = niceMax(series.max.complaints);

  const y = scaleLinear().domain([0, max]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const xFor = (index: number) => MARGIN.left + index * band;

  const indexOf = new Map(series.days.map((point, index) => [point.day, index]));

  // Month boundaries, so the year is readable as a year.
  const monthStarts = series.days
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.day.endsWith("-01"));

  const description = colorByDayType
    ? `${label}. One bar per day, weekend days marked. Weekday days average ${formatNumber(series.weekdayMean, 1)} complaints, weekend days ${formatNumber(series.weekendMean, 1)}.`
    : `${label}. One bar per day across ${series.days.length} days. The lowest day is ${formatNumber(series.min.complaints)} complaints on ${series.min.day}, the highest ${formatNumber(series.max.complaints)} on ${series.max.day}, and the median day ${formatNumber(series.median, 1)}.`;

  return (
    <>
      <svg
        className="chart-svg chart-svg-full"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={description}
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={MARGIN.left} y1={y(tick)} x2={WIDTH - MARGIN.right} y2={y(tick)} />
            <text className="tick" x={MARGIN.left - 10} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <line className="axis" x1={MARGIN.left} y1={y(0)} x2={WIDTH - MARGIN.right} y2={y(0)} />

        {series.days.map((point, index) => {
          const height = Math.max(point.complaints === 0 ? 0 : 0.75, y(0) - y(point.complaints));

          return (
            <rect
              key={point.day}
              className={colorByDayType && point.weekend ? "day-bar day-bar-accent" : "day-bar"}
              x={xFor(index)}
              y={y(0) - height}
              width={barWidth}
              height={height}
            />
          );
        })}

        {monthStarts.map(({ point, index }) => (
          <text
            key={point.day}
            className="tick tick-faint"
            x={xFor(index)}
            y={y(0) + 20}
            textAnchor="start"
          >
            {MONTHS[Number(point.day.slice(5, 7)) - 1]}
          </text>
        ))}

        {/* Anchors: a leader from the bar up to a label, staggered so the
            callouts cannot overlap each other. */}
        {anchors.map((anchor, order) => {
          const index = indexOf.get(anchor.day);

          if (index === undefined) {
            return null;
          }

          const x = xFor(index) + barWidth / 2;
          const barTop = y(anchor.complaints);
          const labelY = 20 + (order % 3) * 34;
          const anchorEnd = Math.min(WIDTH - MARGIN.right, Math.max(MARGIN.left, x));
          const textAnchor = x > WIDTH - 220 ? "end" : "start";
          const textX = textAnchor === "end" ? anchorEnd - 8 : anchorEnd + 8;

          return (
            <g key={anchor.day}>
              <line className="anchor-leader" x1={x} y1={barTop - 4} x2={x} y2={labelY + 6} />
              <circle className="anchor-dot" cx={x} cy={barTop - 4} r={2.5} />
              <text className="anchor-label" x={textX} y={labelY} textAnchor={textAnchor}>
                {anchor.label}
              </text>
              <text className="anchor-value" x={textX} y={labelY + 15} textAnchor={textAnchor}>
                {formatNumber(anchor.complaints)} complaints
              </text>
            </g>
          );
        })}

        {colorByDayType && (
          <g>
            <rect className="day-bar day-bar-accent" x={MARGIN.left} y={MARGIN.top - 26} width={9} height={9} />
            <text className="series-label" x={MARGIN.left + 16} y={MARGIN.top - 18}>
              weekend
            </text>
            <rect className="day-bar" x={MARGIN.left + 92} y={MARGIN.top - 26} width={9} height={9} />
            <text className="series-label" x={MARGIN.left + 108} y={MARGIN.top - 18}>
              weekday
            </text>
          </g>
        )}
      </svg>

      <ChartTable
        summary={`${label}: summary of ${series.days.length} daily complaint counts. Individual days are described in the surrounding text; the full daily figures are available from the query in METHOD.md.`}
        columns={["Measure", "Value", "Day"]}
        rows={[
          ["Days covered", formatNumber(series.days.length), series.range.display],
          ["Total complaints", formatNumber(series.total), "—"],
          [
            "Busiest day",
            formatNumber(series.max.complaints),
            `${series.max.day} (${weekdayName(series.max.day)})`,
          ],
          [
            "Quietest day",
            formatNumber(series.min.complaints),
            `${series.min.day} (${weekdayName(series.min.day)})`,
          ],
          [
            "Busiest weekday",
            formatNumber(series.maxWeekday.complaints),
            `${series.maxWeekday.day} (${weekdayName(series.maxWeekday.day)})`,
          ],
          [
            "Busiest weekend day",
            formatNumber(series.maxWeekend.complaints),
            `${series.maxWeekend.day} (${weekdayName(series.maxWeekend.day)})`,
          ],
          ["Median day", formatNumber(series.median, 1), "—"],
          ["Weekday mean", formatNumber(series.weekdayMean, 1), "260 weekdays"],
          ["Weekend mean", formatNumber(series.weekendMean, 1), "104 weekend days"],
          ...anchors.map((anchor) => [
            anchor.label,
            formatNumber(anchor.complaints),
            `${anchor.day} (${weekdayName(anchor.day)})`,
          ]),
        ]}
      />
    </>
  );
}
