# Method

How CitySignal is built, every query it runs, and where each number comes from.

This file exists because the project's strongest claim is its method, and a
method that cannot be re-run is an assertion. The piece itself carries only the
source, the two periods and the night definition; everything technical is here,
where it can be read at length instead of skimmed past. Each live query below is
the exact string the code builds — `lib/queries.test.ts` fails if this document
and `lib/socrata.ts` ever disagree, so it cannot drift.

The URLs are shown decoded for readability. `+` is a literal space. Pasting one
into a browser works; `curl --get --data-urlencode` is shown for the shell.

---

## Live queries

All three filter to `complaint_type = 'Noise - Residential'` on dataset
`erm2-nwe9`, and all are half-open on time: `>= start`, `< endExclusive`. No app
token is used, so these are subject to Socrata's unauthenticated rate limit.

### 1. Daily counts

Feeds the daily corpus charts (sections 3 and 4) and the weekday/weekend
comparison (sections 5, 11 and 14) with its bootstrap interval. One row per
calendar day with at least one complaint; at most 364 rows per range, against a
5,000 limit.

```
https://data.cityofnewyork.us/resource/erm2-nwe9.json?$select=date_trunc_ymd(created_date)+AS+day,+count(*)+AS+complaints&$where=borough='BROOKLYN'+AND+complaint_type='Noise+-+Residential'+AND+created_date+>=+'2024-01-01T00:00:00'+AND+created_date+<+'2024-12-30T00:00:00'&$group=date_trunc_ymd(created_date)&$order=day&$limit=5000
```

Expected row shape — note every value is a string:

```json
{ "day": "2024-01-01T00:00:00.000", "complaints": "437" }
```

### 2. Hourly counts

Feeds the hour-of-day chart (sections 6 and 14) and, from the same response, the
night-of-week summary (section 7) and the night grid (section 8). Fetched once
per range and used three times. At most 364 × 24 = 8,736 rows, against a 10,000
limit.

```
https://data.cityofnewyork.us/resource/erm2-nwe9.json?$select=date_trunc_ymd(created_date)+AS+day,+date_extract_hh(created_date)+AS+hour,+count(*)+AS+complaints&$where=borough='BROOKLYN'+AND+complaint_type='Noise+-+Residential'+AND+created_date+>=+'2024-01-01T00:00:00'+AND+created_date+<+'2024-12-30T00:00:00'&$group=date_trunc_ymd(created_date),+date_extract_hh(created_date)&$order=day,+hour&$limit=10000
```

```json
{ "day": "2024-01-01T00:00:00.000", "hour": "22", "complaints": "31" }
```

### 3. Descriptor by night

Feeds the descriptor decomposition (section 9). Grouped by day of week rather
than calendar day, which is what keeps it to 169 rows instead of roughly 10,900.

```
https://data.cityofnewyork.us/resource/erm2-nwe9.json?$select=descriptor,+date_extract_dow(created_date)+AS+dow,+date_extract_hh(created_date)+AS+hour,+count(*)+AS+complaints&$where=borough='BROOKLYN'+AND+complaint_type='Noise+-+Residential'+AND+created_date+>=+'2024-01-01T00:00:00'+AND+created_date+<+'2024-12-30T00:00:00'+AND+(date_extract_hh(created_date)+>=+22+OR+date_extract_hh(created_date)+<+4)&$group=descriptor,+date_extract_dow(created_date),+date_extract_hh(created_date)&$order=dow,+hour&$limit=2000
```

```json
{ "descriptor": "Loud Music/Party", "dow": "0", "hour": "0", "complaints": "2286" }
```

`date_extract_dow` returns 0 for Sunday through 6 for Saturday.

**Why grouping by day of week is safe here and nowhere else.** Losing the
calendar day means the two incomplete boundary nights cannot be excluded from
these totals. That does not affect this query's use, because in both configured
ranges those two nights are Sunday nights, and neither the peak night nor the
Monday–Thursday baseline is Sunday. That is asserted in
`lib/descriptors.test.ts`, not assumed.

### Substitutions

| Change | Replace |
| --- | --- |
| Stress period | `2024-01-01` → `2025-01-06`, `2024-12-30` → `2026-01-05` |
| Another borough | `BROOKLYN` → `MANHATTAN`, `QUEENS`, `BRONX`, `STATEN ISLAND` |

The stress-period daily query in full:

```
https://data.cityofnewyork.us/resource/erm2-nwe9.json?$select=date_trunc_ymd(created_date)+AS+day,+count(*)+AS+complaints&$where=borough='BROOKLYN'+AND+complaint_type='Noise+-+Residential'+AND+created_date+>=+'2025-01-06T00:00:00'+AND+created_date+<+'2026-01-05T00:00:00'&$group=date_trunc_ymd(created_date)&$order=day&$limit=5000
```

### Running one by hand

```sh
curl --get 'https://data.cityofnewyork.us/resource/erm2-nwe9.json' \
  --data-urlencode '$select=date_trunc_ymd(created_date) AS day, count(*) AS complaints' \
  --data-urlencode "\$where=borough='BROOKLYN' AND complaint_type='Noise - Residential' AND created_date >= '2024-01-01T00:00:00' AND created_date < '2024-12-30T00:00:00'" \
  --data-urlencode '$group=date_trunc_ymd(created_date)' \
  --data-urlencode '$order=day' \
  --data-urlencode '$limit=5000'
```

Or reproduce the whole page's live figures at once:

```sh
npm run verify:live
```

### Request budget

Fourteen upstream requests per revalidation window, regardless of traffic:
Brooklyn daily and hourly for both ranges (4), Brooklyn descriptor-by-night for
both ranges (2), and the other four boroughs daily and hourly for the primary
range (8). The window is 6 hours.

### Not queried

`inspectUrl` in the Phase 1–3 build issued a third request per page load whose
response was never displayed. It is not ported. No query requests complaint
descriptions, addresses, BBLs, or any record-level field: every request is an
aggregate count.

---

## Static datasets

### Brooklyn community boards

`lib/static-data.ts`, `PHASE3_BOARD_DATASET` — 18 rows of
`{ board, occupiedHouseholds, saturdayNightComplaints }`.

| Field | Value |
| --- | --- |
| Numerator | Saturday-night `Loud Music/Party` complaints |
| Complaint period | 2024-01-01 through 2024-12-29 |
| Denominator | 2024 ACS 5-year estimates, occupied households, aggregated to DCP CDTAs |
| Extraction date | **not recorded** |
| Known limitation | CDTAs approximate but are not identical to legal community-district boundaries, so numerator and denominator are drawn on slightly different geographies |

The join between 311 `community_board` values and CDTA-aggregated ACS estimates
was performed in the Phase 3 analysis and is not committed here. No crosswalk
file exists in this repository, and there is no record of how records with a
missing or invalid `community_board` were treated.

---

## Figure provenance

Every number that appears in the piece or in `README.md`.

`§N` is a position in the running order, which is held as data in
`lib/sections.ts`. That file is the source of truth for what the piece contains
and in what order; if a section is added or removed there, these references move
with it.

**Live** — recomputed from the queries above on every revalidation.
**Committed** — derived at runtime from data in this repository.
**Phase 2–3** — recorded from an analysis that is not committed here.

| Figure | Where | Source | How to reproduce |
| --- | --- | --- | --- |
| Daily counts in calendar order, spread and median | §3, §4 | Live | Query 1 → `buildDailySeries` |
| Weekday and weekend daily means | §5, §11, §14 | Live | Query 1 → `summarize` |
| Weekend difference, primary (~+77.8%) | §5 | Live | Query 1 |
| Weekend difference, stress (~+76.3%) | §11 | Live | Query 1, stress range |
| 95% intervals on both | §5, §11 | Live | `bootstrapPercentageDifference`, seeded |
| Complaint totals and day counts | §5, §11, §13 | Live | Query 1 |
| Hour-of-day averages, peak hour and gap | §6, §14 | Live | Query 2 → `summarizeHourly` |
| Complaints per night by night of week | §7 | Live | Query 2 → `summarizeNights` |
| Peak night (Saturday) | §7, §8, §9 | Live | `peakNight` — derived, not assumed |
| Nights counted (52 Mon–Sat, 51 Sun) | §7, §8 | Live | `countCompleteNights` |
| Every peak night hour by hour; busiest, quietest, median | §8 | Live | Query 2 → `buildNightGrid` |
| Loud Music/Party share of excess, primary (96.4%) | §9 | Live | Query 3 → `descriptorExcess` |
| Loud Music/Party share of excess, stress (93.7%) | §9 | Live | Query 3, stress range |
| Complaints per 1,000 households, all 18 boards | §10 | Committed | `buildBoardRates` |
| BK04 at 30.6 per 1,000 | §10 | Committed | 1394 / 45491 × 1000 |
| Top-three share, 38.0% | §10, §12 | Committed | `topBoardShare(3)` |
| Interval on the top-three share | §12 | Committed | `bootstrapTopShare`, seeded |
| Density association | §12 | Phase 2–3 | Not reproducible here |
| Alcohol-licence association | §12 | Phase 2–3 | Not reproducible here |
| Top-10 BBL share, 10.4% / 8.4% | §12 | Phase 2–3 | Not reproducible here |
| Single-night location share, 78–81% | §12 | Phase 2–3 | Not reproducible here |
| Top-three share, stress period, 37.7% | §12 | Phase 2–3 | Not reproducible here |
| Manhattan +60.9%, 2024 | README | Phase 2–3 | Query 1 with `MANHATTAN` gives the current value |
| Behavioural-evening effect, +127.3% / +126.2% | README | Phase 2–3 | Not reproducible here |
| Population-normalized sensitivity check | README | Phase 2–3 | Not reproducible here |

### What is missing, stated plainly

Nine figures above have no committed derivation. They were computed during
Phases 2 and 3 in analyses that were never added to this repository, and this
document records that rather than leaving a reader to discover it. Committing the
night × board grid used in Phase 3 would make two of them reproducible, and would
additionally allow the §12 interval to be computed on the correct
resampling unit — complaints cluster within nights, so the interval currently
shown is narrower than the data warrants.

---

## Method notes that affect the numbers

- **Timezone.** `created_date` is a floating local timestamp with no zone. Every
  date is parsed from its components into UTC and never through the host
  timezone; hour and day-of-week come from Socrata, which reads the timestamp as
  NYC wall-clock time. CI runs the suite under four timezones spanning UTC+14 to
  UTC−11 to keep it that way.
- **Daylight saving.** Two days a year are not 24 hours long in local time.
  2024-11-03 has two 1 AM hours and 2024-03-10 has none at 2 AM. Both are
  Sundays, both are counted on a 24-hour grid, and the effect is roughly one
  percent on two hourly buckets. Disclosed, not adjusted.
- **Denominators.** Counted by walking the calendar, never by counting returned
  rows, so a day with genuinely zero complaints stays in the denominator.
- **Validation.** Aggregate rows are rejected and counted, never coerced.
  `Number(null)` and `Number("")` are both `0` and both pass `Number.isInteger`,
  so the explicit null and empty-string guards are load-bearing.
### Bootstraps

Both intervals are percentile bootstraps. Randomness comes from a seeded
xorshift32 generator rather than `Math.random`, so an interval is reproducible
from the committed code, stable across CI runs, and pinnable in a test. The seed
and the draw count are part of the method, not an implementation detail:
**2,000 draws, seed 20,240,101**, 95% level, in `lib/uncertainty.ts`.

**The weekday/weekend difference** resamples days within each day type — 260
weekday draws and 104 weekend draws per iteration, with replacement — and
recomputes the percentage difference of the two means each time. A draw whose
weekday sample sums to zero has no ratio and is skipped; if more than half the
draws were skipped the interval is reported as unavailable rather than
fabricated. With real data this never occurs.

**The top-three board share** resamples complaints, not boards: 9,944 draws from
the observed board proportions per iteration. The top three are **re-selected on
every draw**, which matches how the hypothesis was written ("the top three boards
would account for at least 40%") rather than fixing the three boards that
happened to win. That makes it a slightly higher and more honest estimate than
holding BK04, BK01 and BK05 fixed.

Both estimators assume independent resampling units, and both are therefore
narrower than the truth:

- Daily counts are seasonal and autocorrelated, so resampling days independently
  understates variance.
- Complaints cluster within nights and within addresses, so resampling complaints
  independently understates it considerably. The clustered alternative needs
  night-level board counts, which are not committed to this repository. As a
  sense of scale: the complaint-level interval on the top-three share is roughly
  ±1 point, and it would need to be about ±2 to reach the 40% threshold — a
  variance inflation of about 4.5, which an intra-night correlation of only about
  0.02 would produce. That is small enough to be plausible, which is why the
  piece says the test points below the threshold rather than that it settles it.

### Daylight saving

`created_date` is NYC wall-clock time, so two days a year are not 24 hours long
and the hourly grid does not adjust for it:

- **2024-03-10**, the spring transition. There is no 02:00 hour. That bucket
  receives nothing, but the 104-weekend-day denominator is unchanged, so the
  hour-2 weekend average is diluted by roughly 1/104.
- **2024-11-03**, the autumn transition. The 01:00 hour occurs twice, so that
  bucket holds two real hours of complaints for that one day, inflating the
  hour-1 weekend average by roughly the same amount.

Both fall on a Sunday, so the effect is confined to the weekend series and to two
of twenty-four hours. It does not touch the daily comparison at all. It is
disclosed next to the chart it affects rather than corrected, because correcting
it would mean inventing a value for an hour that did not happen.
