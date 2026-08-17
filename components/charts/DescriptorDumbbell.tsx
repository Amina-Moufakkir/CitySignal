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
/*
 * The baseline end is a vertical tick and the Saturday end is a filled dot.
 *
 * Two circles could not do this job. Three of these four descriptors differ by
 * so little that the marks overlap - Loud Television by 0.1 complaints a night -
 * and any two circles, equal or unequal, read as one dot sitting inside another
 * rather than as two endpoints. A tick and a dot are different shapes, so the
 * pair stays legible however close the values are, and the tick is tall enough
 * that its ends still show above and below the dot when they coincide.
 *
 * Shape carries the identity here, not size: size would suggest magnitude.
 */
const TICK_HALF_HEIGHT = 11;

/**
 * Vertical centring for legend text on its mark, in `em` so it tracks the type.
 *
 * The legend used to sit its baseline four units under the mark's centre, which
 * is right at 12-unit type and wrong everywhere else: chart text is sized
 * against the chart's own width, so on a phone this type is nearly four times
 * that and the labels rode ten units high of their marks.
 */
const CENTRE_TEXT = "0.32em";

/**
 * Two legends, because one line cannot hold both entries at every width.
 *
 * The entries sit side by side - they are the two ends of one row, not two
 * unrelated keys - and at full size "baseline night" is 83 units against the 124
 * available before the second mark. But chart text grows as the chart shrinks,
 * and by 440px that label is 199 units and runs straight through the entry
 * beside it. Shrinking the type to fit is what the sizing rule exists to
 * prevent, and abbreviating either entry would leave the legend explaining
 * itself in shorthand.
 *
 * So below the width where they fit honestly the two entries stack, aligned on
 * one left edge, still adjacent and still reading as a pair. That is a taller
 * chart with a different top margin, and a viewBox is an attribute rather than
 * something a media query can reach, so both are rendered and a container query
 * shows one. The query is on the chart's own width because this chart is drawn
 * far narrower than the viewport that holds it.
 */
const LEGEND_STEP = 58;

type Geometry = {
  className: string;
  /** Distance from the top of the viewBox to the top of the plot. */
  marginTop: number;
  stacked: boolean;
};

/* Unchanged: the plot this ships at full size is the plot it always shipped. */
const INLINE: Geometry = { className: "descriptor-legend-inline", marginTop: 30, stacked: false };

/*
 * One legend line taller. `marginTop` clears the second entry's tick and the
 * descenders of its label at the largest type this form is ever drawn with.
 */
const STACKED: Geometry = {
  className: "descriptor-legend-stacked",
  marginTop: 30 + LEGEND_STEP + 8,
  stacked: true,
};

type Row = { descriptor: string; baseline: number; peak: number };

function perNight(total: number | undefined, nights: number): number {
  return nights === 0 ? 0 : (total ?? 0) / nights;
}

function Plot({
  rows,
  peakWeekday,
  baselineWeekdays,
  highlight,
  geometry,
}: {
  rows: Row[];
  peakWeekday: WeekdayLabel;
  baselineWeekdays: readonly WeekdayLabel[];
  highlight: string;
  geometry: Geometry;
}) {
  const marginTop = geometry.marginTop;
  const height = marginTop + MARGIN.bottom + rows.length * ROW_HEIGHT;
  const max = niceMax(Math.max(...rows.map((row) => Math.max(row.peak, row.baseline))));
  const x = scaleLinear().domain([0, max]).range([MARGIN.left, WIDTH - MARGIN.right]);

  /*
   * The first legend entry sits where it always has, one line above the plot.
   * Stacked, the second drops a line and returns to the first one's left edge,
   * so the two labels start at the same x and read as one block.
   */
  const legendOne = 16;
  const legendTwo = geometry.stacked ? legendOne + LEGEND_STEP : legendOne;
  const markOneX = MARGIN.left + 8;
  const markTwoX = geometry.stacked ? markOneX : MARGIN.left + 146;

  return (
    <svg
      className={`chart-svg ${geometry.className}`}
      style={chartStyle(WIDTH)}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`Complaints per night by descriptor, ${baselineWeekdays[0]} to ${baselineWeekdays[baselineWeekdays.length - 1]} baseline compared with ${peakWeekday}.`}
    >
      {x.ticks(3).map((tick) => (
        <g key={tick}>
          <line className="grid" x1={x(tick)} y1={marginTop} x2={x(tick)} y2={height - MARGIN.bottom} />
          <text className="tick" x={x(tick)} y={height - MARGIN.bottom + 22} textAnchor="middle">
            {formatNumber(tick)}
          </text>
        </g>
      ))}

      {rows.map((row, index) => {
          const y = marginTop + index * ROW_HEIGHT + ROW_HEIGHT / 2;
          const isHighlight = row.descriptor === highlight;

          return (
            <g key={row.descriptor}>
              {/* Emphasis rides the descriptor's name, not its marks: a text
                  weight says "this is the row the section is about" without
                  claiming the marks in it mean something different. */}
              <text
                className={isHighlight ? "tick row-label row-label-strong" : "tick row-label"}
                x={MARGIN.left - 12}
                y={y + 4}
                textAnchor="end"
              >
                {row.descriptor}
              </text>
              <line
                className="dumbbell-accent"
                x1={x(row.baseline)}
                y1={y}
                x2={x(row.peak)}
                y2={y}
              />
              <line
                className="endpoint-tick"
                x1={x(row.baseline)}
                y1={y - TICK_HALF_HEIGHT}
                x2={x(row.baseline)}
                y2={y + TICK_HALF_HEIGHT}
              />
              {/*
                Every Saturday endpoint is the accent, not just the highlighted
                one, and so is every connector. The legend promises that an orange
                dot means Saturday night, and the span between the two ends is the
                difference the chart is about; neither can change colour row by
                row and still mean one thing. A short connector is short because
                the difference is small, not because it matters less.

                Emphasis is carried by the value label, which appears on the
                highlighted descriptor alone - it singles the row out without
                redefining any mark in it.
              */}
              <circle className="marker-accent" cx={x(row.peak)} cy={y} r={CHART.markerRadius} />
              {isHighlight && (
                <text className="value-label" x={x(row.peak) + 12} y={y + 4}>
                  {formatNumber(row.peak, 1)}
                </text>
              )}
            </g>
          );
        })}

      {/*
        Two marks with different meanings, so both are named - and drawn at the
        sizes the rows use, so the legend teaches the tick-and-dot pairing rather
        than only the colours. Adjacent rather than at opposite edges: they are
        the two ends of one row, and the legend should read that way, stacked or
        not. Each label is centred on its own mark in `em`, so the pairing holds
        at every type size this chart is drawn with.
      */}
      <g className="chart-legend">
        <line
          className="endpoint-tick"
          x1={markOneX}
          y1={legendOne - TICK_HALF_HEIGHT}
          x2={markOneX}
          y2={legendOne + TICK_HALF_HEIGHT}
        />
        <text className="series-label" x={markOneX + 14} y={legendOne} dy={CENTRE_TEXT}>
          baseline night
        </text>
        <circle
          className="marker-accent"
          cx={markTwoX}
          cy={legendTwo}
          r={CHART.markerRadius}
        />
        <text className="series-label" x={markTwoX + 14} y={legendTwo} dy={CENTRE_TEXT}>
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
  );
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

  const plot = { rows, peakWeekday, baselineWeekdays, highlight };

  return (
    <>
      <div className="descriptor-dumbbell">
        <Plot {...plot} geometry={INLINE} />
        <Plot {...plot} geometry={STACKED} />
      </div>

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
