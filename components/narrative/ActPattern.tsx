/**
 * Sections 4-6: it is not days, it is nights; it is one night; it is one kind
 * of complaint.
 */

import { ChartFigure } from "@/components/charts/ChartFrame";
import { DescriptorDumbbell } from "@/components/charts/DescriptorDumbbell";
import { HourlyLines } from "@/components/charts/HourlyLines";
import { NightBars } from "@/components/charts/NightBars";
import { Boundary, Section, Unavailable } from "./Section";
import { formatNumber, formatPercentage, hourLabel } from "@/lib/format";
import { describeFailure } from "@/lib/socrata";
import { largestHourlyGap, peakNight } from "@/lib/analysis";
import type { HourlySummary, NightRow, NightSummary } from "@/lib/analysis";
import type { DescriptorBundle, Loaded, RangeBundle } from "@/lib/data";

function listWithAnd(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function NightsSection({ hourly }: { hourly: Loaded<HourlySummary> }) {
  if (hourly.status === "failed") {
    return (
      <Section id="nights" eyebrow="Narrowing" title="It is not days. It is nights.">
        <Unavailable>{describeFailure(hourly.failure)}</Unavailable>
      </Section>
    );
  }

  const summary = hourly.value;
  const peak = largestHourlyGap(summary);

  return (
    <Section id="nights" eyebrow="Narrowing" title="It is not days. It is nights." wide>
      <p>
        A daily average hides where the difference sits. Split the same complaints by the hour they
        were filed and the weekend line tracks the weekday line for most of the day, then leaves it
        behind after dark.
      </p>

      <ChartFigure
        caption={`Average complaints per day by hour, ${summary.range.display}`}
        table={null}
        note={
          peak.kind === "gap" ? (
            <>
              The widest gap falls at {hourLabel(peak.hour)}:{" "}
              {formatNumber(peak.weekendAverage, 1)} complaints on a weekend day against{" "}
              {formatNumber(peak.weekdayAverage, 1)} on a weekday. The shaded band marks 10 PM
              through 3:59 AM.
            </>
          ) : (
            <>No hour shows a positive weekend-weekday gap in this period.</>
          )
        }
      >
        <HourlyLines
          hours={summary.hours}
          peak={peak}
          label={`Brooklyn by hour, ${summary.range.display}`}
        />
      </ChartFigure>

      <p>
        Hours come from the timestamp on the report, which NYC records in local time. Two days a
        year that clock is not 24 hours long — the March and November daylight-saving changes — and
        those two days are counted as if they were. The effect is about a percent on two of the
        twenty-four bars, and it is left in rather than quietly patched.
      </p>
    </Section>
  );
}

export function SaturdaySection({ nights }: { nights: Loaded<NightSummary> }) {
  if (nights.status === "failed") {
    return (
      <Section id="saturday" eyebrow="Narrowing further" title="And not every night.">
        <Unavailable>{describeFailure(nights.failure)}</Unavailable>
      </Section>
    );
  }

  const summary = nights.value;
  const peak = peakNight(summary);

  return (
    <Section id="saturday" eyebrow="Narrowing further" title="And not every night." wide>
      <p>
        If the difference lives after dark, a night is the natural unit — and a night does not stop
        at midnight. Counting 10 PM to 3:59 AM as one night, and giving those small hours to the
        evening they belong to, separates the seven nights of the week.
      </p>

      {peak.kind === "none" ? (
        <p>No night stands out in this period.</p>
      ) : (
        <>
          <p className="lede">
            <strong>{peak.night.weekday}</strong> night runs highest, at{" "}
            {formatNumber(peak.night.average, 1)} complaints per night across{" "}
            {peak.night.nightsCounted} nights.
          </p>

          <ChartFigure
            caption={`Complaints per night by night of week, ${summary.range.display}`}
            table={null}
            note={
              <>
                A night needs both halves inside the period to count, so the night before the
                period starts and the night it ends on are excluded ({listWithAnd(summary.droppedNights)}).
                Both fall on a Sunday, which is why Sunday is counted over{" "}
                {summary.nights.find((night: NightRow) => night.weekday === "Sunday")?.nightsCounted} nights
                and every other night over{" "}
                {summary.nights.find((night: NightRow) => night.weekday === "Monday")?.nightsCounted}.
              </>
            }
          >
            <NightBars summary={summary} peak={peak} />
          </ChartFigure>
        </>
      )}
    </Section>
  );
}

export function DescriptorSection({
  bundle,
  bundleStress,
  descriptor,
}: {
  bundle: DescriptorBundle;
  bundleStress: DescriptorBundle;
  descriptor: string;
}) {
  const { excess, summary } = bundle;

  if (summary.status === "failed") {
    return (
      <Section id="parties" eyebrow="Narrowing further" title="And not every kind of noise.">
        <Unavailable>{describeFailure(summary.failure)}</Unavailable>
      </Section>
    );
  }

  if (excess.kind === "no-data") {
    return (
      <Section id="parties" eyebrow="Narrowing further" title="And not every kind of noise.">
        <p>The descriptor breakdown is not available for this period.</p>
      </Section>
    );
  }

  if (excess.kind === "no-excess") {
    return (
      <Section id="parties" eyebrow="Narrowing further" title="And not every kind of noise.">
        <p>
          The peak night does not run above the {listWithAnd(["Monday", "Thursday"])} baseline in
          this period, so there is no excess to attribute to any one kind of report.
        </p>
      </Section>
    );
  }

  return (
    <Section id="parties" eyebrow="Narrowing further" title="And not every kind of noise." wide>
      <p>
        311 asks what the noise was. Comparing {excess.peakWeekday} nights against the{" "}
        {listWithAnd(excess.baselineWeekdays)} baseline, one answer moves and the others barely do.
      </p>

      <p className="lede">
        {excess.peakWeekday} nights run{" "}
        <strong>{formatNumber(excess.excessPerNight, 1)}</strong> complaints above the baseline.{" "}
        <strong>{excess.descriptor}</strong> accounts for{" "}
        <strong>{formatPercentage(excess.shareOfExcess)}</strong> of that.
      </p>

      <ChartFigure
        caption={`Complaints per night by kind of report, ${summary.value.range.display}`}
        table={null}
        note={
          <>
            Per night, not per period: the baseline is four nights a week against{" "}
            {excess.peakWeekday}&rsquo;s one, so raw totals would not be comparable.{" "}
            {excess.peakWeekday}: {formatNumber(excess.peakPerNight, 1)} complaints per night,{" "}
            {formatNumber(excess.peakDescriptorPerNight, 1)} of them {excess.descriptor}. Baseline:{" "}
            {formatNumber(excess.baselinePerNight, 1)} per night,{" "}
            {formatNumber(excess.baselineDescriptorPerNight, 1)} of them {excess.descriptor}.
          </>
        }
      >
        <DescriptorDumbbell
          summary={summary.value}
          peakWeekday={excess.peakWeekday}
          baselineWeekdays={excess.baselineWeekdays}
          highlight={descriptor}
        />
      </ChartFigure>

      {bundleStress.excess.kind === "computed" && (
        <p className="interval">
          The same calculation over a different year returns{" "}
          {formatPercentage(bundleStress.excess.shareOfExcess)}.
        </p>
      )}

      <Boundary>
        This describes what people told 311 they were hearing. It is not a measurement of what was
        happening, and a report of loud music is not evidence that a party took place.
      </Boundary>
    </Section>
  );
}

export type { RangeBundle };
