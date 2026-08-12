const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BOROUGHS,
  DEFAULT_BOROUGH,
  PHASE3_BOARD_DATASET,
  createRequestTracker,
  dailyUrl,
  buildBoardRates,
  hourLabel,
  hourlyUrl,
  isWeekendDay,
  largestHourlyGap,
  normalizeDailyRows,
  normalizeHourlyRows,
  normalizeBorough,
  possessiveLabel,
  summarize,
  summarizeHourly,
  showsBrooklynDeepDive,
  whereClause,
} = require("./app");

const inspectRow = {
  total_records: "0",
  records_with_created_date: "0",
  records_with_complaint_type: "0",
  records_with_borough: "0",
  min_created_date: null,
  max_created_date: null,
};

test("classifies weekdays and weekends by calendar day", () => {
  assert.equal(isWeekendDay("2024-01-01"), false);
  assert.equal(isWeekendDay("2024-01-05"), false);
  assert.equal(isWeekendDay("2024-01-06"), true);
  assert.equal(isWeekendDay("2024-01-07"), true);
});

test("defines exactly five valid borough choices", () => {
  assert.deepEqual(
    BOROUGHS.map((borough) => borough.value),
    ["BROOKLYN", "MANHATTAN", "QUEENS", "BRONX", "STATEN ISLAND"],
  );
});

test("constructs borough-specific daily and hourly URLs", () => {
  for (const borough of BOROUGHS) {
    const daily = decodeURIComponent(
      dailyUrl({ start: "2024-01-01", endExclusive: "2024-01-08" }, borough.value),
    ).replace(/\+/g, " ");
    const hourly = decodeURIComponent(
      hourlyUrl({ start: "2024-01-01", endExclusive: "2024-01-08" }, borough.value),
    ).replace(/\+/g, " ");

    assert.match(daily, new RegExp(`borough='${borough.value}'`));
    assert.match(hourly, new RegExp(`borough='${borough.value}'`));
    assert.match(daily, /complaint_type='Noise - Residential'/);
    assert.match(hourly, /date_extract_hh\(created_date\) AS hour/);
  }
});

test("falls back to Brooklyn for invalid borough values", () => {
  assert.equal(normalizeBorough("BROOKLYNN"), DEFAULT_BOROUGH);
  assert.match(whereClause({ start: "2024-01-01", endExclusive: "2024-01-08" }, "BROOKLYNN"), /borough='BROOKLYN'/);
});

test("fills missing calendar days with zero complaints", () => {
  const summary = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", complaints: "4" },
    ],
    inspectRow,
  );

  assert.equal(summary.weekdayDays, 5);
  assert.equal(summary.weekendDays, 2);
  assert.equal(summary.zeroDaysFilled, 5);
  assert.equal(summary.weekdayTotal, 10);
  assert.equal(summary.weekendTotal, 4);
});

test("calculates averages per observed calendar day", () => {
  const summary = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-02T00:00:00.000", complaints: "15" },
      { day: "2024-01-06T00:00:00.000", complaints: "8" },
      { day: "2024-01-07T00:00:00.000", complaints: "12" },
    ],
    inspectRow,
  );

  assert.equal(summary.weekdayDays, 5);
  assert.equal(summary.weekendDays, 2);
  assert.equal(summary.weekdayAverage, 5);
  assert.equal(summary.weekendAverage, 10);
});

test("summary calculations are independent of borough-specific URL construction", () => {
  const range = { start: "2024-01-01", endExclusive: "2024-01-08" };
  const rows = [
    { day: "2024-01-01T00:00:00.000", complaints: "10" },
    { day: "2024-01-06T00:00:00.000", complaints: "20" },
  ];
  const brooklyn = summarize(range, rows, inspectRow, "BROOKLYN");
  const queens = summarize(range, rows, inspectRow, "QUEENS");

  assert.equal(brooklyn.weekdayAverage, queens.weekdayAverage);
  assert.equal(brooklyn.weekendAverage, queens.weekendAverage);
  assert.notEqual(brooklyn.dailyUrl, queens.dailyUrl);
});

test("calculates percentage difference from weekday average", () => {
  const summary = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "25" },
      { day: "2024-01-06T00:00:00.000", complaints: "20" },
      { day: "2024-01-07T00:00:00.000", complaints: "20" },
    ],
    inspectRow,
  );

  assert.equal(summary.weekdayAverage, 5);
  assert.equal(summary.weekendAverage, 20);
  assert.equal(summary.percentageDifference, 300);
});

test("sets hypothesis support only when weekend average is higher", () => {
  const supported = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "5" },
      { day: "2024-01-06T00:00:00.000", complaints: "20" },
    ],
    inspectRow,
  );
  const equal = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", complaints: "4" },
    ],
    inspectRow,
  );
  const lower = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [
      { day: "2024-01-01T00:00:00.000", complaints: "50" },
      { day: "2024-01-06T00:00:00.000", complaints: "2" },
    ],
    inspectRow,
  );

  assert.equal(supported.supported, true);
  assert.equal(equal.weekdayAverage, equal.weekendAverage);
  assert.equal(equal.supported, false);
  assert.equal(lower.supported, false);
});

test("handles empty API responses without NaN metrics", () => {
  const summary = summarize(
    { start: "2024-01-01", endExclusive: "2024-01-08" },
    [],
    inspectRow,
  );

  assert.equal(summary.weekdayTotal, 0);
  assert.equal(summary.weekendTotal, 0);
  assert.equal(summary.weekdayAverage, 0);
  assert.equal(summary.weekendAverage, 0);
  assert.equal(summary.percentageDifference, null);
  assert.equal(summary.supported, false);
  assert.equal(summary.zeroDaysFilled, 7);
});

test("rejects malformed aggregate rows and continues with valid rows", () => {
  const range = { start: "2024-01-01", endExclusive: "2024-01-08" };
  const rows = [
    { day: "2024-01-01T00:00:00.000", complaints: "10" },
    { complaints: "3" },
    { day: "not-a-date", complaints: "3" },
    { day: "2024-13-40T00:00:00.000", complaints: "3" },
    { day: "2024-01-02T00:00:00.000" },
    { day: "2024-01-03T00:00:00.000", complaints: "abc" },
    { day: "2024-01-04T00:00:00.000", complaints: "-1" },
    { day: "2024-01-09T00:00:00.000", complaints: "5" },
    null,
  ];

  const normalized = normalizeDailyRows(rows, range);
  const summary = summarize(range, rows, inspectRow);

  assert.equal(normalized.rejectedRows, 8);
  assert.equal(summary.rejectedRows, 8);
  assert.equal(summary.weekdayTotal, 10);
  assert.equal(summary.weekendTotal, 0);
});

test("hourly summaries classify days locally and fill missing day-hour cells", () => {
  const range = { start: "2024-01-01", endExclusive: "2024-01-08" };
  const rows = [
    { day: "2024-01-01T00:00:00.000", hour: "0", complaints: "10" },
    { day: "2024-01-06T00:00:00.000", hour: "0", complaints: "8" },
    { day: "2024-01-07T00:00:00.000", hour: "0", complaints: "12" },
    { day: "2024-01-06T00:00:00.000", hour: "23", complaints: "4" },
  ];

  const summary = summarizeHourly(range, rows);

  assert.equal(summary.weekdayDays, 5);
  assert.equal(summary.weekendDays, 2);
  assert.equal(summary.zeroCellsFilled, 7 * 24 - 4);
  assert.equal(summary.hours[0].weekdayAverage, 2);
  assert.equal(summary.hours[0].weekendAverage, 10);
  assert.equal(summary.hours[23].weekdayAverage, 0);
  assert.equal(summary.hours[23].weekendAverage, 2);
});

test("rejects malformed hourly aggregate rows", () => {
  const range = { start: "2024-01-01", endExclusive: "2024-01-08" };
  const rows = [
    { day: "2024-01-01T00:00:00.000", hour: "0", complaints: "10" },
    { day: "2024-01-01T00:00:00.000", hour: "24", complaints: "3" },
    { day: "2024-01-01T00:00:00.000", hour: "-1", complaints: "3" },
    { day: "2024-01-01T00:00:00.000", hour: "1.5", complaints: "3" },
    { day: "not-a-date", hour: "1", complaints: "3" },
    { day: "2024-01-01T00:00:00.000", complaints: "3" },
    { day: "2024-01-01T00:00:00.000", hour: "1", complaints: "abc" },
    { day: "2024-01-09T00:00:00.000", hour: "1", complaints: "3" },
    null,
  ];

  const normalized = normalizeHourlyRows(rows, range);
  const summary = summarizeHourly(range, rows);

  assert.equal(normalized.rejectedRows, 8);
  assert.equal(summary.rejectedRows, 8);
  assert.equal(summary.hours[0].weekdayTotal, 10);
});

test("validates Phase 3 board provenance data and reproduces normalized ranking", () => {
  const boardIds = new Set(PHASE3_BOARD_DATASET.rows.map((row) => row.board));
  const boardRates = buildBoardRates();

  assert.equal(PHASE3_BOARD_DATASET.rows.length, 18);
  assert.equal(boardIds.size, 18);
  assert.equal(
    PHASE3_BOARD_DATASET.rows.every((row) => row.occupiedHouseholds > 0),
    true,
  );
  assert.equal(
    PHASE3_BOARD_DATASET.rows.every((row) => row.saturdayNightComplaints >= 0),
    true,
  );
  assert.deepEqual(
    boardRates.slice(0, 6).map((row) => row.board),
    ["BK04", "BK05", "BK01", "BK03", "BK16", "BK17"],
  );
  assert.equal(Number(boardRates[0].complaintsPer1000Households.toFixed(3)), 30.643);
});

test("request tracker prevents stale response application", () => {
  const tracker = createRequestTracker();
  const first = tracker.next();
  const second = tracker.next();

  assert.equal(tracker.isCurrent(first), false);
  assert.equal(tracker.isCurrent(second), true);
});

test("formats hours for selected-borough insight text", () => {
  assert.equal(hourLabel(0), "12 AM");
  assert.equal(hourLabel(11), "11 AM");
  assert.equal(hourLabel(12), "12 PM");
  assert.equal(hourLabel(22), "10 PM");
});

test("formats selected borough possessives for insight text", () => {
  assert.equal(possessiveLabel("Brooklyn"), "Brooklyn's");
  assert.equal(possessiveLabel("Queens"), "Queens'");
});

test("shows Brooklyn deep dive only for Brooklyn selections", () => {
  assert.equal(showsBrooklynDeepDive("BROOKLYN"), true);
  assert.equal(showsBrooklynDeepDive("MANHATTAN"), false);
  assert.equal(showsBrooklynDeepDive("QUEENS"), false);
  assert.equal(showsBrooklynDeepDive("BRONX"), false);
  assert.equal(showsBrooklynDeepDive("STATEN ISLAND"), false);
});

test("derives largest hourly weekend-weekday gap from live hourly summary shape", () => {
  const hourlySummary = {
    hours: [
      { hour: 0, weekdayAverage: 4, weekendAverage: 8 },
      { hour: 1, weekdayAverage: 2, weekendAverage: 11 },
      { hour: 2, weekdayAverage: 6, weekendAverage: 7 },
    ],
  };

  assert.deepEqual(largestHourlyGap(hourlySummary), {
    hour: 1,
    gap: 9,
    weekdayAverage: 2,
    weekendAverage: 11,
  });
});
