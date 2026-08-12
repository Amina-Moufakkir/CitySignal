# CitySignal

**A narrative data piece about when and where New Yorkers report residential
noise to 311 — and why that is not the same as where the city is loud.**

**Read it: [citysignal-two.vercel.app](https://citysignal-two.vercel.app)**

Built on live NYC Open Data. Every figure in the piece is either recomputed from
the API on each refresh or derived from data committed to this repository, and
`METHOD.md` says which for every number.

The argument is that a count of complaints is a record of who picked up the
phone, not a measurement of sound — and that most published readings of this
dataset quietly treat the two as the same thing. The piece follows one pattern in
Brooklyn's 311 data as far as it will honestly go, and then stops where the
evidence does, which is earlier than a ranking would.

## Two live versions

The project is deliberately published twice, so the two can be read against each
other.

| | What it is | Served from |
| --- | --- | --- |
| [citysignal-two.vercel.app](https://citysignal-two.vercel.app) | The current piece. Next.js, server-rendered, fourteen sections. | Vercel, from `main` |
| [amina-moufakkir.github.io/CitySignal](https://amina-moufakkir.github.io/CitySignal/) | The original Phase 1–3 build. Static HTML, CSS and plain JavaScript, three charts in one container. | GitHub Pages, from `mvp` |

`mvp` is frozen at `de64d69`, the last commit before the Next.js migration, and
takes no backports or fixes — a preserved version that drifts is not preserved.
Its only change from that commit is a banner saying what it is and a canonical
link pointing here. `SPEC.md` records why the architecture changed and what that
decision did and did not authorise.

## Reading it

The piece runs as fourteen sections, one claim each, in order. `lib/sections.ts`
holds the running order as data — the progress bar, the dot rail, the next-links
and each section's eyebrow all read from it, so this table describes it rather
than duplicating it:

| # | Section | Claim |
| --- | --- | --- |
| 1 | Hook | This measures reporting, not noise |
| 2 | Guess | The reader commits to a number first |
| 3 | Corpus | Every day of the year, before anything is averaged |
| 4 | Rhythm | The same chart again, with the weekends picked out |
| 5 | Reveal | Weekend days run higher than weekdays |
| 6 | Nights | The difference lives after dark, not across the day |
| 7 | Saturday | And on one night of the week more than the others |
| 8 | Every night | On every one of those nights, not a few big ones |
| 9 | Parties | And in one kind of report more than the others |
| 10 | Where | Reporting rates differ across Brooklyn community boards |
| 11 | Persistence | The same shape appears in a second, non-overlapping year |
| 12 | Failed explanations | Four pre-registered explanations did not survive |
| 13 | Boundaries | What this does and does not establish |
| 14 | Explore | The reader runs the comparison for any borough |

The method is not a section. It lives in `METHOD.md`, reached from a colophon at
the foot of the page that names the dataset and when the live figures were last
pulled.

Section 12 is the centre of the piece. Four candidate explanations were written
down as predictions, each with a number attached, before the data was examined.
All four came back unsupported. That is presented as the result rather than as a
gap in it.

## Running it

```sh
npm install
npm run dev          # http://localhost:3000
```

```sh
npm test             # unit tests, no network
npm run typecheck
npm run build        # queries the live API
npm run verify:live  # checks the live API still reproduces the figures
```

Requires Node 20 or newer.

## How it is built

Next.js App Router, TypeScript, hand-rolled SVG charts. No chart library, no
scroll library, no animation library. `d3-scale` and `d3-shape` are the only
non-framework dependencies.

**Data is fetched on the server** behind a six-hour revalidation window. That is
the main technical argument for the current architecture: the page ships real
content instead of a loading state, the story is readable with JavaScript
disabled and by crawlers, and NYC Open Data sees fourteen requests per window
regardless of traffic rather than three per visitor per interaction.

```
app/                 page, layout, share image, favicon
components/charts/   hand-rolled SVG, one file per chart
components/narrative/ one file per act; sections own their copy
components/ui/       reading nav, theme toggle, scroll reveal
lib/                 analysis, queries, uncertainty, config, static data
METHOD.md            every query and every figure's provenance
scripts/             live verification
legacy/              the Phase 1-3 static build, readable without switching branch
```

### Things that are load-bearing

Four properties hold the numbers up. `AGENTS.md` states them for anyone — human
or agent — working in the repository, and tests enforce each:

1. **Dates are parsed from components into UTC.** `created_date` is a floating
   local timestamp with no zone; routing it through the host timezone would shift
   days. CI runs the suite under four timezones from UTC+14 to UTC−11.
2. **Hour and day-of-week extraction stay in the query.** Socrata reads
   `created_date` as NYC wall-clock time, which is the frame the analysis wants.
3. **Denominators come from walking the calendar**, never from counting returned
   rows, so a day with genuinely zero complaints stays in the denominator.
4. **Row validation rejects and counts. It never coerces.** `Number(null)` and
   `Number("")` are both `0` and both pass `Number.isInteger`.

A fifth is enforced by the type system rather than by a test: **absence is a
variant, not a null.** A missing comparison is `{ kind: "no-data" }`, and reading
a percentage without narrowing on `kind` is a compile error. This exists because
the previous build rendered "0.0% higher" when the API returned nothing.

## Data

NYC Open Data,
[311 Service Requests from 2010 to Present](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9)
(`erm2-nwe9`), filtered to `complaint_type = 'Noise - Residential'`. One record
is one service request. No app token is used and none is committed; tokens raise
Socrata's rate limit but do not belong in client code or in Git.

Two periods, each 52 complete Monday-to-Sunday weeks — so each holds exactly 260
weekdays and 104 weekend days, and neither is skewed by a partial week:

- **Primary:** 2024-01-01 through 2024-12-29
- **Stress:** 2025-01-06 through 2026-01-04

They share no days.

Community-board normalization uses 2024 ACS 5-year occupied-household estimates
aggregated to DCP Community District Tabulation Areas. That dataset is committed
and static; everything else is live.

## What the piece does not claim

These are product requirements, not disclaimers, and they are in `SPEC.md`:

- 311 complaints are reports, not measured noise.
- Nothing here establishes causation.
- Complaint counts are not unique noise incidents — one address can generate
  several reports on one night.
- Community-board normalization exists only for Brooklyn.
- Nothing identifies a resident or a building, and nothing implies neighbourhood
  quality.
- The assumed reader — someone at a community board or in city operations —
  has never been validated with an actual such reader.

---

# Analysis history

The piece is the current product. The investigation behind it ran in phases, and
the record below is kept because the method is the point. `METHOD.md`
maps every figure named here to its source, and marks the ones that cannot
currently be reproduced from committed code.

## Phase 1 — Hypothesis-driven exploration

Initial question: are Brooklyn `Noise - Residential` complaints more frequent per
day on weekends than weekdays?

Weekend complaints averaged **+77.8%** per day over weekdays in the primary 2024
range. Stress tests: **+76.3%** over a different range, **+60.9%** for Manhattan
over the same 2024 range.

The pattern is repeatable and not unique to Brooklyn — and it measures 311
reporting behaviour, not noise levels or causation.

## Phase 2 — From finding to insight

- **Time of day:** late-night hours (10 PM–3:59 AM) accounted for most of the
  weekend-versus-weekday increase.
- **Behavioural evening:** reassigning 12 AM–3:59 AM complaints to the previous
  evening strengthened the weekend-night effect to **+127.3%** (primary) and
  **+126.2%** (stress).
- **Day of week:** Saturday night was the strongest night in both periods.
- **Descriptor:** `Loud Music/Party` accounted for **96.4%** of the
  Saturday-versus-Monday–Thursday excess in the primary range and **93.7%** in
  the stress range.
- **Geographic concentration:** a pre-registered hypothesis that the top three
  valid Brooklyn community boards would account for at least 40% of Saturday-night
  `Loud Music/Party` complaints was **not supported** — 38.0% primary, 37.7%
  stress. Boards 01 and 04 stayed high-volume, but the pattern was distributed.

The night attribution and the descriptor decomposition are now implemented in
`lib/analysis.ts` and recomputed live; both reproduce the figures above exactly.

## Phase 3 — Normalize and compare

Raw geographic counts mislead when boards differ in size, so Saturday-night
`Loud Music/Party` complaints were normalized by 2024 ACS 5-year estimates
aggregated to Brooklyn CDTAs.

Pre-registered normalization test: after household normalization, at least one of
CB01 or CB04 would fall outside the top five. **Not supported.** CB04 remained #1
at **30.6** complaints per 1,000 occupied households and CB01 stayed near the
top. A population-based sensitivity check and the stress period both preserved
the result.

Alternative explanations tested, and what happened:

- **Residential density** showed only a weak association with normalized rates
  and did not explain BK04.
- **On-premises alcohol-licence exposure** showed a very weak relationship and
  did not explain BK04.
- **Repeated locations:** a pre-registered hypothesis was not supported — the top
  ten valid BBL locations accounted for only **10.4%** of BK04 complaints in the
  primary period and **8.4%** in the stress period.
- Roughly **78–81%** of valid BBL locations appeared on only one Saturday night.
- Same-location, same-night bursts were still meaningful, so complaint counts
  must not be read as unique noise incidents.

**Conclusion.** BK04's high Saturday-night residential-noise reporting rate
persists after accounting for household size, residential density,
nightlife-licence exposure, and repeated-location concentration. Complaints are
distributed across hundreds of residential tax lots, with some same-night bursts.

**Limitations.** CDTAs approximate but are not identical to legal
community-district boundaries. The ACS denominator is a 2024 five-year estimate
while the stress complaint period extends into 2025 and early 2026.

## Phase 4 — The narrative product

The dashboard became a sequential piece, and the architecture changed with it.
`SPEC.md` records that decision and its reasoning.

Three figures that Phase 2–3 produced but never committed are now recomputed live
from committed code: the two descriptor decompositions (96.4% and 93.7%) and the
top-three concentration (38.0%). Nine remain recorded rather than reproducible;
`METHOD.md` lists exactly which.

Confidence intervals were added. The top-three concentration test is the
interesting case: at 38.0% with a 95% interval of roughly 37.0–38.9%, it sits
entirely below its pre-registered 40% threshold — but that interval treats every
complaint as independent, and complaints cluster within nights and addresses. The
night-level data needed to compute the correct, wider interval is not committed.

## Repository layout

`SPEC.md` owns product requirements and scope. `README.md` owns explanation,
method, and this history. `AGENTS.md` tells coding agents how to work here and
defers to `SPEC.md`. `METHOD.md` owns figure provenance. Implementation
details live in code and tests.

### Branches

- **`main`** — the narrative piece. Deployed to Vercel. This is the project.
- **`mvp`** — the Phase 1–3 static build, frozen at `de64d69`. Served by GitHub
  Pages. Takes no changes.

The old build therefore exists in three places, which is deliberate rather than
untidy, because each is reachable a different way: `mvp` runs it, `legacy/` makes
it readable in a checkout of `main` without switching branch, and the history
before `40948f2` has it at the repository root where it was originally written.

## Licence

MIT — see `LICENSE`. The 311 and ACS data are published by the City of New York
and the U.S. Census Bureau respectively and are not covered by it.
