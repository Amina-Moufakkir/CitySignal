/**
 * Section 1, and sections 6-8: the reframe, then the opening of the Brooklyn
 * case study - the corpus, the same corpus with the weekends marked, and the
 * reveal.
 *
 * The reader's guess used to live here and now sits in `ActCity`, asked about
 * the city rather than about Brooklyn's 2024. The reveal below is consequently
 * no longer an answer to a question the reader was asked: it is the fixed-year
 * figure the rest of the investigation is built on, and the citywide section has
 * already shown that Brooklyn is not alone in it.
 */

import Image from "next/image";

import heroIllustration from "@/public/images/citysignal-311-hero.webp";
import { ChartFigure } from "@/components/charts/ChartFrame";
import { DailyCalendar } from "@/components/charts/DailyCalendar";
import { DayTypeColumns } from "@/components/charts/DayTypeColumns";
import { Boundary, KeyFigure, PullQuote, Secondary, Section, Unavailable } from "./Section";
import { formatNumber, formatPercentage, formatSignedPercentage } from "@/lib/format";
import { describeFailure } from "@/lib/socrata";
import { pickAnchors, weekdayName } from "@/lib/series";
import type { RangeBundle } from "@/lib/data";

export function HookSection() {
  return (
    <Section
      id="hook"
      title="Where is New York loud?"
      lead
      hero={{
        /*
          The illustration is its own region of the composition, not a sibling
          nudged into place. On a wide screen the grid puts it beside the heading
          and the opening paragraph and lets those two decide the row height; on a
          narrow one the same three regions stack heading, image, paragraph, so
          the picture is the way into the piece rather than something to scroll
          past.

          It is supporting content, not decoration, and it carries no claim the
          prose does not: every figure on this page comes from the data.
        */
        visual: (
          <figure className="hero-visual">
            <Image
              src={heroIllustration}
              alt="Illustration of a 311 operator receiving selected reports from Brooklyn residences, with the Brooklyn Bridge and Lower Manhattan beyond."
              sizes="(min-width: 74rem) 640px, (min-width: 72rem) 52vw, 100vw"
              priority
            />
          </figure>
        ),
        intro: (
          <p className="lede drop-cap">
            There is a whole genre of answer. Rankings of the noisiest neighbourhoods. Guides that
            score a block on how quiet it is. Maps that shade a district darker the more it
            complains. All built on one public dataset — NYC 311 service requests — and all making
            the same move: treating a count of complaints as a measurement of sound.
          </p>
        ),
      }}
    >
      {/* The argument continues below the closed composition, at the reading
          measure the rest of the piece uses. */}
      <div className="hero-continuation">
        <PullQuote>
          Nobody in that dataset measured anything. What got recorded is who picked up the phone.
        </PullQuote>
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
      </div>
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
              <b className="note-head">The spread.</b> The quietest day drew {formatNumber(min.complaints)} complaints and the busiest{" "}
              {formatNumber(max.complaints)}, on {max.day}, a {weekdayName(max.day)}. The median day
              drew {formatNumber(median, 1)}.
            </span>
            <span className="note-block">
              <b className="note-head">One complication, up front.</b> The busiest{" "}
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
        <DayTypeColumns
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
