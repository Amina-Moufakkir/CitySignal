/**
 * Complaints per night by night of the week.
 *
 * Emphasis form: the peak night carries the accent, the other six are context.
 * Which night that is comes from `peakNight`, never from an assumption - if the
 * data moved, the highlight moves with it.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import type { NightSummary, PeakNight } from "@/lib/analysis";
import { ChartTable, niceMax, roundedBarPath, CHART, chartStyle } from "./ChartFrame";

const WIDTH = 860;
const ROW_HEIGHT = 46;
const MARGIN = { top: 12, right: 70, bottom: 52, left: 92 };

export function NightBars({ summary, peak }: { summary: NightSummary; peak: PeakNight }) {
  const rows = summary.nights;
  const height = MARGIN.top + MARGIN.bottom + rows.length * ROW_HEIGHT;
  const max = niceMax(Math.max(...rows.map((row) => row.average)));
  const x = scaleLinear().domain([0, max]).range([MARGIN.left, WIDTH - MARGIN.right]);
  const peakWeekday = peak.kind === "peak" ? peak.night.weekday : null;
  const barHeight = CHART.maxBarThickness - CHART.surfaceGap;

  return (
    <>
      <svg
        className="chart-svg"
        style={chartStyle(WIDTH)}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={
          peak.kind === "peak"
            ? `Complaints per night by night of week. ${peak.night.weekday} is highest at ${formatNumber(peak.night.average, 1)} per night.`
            : "Complaints per night by night of week. No night stands out."
        }
      >
        {x.ticks(3).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={x(tick)} y1={MARGIN.top} x2={x(tick)} y2={height - MARGIN.bottom} />
            <text className="tick" x={x(tick)} y={height - MARGIN.bottom + 22} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <line
          className="axis"
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={height - MARGIN.bottom}
        />

        {rows.map((row, index) => {
          const y = MARGIN.top + index * ROW_HEIGHT + (ROW_HEIGHT - barHeight) / 2;
          const isPeak = row.weekday === peakWeekday;
          const width = x(row.average) - MARGIN.left;

          return (
            <g key={row.weekday}>
              <text className="tick row-label" x={MARGIN.left - 12} y={y + barHeight / 2 + 4} textAnchor="end">
                {row.weekday}
              </text>
              <path
                className={isPeak ? "mark-accent" : "mark-muted"}
                d={roundedBarPath(MARGIN.left, y, width, barHeight, CHART.barRadius, "right")}
              />
              <text
                className={isPeak ? "value-label" : "value-label value-label-muted"}
                x={MARGIN.left + width + 10}
                y={y + barHeight / 2 + 4}
              >
                {formatNumber(row.average, 1)}
              </text>
            </g>
          );
        })}

        <text
          className="tick tick-faint"
          x={MARGIN.left + (WIDTH - MARGIN.right - MARGIN.left) / 2}
          y={height - 8}
          textAnchor="middle"
        >
          complaints per night, 10 PM to 3:59 AM
        </text>
      </svg>

      <ChartTable
        summary="Complaints per night by night of the week"
        columns={["Night", "Complaints per night", "Total", "Nights counted"]}
        rows={rows.map((row) => [
          row.weekday,
          formatNumber(row.average, 1),
          formatNumber(row.total),
          formatNumber(row.nightsCounted),
        ])}
      />
    </>
  );
}
