# CitySignal Product Specification

## Product Status

CitySignal is transitioning from a hypothesis-driven data-analysis visualization into a focused decision-support tool.

The historical analysis, methodology, and evidence trail remain documented in `README.md`. This specification defines the product contract for Phase 4 forward.

## Primary User

Assumed primary user: NYC community board / city operations staff.

This user need is a project assumption. It has not been validated through direct user interviews, workflow observation, or formal user research. CitySignal must not describe the user problem as validated until that evidence exists.

## Core Decision

CitySignal should help the user answer:

> Does this 311 complaint-reporting pattern deserve closer investigation?

CitySignal does not decide what enforcement, intervention, outreach, staffing, or agency response should occur. The human user retains the decision.

## Product Purpose

CitySignal is a focused interpretation layer over public 311 data.

It is not a replacement for:

- NYC 311 Reporting
- NYC Open Data
- existing municipal reporting tools
- official agency case-management or service-delivery systems

CitySignal's job is to help a user distinguish potentially meaningful recurring reporting patterns from raw complaint volume.

## Minimum Decision Model

A decision view should help the user evaluate five signals:

1. Unusualness: Is the pattern elevated relative to an appropriate comparison baseline?
2. Specificity: When and where is the difference concentrated?
3. Persistence: Does the pattern survive another comparable period?
4. Volume: Is there enough underlying complaint volume that the comparison is not obviously driven by tiny counts?
5. Interpretation boundary: What does the evidence not establish?

CitySignal must not define a universal numeric threshold, risk score, or automatic investigate / do not investigate classification unless a future approved analysis justifies one. The product should support judgment, not replace it.

## Context-Dependent Evidence

Not every comparison requires the same supporting evidence.

Normalization is required when comparing geographies with materially different population, household, or housing-unit size. It is not universally required for every comparison.

Descriptor, day-of-week detail, density, nightlife exposure, and repeated-location concentration are diagnostic evidence. They are not universally required inputs to the initial decision. They may help investigate or explain a signal after it has been identified.

## Current Supported Capabilities

The CitySignal product surface is a sequential narrative of fourteen sections, one
claim each, presented in order. The running order is held as data in
`lib/sections.ts` and is the single source of truth for what the piece contains.
It supports:

- the unaggregated daily corpus, shown before anything is averaged
- live weekday/weekend comparison, with a confidence interval
- live hour-of-day comparison
- live night-of-week comparison, using a stated night definition and calendar-counted denominators
- every night of the peak weekday shown individually, rather than only their average, so a reader can see whether the pattern is weekly or carried by outliers
- live descriptor decomposition of the peak night against a baseline
- live persistence check across a second, non-overlapping period
- Brooklyn-only household-normalized community-board comparison, from a static extract
- a record of pre-registered hypotheses that were not supported, each labelled with its source
- reader-run borough comparison, from data already computed on the server
- explicit interpretation boundaries, as their own section rather than as footnotes
- a colophon naming the dataset and the last live refresh, linking to the method

The method is not a section of the piece. The queries, the date handling, the
bootstraps and the figure provenance live in `METHOD.md`. Moving them off the
page does not weaken the requirement that the work be checkable: `METHOD.md` is
linked from the colophon and remains a release requirement.

The decision model's five signals map onto this surface as follows. Phases 1-3
left three of the five unserved; all five are now present:

| Signal | Where |
| --- | --- |
| Unusualness | Weekday baseline comparison, with interval |
| Specificity | Hour, night of week, descriptor, community board |
| Persistence | Second non-overlapping period, computed live |
| Volume | Underlying complaint counts stated in the prose, not only rates |
| Interpretation boundary | Its own section, plus per-section boundaries |

## Current Limitations

CitySignal must preserve these limitations in product behavior and copy:

- 311 complaints represent reporting behavior, not measured noise levels.
- CitySignal does not establish causation.
- Complaint counts are not unique noise incidents.
- Community-board normalization currently exists only for Brooklyn.
- The assumed user need has not been directly validated.
- CitySignal must not identify problematic residents or buildings.
- CitySignal must not imply neighborhood quality.

## Near-Term Product Requirements

The next product iteration should prioritize:

- comparison against an appropriate baseline
- timing specificity
- geographic specificity where supported
- persistence across a comparable period
- underlying volume context
- clear interpretation boundaries

Exact UI components are intentionally not specified here unless required by product behavior. Interface decisions should follow the decision model rather than expand into a general dashboard by default.

## Out Of Scope

For the current phase, CitySignal should not include:

- address search
- exact complaint-location maps
- automated risk scores
- automated enforcement recommendations
- causal explanations
- AI-generated conclusions
- generalized dashboard/filter expansion
- further framework migration (see Phase 4 Architecture Decision)

## Architecture

CitySignal is a Next.js (App Router) application written in TypeScript, rendered on the server and deployed to Vercel.

Architecture should only change if future approved product requirements demonstrate that the current architecture is inadequate. The Phase 4 change is recorded below rather than left implicit.

### Phase 4 Architecture Decision

Phases 1-3 specified a static HTML/CSS/plain-JavaScript architecture, and this specification previously instructed that it be preserved unless a future approved product requirement demonstrated it was inadequate. The Phase 4 narrative requirement is that demonstration.

**Decision.** The plain-JavaScript requirement is superseded. CitySignal is now Next.js (App Router) + TypeScript, server-rendered, deployed to Vercel. The `Out Of Scope` entry formerly reading `framework migration` is amended to `further framework migration`: this specific migration is approved, and the prohibition on migrating again stands.

**Reasoning.**

1. *The product changed shape.* Phases 1-3 produced a dashboard: three charts rendered at once into a single container by replacing `innerHTML`, leaving the reader to assemble the argument. Phase 4 is a sequential narrative in which each section makes one claim and later evidence must not appear early. Ordered, independently addressable sections are the requirement; component composition expresses that directly and string-templated `innerHTML` does not.

2. *Server-side data fetching removes a class of defects rather than patching them.* The static build shipped an empty page holding a permanent loading state, was invisible to crawlers and to clients without JavaScript, and issued three unauthenticated Socrata requests per visitor per interaction. Fetching on the server with revalidation ships real content in the initial response, makes the narrative readable without JavaScript, and reduces upstream load to a fixed number of requests per revalidation window regardless of traffic. That last point also removes most of the rate-limit exposure that the static build had no defence against.

3. *Types can enforce product requirements that comments cannot.* An absent comparison is now a variant of a discriminated union rather than `null`. The defect recorded as REVIEW.md B1 - rendering "0.0% higher" when the API returned no data - cannot be reintroduced without a compile error. This is the strongest available guarantee that an interpretation boundary survives future edits.

**What did not change.** The analysis is ported, not rewritten. Date handling remains UTC-only and parsed from components; hour-of-day extraction remains delegated to Socrata's `date_extract_hh`; denominators still come from walking the calendar rather than counting returned rows; row validation still rejects and counts rather than coercing. The product guardrails in `Out Of Scope` and `Current Limitations` are unaffected by this decision and continue to bind.

**What this decision does not authorise.** It does not authorise adopting a component chart library, a scroll-jacking library, an animation library, or a state-management library. It does not authorise expanding the product surface beyond the decision model. It does not weaken any interpretation boundary for the sake of narrative pacing.

**Preserved for reference.** The Phase 1-3 static build is retained unmodified in `legacy/` and on the `main` branch.

## Source-Of-Truth Boundaries

- `SPEC.md` owns product requirements and product scope.
- `README.md` owns project explanation, analysis history, methodology, setup, and evidence trail.
- Implementation details remain in code and tests.
- A future `AGENTS.md`, if added, should instruct coding agents how to work in the repository and defer to `SPEC.md` for product requirements.
