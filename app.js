const DATASET_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";
const DEFAULT_BOROUGH = "BROOKLYN";
const BOROUGHS = [
  { label: "Brooklyn", value: "BROOKLYN" },
  { label: "Manhattan", value: "MANHATTAN" },
  { label: "Queens", value: "QUEENS" },
  { label: "Bronx", value: "BRONX" },
  { label: "Staten Island", value: "STATEN ISLAND" },
];
const FILTERS = {
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

function normalizeBorough(value) {
  return BOROUGHS.some((borough) => borough.value === value) ? value : DEFAULT_BOROUGH;
}

function boroughLabel(value) {
  return BOROUGHS.find((borough) => borough.value === normalizeBorough(value)).label;
}

function possessiveLabel(label) {
  return label.endsWith("s") ? `${label}'` : `${label}'s`;
}

function showsBrooklynDeepDive(borough) {
  return normalizeBorough(borough) === DEFAULT_BOROUGH;
}

function createRequestTracker() {
  let currentRequest = 0;

  return {
    next() {
      currentRequest += 1;
      return currentRequest;
    },
    isCurrent(requestId) {
      return requestId === currentRequest;
    },
  };
}

function whereClause(range, borough = DEFAULT_BOROUGH) {
  const selectedBorough = normalizeBorough(borough);

  return [
    `borough='${selectedBorough}'`,
    `complaint_type='${FILTERS.complaintType}'`,
    `created_date >= '${range.start}T00:00:00'`,
    `created_date < '${range.endExclusive}T00:00:00'`,
  ].join(" AND ");
}

function dailyUrl(range, borough = DEFAULT_BOROUGH) {
  const params = new URLSearchParams({
    $select: "date_trunc_ymd(created_date) AS day, count(*) AS complaints",
    $where: whereClause(range, borough),
    $group: "date_trunc_ymd(created_date)",
    $order: "day",
    $limit: "5000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

function hourlyUrl(range, borough = DEFAULT_BOROUGH) {
  const params = new URLSearchParams({
    $select:
      "date_trunc_ymd(created_date) AS day, date_extract_hh(created_date) AS hour, count(*) AS complaints",
    $where: whereClause(range, borough),
    $group: "date_trunc_ymd(created_date), date_extract_hh(created_date)",
    $order: "day, hour",
    $limit: "10000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

function inspectUrl(range, borough = DEFAULT_BOROUGH) {
  const params = new URLSearchParams({
    $select:
      "count(*) AS total_records, count(created_date) AS records_with_created_date, " +
      "count(complaint_type) AS records_with_complaint_type, count(borough) AS records_with_borough, " +
      "min(created_date) AS min_created_date, max(created_date) AS max_created_date",
    $where: whereClause(range, borough),
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

function summarizeHourly(range, hourlyRows, borough = DEFAULT_BOROUGH) {
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
    hourlyUrl: hourlyUrl(range, borough),
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

function summarize(range, dailyRows, inspectRow, borough = DEFAULT_BOROUGH) {
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
    dailyUrl: dailyUrl(range, borough),
    inspectUrl: inspectUrl(range, borough),
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

function formatSignedPercentage(value) {
  if (value === null) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${formatPercentage(value)}`;
}

function hourLabel(hour) {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour < 12) {
    return `${hour} AM`;
  }

  if (hour === 12) {
    return "12 PM";
  }

  return `${hour - 12} PM`;
}

function largestHourlyGap(hourlySummary) {
  return hourlySummary.hours.reduce((largest, row) => {
    const gap = row.weekendAverage - row.weekdayAverage;

    if (!largest || gap > largest.gap) {
      return {
        hour: row.hour,
        gap,
        weekdayAverage: row.weekdayAverage,
        weekendAverage: row.weekendAverage,
      };
    }

    return largest;
  }, null);
}

function chartScale(maxValue, chartSize) {
  return (value) => (maxValue === 0 ? 0 : (value / maxValue) * chartSize);
}

function renderWeekdayWeekendChart(summary, selectedBorough) {
  const selectedLabel = boroughLabel(selectedBorough);
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
        <strong>Weekends receive more residential noise complaints</strong>
        <em>Average ${selectedLabel} complaints per day.</em>
      </figcaption>
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${selectedLabel} weekday average ${formatNumber(summary.weekdayAverage, 1)} complaints and weekend average ${formatNumber(summary.weekendAverage, 1)} complaints">
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
      <p class="chart-note">Weekend days averaged ${formatNumber(summary.weekendAverage, 1)} complaints compared with ${formatNumber(summary.weekdayAverage, 1)} on weekdays.</p>
    </figure>
  `;
}

function renderHourlyChart(hourlySummary, selectedBorough) {
  const selectedLabel = boroughLabel(selectedBorough);
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
        <strong>The gap grows sharply late at night</strong>
        <em>Average ${selectedLabel} residential noise complaints per day by hour.</em>
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
      <p class="chart-note">The weekend-weekday gap is largest during the late-night hours highlighted on the chart.</p>
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
        <strong>Complaint rates vary widely across Brooklyn community boards</strong>
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
      <p class="chart-note">Comparing complaints relative to occupied households keeps larger boards from dominating by size alone.</p>
    </figure>
  `;
}

function renderKeyMetrics(summary, selectedBorough) {
  const selectedLabel = boroughLabel(selectedBorough);

  return `
    <section class="key-metrics" aria-labelledby="key-metrics-title">
      <div>
        <p class="eyebrow">Key Metrics</p>
        <h2 id="key-metrics-title">${selectedLabel} at a glance</h2>
        <p>Average daily residential noise complaints in the primary 2024 period.</p>
      </div>
      <div class="metrics">
        <div class="metric">
          <span>Weekday average</span>
          <strong>${formatNumber(summary.weekdayAverage, 1)}</strong>
        </div>
        <div class="metric">
          <span>Weekend average</span>
          <strong>${formatNumber(summary.weekendAverage, 1)}</strong>
        </div>
        <div class="metric">
          <span>Weekend difference</span>
          <strong>${formatSignedPercentage(summary.percentageDifference)}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderBoroughSelector(selectedBorough) {
  const selectedValue = normalizeBorough(selectedBorough);

  return `
    <section class="borough-control" aria-labelledby="borough-selector-label">
      <label id="borough-selector-label" for="borough-selector">Compare NYC boroughs</label>
      <select id="borough-selector">
        ${BOROUGHS.map(
          (borough) =>
            `<option value="${borough.value}"${borough.value === selectedValue ? " selected" : ""}>${borough.label}</option>`,
        ).join("")}
      </select>
    </section>
  `;
}

function renderBoroughComparison(primarySummary, hourlySummary, selectedBorough) {
  return `
    <section class="visualizations" aria-labelledby="visualization-title">
      <div class="section-head">
        <p class="eyebrow">Data Exploration</p>
        <h2 id="visualization-title">Compare NYC boroughs</h2>
        <p>The charts show how complaint reporting changes by day type and hour.</p>
      </div>
      <div class="chart-grid">
        ${renderWeekdayWeekendChart(primarySummary, selectedBorough)}
        ${renderHourlyChart(hourlySummary, selectedBorough)}
      </div>
    </section>
  `;
}

function renderSelectedBoroughInsight(summary, hourlySummary, selectedBorough) {
  const selectedLabel = boroughLabel(selectedBorough);
  const percentage = summary.percentageDifference;
  const averageDirection = percentage === null || percentage >= 0 ? "higher" : "lower";
  const hourlyGap = largestHourlyGap(hourlySummary);
  const hourlySentence =
    hourlyGap && hourlyGap.gap >= 0
      ? `The hourly pattern shows the largest weekend-weekday difference around ${hourLabel(hourlyGap.hour)}, when weekend days averaged ${formatNumber(hourlyGap.gap, 1)} more complaints than weekdays in that hour.`
      : `The hourly pattern does not show a positive weekend-weekday difference in the 2024 comparison period.`;

  return `
    <section class="insight" aria-labelledby="selected-borough-insight-title">
      <p class="eyebrow">Selected Borough Insight</p>
      <h2 id="selected-borough-insight-title">${selectedLabel} insight</h2>
      <p>${possessiveLabel(selectedLabel)} weekend residential-noise complaint average is ${formatPercentage(Math.abs(percentage ?? 0))} ${averageDirection} than its weekday average in the 2024 comparison period.</p>
      <p>${hourlySentence}</p>
      <p class="boundary">This describes 311 complaint reporting, not actual noise levels or causation.</p>
    </section>
  `;
}

function renderBrooklynDeepDive(boardRates) {
  return `
    <section class="visualizations" aria-labelledby="brooklyn-deep-dive-title">
      <div class="section-head">
        <p class="eyebrow">Brooklyn Deep Dive</p>
        <h2 id="brooklyn-deep-dive-title">Brooklyn community-board comparison</h2>
        <p>This chart is a Brooklyn-specific result using 2024 ACS household estimates. It does not change when another borough is selected above.</p>
      </div>
      <div class="chart-grid">
        ${renderBoardChart(boardRates)}
      </div>
      <div class="insight brooklyn-insight" aria-labelledby="brooklyn-insight-title">
        <p class="eyebrow">Brooklyn Deep-Dive Insight</p>
        <h2 id="brooklyn-insight-title">BK04 remains unusually high</h2>
        <p>BK04's unusually high Saturday-night residential noise complaint-reporting rate persists after comparisons with household size, residential density, nightlife-license exposure, and repeated locations; complaints are distributed across hundreds of residential tax lots rather than being dominated by a small set of locations.</p>
        <p class="boundary">These patterns can help identify where and when elevated residential-noise reporting deserves closer investigation, without assuming the complaints measure actual noise or explain its cause.</p>
      </div>
    </section>
  `;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${url}`);
  }

  return response.json();
}

function renderLoading(selectedBorough) {
  return `
    ${renderBoroughSelector(selectedBorough)}
    <div class="status">Loading ${boroughLabel(selectedBorough)} residential noise complaint data...</div>
    ${showsBrooklynDeepDive(selectedBorough) ? renderBrooklynDeepDive(buildBoardRates()) : ""}
  `;
}

function renderError(selectedBorough, message) {
  return `
    ${renderBoroughSelector(selectedBorough)}
    <div class="status error">Could not load ${boroughLabel(selectedBorough)} complaint data. ${message}</div>
    ${showsBrooklynDeepDive(selectedBorough) ? renderBrooklynDeepDive(buildBoardRates()) : ""}
  `;
}

function renderApp(primarySummary, hourlySummary, boardRates, selectedBorough) {
  const sections = [
    renderBoroughSelector(selectedBorough),
    renderKeyMetrics(primarySummary, selectedBorough),
    renderBoroughComparison(primarySummary, hourlySummary, selectedBorough),
    renderSelectedBoroughInsight(primarySummary, hourlySummary, selectedBorough),
  ];

  if (showsBrooklynDeepDive(selectedBorough)) {
    sections.push(renderBrooklynDeepDive(boardRates));
  }

  return sections.join("");
}

async function load() {
  const results = document.querySelector("#results");
  const boardRates = buildBoardRates();
  const requestTracker = createRequestTracker();

  async function updateBorough(nextBorough) {
    const selectedBorough = normalizeBorough(nextBorough);
    const requestId = requestTracker.next();

    results.innerHTML = renderLoading(selectedBorough);
    attachBoroughListener();

    try {
      const [dailyRows, inspectRows, hourlyRows] = await Promise.all([
        fetchJson(dailyUrl(RANGES[0], selectedBorough)),
        fetchJson(inspectUrl(RANGES[0], selectedBorough)),
        fetchJson(hourlyUrl(RANGES[0], selectedBorough)),
      ]);

      if (!requestTracker.isCurrent(requestId)) {
        return;
      }

      const summary = summarize(RANGES[0], dailyRows, inspectRows[0], selectedBorough);
      const hourlySummary = summarizeHourly(RANGES[0], hourlyRows, selectedBorough);

      results.innerHTML = renderApp(summary, hourlySummary, boardRates, selectedBorough);
      attachBoroughListener();
    } catch (error) {
      if (!requestTracker.isCurrent(requestId)) {
        return;
      }

      results.innerHTML = renderError(selectedBorough, error.message);
      attachBoroughListener();
    }
  }

  function attachBoroughListener() {
    const selector = document.querySelector("#borough-selector");

    if (!selector) {
      return;
    }

    selector.addEventListener("change", (event) => {
      updateBorough(event.target.value);
    });
  }

  updateBorough(DEFAULT_BOROUGH);
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
    BOROUGHS,
    DEFAULT_BOROUGH,
    RANGES,
    PHASE3_BOARD_DATASET,
    boroughLabel,
    possessiveLabel,
    createRequestTracker,
    dailyUrl,
    hourlyUrl,
    hourLabel,
    inspectUrl,
    isWeekendDay,
    largestHourlyGap,
    normalizeDailyRows,
    normalizeHourlyRows,
    normalizeBorough,
    summarize,
    summarizeHourly,
    showsBrooklynDeepDive,
    buildBoardRates,
    whereClause,
    utcDateFromDay,
    isValidDay,
  };
}
