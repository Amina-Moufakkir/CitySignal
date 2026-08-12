/**
 * Fifty-two nights, six hours each.
 *
 * A heatmap is the right form for magnitude on a grid, and the colour job is
 * sequential: one hue, light to dark, not the categorical palette. The ramp is
 * validated for monotone lightness, adjacent lightness gap and single hue in both
 * themes. Its lightest step deliberately recedes toward the surface - for a
 * sequential scale the near-zero end is meant to, and a true zero is drawn as an
 * empty cell so "none" and "a few" stay distinguishable.
 *
 * Colour is applied by class rather than computed in JavaScript, so the scale
 * follows the theme. Every value is also in the table twin, because a continuous
 * colour encoding must never be the only way to read a number.
 */

import { formatNumber, hourLabel } from "@/lib/format";
import { NIGHT_HOURS, type NightGrid as Grid } from "@/lib/night-grid";
import { weekdayName } from "@/lib/series";
import { ChartTable } from "./ChartFrame";

const WIDTH = 780;
const ROW_HEIGHT = 12;
const CELL_GAP = 1.5;
const MARGIN = { top: 54, right: 108, bottom: 30, left: 96 };

/** Six buckets plus an empty state. More steps than this stop being separable. */
const LEVELS = 6;

function levelFor(value: number, max: number): number {
  if (value <= 0) {
    return 0;
  }

  return Math.min(LEVELS, Math.max(1, Math.ceil((value / max) * LEVELS)));
}

export function NightGrid({ grid, label }: { grid: Grid; label: string }) {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const cellWidth = plotWidth / NIGHT_HOURS.length;
  const height = MARGIN.top + MARGIN.bottom + grid.nights.length * ROW_HEIGHT;

  return (
    <>
      <svg
        className="chart-svg"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`${label}. ${grid.nights.length} ${grid.weekday} nights, each split into the six hours from ${hourLabel(NIGHT_HOURS[0])} to ${hourLabel(NIGHT_HOURS[NIGHT_HOURS.length - 1])}. The busiest was ${grid.busiest.anchor} with ${formatNumber(grid.busiest.total)} complaints, the quietest ${grid.quietest.anchor} with ${formatNumber(grid.quietest.total)}, and the median night ${formatNumber(grid.medianTotal, 0)}. ${formatNumber(grid.nightsAboveHalfPeak)} of ${formatNumber(grid.nights.length)} nights reached at least half the busiest night's total.`}
      >
        {NIGHT_HOURS.map((hour, column) => (
          <text
            key={hour}
            className="tick"
            x={MARGIN.left + column * cellWidth + cellWidth / 2}
            y={MARGIN.top - 12}
            textAnchor="middle"
          >
            {hourLabel(hour)}
          </text>
        ))}

        {grid.nights.map((night, row) => {
          const y = MARGIN.top + row * ROW_HEIGHT;
          const isBusiest = night.anchor === grid.busiest.anchor;

          return (
            <g key={night.anchor}>
              {/* Every fourth night is dated, so the column reads as a year. */}
              {(row % 4 === 0 || isBusiest) && (
                <text
                  className={isBusiest ? "tick heat-row-label heat-row-label-peak" : "tick heat-row-label"}
                  x={MARGIN.left - 10}
                  y={y + ROW_HEIGHT - 3}
                  textAnchor="end"
                >
                  {night.anchor.slice(5)}
                </text>
              )}

              {night.hours.map((value, column) => (
                <rect
                  key={column}
                  className={`heat heat-${levelFor(value, grid.max)}`}
                  x={MARGIN.left + column * cellWidth}
                  y={y}
                  width={cellWidth - CELL_GAP}
                  height={ROW_HEIGHT - CELL_GAP}
                />
              ))}

              <text
                className={isBusiest ? "tick heat-total heat-total-peak" : "tick heat-total"}
                x={WIDTH - MARGIN.right + 10}
                y={y + ROW_HEIGHT - 3}
              >
                {formatNumber(night.total)}
              </text>
            </g>
          );
        })}

        {/* Scale key: a continuous encoding needs one. */}
        <g>
          <text className="tick tick-faint" x={MARGIN.left} y={16}>
            fewer
          </text>
          {Array.from({ length: LEVELS }, (_unused, index) => (
            <rect
              key={index}
              className={`heat heat-${index + 1}`}
              x={MARGIN.left + 44 + index * 15}
              y={7}
              width={13}
              height={9}
            />
          ))}
          <text className="tick tick-faint" x={MARGIN.left + 44 + LEVELS * 15 + 6} y={16}>
            more complaints in that hour
          </text>
        </g>
      </svg>

      <ChartTable
        summary={`${label}: complaints per hour on each of the ${grid.nights.length} complete ${grid.weekday} nights`}
        columns={["Night", ...NIGHT_HOURS.map((hour) => hourLabel(hour)), "Total"]}
        rows={grid.nights.map((night) => [
          `${night.anchor} (${weekdayName(night.anchor)})`,
          ...night.hours.map((value) => formatNumber(value)),
          formatNumber(night.total),
        ])}
      />
    </>
  );
}
