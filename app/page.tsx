/**
 * The piece. Twelve sections, one claim each, in order.
 *
 * Everything is server-rendered and present in the DOM. The only client
 * components are the guess (sections 2-3) and the borough selector (section 11),
 * both of which are enhancements over content that is already complete.
 */

import { GuessProvider } from "@/components/narrative/Guess";
import { GuessSection, HookSection, RevealSection } from "@/components/narrative/ActOpening";
import {
  DescriptorSection,
  NightsSection,
  SaturdaySection,
} from "@/components/narrative/ActPattern";
import {
  FailedExplanationsSection,
  PersistenceSection,
  WhereSection,
} from "@/components/narrative/ActPlace";
import {
  BoundariesSection,
  ExploreSection,
  MethodSection,
} from "@/components/narrative/ActClosing";
import type { ExploreBorough } from "@/components/narrative/ExploreBoroughs";
import { largestHourlyGap } from "@/lib/analysis";
import { boroughLabel } from "@/lib/config";
import { loadPageData, NARRATIVE_DESCRIPTOR, type RangeBundle } from "@/lib/data";

// Must match REVALIDATE_SECONDS in lib/socrata.ts. Next requires a literal here.
export const revalidate = 21600;

/**
 * The explore payload deliberately drops `weekdayCounts` and `weekendCounts`.
 * They are 364 numbers per borough that only the server-side bootstrap needs.
 */
function toExplorePayload(bundle: RangeBundle): ExploreBorough | null {
  if (bundle.daily.status !== "ok") {
    return null;
  }

  const summary = bundle.daily.value;
  const hourly = bundle.hourly.status === "ok" ? bundle.hourly.value : null;

  return {
    borough: bundle.borough,
    label: boroughLabel(bundle.borough),
    rangeDisplay: bundle.range.display,
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
  const explore = data.boroughs
    .map(toExplorePayload)
    .filter((entry): entry is ExploreBorough => entry !== null);

  return (
    <main id="main">
      <article>
        <GuessProvider>
          <HookSection />
          <GuessSection />
          <RevealSection bundle={data.brooklynPrimary} />
        </GuessProvider>

        <NightsSection hourly={data.brooklynPrimary.hourly} />
        <SaturdaySection nights={data.brooklynPrimary.nights} />
        <DescriptorSection
          bundle={data.descriptorsPrimary}
          bundleStress={data.descriptorsStress}
          descriptor={NARRATIVE_DESCRIPTOR}
        />

        <WhereSection boards={data.boards} boardShare={data.boardShare} />
        <PersistenceSection primary={data.brooklynPrimary} stress={data.brooklynStress} />
        <FailedExplanationsSection pageData={data} />

        <BoundariesSection pageData={data} />
        <ExploreSection boroughs={explore} />
        <MethodSection pageData={data} />
      </article>
    </main>
  );
}
