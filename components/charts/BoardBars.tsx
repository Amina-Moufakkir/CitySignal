/**
 * Normalized complaint rates across Brooklyn community boards.
 *
 * Eighteen nominal categories, so the bars are NOT coloured by their value -
 * bar length already encodes magnitude, and a value ramp would spend the
 * identity channel re-encoding it. Emphasis instead: the board the section is
 * about carries the accent, the rest are context.
 *
 * Values are labelled selectively. All eighteen are in the table twin.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import type { BoardRate } from "@/lib/analysis";
import { ChartTable, niceMax, roundedBarPath, CHART } from "./ChartFrame";

const WIDTH = 640;
const ROW_HEIGHT = 26;
const MARGIN = { top: 12, right: 62, bottom: 58, left: 60 };
const LABELLED = 3;

export function BoardBars({ boards, highlight }: { boards: BoardRate[]; highlight: string }) {
  const height = MARGIN.top + MARGIN.bottom + boards.length * ROW_HEIGHT;
  const max = niceMax(boards[0].complaintsPer1000Households * 1.1);
  const x = scaleLinear().domain([0, max]).range([MARGIN.left, WIDTH - MARGIN.right]);
  const barHeight = Math.min(CHART.maxBarThickness, ROW_HEIGHT - CHART.surfaceGap * 3);
  const top = boards[0];

  return (
    <>
      <svg
        className="chart-svg"
        style={{ maxWidth: WIDTH }}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Saturday-night Loud Music/Party complaints per 1,000 occupied households across 18 Brooklyn community boards. ${top.board} is highest at ${formatNumber(top.complaintsPer1000Households, 1)}; the lowest is ${formatNumber(boards[boards.length - 1].complaintsPer1000Households, 1)}.`}
      >
        {x.ticks(4).map((tick) => (
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

        {boards.map((board, index) => {
          const y = MARGIN.top + index * ROW_HEIGHT + (ROW_HEIGHT - barHeight) / 2;
          const isHighlight = board.board === highlight;
          const width = x(board.complaintsPer1000Households) - MARGIN.left;

          return (
            <g key={board.board}>
              <text
                className={isHighlight ? "tick row-label row-label-strong" : "tick row-label"}
                x={MARGIN.left - 10}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
              >
                {board.board}
              </text>
              <path
                className={isHighlight ? "mark-accent" : "mark-muted"}
                d={roundedBarPath(MARGIN.left, y, width, barHeight, CHART.barRadius, "right")}
              />
              {(isHighlight || index < LABELLED) && (
                <text
                  className={isHighlight ? "value-label" : "value-label value-label-muted"}
                  x={MARGIN.left + width + 9}
                  y={y + barHeight / 2 + 4}
                >
                  {formatNumber(board.complaintsPer1000Households, 1)}
                </text>
              )}
            </g>
          );
        })}

        <text
          className="tick tick-faint"
          x={MARGIN.left + (WIDTH - MARGIN.right - MARGIN.left) / 2}
          y={height - 10}
          textAnchor="middle"
        >
          complaints per 1,000 occupied households
        </text>
      </svg>

      <ChartTable
        summary="Saturday-night Loud Music/Party complaints per 1,000 occupied households, by Brooklyn community board"
        columns={["Board", "Per 1,000 households", "Complaints", "Occupied households"]}
        rows={boards.map((board) => [
          board.board,
          formatNumber(board.complaintsPer1000Households, 1),
          formatNumber(board.saturdayNightComplaints),
          formatNumber(board.occupiedHouseholds),
        ])}
      />
    </>
  );
}
