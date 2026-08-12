/**
 * Sections 10-12: what this establishes, the reader's turn, and the method.
 *
 * The method section is not a footer. It is where the piece is checkable, and
 * that is the strongest thing it has.
 */

import { ExploreBoroughs, type ExploreBorough } from "./ExploreBoroughs";
import { Boundary, Secondary, Section } from "./Section";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { REVALIDATE_SECONDS } from "@/lib/socrata";
import { PRIMARY_RANGE, STRESS_RANGE } from "@/lib/config";
import type { PageData } from "@/lib/data";

const REPO_URL = "https://github.com/Amina-Moufakkir/CitySignal";
const DATASET_PAGE =
  "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9";
/** Points at the branch this is deployed from; update when it merges. */
const METHOD_URL = "https://github.com/Amina-Moufakkir/CitySignal/blob/narrative/METHOD.md";

export function BoundariesSection({ pageData }: { pageData: PageData }) {
  const total =
    (pageData.brooklynPrimary.daily.status === "ok"
      ? pageData.brooklynPrimary.daily.value.totalComplaints
      : 0) +
    (pageData.brooklynStress.daily.status === "ok"
      ? pageData.brooklynStress.daily.value.totalComplaints
      : 0);

  return (
    <Section id="boundaries" title="What this does and does not establish">
      <p>
        {formatNumber(total)} complaints across two years support a narrow set of claims. It is
        worth being exact about which.
      </p>

      <h3>What it establishes</h3>
      <ul className="claims">
        <li>
          Brooklyn residents filed more residential noise reports on weekend days than weekdays, in
          both periods examined.
        </li>
        <li>The difference is concentrated in late-night hours rather than spread across the day.</li>
        <li>It concentrates further on one night of the week and one kind of report.</li>
        <li>
          Reporting rates differ across community boards after adjusting for household counts.
        </li>
        <li>
          Four pre-registered explanations for that geographic difference were not supported.
        </li>
      </ul>

      <h3>What it does not establish</h3>
      <ul className="claims">
        <li>
          <strong>That anywhere is louder.</strong> This measures reports. Reporting depends on who
          calls, how often, and whether they expect a response. Two equally loud places can produce
          very different numbers.
        </li>
        <li>
          <strong>Any cause.</strong> Nothing here explains why the pattern exists. Four candidate
          explanations failing is not evidence for a fifth.
        </li>
        <li>
          <strong>A count of noise events.</strong> Complaint counts are not unique noise
          incidents. One address can generate several reports on a single night, and Phase 3 found
          those bursts to be meaningful.
        </li>
        <li>
          <strong>Anything about a resident or a building.</strong> The smallest unit here is a
          community board of tens of thousands of households.
        </li>
        <li>
          <strong>Anything about neighbourhood quality.</strong> A board that reports more is a
          board that reports more.
        </li>
      </ul>

      <Boundary>
        One more, about the product rather than the data: CitySignal assumes its reader is someone
        at a community board or in city operations deciding whether a pattern is worth a closer
        look. That assumption has never been tested with an actual such reader.
      </Boundary>
    </Section>
  );
}

export function ExploreSection({ boroughs }: { boroughs: ExploreBorough[] }) {
  return (
    <Section id="explore" title="Run it yourself" wide>
      <p>
        The same two comparisons, for any borough. Everything here was computed when the page was
        built, so changing the selection queries nothing.
      </p>
      <ExploreBoroughs boroughs={boroughs} />
    </Section>
  );
}

export function MethodSection({ pageData }: { pageData: PageData }) {
  return (
    <Section id="method" title="Method">
      <p>
        Every live figure here comes from NYC Open Data&rsquo;s{" "}
        <a href={DATASET_PAGE}>311 Service Requests</a> dataset (<code>erm2-nwe9</code>), filtered
        to <code>complaint_type = &lsquo;Noise - Residential&rsquo;</code>. One record is one
        service request — not one noise event.
      </p>
      <p>
        Two periods, each 52 complete Monday-to-Sunday weeks, so each holds exactly 260 weekdays
        and 104 weekend days: {PRIMARY_RANGE.display} and {STRESS_RANGE.display}. They share no
        days. A night runs 10 PM to 3:59 AM and is credited to the evening it began, which is why
        Saturday is counted over 52 nights and Sunday over 51.
      </p>
      <p>
        The three queries, the date handling, the bootstrap, the daylight-saving arithmetic and
        every known limitation are written out in <a href={METHOD_URL}>METHOD.md</a>, alongside a
        table naming the source of every number in this piece — including the nine that cannot be
        reproduced from what is committed. The code is at <a href={REPO_URL}>GitHub</a>.
      </p>
      <Secondary>
        Live figures were last fetched from NYC Open Data on{" "}
        {formatTimestamp(pageData.fetchedAt)}, and refresh at most every{" "}
        {formatNumber(REVALIDATE_SECONDS / 3600)} hours. The community-board chart is a fixed
        extract and does not refresh.
      </Secondary>
    </Section>
  );
}
