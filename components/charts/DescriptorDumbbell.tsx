/**
 * Baseline night to peak night, per descriptor.
 *
 * Before-and-after per item is a dumbbell: one hue in two weights, the travel
 * between them carrying the change. It shows at a glance that one descriptor
 * moves and the others barely do, which is the section's whole claim.
 *
 * Rates, not raw totals - the baseline is four nights a week against the peak's
 * one, so totals would be meaningless here.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import type { DescriptorNightSummary, WeekdayLabel } from "@/lib/analysis";
import { ChartTable, niceMax, CHART, chartStyle } from "./ChartFrame";

const WIDTH = 860;
const ROW_HEIGHT = 54;
const MARGIN = { top: 30, right: 64, bottom: 56, left: 132 };

type Row = { descriptor: string; baseline: number; peak: number };

function perNight(total: number | undefined, nights: number): number {
  return nights === 0 ? 0 : (total ?? 0) / nights;
}

export function DescriptorDumbbell({
  summary,
  peakWeekday,
  baselineWeekdays,
  highlight,
}: {
  summary: DescriptorNightSummary;
  peakWeekday: WeekdayLabel;
  baselineWeekdays: readonly WeekdayLabel[];
  highlight: string;
}) {
  const peakRow = summary.weekdays.find((row) => row.weekday === peakWeekday);
  const baselineRows = summary.weekdays.filter((row) => baselineWeekdays.includes(row.weekday));

  if (!peakRow || baselineRows.length === 0) {
    return null;
  }

  const rows: Row[] = summary.descriptors
    .map((descriptor) => ({
      descriptor,
      peak: perNight(peakRow.byDescriptor[descriptor], peakRow.nightsCounted),
      baseline:
        baselineRows.reduce(
          (sum, row) => sum + perNight(row.byDescriptor[descriptor], row.nightsCounted),
          0,
        ) / baselineRows.length,
    }))
    .filter((row) => row.peak > 0.05 || row.baseline > 0.05)
    .sort((a, b) => b.peak - a.peak);

  const height = MARGIN.top + MARGIN.bottom + rows.length * ROW_HEIGHT;
  const max = niceMax(Math.max(...rows.map((row) => Math.max(row.peak, row.baseline))));
  const x = scaleLinear().domain([0, max]).range([MARGIN.left, WIDTH - MARGIN.right]);

  return (
    <>
      <svg
        className="chart-svg"
        style={chartStyle(WIDTH)}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Complaints per night by descriptor, ${baselineWeekdays[0]} to ${baselineWeekdays[baselineWeekdays.length - 1]} baseline compared with ${peakWeekday}.`}
      >
        {x.ticks(3).map((tick) => (
          <g key={tick}>
            <line className="grid" x1={x(tick)} y1={MARGIN.top} x2={x(tick)} y2={height - MARGIN.bottom} />
            <text className="tick" x={x(tick)} y={height - MARGIN.bottom + 22} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {rows.map((row, index) => {
          const y = MARGIN.top + index * ROW_HEIGHT + ROW_HEIGHT / 2;
          const isHighlight = row.descriptor === highlight;

          return (
            <g key={row.descriptor}>
              <text className="tick row-label" x={MARGIN.left - 12} y={y + 4} textAnchor="end">
                {row.descriptor}
              </text>
              <line
                className={isHighlight ? "dumbbell-accent" : "dumbbell-muted"}
                x1={x(row.baseline)}
                y1={y}
                x2={x(row.peak)}
                y2={y}
              />
              <circle className="marker-muted" cx={x(row.baseline)} cy={y} r={CHART.markerRadius} />
              <circle
                className={isHighlight ? "marker-accent" : "marker-muted-solid"}
                cx={x(row.peak)}
                cy={y}
                r={CHART.markerRadius}
              />
              {isHighlight && (
                <text className="value-label" x={x(row.peak) + 12} y={y + 4}>
                  {formatNumber(row.peak, 1)}
                </text>
              )}
            </g>
          );
        })}

        {/*
          Two marks with different meanings, so both are named on the chart.

          Anchored to the two ends of the plot rather than set 128 units apart:
          that spacing was tuned to one text size, and chart text scales up on
          narrow screens so the first label grew straight through the second
          mark. At the edges they cannot meet at any size.
        */}
        <g>
          <circle className="marker-muted" cx={MARGIN.left + 4} cy={MARGIN.top - 14} r={4} />
          <text className="series-label" x={MARGIN.left + 14} y={MARGIN.top - 10}>
            baseline night
          </text>
          <circle className="marker-accent" cx={WIDTH - MARGIN.right - 4} cy={MARGIN.top - 14} r={4} />
          <text
            className="series-label"
            x={WIDTH - MARGIN.right - 14}
            y={MARGIN.top - 10}
            textAnchor="end"
          >
            {peakWeekday} night
          </text>
        </g>

        <text
          className="tick tick-faint"
          x={MARGIN.left + (WIDTH - MARGIN.right - MARGIN.left) / 2}
          y={height - 8}
          textAnchor="middle"
        >
          complaints per night
        </text>
      </svg>

      <ChartTable
        summary={`Complaints per night by descriptor: baseline nights compared with ${peakWeekday} nights`}
        columns={["Descriptor", "Baseline per night", `${peakWeekday} per night`, "Change"]}
        rows={rows.map((row) => [
          row.descriptor,
          formatNumber(row.baseline, 1),
          formatNumber(row.peak, 1),
          `${row.peak >= row.baseline ? "+" : ""}${formatNumber(row.peak - row.baseline, 1)}`,
        ])}
      />
    </>
  );
}
