/**
 * The piece. Sixteen sections, one claim each, in the order held by
 * `lib/sections.ts`.
 *
 * The shape is two layers. Sections 2-4 are New York: all five boroughs over a
 * rolling current period, and the borough the reader picks. Section 5 hands over,
 * and 6-16 are the Brooklyn case study over two fixed years, which is where the
 * committed household denominator and the pre-registered geographic tests are.
 *
 * Everything is server-rendered and present in the DOM. The only client
 * components are the borough guess (taken in section 2, answered in section 3)
 * and the borough selector (section 4), both enhancements over content that is
 * already complete.
 */

import { GuessProvider } from "@/components/narrative/Guess";
import {
  BoroughSection,
  CaseStudySection,
  CitywideGuessSection,
  CitywideSection,
} from "@/components/narrative/ActCity";
import {
  CorpusSection,
  HookSection,
  RevealSection,
  RhythmSection,
} from "@/components/narrative/ActOpening";
import {
  DescriptorSection,
  NightsSection,
  EveryNightSection,
  SaturdaySection,
} from "@/components/narrative/ActPattern";
import {
  FailedExplanationsSection,
  PersistenceSection,
  WhereSection,
} from "@/components/narrative/ActPlace";
import { BoundariesSection, Colophon } from "@/components/narrative/ActClosing";
import type { ExploreBorough } from "@/components/narrative/ExploreBoroughs";
import { ReadingNav } from "@/components/ui/ReadingNav";
import { Reveal } from "@/components/ui/Reveal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { largestHourlyGap } from "@/lib/analysis";
import { boroughLabel } from "@/lib/config";
import { loadPageData, NARRATIVE_DESCRIPTOR, type BoroughOverview } from "@/lib/data";

// Must match REVALIDATE_SECONDS in lib/socrata.ts. Next requires a literal here.
export const revalidate = 21600;

/**
 * The profile payload for one borough. Deliberately drops the per-day counts:
 * they are 364 numbers per borough that only the server-side bootstrap needs,
 * and the citywide five never run a bootstrap at all.
 */
function toExplorePayload(overview: BoroughOverview): ExploreBorough | null {
  if (overview.daily.status !== "ok") {
    return null;
  }

  const summary = overview.daily.value;
  const hourly = overview.hourly.status === "ok" ? overview.hourly.value : null;

  return {
    borough: overview.borough,
    label: boroughLabel(overview.borough),
    rangeDisplay: overview.range.display,
    comparison: summary.comparison,
    weekdayDays: summary.weekdayDays,
    weekendDays: summary.weekendDays,
    weekdayTotal: summary.weekdayTotal,
    weekendTotal: summary.weekendTotal,
    totalComplaints: summary.totalComplaints,
    hours: hourly?.hours ?? null,
    peak: hourly ? largestHourlyGap(hourly) : { kind: "none" },
  };
}

export default async function Page() {
  const data = await loadPageData();
  const boroughs = data.citywide
    .map(toExplorePayload)
    .filter((entry): entry is ExploreBorough => entry !== null);

  return (
    <main id="main">
      <ReadingNav />
      <ThemeToggle />
      <article>
        <Reveal><HookSection /></Reveal>

        <GuessProvider>
          <Reveal><CitywideGuessSection /></Reveal>
          <Reveal>
            <CitywideSection
              rows={data.citywideRows}
              range={data.currentRange}
              fetchedAt={data.fetchedAt}
            />
          </Reveal>
        </GuessProvider>

        <Reveal><BoroughSection boroughs={boroughs} /></Reveal>
        <Reveal><CaseStudySection rows={data.citywideRows} range={data.currentRange} /></Reveal>

        <Reveal><CorpusSection bundle={data.brooklynPrimary} /></Reveal>
        <Reveal><RhythmSection bundle={data.brooklynPrimary} /></Reveal>
        <Reveal><RevealSection bundle={data.brooklynPrimary} /></Reveal>

        <Reveal><NightsSection hourly={data.brooklynPrimary.hourly} /></Reveal>
        <Reveal><SaturdaySection nights={data.brooklynPrimary.nights} /></Reveal>
        <Reveal><EveryNightSection grid={data.brooklynPrimary.nightGrid} /></Reveal>
        <Reveal>
          <DescriptorSection
            bundle={data.descriptorsPrimary}
            bundleStress={data.descriptorsStress}
            descriptor={NARRATIVE_DESCRIPTOR}
          />
        </Reveal>

        <Reveal>
          <WhereSection
            boards={data.boards}
            boardShare={data.boardShare}
            descriptors={data.descriptorsPrimary}
            descriptor={NARRATIVE_DESCRIPTOR}
          />
        </Reveal>
        <Reveal><PersistenceSection primary={data.brooklynPrimary} stress={data.brooklynStress} /></Reveal>
        <Reveal><FailedExplanationsSection pageData={data} /></Reveal>

        <Reveal><BoundariesSection pageData={data} /></Reveal>
      </article>
      <Colophon pageData={data} />
    </main>
  );
}
