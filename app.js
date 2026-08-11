const DATASET_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";
const FILTERS = {
  borough: "BROOKLYN",
  complaintType: "Noise - Residential",
};

const RANGES = [
  {
    label: "Primary range",
    start: "2024-01-01",
    endExclusive: "2024-12-30",
    display: "2024-01-01 through 2024-12-29",
  },
  {
    label: "Stress-test range",
    start: "2025-01-06",
    endExclusive: "2026-01-05",
    display: "2025-01-06 through 2026-01-04",
  },
];

function whereClause(range) {
  return [
    `borough='${FILTERS.borough}'`,
    `complaint_type='${FILTERS.complaintType}'`,
    `created_date >= '${range.start}T00:00:00'`,
    `created_date < '${range.endExclusive}T00:00:00'`,
  ].join(" AND ");
}

function dailyUrl(range) {
  const params = new URLSearchParams({
    $select: "date_trunc_ymd(created_date) AS day, count(*) AS complaints",
    $where: whereClause(range),
    $group: "date_trunc_ymd(created_date)",
    $order: "day",
    $limit: "5000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

function inspectUrl(range) {
  const params = new URLSearchParams({
    $select:
      "count(*) AS total_records, count(created_date) AS records_with_created_date, " +
      "count(complaint_type) AS records_with_complaint_type, count(borough) AS records_with_borough, " +
      "min(created_date) AS min_created_date, max(created_date) AS max_created_date",
    $where: whereClause(range),
  });

  return `${DATASET_URL}?${params.toString()}`;
}

function utcDateFromDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function isValidDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }

  return isoDay(utcDateFromDay(day)) === day;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDay(date) {
  date.setUTCDate(date.getUTCDate() + 1);
}

function isWeekendDay(day) {
  const date = typeof day === "string" ? utcDateFromDay(day) : day;
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

function normalizeDailyRows(dailyRows, range) {
  const countsByDay = new Map();
  const start = utcDateFromDay(range.start);
  const end = utcDateFromDay(range.endExclusive);
  let rejectedRows = 0;

  for (const row of dailyRows) {
    const dayValue = row?.day;
    const complaintValue = row?.complaints;
    const day = typeof dayValue === "string" ? dayValue.slice(0, 10) : "";
    const date = day ? utcDateFromDay(day) : new Date(Number.NaN);
    const complaints = Number(complaintValue);

    if (
      !row ||
      !isValidDay(day) ||
      Number.isNaN(date.getTime()) ||
      date < start ||
      date >= end ||
      complaintValue === undefined ||
      complaintValue === null ||
      complaintValue === "" ||
      !Number.isInteger(complaints) ||
      complaints < 0
    ) {
      rejectedRows += 1;
      continue;
    }

    countsByDay.set(day, (countsByDay.get(day) ?? 0) + complaints);
  }

  return { countsByDay, rejectedRows };
}

function summarize(range, dailyRows, inspectRow) {
  const { countsByDay, rejectedRows } = normalizeDailyRows(dailyRows, range);

  let weekdayDays = 0;
  let weekendDays = 0;
  let weekdayTotal = 0;
  let weekendTotal = 0;
  let zeroDaysFilled = 0;

  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const day = isoDay(date);
    const complaints = countsByDay.get(day) ?? 0;

    if (!countsByDay.has(day)) {
      zeroDaysFilled += 1;
    }

    if (isWeekendDay(date)) {
      weekendDays += 1;
      weekendTotal += complaints;
    } else {
      weekdayDays += 1;
      weekdayTotal += complaints;
    }
  }

  const weekdayAverage = weekdayTotal / weekdayDays;
  const weekendAverage = weekendTotal / weekendDays;
  const percentageDifference =
    weekdayAverage === 0 ? null : ((weekendAverage - weekdayAverage) / weekdayAverage) * 100;

  return {
    ...range,
    weekdayDays,
    weekendDays,
    weekdayTotal,
    weekendTotal,
    weekdayAverage,
    weekendAverage,
    percentageDifference,
    supported: weekendAverage > weekdayAverage,
    apiReturnedDays: dailyRows.length,
    rejectedRows,
    zeroDaysFilled,
    totalRecords: Number(inspectRow?.total_records ?? 0),
    recordsWithCreatedDate: Number(inspectRow?.records_with_created_date ?? 0),
    recordsWithComplaintType: Number(inspectRow?.records_with_complaint_type ?? 0),
    recordsWithBorough: Number(inspectRow?.records_with_borough ?? 0),
    minCreatedDate: inspectRow?.min_created_date ?? "n/a",
    maxCreatedDate: inspectRow?.max_created_date ?? "n/a",
    dailyUrl: dailyUrl(range),
    inspectUrl: inspectUrl(range),
  };
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatPercentage(value) {
  return value === null ? "n/a" : `${formatNumber(value, 1)}%`;
}

function renderSummary(summary) {
  const verdict = summary.supported ? "Hypothesis supported" : "Hypothesis not supported";
  const verdictClass = summary.supported ? "verdict" : "verdict unsupported";

  return `
    <article class="range-panel">
      <div class="panel-head">
        <div>
          <h2>${summary.label}</h2>
          <p>${summary.display}, 52 complete Monday-Sunday weeks.</p>
        </div>
        <span class="${verdictClass}">${verdict}</span>
      </div>

      <div class="metrics">
        <div class="metric">
          <span>Average weekday complaints</span>
          <strong>${formatNumber(summary.weekdayAverage, 1)}</strong>
        </div>
        <div class="metric">
          <span>Average weekend complaints</span>
          <strong>${formatNumber(summary.weekendAverage, 1)}</strong>
        </div>
        <div class="metric">
          <span>Weekend difference</span>
          <strong>${formatPercentage(summary.percentageDifference)}</strong>
        </div>
        <div class="metric">
          <span>Total matching complaints</span>
          <strong>${formatNumber(summary.totalRecords)}</strong>
        </div>
      </div>

      <div class="evidence">
        <div>
          <h3>Auditable Counts</h3>
          <table>
            <tbody>
              <tr><th>Weekday days observed</th><td>${summary.weekdayDays}</td></tr>
              <tr><th>Weekend days observed</th><td>${summary.weekendDays}</td></tr>
              <tr><th>Total weekday complaints</th><td>${formatNumber(summary.weekdayTotal)}</td></tr>
              <tr><th>Total weekend complaints</th><td>${formatNumber(summary.weekendTotal)}</td></tr>
              <tr><th>API daily rows returned</th><td>${summary.apiReturnedDays}</td></tr>
              <tr><th>Rejected aggregate rows</th><td>${summary.rejectedRows}</td></tr>
              <tr><th>Zero days filled locally</th><td>${summary.zeroDaysFilled}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3>Response Checks</h3>
          <table>
            <tbody>
              <tr><th>Records with created_date</th><td>${formatNumber(summary.recordsWithCreatedDate)}</td></tr>
              <tr><th>Records with complaint_type</th><td>${formatNumber(summary.recordsWithComplaintType)}</td></tr>
              <tr><th>Records with borough</th><td>${formatNumber(summary.recordsWithBorough)}</td></tr>
              <tr><th>Minimum created_date</th><td>${summary.minCreatedDate}</td></tr>
              <tr><th>Maximum created_date</th><td>${summary.maxCreatedDate}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3>Daily Count Request URL</h3>
          <a class="api-url" href="${summary.dailyUrl}" target="_blank" rel="noreferrer">${summary.dailyUrl}</a>
        </div>

        <div>
          <h3>Completeness Check URL</h3>
          <a class="api-url" href="${summary.inspectUrl}" target="_blank" rel="noreferrer">${summary.inspectUrl}</a>
        </div>
      </div>
    </article>
  `;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${url}`);
  }

  return response.json();
}

async function load() {
  const summaries = await Promise.all(
    RANGES.map(async (range) => {
      const [dailyRows, inspectRows] = await Promise.all([
        fetchJson(dailyUrl(range)),
        fetchJson(inspectUrl(range)),
      ]);

      return summarize(range, dailyRows, inspectRows[0]);
    }),
  );

  document.querySelector("#results").innerHTML = summaries.map(renderSummary).join("");
}

if (typeof document !== "undefined") {
  load().catch((error) => {
    document.querySelector("#results").innerHTML = `
      <div class="status">
        Could not load NYC Open Data evidence. ${error.message}
      </div>
    `;
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    RANGES,
    dailyUrl,
    inspectUrl,
    isWeekendDay,
    normalizeDailyRows,
    summarize,
    utcDateFromDay,
    isValidDay,
  };
}
