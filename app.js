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

const PHASE3_BOARD_DATASET = {
  metadata: {
    denominatorSource: "2024 ACS 5-year estimates aggregated to DCP CDTAs",
    complaintPeriod: "2024-01-01 through 2024-12-29",
    limitation:
      "CDTAs approximate, but are not identical to, legal community-district boundaries.",
  },
  rows: [
    { board: "BK01", occupiedHouseholds: 85708, saturdayNightComplaints: 1256 },
    { board: "BK02", occupiedHouseholds: 61250, saturdayNightComplaints: 355 },
    { board: "BK03", occupiedHouseholds: 71580, saturdayNightComplaints: 1042 },
    { board: "BK04", occupiedHouseholds: 45491, saturdayNightComplaints: 1394 },
    { board: "BK05", occupiedHouseholds: 71948, saturdayNightComplaints: 1128 },
    { board: "BK06", occupiedHouseholds: 52116, saturdayNightComplaints: 240 },
    { board: "BK07", occupiedHouseholds: 41131, saturdayNightComplaints: 313 },
    { board: "BK08", occupiedHouseholds: 48537, saturdayNightComplaints: 407 },
    { board: "BK09", occupiedHouseholds: 40499, saturdayNightComplaints: 398 },
    { board: "BK10", occupiedHouseholds: 49275, saturdayNightComplaints: 239 },
    { board: "BK11", occupiedHouseholds: 62339, saturdayNightComplaints: 278 },
    { board: "BK12", occupiedHouseholds: 55111, saturdayNightComplaints: 279 },
    { board: "BK13", occupiedHouseholds: 46711, saturdayNightComplaints: 262 },
    { board: "BK14", occupiedHouseholds: 59557, saturdayNightComplaints: 400 },
    { board: "BK15", occupiedHouseholds: 58709, saturdayNightComplaints: 261 },
    { board: "BK16", occupiedHouseholds: 37597, saturdayNightComplaints: 448 },
    { board: "BK17", occupiedHouseholds: 58588, saturdayNightComplaints: 672 },
    { board: "BK18", occupiedHouseholds: 63771, saturdayNightComplaints: 572 },
  ],
};

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

function hourlyUrl(range) {
  const params = new URLSearchParams({
    $select:
      "date_trunc_ymd(created_date) AS day, date_extract_hh(created_date) AS hour, count(*) AS complaints",
    $where: whereClause(range),
    $group: "date_trunc_ymd(created_date), date_extract_hh(created_date)",
    $order: "day, hour",
    $limit: "10000",
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

function normalizeHourlyRows(hourlyRows, range) {
  const countsByDayHour = new Map();
  const start = utcDateFromDay(range.start);
  const end = utcDateFromDay(range.endExclusive);
  let rejectedRows = 0;

  for (const row of hourlyRows) {
    const dayValue = row?.day;
    const hourValue = row?.hour;
    const complaintValue = row?.complaints;
    const day = typeof dayValue === "string" ? dayValue.slice(0, 10) : "";
    const date = day ? utcDateFromDay(day) : new Date(Number.NaN);
    const hour = Number(hourValue);
    const complaints = Number(complaintValue);

    if (
      !row ||
      !isValidDay(day) ||
      Number.isNaN(date.getTime()) ||
      date < start ||
      date >= end ||
      hourValue === undefined ||
      hourValue === null ||
      hourValue === "" ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      complaintValue === undefined ||
      complaintValue === null ||
      complaintValue === "" ||
      !Number.isInteger(complaints) ||
      complaints < 0
    ) {
      rejectedRows += 1;
      continue;
    }

    countsByDayHour.set(`${day}|${hour}`, (countsByDayHour.get(`${day}|${hour}`) ?? 0) + complaints);
  }

  return { countsByDayHour, rejectedRows };
}

function summarizeHourly(range, hourlyRows) {
  const { countsByDayHour, rejectedRows } = normalizeHourlyRows(hourlyRows, range);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    weekdayTotal: 0,
    weekendTotal: 0,
    weekdayAverage: 0,
    weekendAverage: 0,
  }));
  let weekdayDays = 0;
  let weekendDays = 0;
  let zeroCellsFilled = 0;

  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const day = isoDay(date);
    const weekend = isWeekendDay(date);

    if (weekend) {
      weekendDays += 1;
    } else {
      weekdayDays += 1;
    }

    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${day}|${hour}`;
      const complaints = countsByDayHour.get(key) ?? 0;

      if (!countsByDayHour.has(key)) {
        zeroCellsFilled += 1;
      }

      if (weekend) {
        hours[hour].weekendTotal += complaints;
      } else {
        hours[hour].weekdayTotal += complaints;
      }
    }
  }

  for (const row of hours) {
    row.weekdayAverage = row.weekdayTotal / weekdayDays;
    row.weekendAverage = row.weekendTotal / weekendDays;
  }

  return {
    hours,
    weekdayDays,
    weekendDays,
    apiReturnedRows: hourlyRows.length,
    rejectedRows,
    zeroCellsFilled,
    hourlyUrl: hourlyUrl(range),
  };
}

function buildBoardRates(dataset = PHASE3_BOARD_DATASET) {
  const boards = new Set();

  for (const row of dataset.rows) {
    if (
      !/^BK(0[1-9]|1[0-8])$/.test(row.board) ||
      boards.has(row.board) ||
      !Number.isFinite(row.occupiedHouseholds) ||
      row.occupiedHouseholds <= 0 ||
      !Number.isInteger(row.saturdayNightComplaints) ||
      row.saturdayNightComplaints < 0
    ) {
      throw new Error("Invalid Phase 3 board provenance dataset");
    }

    boards.add(row.board);
  }

  if (boards.size !== 18 || dataset.rows.length !== 18) {
    throw new Error("Phase 3 board provenance dataset must contain 18 unique Brooklyn boards");
  }

  return dataset.rows
    .map((row) => ({
      ...row,
      complaintsPer1000Households: (row.saturdayNightComplaints / row.occupiedHouseholds) * 1000,
    }))
    .sort((a, b) => b.complaintsPer1000Households - a.complaintsPer1000Households);
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

function chartScale(maxValue, chartSize) {
  return (value) => (maxValue === 0 ? 0 : (value / maxValue) * chartSize);
}

function renderWeekdayWeekendChart(summary) {
  const width = 680;
  const height = 320;
  const margin = { top: 24, right: 28, bottom: 56, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.ceil(Math.max(summary.weekdayAverage, summary.weekendAverage) / 50) * 50;
  const scaleY = chartScale(maxValue, plotHeight);
  const bars = [
    { label: "Weekday", value: summary.weekdayAverage, total: summary.weekdayTotal, days: summary.weekdayDays },
    { label: "Weekend", value: summary.weekendAverage, total: summary.weekendTotal, days: summary.weekendDays },
  ];
  const barWidth = 120;
  const gap = 86;
  const startX = margin.left + (plotWidth - barWidth * 2 - gap) / 2;

  return `
    <figure class="chart-card">
      <figcaption>
        <span>Chart 1</span>
        <strong>Weekday vs Weekend</strong>
        <em>Average daily Brooklyn Noise - Residential complaints, primary 2024 range.</em>
      </figcaption>
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekday average 210.6 complaints and weekend average 374.5 complaints">
        <line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
        <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
        <text class="axis-label" x="14" y="${margin.top + 8}" transform="rotate(-90 14 ${margin.top + 8})">complaints per day</text>
        ${[0, maxValue / 2, maxValue]
          .map((tick) => {
            const y = height - margin.bottom - scaleY(tick);
            return `<g><line class="grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line><text class="tick" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(tick, 0)}</text></g>`;
          })
          .join("")}
        ${bars
          .map((bar, index) => {
            const barHeight = scaleY(bar.value);
            const x = startX + index * (barWidth + gap);
            const y = height - margin.bottom - barHeight;
            return `
              <rect class="bar bar-${index}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"></rect>
              <text class="value-label" x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle">${formatNumber(bar.value, 1)}</text>
              <text class="tick" x="${x + barWidth / 2}" y="${height - margin.bottom + 24}" text-anchor="middle">${bar.label}</text>
            `;
          })
          .join("")}
      </svg>
      <p class="chart-note">Weekend average was ${formatPercentage(summary.percentageDifference)} higher. Weekday total: ${formatNumber(summary.weekdayTotal)} over ${summary.weekdayDays} days; weekend total: ${formatNumber(summary.weekendTotal)} over ${summary.weekendDays} days.</p>
    </figure>
  `;
}

function renderHourlyChart(hourlySummary) {
  const width = 760;
  const height = 360;
  const margin = { top: 24, right: 32, bottom: 62, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxAverage = Math.max(
    ...hourlySummary.hours.flatMap((row) => [row.weekdayAverage, row.weekendAverage]),
  );
  const maxValue = Math.ceil(maxAverage / 10) * 10;
  const scaleY = chartScale(maxValue, plotHeight);
  const xForHour = (hour) => margin.left + (hour / 23) * plotWidth;
  const yForValue = (value) => height - margin.bottom - scaleY(value);
  const lineFor = (key) =>
    hourlySummary.hours
      .map((row) => `${xForHour(row.hour)},${yForValue(row[key])}`)
      .join(" ");

  return `
    <figure class="chart-card chart-card-wide">
      <figcaption>
        <span>Chart 2</span>
        <strong>Hourly Weekday vs Weekend Pattern</strong>
        <em>Average Brooklyn Noise - Residential complaints per weekday/weekend day by created_date hour.</em>
      </figcaption>
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart comparing weekday and weekend complaints by hour of day">
        <line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
        <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
        <text class="axis-label" x="14" y="${margin.top + 8}" transform="rotate(-90 14 ${margin.top + 8})">complaints per day</text>
        ${[0, maxValue / 2, maxValue]
          .map((tick) => {
            const y = yForValue(tick);
            return `<g><line class="grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line><text class="tick" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(tick, 0)}</text></g>`;
          })
          .join("")}
        ${[0, 4, 8, 12, 16, 20, 23]
          .map((hour) => `<text class="tick" x="${xForHour(hour)}" y="${height - margin.bottom + 24}" text-anchor="middle">${hour}</text>`)
          .join("")}
        <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 16}" text-anchor="middle">hour of day</text>
        <rect class="late-night-band" x="${xForHour(22)}" y="${margin.top}" width="${xForHour(23) - xForHour(22)}" height="${plotHeight}"></rect>
        <rect class="late-night-band" x="${margin.left}" y="${margin.top}" width="${xForHour(4) - margin.left}" height="${plotHeight}"></rect>
        <polyline class="line weekday-line" points="${lineFor("weekdayAverage")}"></polyline>
        <polyline class="line weekend-line" points="${lineFor("weekendAverage")}"></polyline>
        <g class="legend" transform="translate(${width - 236} ${margin.top + 8})">
          <line class="line weekday-line" x1="0" y1="0" x2="28" y2="0"></line><text x="36" y="4">weekday</text>
          <line class="line weekend-line" x1="116" y1="0" x2="144" y2="0"></line><text x="152" y="4">weekend</text>
        </g>
      </svg>
      <p class="chart-note">Late-night hours are visually shaded only to show the validated 10 PM-3:59 AM comparison window. Filled ${formatNumber(hourlySummary.zeroCellsFilled)} missing day-hour cells with zero; rejected ${hourlySummary.rejectedRows} malformed aggregate rows.</p>
    </figure>
  `;
}

function renderBoardChart(boardRates) {
  const width = 760;
  const rowHeight = 28;
  const margin = { top: 24, right: 30, bottom: 46, left: 64 };
  const height = margin.top + margin.bottom + boardRates.length * rowHeight;
  const plotWidth = width - margin.left - margin.right;
  const maxValue = Math.ceil(boardRates[0].complaintsPer1000Households / 5) * 5;
  const scaleX = chartScale(maxValue, plotWidth);

  return `
    <figure class="chart-card chart-card-wide">
      <figcaption>
        <span>Chart 3</span>
        <strong>Normalized Community Board Comparison</strong>
        <em>Saturday-night Loud Music/Party complaints per 1,000 occupied households.</em>
      </figcaption>
      <svg class="chart board-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Horizontal bar chart of normalized complaint rates for all Brooklyn community boards">
        <line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
        ${[0, maxValue / 2, maxValue]
          .map((tick) => {
            const x = margin.left + scaleX(tick);
            return `<g><line class="grid vertical" x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}"></line><text class="tick" x="${x}" y="${height - margin.bottom + 22}" text-anchor="middle">${formatNumber(tick, 0)}</text></g>`;
          })
          .join("")}
        ${boardRates
          .map((row, index) => {
            const y = margin.top + index * rowHeight;
            const barWidth = scaleX(row.complaintsPer1000Households);
            return `
              <text class="tick board-label" x="${margin.left - 10}" y="${y + 17}" text-anchor="end">${row.board}</text>
              <rect class="bar board-bar" x="${margin.left}" y="${y + 4}" width="${barWidth}" height="18"></rect>
              <text class="value-label board-value" x="${margin.left + barWidth + 7}" y="${y + 18}">${formatNumber(row.complaintsPer1000Households, 1)}</text>
            `;
          })
          .join("")}
        <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle">complaints per 1,000 occupied households</text>
      </svg>
      <p class="chart-note">${PHASE3_BOARD_DATASET.metadata.denominatorSource}; complaint period ${PHASE3_BOARD_DATASET.metadata.complaintPeriod}. ${PHASE3_BOARD_DATASET.metadata.limitation}</p>
    </figure>
  `;
}

function renderVisualizations(primarySummary, hourlySummary, boardRates) {
  return `
    <section class="visualizations" aria-labelledby="visualization-title">
      <div class="section-head">
        <p class="eyebrow">Evidence Charts</p>
        <h2 id="visualization-title">Three views of the validated complaint-reporting pattern</h2>
        <p>These charts show 311 complaint reports, not actual noise levels or causation. Axes start at zero and units are shown explicitly.</p>
      </div>
      <div class="chart-grid">
        ${renderWeekdayWeekendChart(primarySummary)}
        ${renderHourlyChart(hourlySummary)}
        ${renderBoardChart(boardRates)}
      </div>
    </section>
  `;
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
  const [summaries, primaryHourlyRows] = await Promise.all([
    Promise.all(
    RANGES.map(async (range) => {
      const [dailyRows, inspectRows] = await Promise.all([
        fetchJson(dailyUrl(range)),
        fetchJson(inspectUrl(range)),
      ]);

      return summarize(range, dailyRows, inspectRows[0]);
    }),
    ),
    fetchJson(hourlyUrl(RANGES[0])),
  ]);
  const hourlySummary = summarizeHourly(RANGES[0], primaryHourlyRows);
  const boardRates = buildBoardRates();

  document.querySelector("#results").innerHTML = [
    renderVisualizations(summaries[0], hourlySummary, boardRates),
    summaries.map(renderSummary).join(""),
  ].join("");
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
    PHASE3_BOARD_DATASET,
    dailyUrl,
    hourlyUrl,
    inspectUrl,
    isWeekendDay,
    normalizeDailyRows,
    normalizeHourlyRows,
    summarize,
    summarizeHourly,
    buildBoardRates,
    utcDateFromDay,
    isValidDay,
  };
}
