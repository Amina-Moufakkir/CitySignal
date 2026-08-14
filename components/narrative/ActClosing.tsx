/**
 * Section 16: what this establishes, and what it does not.
 *
 * The borough selector that used to close the piece has moved to section 4,
 * where it belongs: a reader should meet their own borough before the case
 * study, not after it. There is one selector, not two.
 *
 * The method is not a section of the piece - it is in METHOD.md, reached from
 * the colophon below, which sits outside the article and is not part of the
 * running order.
 */

import { Boundary, Secondary, Section } from "./Section";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { REVALIDATE_SECONDS } from "@/lib/socrata";
import { PRIMARY_RANGE, STRESS_RANGE } from "@/lib/config";
import type { PageData } from "@/lib/data";

const REPO_URL = "https://github.com/Amina-Moufakkir/CitySignal";
const DATASET_PAGE =
  "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9";
/** Points at the branch this is deployed from, which is now main. */
const METHOD_URL = "https://github.com/Amina-Moufakkir/CitySignal/blob/main/METHOD.md";
/**
 * The Phase 1-3 static build, still standing at its own URL. Served by GitHub
 * Pages from the `mvp` branch, which is frozen at the last commit before the
 * Next.js migration.
 */
const ORIGINAL_URL = "https://amina-moufakkir.github.io/CitySignal/";

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

      <div className="two-columns">
        <div className="column">
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
        </div>

        <div className="column column-emphasis">
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
        </div>
      </div>

      <Boundary>
        One more, about the product rather than the data: CitySignal assumes its reader is someone
        at a community board or in city operations deciding whether a pattern is worth a closer
        look. That assumption has never been tested with an actual such reader.
      </Boundary>
    </Section>
  );
}

/**
 * A colophon, not a section.
 *
 * The method used to be the last stop in the piece. It is now a single line
 * outside the article: the dataset it rests on, when the live figures were last
 * pulled, and where the full method lives. Everything technical - the queries,
 * the date handling, the bootstraps, the daylight-saving arithmetic and the
 * table naming the source of every figure - is in METHOD.md.
 *
 * The attribution stays because a piece built on someone else's public data
 * should say so on its face, not one link away.
 *
 * The second line points at the version this one replaced. It is kept running at
 * its own URL rather than deleted, so the before and after can be read against
 * each other; saying so here is part of showing the work.
 */
export function Colophon({ pageData }: { pageData: PageData }) {
  return (
    <footer className="colophon">
      <p>
        Live figures from NYC Open Data,{" "}
        <a href={DATASET_PAGE}>311 Service Requests</a> (<code>erm2-nwe9</code>), last fetched{" "}
        {formatTimestamp(pageData.fetchedAt)} and refreshed at most every{" "}
        {formatNumber(REVALIDATE_SECONDS / 3600)} hours. Full method, queries and figure
        provenance: <a href={METHOD_URL}>METHOD.md</a>. Code: <a href={REPO_URL}>GitHub</a>.
      </p>
      <p>
        This piece replaced an earlier static version, which is preserved unchanged at{" "}
        <a href={ORIGINAL_URL}>the original CitySignal</a>.
      </p>
    </footer>
  );
}
