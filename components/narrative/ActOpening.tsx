/**
 * Sections 1-3: the reframe, the guess, the reveal.
 */

import { ChartFigure } from "@/components/charts/ChartFrame";
import { GuessAwareColumns, GuessComparison, GuessInput } from "./Guess";
import { Boundary, Section, Unavailable } from "./Section";
import { formatNumber, formatSignedPercentage } from "@/lib/format";
import { describeFailure } from "@/lib/socrata";
import type { RangeBundle } from "@/lib/data";

export function HookSection() {
  return (
    <Section id="hook" eyebrow="CitySignal" title="Where is New York loud?" lead>
      <p className="lede">
        This is not that map. Nobody measures the noise. What gets measured is who picks up the
        phone.
      </p>
      <p>
        Every record here is a New Yorker deciding that something was worth reporting to 311 — and
        then reporting it. That decision runs on more than volume. It runs on whether you think
        anyone will come, whether you have done it before, whether you know the number, whether you
        expect to still live there next year, and what you assume about the people making the sound.
      </p>
      <p>
        So the pattern below is real, and it is repeatable, and it is not a map of noise. It is a
        map of reporting. Those are different maps, and the difference is the whole point.
      </p>
      <Boundary>
        Throughout: a complaint is a report, not a measurement. Complaint counts are not unique
        noise incidents — one address can generate several reports on a single night.
      </Boundary>
    </Section>
  );
}

export function GuessSection() {
  return (
    <Section id="guess" eyebrow="Before the answer" title="How much more, on a weekend?">
      <p>
        Take the average number of residential noise complaints Brooklyn files on a weekday. Now
        take the average for a weekend day. How much bigger is the second number?
      </p>
      <GuessInput />
    </Section>
  );
}

export function RevealSection({ bundle }: { bundle: RangeBundle }) {
  const { daily, dailyInterval, range } = bundle;

  if (daily.status === "failed") {
    return (
      <Section id="reveal" eyebrow="The answer" title="Weekends run higher">
        <Unavailable>{describeFailure(daily.failure)}</Unavailable>
      </Section>
    );
  }

  const summary = daily.value;
  const { comparison } = summary;

  if (comparison.kind === "no-data") {
    return (
      <Section id="reveal" eyebrow="The answer" title="No comparison available">
        <p>
          NYC Open Data returned no residential noise complaints for {range.display}. There is
          nothing to compare, so nothing is shown.
        </p>
      </Section>
    );
  }

  if (comparison.kind === "zero-baseline") {
    return (
      <Section id="reveal" eyebrow="The answer" title="No weekday baseline">
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
      eyebrow="The answer"
      title={
        comparison.direction === "level"
          ? "Weekends and weekdays run level"
          : `Weekends run ${formatSignedPercentage(comparison.percentageDifference)}`
      }
    >
      <p className="lede">
        Across {range.display}, Brooklyn averaged{" "}
        <strong>{formatNumber(comparison.weekendAverage, 1)}</strong> residential noise complaints
        on a weekend day against <strong>{formatNumber(comparison.weekdayAverage, 1)}</strong> on a
        weekday — {formatSignedPercentage(comparison.percentageDifference)}, {direction} the
        weekday baseline.
      </p>

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
        <p className="interval">
          Resampling days gives a 95% interval of{" "}
          {formatSignedPercentage(dailyInterval.lower)} to{" "}
          {formatSignedPercentage(dailyInterval.upper)}. Daily counts are seasonal and
          autocorrelated, so the real interval is wider than that.
        </p>
      )}

      <Boundary>
        A gap this size means weekend days produce more reports. It does not mean weekend nights
        are louder, and nothing here explains why the gap exists.
      </Boundary>
    </Section>
  );
}
