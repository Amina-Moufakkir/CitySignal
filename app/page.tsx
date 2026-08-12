/**
 * Increment 2: a provisional page that proves the data layer end to end.
 *
 * It renders the reveal (section 3), the persistence check (section 8), and the
 * descriptor decomposition (section 6) because those are the three shapes the
 * data layer has to get right: a union-typed comparison, a second live range,
 * and a derived-peak decomposition. The other sections, the charts, and the
 * design land in increment 3.
 *
 * Every claim below is templated from the data. There is no sentence asserting a
 * direction or a magnitude that the numbers do not produce.
 */

import {
  BOARD_CONCENTRATION_THRESHOLD,
  loadPageData,
  NARRATIVE_DESCRIPTOR,
  type Loaded,
  type RangeBundle,
} from "@/lib/data";
import { peakNight, type DescriptorExcess, type NightSummary } from "@/lib/analysis";
import { describeFailure } from "@/lib/socrata";
import { formatNumber, formatPercentage, formatSignedPercentage } from "@/lib/format";
import { comparedToThreshold, type IntervalResult } from "@/lib/uncertainty";

// Must match REVALIDATE_SECONDS in lib/socrata.ts. Next requires a literal here.
export const revalidate = 21600;

function Failed({ message }: { message: string }) {
  return (
    <p className="status" role="status">
      {message}
    </p>
  );
}

function IntervalNote({ interval }: { interval: IntervalResult }) {
  if (interval.kind === "unavailable") {
    return null;
  }

  return (
    <p className="interval">
      95% interval {formatSignedPercentage(interval.lower)} to{" "}
      {formatSignedPercentage(interval.upper)}, from {formatNumber(interval.draws)} bootstrap draws
      resampling days. Daily counts are seasonal and autocorrelated, so the true interval is wider.
    </p>
  );
}

function DayTypeReveal({ bundle, heading }: { bundle: RangeBundle; heading: string }) {
  const { daily, dailyInterval, range } = bundle;

  if (daily.status === "failed") {
    return (
      <section>
        <h2>{heading}</h2>
        <Failed message={describeFailure(daily.failure)} />
      </section>
    );
  }

  const summary = daily.value;
  const { comparison } = summary;

  return (
    <section>
      <h2>{heading}</h2>

      {comparison.kind === "no-data" && (
        <p>
          NYC Open Data returned no residential noise complaints for {range.display}. No comparison
          is shown, because there is nothing to compare.
        </p>
      )}

      {comparison.kind === "zero-baseline" && (
        <p>
          Weekend days averaged{" "}
          <span className="figure">{formatNumber(comparison.weekendAverage, 1)}</span> complaints
          across {range.display}, but weekdays recorded none at all, so there is no baseline to
          express the difference against.
        </p>
      )}

      {comparison.kind === "computed" && (
        <>
          <p>
            Across {range.display}, weekend days averaged{" "}
            <span className="figure">{formatNumber(comparison.weekendAverage, 1)}</span> residential
            noise complaints against{" "}
            <span className="figure">{formatNumber(comparison.weekdayAverage, 1)}</span> on
            weekdays. That is{" "}
            <span className="figure">
              {formatSignedPercentage(comparison.percentageDifference)}
            </span>{" "}
            {comparison.direction === "level" ? "- no difference" : comparison.direction}.
          </p>
          <IntervalNote interval={dailyInterval} />
        </>
      )}

      <p className="note">
        Based on {formatNumber(summary.weekdayTotal)} complaints across {summary.weekdayDays}{" "}
        weekdays and {formatNumber(summary.weekendTotal)} across {summary.weekendDays} weekend days.
        {summary.rejectedRows > 0 &&
          ` ${formatNumber(summary.rejectedRows)} malformed rows were rejected and excluded.`}
      </p>
    </section>
  );
}

function NightsSection({ nights }: { nights: Loaded<NightSummary> }) {
  if (nights.status === "failed") {
    return (
      <section>
        <h2>Which night</h2>
        <Failed message={describeFailure(nights.failure)} />
      </section>
    );
  }

  const peak = peakNight(nights.value);

  return (
    <section>
      <h2>Which night</h2>
      {peak.kind === "none" ? (
        <p>No night stands out in this period.</p>
      ) : (
        <p>
          The strongest night is <span className="figure">{peak.night.weekday}</span>, averaging{" "}
          <span className="figure">{formatNumber(peak.night.average, 1)}</span> complaints across{" "}
          {peak.night.nightsCounted} complete nights. A night runs 10 PM to 3:59 AM, so complaints
          after midnight count toward the evening they began.
        </p>
      )}
      <p className="note">
        Nights counted:{" "}
        {nights.value.nights.map((night) => `${night.weekday} ${night.nightsCounted}`).join(", ")}.
        Excluded as incomplete: {nights.value.droppedNights.join(" and ")}.
      </p>
    </section>
  );
}

function DescriptorSection({ excess, heading }: { excess: DescriptorExcess; heading: string }) {
  return (
    <section>
      <h2>{heading}</h2>
      {excess.kind === "no-data" && <p>The descriptor breakdown is not available for this period.</p>}
      {excess.kind === "no-excess" && (
        <p>
          The peak night does not exceed the {"Monday-Thursday"} baseline in this period, so there is
          no excess to attribute to any one descriptor.
        </p>
      )}
      {excess.kind === "computed" && (
        <>
          <p>
            {excess.peakWeekday} nights run{" "}
            <span className="figure">{formatNumber(excess.excessPerNight, 1)}</span> complaints above
            the {excess.baselineWeekdays.join(", ")} average.{" "}
            <span className="figure">{excess.descriptor}</span> accounts for{" "}
            <span className="figure">{formatPercentage(excess.shareOfExcess)}</span> of that excess.
          </p>
          <p className="note">
            {excess.peakWeekday}: {formatNumber(excess.peakPerNight, 1)} per night,{" "}
            {formatNumber(excess.peakDescriptorPerNight, 1)} of them {excess.descriptor}. Baseline:{" "}
            {formatNumber(excess.baselinePerNight, 1)} per night,{" "}
            {formatNumber(excess.baselineDescriptorPerNight, 1)} of them {excess.descriptor}. Rates,
            not totals: the baseline is four nights a week against the peak&rsquo;s one.
          </p>
        </>
      )}
    </section>
  );
}

export default async function Page() {
  const data = await loadPageData();
  const threshold = comparedToThreshold(data.boardShareInterval, BOARD_CONCENTRATION_THRESHOLD);

  return (
    <main>
      <p className="eyebrow">CitySignal</p>
      <h1>Increment 2: data layer</h1>
      <p className="lede">
        A provisional render proving the server-side data layer. Sections, charts, and design land in
        increment 3.
      </p>

      <DayTypeReveal bundle={data.brooklynPrimary} heading="Reveal (section 3, primary range)" />
      <DayTypeReveal bundle={data.brooklynStress} heading="Persistence (section 8, stress range)" />
      <NightsSection nights={data.brooklynPrimary.nights} />
      <DescriptorSection
        excess={data.descriptorsPrimary.excess}
        heading="What kind of noise (section 6, primary range)"
      />
      <DescriptorSection
        excess={data.descriptorsStress.excess}
        heading="What kind of noise (section 6, stress range)"
      />

      <section>
        <h2>Board concentration (section 9)</h2>
        <p>
          The three highest-count boards ({data.boardShare.boards.join(", ")}) hold{" "}
          <span className="figure">{formatPercentage(data.boardShare.share)}</span> of{" "}
          {formatNumber(data.boardShare.total)} Saturday-night {NARRATIVE_DESCRIPTOR} complaints.
        </p>
        {data.boardShareInterval.kind === "interval" && (
          <p className="interval">
            95% interval {formatPercentage(data.boardShareInterval.lower)} to{" "}
            {formatPercentage(data.boardShareInterval.upper)}, resampling complaints. Against the
            pre-registered {BOARD_CONCENTRATION_THRESHOLD}% threshold this interval falls{" "}
            {threshold === "straddles" ? "on both sides" : threshold.replace("-", " ")}. Complaints
            cluster within nights, so this interval is narrower than the data warrants.
          </p>
        )}
      </section>

      <section>
        <h2>Fetch status</h2>
        <p className="note">
          Refreshed {data.fetchedAt}. Revalidation window {revalidate} seconds. Boroughs loaded:{" "}
          {data.boroughs
            .map(
              (bundle) =>
                `${bundle.borough} ${bundle.daily.status}/${bundle.hourly.status}`,
            )
            .join(", ")}
          .
        </p>
      </section>
    </main>
  );
}
