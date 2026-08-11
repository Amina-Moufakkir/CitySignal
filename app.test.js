const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PHASE3_BOARD_DATASET,
  buildBoardRates,
  isWeekendDay,
  normalizeDailyRows,
  normalizeHourlyRows,
  summarize,
  summarizeHourly,
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
