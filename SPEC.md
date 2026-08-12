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

The currently validated CitySignal product surface supports:

- live borough weekday/weekend comparison
- live borough hourly comparison
- selected-borough insight derived from live daily and hourly results
- Brooklyn-only household-normalized community-board comparison
- explicit interpretation boundaries

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
- framework migration

## Architecture

Preserve the current static HTML/CSS/plain-JavaScript architecture.

Architecture should only change if future approved product requirements demonstrate that the current architecture is inadequate.

## Source-Of-Truth Boundaries

- `SPEC.md` owns product requirements and product scope.
- `README.md` owns project explanation, analysis history, methodology, setup, and evidence trail.
- Implementation details remain in code and tests.
- A future `AGENTS.md`, if added, should instruct coding agents how to work in the repository and defer to `SPEC.md` for product requirements.
