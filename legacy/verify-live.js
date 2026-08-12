const assert = require("node:assert/strict");

const { RANGES, dailyUrl } = require("./app");

const EXPECTED = {
  "Primary range": {
    weekdayDays: 260,
    weekendDays: 104,
    weekdayTotal: 54749,
    weekendTotal: 38946,
    weekdayAverage: 210.5730769230769,
    weekendAverage: 374.4807692307692,
    percentageDifference: 77.83886463679703,
    supported: true,
  },
  "Stress-test range": {
    weekdayDays: 260,
    weekendDays: 104,
    weekdayTotal: 60746,
    weekendTotal: 42826,
    weekdayAverage: 233.63846153846154,
    weekendAverage: 411.78846153846155,
    percentageDifference: 76.25028808481217,
    supported: true,
  },
};

function closeEnough(actual, expected) {
  return Math.abs(actual - expected) < 0.000001;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${url}`);
  }

  return response.json();
}

function toUtcDate(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function independentlySummarize(range, rows) {
  const counts = new Map();

  for (const row of rows) {
    const day = row.day.slice(0, 10);
    counts.set(day, Number(row.complaints));
  }

  let weekdayDays = 0;
  let weekendDays = 0;
  let weekdayTotal = 0;
  let weekendTotal = 0;

  for (
    const date = toUtcDate(range.start), end = toUtcDate(range.endExclusive);
    date < end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const complaints = counts.get(isoDay(date)) ?? 0;
    const dayOfWeek = date.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays += 1;
      weekendTotal += complaints;
    } else {
      weekdayDays += 1;
      weekdayTotal += complaints;
    }
  }

  const weekdayAverage = weekdayTotal / weekdayDays;
  const weekendAverage = weekendTotal / weekendDays;

  return {
    weekdayDays,
    weekendDays,
    weekdayTotal,
    weekendTotal,
    weekdayAverage,
    weekendAverage,
    percentageDifference: ((weekendAverage - weekdayAverage) / weekdayAverage) * 100,
    supported: weekendAverage > weekdayAverage,
  };
}

(async () => {
  for (const range of RANGES) {
    const rows = await fetchJson(dailyUrl(range));
    const summary = independentlySummarize(range, rows);
    const expected = EXPECTED[range.label];

    assert.equal(summary.weekdayDays, expected.weekdayDays);
    assert.equal(summary.weekendDays, expected.weekendDays);
    assert.equal(summary.weekdayTotal, expected.weekdayTotal);
    assert.equal(summary.weekendTotal, expected.weekendTotal);
    assert.equal(summary.supported, expected.supported);
    assert.ok(closeEnough(summary.weekdayAverage, expected.weekdayAverage));
    assert.ok(closeEnough(summary.weekendAverage, expected.weekendAverage));
    assert.ok(closeEnough(summary.percentageDifference, expected.percentageDifference));

    console.log(`${range.label}`);
    console.log(`  URL: ${dailyUrl(range)}`);
    console.log(`  weekday days: ${summary.weekdayDays}`);
    console.log(`  weekend days: ${summary.weekendDays}`);
    console.log(`  weekday complaints: ${summary.weekdayTotal}`);
    console.log(`  weekend complaints: ${summary.weekendTotal}`);
    console.log(`  weekday average: ${summary.weekdayAverage}`);
    console.log(`  weekend average: ${summary.weekendAverage}`);
    console.log(`  percentage difference: ${summary.percentageDifference}`);
    console.log(`  hypothesis supported: ${summary.supported}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
