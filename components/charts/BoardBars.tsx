/**
 * Normalized complaint rates across Brooklyn community boards.
 *
 * Eighteen nominal categories, so the bars are NOT coloured by their value -
 * bar length already encodes magnitude, and a value ramp would spend the
 * identity channel re-encoding it. Emphasis instead: the board the section is
 * about carries the accent, the rest are context.
 *
 * Values are labelled selectively. All eighteen are in the table twin.
 *
 * Two geometries, one chart
 * -------------------------
 * The boards are named - `BK04 · Bushwick` rather than `BK04` - and a name does
 * not fit the same row a four-character code did. Above about 320px of chart the
 * concise label sits on one line with the value at the end of it. Below that it
 * cannot, at any type size worth reading: at a 320px viewport this chart is
 * drawn 216px wide, and squeezing `BK15 · Sheepshead Bay-Gravesend (East)` onto
 * one line there took the label to 9.9px. So the narrow form breaks the label
 * over two lines - code, then name - and gives each row the height to hold it.
 *
 * That is a different viewBox, not a different stylesheet: rows are taller, the
 * drawing is narrower, and the unit caption runs to two lines. A viewBox is an
 * attribute and cannot be switched by a media query, so both are rendered and a
 * container query shows one. The switch is on the chart's own rendered width
 * rather than the viewport's, because this chart is much narrower than the page
 * that holds it and the viewport does not know that.
 */

import { scaleLinear } from "d3-scale";

import { formatNumber } from "@/lib/format";
import { boardDisplayName, boardFullName, boardLabel } from "@/lib/board-labels";
import type { BoardRate } from "@/lib/analysis";
import { ChartTable, niceMax, roundedBarPath, CHART, chartStyle } from "./ChartFrame";

/** How many boards carry a printed value. The rest are in the table twin. */
const LABELLED = 3;

type Layout = {
  className: string;
  width: number;
  rowHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Baseline of the first label line, from the top of its row. */
  labelBaseline: number;
  /** Top of the bar, from the top of its row. */
  barTop: number;
  barThickness: number;
  /** Whether the code and the name are on separate lines. */
  stacked: boolean;
  /** The unit caption, one entry per line. */
  caption: string[];
};

/*
 * The wide form. The row pitch is set by the label, not the bar: a label's
 * ascender reaches about 26 units above its baseline at the largest type this
 * chart is drawn with, and the bar above ends 48 units into its row, so anything
 * under about 64 puts each label on top of that bar.
 *
 * `bottom` holds two stacked lines - the axis numbers and the unit caption under
 * them - at the largest type this form is drawn with.
 */
const WIDE: Layout = {
  className: "board-bars-wide",
  width: 860,
  rowHeight: 68,
  margin: { top: 16, right: 62, bottom: 104, left: 16 },
  labelBaseline: 16,
  barTop: 24,
  barThickness: 24,
  stacked: false,
  caption: ["complaints per 1,000 occupied households"],
};

/*
 * The narrow form. A 380-unit viewBox rather than 860, so the drawing is not
 * shrunk to a quarter and the type does not have to be inflated to survive it.
 *
 * The second label line is placed with `dy` in `em`, so it follows the type
 * rather than being a gap tuned for one size. `barTop` clears it at the largest
 * em this form is drawn with (about 20 units): second baseline at 43, descenders
 * to 48, bar at 54.
 */
const COMPACT: Layout = {
  className: "board-bars-compact",
  width: 380,
  rowHeight: 78,
  margin: { top: 12, right: 12, bottom: 96, left: 12 },
  labelBaseline: 18,
  barTop: 54,
  barThickness: 14,
  stacked: true,
  caption: ["complaints per 1,000", "occupied households"],
};

function BoardChart({
  boards,
  highlight,
  layout,
}: {
  boards: BoardRate[];
  highlight: string;
  layout: Layout;
}) {
  const { width: WIDTH, rowHeight, margin, stacked } = layout;
  const height = margin.top + margin.bottom + boards.length * rowHeight;
  const max = niceMax(boards[0].complaintsPer1000Households);
  const x = scaleLinear().domain([0, max]).range([margin.left, WIDTH - margin.right]);
  const barHeight = Math.min(CHART.maxBarThickness, layout.barThickness);
  const top = boards[0];
  const bottom = boards[boards.length - 1];

  return (
    <svg
      className={`chart-svg ${layout.className}`}
      style={chartStyle(WIDTH)}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`Saturday-night Loud Music/Party complaints per 1,000 occupied households across 18 Brooklyn community boards. ${boardFullName(top.board)} is highest at ${formatNumber(top.complaintsPer1000Households, 1)}; the lowest is ${boardFullName(bottom.board)} at ${formatNumber(bottom.complaintsPer1000Households, 1)}. A Community District Tabulation Area approximates a community district and is not an exact neighbourhood boundary.`}
    >
      {x.ticks(4).map((tick) => (
        <g key={tick}>
          <line className="grid" x1={x(tick)} y1={margin.top} x2={x(tick)} y2={height - margin.bottom} />
          <text className="tick" x={x(tick)} y={height - margin.bottom + 22} textAnchor="middle">
            {formatNumber(tick)}
          </text>
        </g>
      ))}

      <line
        className="axis"
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={height - margin.bottom}
      />

      {boards.map((board, index) => {
        const rowTop = margin.top + index * rowHeight;
        const isHighlight = board.board === highlight;
        const width = x(board.complaintsPer1000Households) - margin.left;
        const label = boardLabel(board.board);
        const rowClass = isHighlight
          ? "tick row-label board-row-label row-label-strong"
          : "tick row-label board-row-label";

        return (
          <g key={board.board}>
            {/*
              The code leads either way. It is the stable analytical identifier -
              every figure in METHOD.md is keyed to it - and the name is what
              makes it recognisable, so the name is never on its own.
            */}
            <text className={rowClass} x={margin.left} y={rowTop + layout.labelBaseline}>
              {stacked && label ? (
                <>
                  <tspan x={margin.left}>{label.board}</tspan>
                  <tspan x={margin.left} dy="1.25em">
                    {label.name}
                  </tspan>
                </>
              ) : (
                boardDisplayName(board.board)
              )}
            </text>
            <path
              className={isHighlight ? "mark-accent" : "mark-muted"}
              d={roundedBarPath(margin.left, rowTop + layout.barTop, width, barHeight, CHART.barRadius, "right")}
            />
            {/* The value shares the label's first line, right-aligned, so it
                cannot meet the next row's label however tall the type gets. In
                the narrow form that line holds only the four-character code, so
                there is room for it there too. */}
            {(isHighlight || index < LABELLED) && (
              <text
                className={isHighlight ? "value-label" : "value-label value-label-muted"}
                x={WIDTH - margin.right}
                y={rowTop + layout.labelBaseline}
                textAnchor="end"
              >
                {formatNumber(board.complaintsPer1000Households, 1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Anchored to the tick row and stepped down in `em`, so the gap grows
          with the type instead of being a spacing tuned for one size. The
          measure is written out in full: "occupied households" is the ACS
          denominator this chart divides by, and dropping "occupied" names a
          different quantity. It breaks across two lines in the narrow form
          rather than being abbreviated into a different one. */}
      <text
        className="tick tick-faint"
        x={margin.left + (WIDTH - margin.right - margin.left) / 2}
        y={height - margin.bottom + 22}
        textAnchor="middle"
      >
        {/* The step down from the tick row is carried by the first line, not by
            the `<text>`: a `dy` on the element is overridden the moment its
            content is tspans, which dropped the caption onto the axis numbers. */}
        {layout.caption.map((line, index) => (
          <tspan
            key={line}
            x={margin.left + (WIDTH - margin.right - margin.left) / 2}
            dy={index === 0 ? "1.6em" : "1.15em"}
          >
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}

export function BoardBars({ boards, highlight }: { boards: BoardRate[]; highlight: string }) {
  return (
    <>
      <div className="board-bars">
        <BoardChart boards={boards} highlight={highlight} layout={WIDE} />
        <BoardChart boards={boards} highlight={highlight} layout={COMPACT} />
      </div>

      <ChartTable
        summary="Saturday-night Loud Music/Party complaints per 1,000 occupied households, by Brooklyn community board. Board names are NYC Department of City Planning Community District Tabulation Area names; a CDTA approximates a community district and is not an exact neighbourhood boundary."
        columns={[
          "Board",
          "Community District Tabulation Area (official name)",
          "Complaints per 1,000 occupied households",
          "Complaints",
          "Occupied households",
        ]}
        rows={boards.map((board) => [
          boardDisplayName(board.board),
          boardFullName(board.board),
          formatNumber(board.complaintsPer1000Households, 1),
          formatNumber(board.saturdayNightComplaints),
          formatNumber(board.occupiedHouseholds),
        ])}
      />
    </>
  );
}
