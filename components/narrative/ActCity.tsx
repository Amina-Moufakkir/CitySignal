/**
 * Sections 2-5: the citywide opening, and the hand-off into Brooklyn.
 *
 * This act exists because the piece is about New York and used to open on
 * Brooklyn in a fixed year. The reader now meets all five boroughs over a period
 * that ends a week ago, picks one to look at, and only then is told why
 * everything after this point is Brooklyn.
 *
 * Nothing here states a finding that has not been computed from the rows being
 * rendered. The transition in particular reads its claim off `patternBreadth`
 * rather than asserting that the weekend rhythm is everywhere, because that is a
 * fact about a period and this period moves every week.
 */

import { ChartFigure } from "@/components/charts/ChartFrame";
import { BoroughDumbbell } from "@/components/charts/BoroughDumbbell";
import { BoroughGuessInput, BoroughGuessResult } from "./Guess";
import { ExploreBoroughs, type ExploreBorough } from "./ExploreBoroughs";
import { Boundary, Secondary, Section } from "./Section";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { CURRENT_RANGE_BUFFER_DAYS, RANGE_WEEKS, type Range } from "@/lib/config";
import {
  largestRise,
  patternBreadth,
  type BoroughRow,
  type PatternBreadth,
} from "@/lib/citywide";

export function CitywideGuessSection() {
  return (
    <Section id="guess" title="Which borough rises most?">
      <p>
        Residential noise reporting rises on weekends. Before you see where, commit to a guess:
        which borough do you expect to show the largest rise, measured against its own weekday
        level rather than against anywhere else?
      </p>
      <BoroughGuessInput />
    </Section>
  );
}

/**
 * The period, stated plainly wherever the current data is shown. A rolling
 * window is only honest if the reader can see exactly which days it covers and
 * when it was last pulled.
 */
export function CurrentPeriodNote({ range, fetchedAt }: { range: Range; fetchedAt: string }) {
  return (
    <Secondary>
      <span className="note-block">
        <b className="note-head">The period.</b> {range.display} — {RANGE_WEEKS} complete
        Monday-to-Sunday weeks, so every borough here is measured over exactly{" "}
        {formatNumber(RANGE_WEEKS * 5)} weekdays and {formatNumber(RANGE_WEEKS * 2)} weekend days.
        Last refreshed {formatTimestamp(fetchedAt)}.
      </span>
      <span className="note-block">
        <b className="note-head">Why it stops a week short.</b> The most recent{" "}
        {CURRENT_RANGE_BUFFER_DAYS} days are left out. 311 is republished daily and its newest
        records are the least settled — requests are still being entered and amended — so the window
        ends at the last completed Sunday before that cut. This is a deliberately conservative
        allowance rather than a measured one: nothing in this repository establishes how far back
        311 revisions actually reach.
      </span>
    </Secondary>
  );
}

/**
 * The heading is read off the rows, not written in advance.
 *
 * "Rises in every borough" is a claim about a period that moves every week, so it
 * is only said when every borough that could be compared actually rose. Anything
 * else states the count, and a period too thin to characterise gets a heading
 * that asserts nothing at all.
 */
function citywideTitle(breadth: PatternBreadth): string {
  switch (breadth.kind) {
    case "all":
      return "Weekend reporting rises in every borough";
    case "most":
    case "some":
      return `Weekend reporting rises in ${breadth.higher} of the ${breadth.total} boroughs compared`;
    case "none":
      return "No borough reported more on weekend days than on its own weekdays";
    default:
      return "The weekend rise, borough by borough";
  }
}

export function CitywideSection({
  rows,
  range,
  fetchedAt,
}: {
  rows: BoroughRow[];
  range: Range;
  fetchedAt: string;
}) {
  const rise = largestRise(rows);
  const breadth = patternBreadth(rows);

  return (
    <Section id="citywide" title={citywideTitle(breadth)} wide>
      <p className="lede">
        Each borough measured against its own weekday level over {range.display}. The hollow mark is
        that baseline, fixed at 100 for every borough; the orange mark is where its weekend
        reporting lands.
      </p>

      <ChartFigure
        caption={`Weekend residential noise reporting against each borough's own weekday baseline, ${range.display}`}
        table={null}
        note={
          <>
            <b className="note-head">What is being compared.</b> Each borough against itself, and
            only against itself. Brooklyn files many times the complaints Staten Island does, so the
            raw daily counts are not comparable between them — the index throws the levels away on
            purpose and keeps the change. The boroughs are listed alphabetically and are never
            reordered by their results.
          </>
        }
      >
        <BoroughDumbbell rows={rows} label={`All five boroughs, ${range.display}`} />
      </ChartFigure>

      {/* Attached to the chart, not filed after it: this is how to read the marks
          immediately above, so it sits against them rather than at the end of the
          section behind the guess result. */}
      <Boundary>
        This is not a measurement of how loud anywhere is, and not a ranking of anywhere against
        anywhere else. A borough that rises further is a borough where the weekend changes reporting
        more — a fact about who picks up the phone, not about sound.
      </Boundary>

      <BoroughGuessResult rise={rise} />

      <CurrentPeriodNote range={range} fetchedAt={fetchedAt} />
    </Section>
  );
}

export function BoroughSection({ boroughs }: { boroughs: ExploreBorough[] }) {
  return (
    <Section id="borough" title="Pick one and look closer" wide>
      <p>
        The same comparison for whichever borough you choose, with the hours behind it. Everything
        here was computed when the page was built, so changing the selection queries nothing.
      </p>
      <ExploreBoroughs boroughs={boroughs} />
    </Section>
  );
}

/**
 * The hinge. Says what the citywide rows actually established, then says why the
 * rest of the piece narrows to one borough.
 */
export function CaseStudySection({ rows, range }: { rows: BoroughRow[]; range: Range }) {
  const breadth = patternBreadth(rows);

  return (
    <Section id="casestudy" title="Why the rest of this is Brooklyn">
      <p className="lede">
        {breadth.kind === "all" &&
          `Across ${range.display}, all ${breadth.total} boroughs with a comparison reported more residential noise on weekend days than on their own weekdays. The weekend rhythm is not a Brooklyn peculiarity.`}
        {breadth.kind === "most" &&
          `Across ${range.display}, ${breadth.higher} of the ${breadth.total} boroughs with a comparison reported more residential noise on weekend days than on their own weekdays. The weekend rhythm is not a Brooklyn peculiarity, though it does not hold everywhere.`}
        {breadth.kind === "some" &&
          `Across ${range.display}, ${breadth.higher} of the ${breadth.total} boroughs with a comparison reported more on weekend days than on their own weekdays. The rhythm is real in those boroughs and absent in the rest, so it is neither unique to Brooklyn nor universal.`}
        {breadth.kind === "none" &&
          `Across ${range.display}, no borough reported more residential noise on weekend days than on its own weekdays. Whatever the historical record below shows, it is not what this period shows.`}
        {breadth.kind === "insufficient" &&
          `Too few boroughs returned a usable comparison over ${range.display} to say how widely the weekend pattern holds right now.`}
      </p>

      <p>
        What follows narrows to Brooklyn, and the reason is evidence rather than interest. Asking
        where inside a borough the reporting concentrates means dividing complaints by the number of
        households in each community district, and CitySignal holds that denominator — the committed
        household extract, and the geographic tests that were written down as predictions before the
        data was examined — for Brooklyn only. The same questions could be asked of the other four.
        They have not been, so they are not answered here.
      </p>

      <Boundary>
        The investigation below runs over two fixed years rather than the rolling period above, so
        its percentages are not the ones you have just read. They describe different windows of the
        same data and are not interchangeable.
      </Boundary>
    </Section>
  );
}
