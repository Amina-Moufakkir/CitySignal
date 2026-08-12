/**
 * Sections 1-3: the reframe, the guess, the reveal.
 */

import { ChartFigure } from "@/components/charts/ChartFrame";
import { DailyCalendar } from "@/components/charts/DailyCalendar";
import { GuessAwareColumns, GuessComparison, GuessInput } from "./Guess";
import { Boundary, KeyFigure, Secondary, Section, Unavailable } from "./Section";
import { formatNumber, formatPercentage, formatSignedPercentage } from "@/lib/format";
import { describeFailure } from "@/lib/socrata";
import { pickAnchors, weekdayName } from "@/lib/series";
import type { RangeBundle } from "@/lib/data";

export function HookSection() {
  return (
    <Section id="hook" title="Where is New York loud?" lead>
      <p className="lede">
        There is a whole genre of answer to that question. Rankings of the city&rsquo;s noisiest
        neighbourhoods. Apartment-hunting guides that score a block on how quiet it is. Maps that
        shade a district darker the more it complains. They are built on one public dataset — NYC
        311 service requests — and they all make the same move: they treat a count of complaints as
        a measurement of sound.
      </p>
      <p className="lede">
        It is not one. Nobody in that dataset measured anything. What got recorded is who picked up
        the phone.
      </p>
      <p>
        Every record here is a New Yorker deciding that something was worth reporting to 311 — and
        then reporting it. That decision runs on more than volume. It runs on whether you think
        anyone will come, whether you have done it before, whether you know the number, whether you
        expect to still live there next year, and what you assume about the people making the sound.
      </p>
      <p>
        So the pattern below is real, and it is repeatable, and it is not a map of noise. It is a
        map of reporting. Those are different maps, and the difference is the whole point. This
        piece follows one pattern in that data as far as it will honestly go — and then stops where
        the evidence does, which is earlier than a ranking would.
      </p>
      <Boundary>
        Throughout: a complaint is a report, not a measurement. Complaint counts are not unique
        noise incidents — one address can generate several reports on a single night.
      </Boundary>
    </Section>
  );
}

export function GuessSection({ bundle }: { bundle: RangeBundle }) {
  const summary = bundle.daily.status === "ok" ? bundle.daily.value : null;
  const weekdayAverage =
    summary && summary.comparison.kind === "computed" ? summary.comparison.weekdayAverage : null;

  return (
    <Section id="guess" title="How much more, on a weekend?">
      <p>
        Take the average number of residential noise complaints Brooklyn files on a weekday. Now
        take the average for a weekend day. How much bigger is the second number?
      </p>
      <GuessInput weekdayAverage={weekdayAverage} />
    </Section>
  );
}

/**
 * The corpus, before any of it is averaged. Same rows as the reveal, no query.
 */
export function CorpusSection({ bundle }: { bundle: RangeBundle }) {
  const { dailySeries, daily, range } = bundle;

  if (dailySeries === null) {
    return (
      <Section id="corpus" title="Every day of the year">
        <Unavailable>
          {daily.status === "failed" ? describeFailure(daily.failure) : "Not available."}
        </Unavailable>
      </Section>
    );
  }

  const anchors = pickAnchors(dailySeries);
  const { max, maxWeekday, min, median, weekdayMean } = dailySeries;
  const weekdayMultiple = weekdayMean === 0 ? null : maxWeekday.complaints / weekdayMean;

  return (
    <Section id="corpus" title="Every day of the year" wide>
      <p className="lede">
        Each bar is one day in Brooklyn in {range.start.slice(0, 4)}. Nothing is averaged, sorted or
        filtered — this is all {formatNumber(dailySeries.days.length)} days, in order.
      </p>

      <ChartFigure
        caption={`Residential noise complaints per day, ${range.display}`}
        table={null}
        note={
          <>
            <span className="note-block">
              The quietest day drew {formatNumber(min.complaints)} complaints and the busiest{" "}
              {formatNumber(max.complaints)}, on {max.day}, a {weekdayName(max.day)}. The median day
              drew {formatNumber(median, 1)}.
            </span>
            <span className="note-block">
              One complication worth putting up front rather than burying. The busiest{" "}
              <em>weekday</em> of the year was {maxWeekday.day}, a {weekdayName(maxWeekday.day)}, at{" "}
              {formatNumber(maxWeekday.complaints)} complaints
              {weekdayMultiple === null
                ? ""
                : ` — ${formatNumber(weekdayMultiple, 1)} times the weekday average`}
              . New Year&rsquo;s Day is a {weekdayName(`${range.start.slice(0, 4)}-01-01`)} too. Both
              are public holidays that behave like weekends, and both are counted as weekdays. The
              gap this piece is about is therefore measured against a baseline that already contains
              the year&rsquo;s largest non-weekend surges, which makes it a conservative one.
            </span>
          </>
        }
      >
        <DailyCalendar
          series={dailySeries}
          anchors={anchors}
          label={`Brooklyn daily complaints, ${range.display}`}
        />
      </ChartFigure>
    </Section>
  );
}

/**
 * The same chart, one prop different. The statistic the next section computes is
 * already visible here as a stripe.
 */
export function RhythmSection({ bundle }: { bundle: RangeBundle }) {
  const { dailySeries, range } = bundle;

  if (dailySeries === null) {
    return null;
  }

  const ratio =
    dailySeries.weekdayMean === 0
      ? null
      : ((dailySeries.weekendMean - dailySeries.weekdayMean) / dailySeries.weekdayMean) * 100;

  return (
    <Section id="rhythm" title="Now colour the weekends" wide>
      <p className="lede">
        Nothing has been recalculated. The same {formatNumber(dailySeries.days.length)} bars, with
        Saturdays and Sundays picked out.
      </p>

      <ChartFigure
        caption={`Residential noise complaints per day, weekends marked, ${range.display}`}
        table={null}
        note={
          <>
            The pattern is a rhythm rather than a trend: it does not build over the year, it repeats
            every week.
            {ratio === null
              ? ""
              : ` Averaged out, a weekend day draws ${formatPercentage(Math.abs(ratio))} ${ratio >= 0 ? "more" : "fewer"} complaints than a weekday — which is the next section, stated precisely.`}
          </>
        }
      >
        <DailyCalendar
          series={dailySeries}
          anchors={[]}
          colorByDayType
          label={`Brooklyn daily complaints by day type, ${range.display}`}
        />
      </ChartFigure>
    </Section>
  );
}

export function RevealSection({ bundle }: { bundle: RangeBundle }) {
  const { daily, dailyInterval, range } = bundle;

  if (daily.status === "failed") {
    return (
      <Section id="reveal" title="Weekends run higher">
        <Unavailable>{describeFailure(daily.failure)}</Unavailable>
      </Section>
    );
  }

  const summary = daily.value;
  const { comparison } = summary;

  if (comparison.kind === "no-data") {
    return (
      <Section id="reveal" title="No comparison available">
        <p>
          NYC Open Data returned no residential noise complaints for {range.display}. There is
          nothing to compare, so nothing is shown.
        </p>
      </Section>
    );
  }

  if (comparison.kind === "zero-baseline") {
    return (
      <Section id="reveal" title="No weekday baseline">
        <p>
          Weekend days averaged {formatNumber(comparison.weekendAverage, 1)} complaints across{" "}
          {range.display}, but weekdays recorded none at all. There is no baseline to express a
          difference against, so no percentage is given.
        </p>
      </Section>
    );
  }

  const direction =
    comparison.direction === "level"
      ? "the same as"
      : comparison.direction === "higher"
        ? "higher than"
        : "lower than";

  return (
    <Section
      id="reveal"
      title={
        comparison.direction === "level"
          ? "Weekends and weekdays run level"
          : `Weekends run ${formatSignedPercentage(comparison.percentageDifference)}`
      }
    >
      <p className="lede">
        Averaged out, a weekend day in Brooklyn drew{" "}
        {formatNumber(comparison.weekendAverage, 1)} residential noise complaints against{" "}
        {formatNumber(comparison.weekdayAverage, 1)} on a weekday.
      </p>

      <KeyFigure value={formatSignedPercentage(comparison.percentageDifference)}>
        {direction === "the same as" ? "no difference between" : `${direction}`} the weekday
        baseline, across {range.display}
      </KeyFigure>

      <GuessComparison actual={comparison.percentageDifference} />

      <ChartFigure
        caption={`Average complaints per day, ${range.display}`}
        table={null}
        note={
          <>
            That is {formatNumber(summary.weekendTotal)} complaints across {summary.weekendDays}{" "}
            weekend days and {formatNumber(summary.weekdayTotal)} across {summary.weekdayDays}{" "}
            weekdays — {formatNumber(summary.totalComplaints)} in total, so the gap is not an
            artefact of thin counts.
            {summary.rejectedRows > 0
              ? ` ${formatNumber(summary.rejectedRows)} malformed rows were rejected and excluded.`
              : ""}
          </>
        }
      >
        <GuessAwareColumns
          comparison={comparison}
          weekdayDays={summary.weekdayDays}
          weekendDays={summary.weekendDays}
          label={`Brooklyn, ${range.display}`}
        />
      </ChartFigure>

      {dailyInterval.kind === "interval" && (
        <Secondary>
          Resampling days gives a 95% interval of {formatSignedPercentage(dailyInterval.lower)} to{" "}
          {formatSignedPercentage(dailyInterval.upper)}. Daily counts are seasonal and
          autocorrelated, so the real interval is wider than that.
        </Secondary>
      )}

      <Boundary>
        A gap this size means weekend days produce more reports. It does not mean weekend nights
        are louder, and nothing here explains why the gap exists.
      </Boundary>
    </Section>
  );
}
