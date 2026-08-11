# CitySignal

CitySignal tests one narrow hypothesis against NYC 311 complaint data before adding any dashboard features.

## Research Question

Are `Noise - Residential` complaints in Brooklyn more frequent per day on weekends than on weekdays?

## Hypothesis

Brooklyn receives a higher average number of residential noise complaints per day on weekends than on weekdays.

## Dataset

The project uses NYC Open Data's 311 Service Requests from 2010 to Present dataset:

- Dataset ID: `erm2-nwe9`
- API endpoint: `https://data.cityofnewyork.us/resource/erm2-nwe9.json`

One source record represents one 311 service request. For this analysis, each record is treated as one complaint report, not as a direct measurement of actual noise.

## API Approach

The app does not fetch the full 311 dataset. It asks Socrata for daily aggregate counts using only the fields needed for this hypothesis:

- `created_date`
- `complaint_type`
- `borough`

The query filters to:

- `borough = 'BROOKLYN'`
- `complaint_type = 'Noise - Residential'`

It groups by calendar day with `date_trunc_ymd(created_date)` and requests rows shaped like:

```json
{ "day": "2024-01-01T00:00:00.000", "complaints": "437" }
```

Socrata returns aggregate values as strings, so the app validates and parses them before analysis. Malformed aggregate rows are rejected, counted, and excluded from calculations; they are not silently coerced.

No NYC Open Data app token is used. Tokens are optional for higher Socrata rate limits, but they should not be hardcoded in browser code or committed to Git.

## Date Ranges

The primary range is `2024-01-01` through `2024-12-29`.

The stress-test range is `2025-01-06` through `2026-01-04`.

Both ranges are 52 complete Monday-Sunday weeks, giving 260 weekdays and 104 weekend days.

## Finding

In both tested ranges, the average number of Brooklyn `Noise - Residential` 311 complaints per day is higher on weekends than on weekdays.

This supports a difference in 311 residential noise complaint rates for the tested periods. It does not prove that actual noise levels are higher on weekends, and it does not establish a causal explanation for the complaint pattern.

## Run the App

Start a simple local HTTP server from the project directory:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Run Tests

Run deterministic unit tests:

```sh
node --test
```

Run the live verification script, which fetches current aggregated daily counts from NYC Open Data and reproduces the displayed metrics:

```sh
node verify-live.js
```
