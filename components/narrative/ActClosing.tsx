/**
 * Sections 10-12: what this establishes, the reader's turn, and the method.
 *
 * The method section is not a footer. It is where the piece is checkable, and
 * that is the strongest thing it has.
 */

import { ExploreBoroughs, type ExploreBorough } from "./ExploreBoroughs";
import { Boundary, Section } from "./Section";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { dailyUrl, descriptorNightUrl, hourlyUrl, REVALIDATE_SECONDS } from "@/lib/socrata";
import { PRIMARY_RANGE, RANGES, STRESS_RANGE } from "@/lib/config";
import { PHASE3_BOARD_DATASET } from "@/lib/static-data";
import type { PageData } from "@/lib/data";

const REPO_URL = "https://github.com/Amina-Moufakkir/CitySignal";
const DATASET_PAGE =
  "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9";

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
  const metadata = PHASE3_BOARD_DATASET.metadata;

  return (
    <Section id="method" title="How this was built, and how to check it" wide>
      <h3>Source</h3>
      <p>
        NYC Open Data,{" "}
        <a href={DATASET_PAGE}>311 Service Requests from 2010 to Present</a> (dataset{" "}
        <code>erm2-nwe9</code>), filtered to <code>complaint_type = &lsquo;Noise - Residential&rsquo;</code>.
        One record is one service request. No app token is used, and none is committed.
      </p>

      <h3>Periods</h3>
      <p>
        Two ranges, each 52 complete Monday-to-Sunday weeks, so each contains exactly 260 weekdays
        and 104 weekend days and neither is biased by a partial week:
      </p>
      <ul className="claims">
        {RANGES.map((range) => (
          <li key={range.id}>
            <strong>{range.label}:</strong> {range.display}
          </li>
        ))}
      </ul>
      <p>
        The two share no days. Nights are counted separately: a night runs 10 PM to 3:59 AM and is
        credited to the evening it began, so a night needs both halves inside the range to count.
        Because both ranges begin on a Monday and end on a Sunday, the two incomplete nights are
        both Sunday nights — Sunday is counted over 51 nights and every other night over 52.
      </p>

      <h3>Queries</h3>
      <p>
        Nothing is fetched record by record. Three aggregate queries per borough per range, run on
        the server and cached for {formatNumber(REVALIDATE_SECONDS / 3600)} hours, so the dataset
        sees a fixed number of requests per window rather than one per visitor:
      </p>
      <ol className="queries">
        <li>
          <span>Daily counts</span>
          <code>{decodeURIComponent(dailyUrl(PRIMARY_RANGE))}</code>
        </li>
        <li>
          <span>Hourly counts</span>
          <code>{decodeURIComponent(hourlyUrl(PRIMARY_RANGE))}</code>
        </li>
        <li>
          <span>Descriptor by night</span>
          <code>{decodeURIComponent(descriptorNightUrl(PRIMARY_RANGE))}</code>
        </li>
      </ol>
      <p>
        Substitute <code>{STRESS_RANGE.start}</code> and <code>{STRESS_RANGE.endExclusive}</code>{" "}
        for the second period, or another borough value, and the numbers on this page follow.
      </p>

      <h3>Handling</h3>
      <ul className="claims">
        <li>
          Dates are parsed from their components into UTC and never through the host timezone.
          Socrata returns a floating local timestamp with no zone; reinterpreting it would shift
          days.
        </li>
        <li>
          Hour of day and day of week are computed by Socrata from <code>created_date</code>, which
          is NYC local time. Nothing is re-derived client-side.
        </li>
        <li>
          Denominators come from walking the calendar, not from counting returned rows, so a day
          with genuinely zero complaints stays in the denominator.
        </li>
        <li>
          Aggregate rows are validated and rejected rather than coerced. Socrata returns counts as
          strings; a null or empty value would otherwise silently become a zero-complaint day.
        </li>
        <li>
          Intervals are percentile bootstraps with a seeded generator, so the same code returns the
          same interval. Day-type differences resample days; the board share resamples complaints
          and re-selects the top three on each draw, matching how that hypothesis was written.
        </li>
      </ul>

      <h3>Known limitations</h3>
      <ul className="claims">
        <li>
          <strong>Daylight saving.</strong> Two days a year are not 24 hours long in local time.
          2024-11-03 has two 1 AM hours and 2024-03-10 has none at 2 AM; both are Sundays and both
          are counted on a 24-hour grid. The effect is roughly one percent on two hourly buckets.
          It is disclosed rather than adjusted.
        </li>
        <li>
          <strong>Board boundaries.</strong> {metadata.limitation}
        </li>
        <li>
          <strong>Denominator vintage.</strong> {metadata.denominatorSource}, against a complaint
          period of {metadata.complaintPeriod}. The second period extends past that vintage.
          {metadata.extractedOn ? ` Extracted ${metadata.extractedOn}.` : " The extraction date was not recorded."}
        </li>
        <li>
          <strong>Independence.</strong> Both bootstraps assume independent resampling units. Daily
          counts are seasonal and autocorrelated; complaints cluster within nights and addresses.
          Both real intervals are wider than the ones shown.
        </li>
        <li>
          <strong>Provenance.</strong> Sections above are queried live and recomputed on every
          refresh. The community-board chart is a fixed extract. Three of the four failed
          predictions were computed in Phase 2-3 analyses that are not committed to this
          repository; their figures are recorded rather than recomputed, and are labelled as such
          where they appear.
        </li>
      </ul>

      <h3>Code</h3>
      <p>
        The analysis, the queries, and the tests are at <a href={REPO_URL}>{REPO_URL}</a>. The
        earlier static build is preserved on the <code>main</code> branch and under{" "}
        <code>legacy/</code>.
      </p>
      <p className="source-line">
        Live figures on this page were last fetched from NYC Open Data on{" "}
        {formatTimestamp(pageData.fetchedAt)}, and refresh at most every{" "}
        {formatNumber(REVALIDATE_SECONDS / 3600)} hours.
      </p>
    </Section>
  );
}
