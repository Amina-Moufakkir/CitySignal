/**
 * Five boroughs, each indexed to its own weekday baseline.
 *
 * The form is a dumbbell because the quantity is a pair with a direction: where
 * a borough's weekday reporting sits, where its weekend reporting sits, and the
 * distance between them. The distance is the subject, so it gets the connector.
 *
 * Emphasis, not category. Weekend is the series the section is about and carries
 * the accent; weekday is context and carries the de-emphasis grey. Boroughs are
 * *not* coloured individually - five hues would say the boroughs are the subject
 * and invite reading the chart as a league table, which is exactly the reading
 * this data does not support.
 *
 * Order is alphabetical and fixed, never sorted by result. Sorting by outcome
 * would rank the boroughs, and a ranking of within-borough ratios is not a
 * ranking of anything a reader would mean by it.
 *
 * **One centre per row.** Every mark and every word in a row is positioned from
 * `rowCentre(index)` and nothing else. An earlier version set the label at
 * `rowTop + 16` and the marks at `rowTop + 42`, which left each label almost
 * exactly halfway between its own row and the one above - close enough that a
 * reader could reasonably attach "Brooklyn" to the Bronx's connector. Separate
 * offsets are what allowed that, so there are no separate offsets now: change the
 * row height or the type size and the row still moves as one piece.
 *
 * The labels live in the gap between the axis origin and the baseline. Nothing
 * can be drawn below an index of 100 except a borough that fell, so that space is
 * free, and using it means the chart needs no reserved gutter and loses no width
 * to one.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber, formatSignedPercentage } from "@/lib/format";
import { WEEKDAY_INDEX, type BoroughRow } from "@/lib/citywide";
import { ChartTable, CHART, chartStyle, niceMax } from "./ChartFrame";

const WIDTH = 860;
const ROW_HEIGHT = 64;
/** Room to the right of the furthest mark for the difference that labels it. */
const VALUE_GUTTER = 108;
const MARGIN = { top: 68, right: 16, bottom: 72, left: 16 };
/** Gap between a row label and the baseline mark it belongs to. */
const LABEL_GAP = 12;
/** Vertical centring for text on a baseline, in `em` so it tracks the type. */
const CENTRE_TEXT = "0.32em";

export function BoroughDumbbell({ rows, label }: { rows: BoroughRow[]; label: string }) {
  const height = MARGIN.top + MARGIN.bottom + rows.length * ROW_HEIGHT;

  const highestIndex = rows.reduce(
    (max, row) => (row.index.kind === "computed" ? Math.max(max, row.index.weekendIndex) : max),
    WEEKDAY_INDEX,
  );

  /*
   * The domain starts at zero, and that is a decision rather than a default.
   *
   * The index is a ratio with a real zero, and connector length is this chart's
   * loudest signal. Starting the axis just below 100 would stretch every
   * connector by the same factor - comparison *between* boroughs would survive
   * intact, since they all share the 100 anchor - but it would roughly double the
   * apparent size of every rise, which is exactly the exaggeration a truncated
   * ratio axis is criticised for. The reader's takeaway from a dumbbell is how
   * long the bar is, so that impression has to stay honest. The space below 100
   * is not wasted either: it is where the row labels sit.
   */
  const max = niceMax(highestIndex);
  const x = scaleLinear()
    .domain([0, max])
    .range([MARGIN.left, WIDTH - MARGIN.right - VALUE_GUTTER]);

  const baseX = x(WEEKDAY_INDEX);
  const plotTop = MARGIN.top - 10;
  const plotBottom = height - MARGIN.bottom;
  const rowCentre = (index: number) => MARGIN.top + index * ROW_HEIGHT + ROW_HEIGHT / 2;
  const computed = rows.filter((row) => row.index.kind === "computed").length;

  return (
    <>
      <svg
        className="chart-svg"
        style={chartStyle(WIDTH)}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`${label}. Each borough's weekday reporting is set to an index of 100 and its weekend reporting plotted against that same baseline, so the boroughs are compared with themselves and not with each other. ${computed} of ${rows.length} boroughs have a comparison in this period.`}
      >
        {x.ticks(4).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={x(tick)} y1={plotTop} x2={x(tick)} y2={plotBottom} />
            <text className="tick" x={x(tick)} y={plotBottom} dy="1.2em" textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {/* The baseline every row shares. Solid, like every other rule here. */}
        <line className="axis" x1={baseX} y1={plotTop} x2={baseX} y2={plotBottom} />

        {/* Two marks with different meanings, so both are named on the chart. */}
        <g>
          <circle className="marker-muted" cx={MARGIN.left + 5} cy={MARGIN.top - 32} r={4} />
          <text className="series-label" x={MARGIN.left + 16} y={MARGIN.top - 28}>
            weekday, indexed to {WEEKDAY_INDEX}
          </text>
          <circle
            className="marker-accent"
            cx={WIDTH - MARGIN.right - 5}
            cy={MARGIN.top - 32}
            r={4}
          />
          <text
            className="series-label"
            x={WIDTH - MARGIN.right - 16}
            y={MARGIN.top - 28}
            textAnchor="end"
          >
            weekend
          </text>
        </g>

        {rows.map((row, index) => {
          const centre = rowCentre(index);

          if (row.index.kind !== "computed") {
            return (
              <g key={row.borough}>
                <text
                  className="tick row-label"
                  x={baseX - LABEL_GAP}
                  y={centre}
                  dy={CENTRE_TEXT}
                  textAnchor="end"
                >
                  {row.label}
                </text>
                <text className="tick" x={baseX + LABEL_GAP} y={centre} dy={CENTRE_TEXT}>
                  {row.index.kind === "no-baseline"
                    ? "No weekday reports in this period, so no index can be formed"
                    : "No data returned for this period"}
                </text>
              </g>
            );
          }

          const { weekendIndex, percentageDifference, direction } = row.index;
          const weekendX = x(weekendIndex);
          const rightward = weekendX >= baseX;

          return (
            <g key={row.borough}>
              <text
                className="tick row-label"
                x={baseX - LABEL_GAP}
                y={centre}
                dy={CENTRE_TEXT}
                textAnchor="end"
              >
                {row.label}
              </text>

              {/* The connector is the weekend's distance from the baseline, so it
                  belongs to the weekend series and carries its accent on every
                  row. A short connector is short because the difference is
                  small, not because that borough matters less. */}
              <line className="dumbbell-accent" x1={baseX} y1={centre} x2={weekendX} y2={centre} />
              <circle className="marker-muted" cx={baseX} cy={centre} r={CHART.markerRadius} />
              <circle className="marker-accent" cx={weekendX} cy={centre} r={CHART.markerRadius} />

              <text
                className="value-label"
                x={weekendX + (rightward ? LABEL_GAP : -LABEL_GAP)}
                y={centre}
                dy={CENTRE_TEXT}
                textAnchor={rightward ? "start" : "end"}
              >
                {direction === "level"
                  ? "no difference"
                  : formatSignedPercentage(percentageDifference)}
              </text>
            </g>
          );
        })}
      </svg>

      <ChartTable
        summary={`${label}: weekday and weekend residential noise reporting for each borough, with each borough indexed to its own weekday average.`}
        columns={[
          "Borough",
          "Weekday average per day",
          "Weekend average per day",
          "Difference",
          "Weekend index (weekday = 100)",
          "Complaints in period",
          "Weekdays / weekend days",
        ]}
        rows={rows.map((row) => [
          row.label,
          row.comparison.kind === "computed" ? formatNumber(row.comparison.weekdayAverage, 1) : "—",
          row.comparison.kind === "computed"
            ? formatNumber(row.comparison.weekendAverage, 1)
            : row.comparison.kind === "zero-baseline"
              ? formatNumber(row.comparison.weekendAverage, 1)
              : "—",
          row.index.kind === "computed"
            ? formatSignedPercentage(row.index.percentageDifference)
            : row.index.kind === "no-baseline"
              ? "No weekday baseline"
              : "No data",
          row.index.kind === "computed" ? formatNumber(row.index.weekendIndex, 1) : "—",
          formatNumber(row.totalComplaints),
          `${formatNumber(row.weekdayDays)} / ${formatNumber(row.weekendDays)}`,
        ])}
      />
    </>
  );
}
