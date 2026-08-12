/**
 * Bootstrap intervals.
 *
 * Every figure the piece reports is a point estimate drawn from one year of
 * data. These functions put an interval around two of them so the reader can
 * see how much of the estimate is signal.
 *
 * Randomness is seeded (xorshift32) rather than `Math.random`, so an interval
 * is reproducible from the committed code, stable across CI runs, and pinnable
 * in a test. The seed and draw count are part of the method, and are stated in
 * the Method section rather than left implicit.
 *
 * Both estimators assume independent resampling units. Neither assumption is
 * exactly true, and both err toward intervals that are too narrow:
 *
 *   - Daily counts are seasonal and autocorrelated, so resampling days
 *     independently understates variance.
 *   - Complaints cluster within nights and within locations, so resampling
 *     complaints independently understates variance considerably. The clustered
 *     alternative needs night-level board counts, which are not committed to
 *     this repository.
 */

export type IntervalResult =
  | {
      kind: "interval";
      point: number;
      lower: number;
      upper: number;
      level: number;
      draws: number;
      seed: number;
    }
  | { kind: "unavailable" };

export type BootstrapOptions = {
  draws?: number;
  seed?: number;
  level?: number;
};

const DEFAULT_DRAWS = 2_000;
const DEFAULT_SEED = 20_240_101;
const DEFAULT_LEVEL = 0.95;

/**
 * xorshift32. Small, fast, and deterministic. Statistical quality is far beyond
 * what a percentile bootstrap at these sample sizes requires.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  if (state === 0) {
    state = 0x9e3779b9;
  }

  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(fraction * sorted.length)));
  return sorted[index];
}

function mean(values: readonly number[]): number {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total / values.length;
}

function resampledMean(values: readonly number[], random: () => number): number {
  let total = 0;

  for (let index = 0; index < values.length; index += 1) {
    total += values[Math.floor(random() * values.length)];
  }

  return total / values.length;
}

function buildInterval(
  point: number,
  samples: number[],
  level: number,
  seed: number,
): IntervalResult {
  if (samples.length === 0) {
    return { kind: "unavailable" };
  }

  samples.sort((a, b) => a - b);
  const tail = (1 - level) / 2;

  return {
    kind: "interval",
    point,
    lower: percentile(samples, tail),
    upper: percentile(samples, 1 - tail),
    level,
    draws: samples.length,
    seed,
  };
}

/**
 * Interval around the percentage difference between weekend and weekday daily
 * means, resampling days within each day type.
 */
export function bootstrapPercentageDifference(
  weekdayCounts: readonly number[],
  weekendCounts: readonly number[],
  options: BootstrapOptions = {},
): IntervalResult {
  const { draws = DEFAULT_DRAWS, seed = DEFAULT_SEED, level = DEFAULT_LEVEL } = options;

  if (weekdayCounts.length === 0 || weekendCounts.length === 0) {
    return { kind: "unavailable" };
  }

  const weekdayMean = mean(weekdayCounts);

  if (weekdayMean === 0) {
    return { kind: "unavailable" };
  }

  const random = createRandom(seed);
  const samples: number[] = [];

  for (let draw = 0; draw < draws; draw += 1) {
    const resampledWeekday = resampledMean(weekdayCounts, random);
    const resampledWeekend = resampledMean(weekendCounts, random);

    // A resample with an all-zero weekday sample has no ratio. With real data
    // this never occurs; skipping keeps it from silently producing Infinity.
    if (resampledWeekday === 0) {
      continue;
    }

    samples.push(((resampledWeekend - resampledWeekday) / resampledWeekday) * 100);
  }

  // Too few usable draws means the estimate is not trustworthy enough to show.
  if (samples.length < draws / 2) {
    return { kind: "unavailable" };
  }

  const point = ((mean(weekendCounts) - weekdayMean) / weekdayMean) * 100;

  return buildInterval(point, samples, level, seed);
}

/**
 * Interval around the share of complaints held by the `topN` largest categories,
 * resampling complaints from the observed category proportions.
 *
 * The top N is re-selected on every draw, matching how the hypothesis was
 * pre-registered ("the top three boards would account for at least 40%") rather
 * than fixing the three boards that happened to win.
 */
export function bootstrapTopShare(
  counts: readonly number[],
  topN: number,
  options: BootstrapOptions = {},
): IntervalResult {
  const { draws = DEFAULT_DRAWS, seed = DEFAULT_SEED, level = DEFAULT_LEVEL } = options;
  const total = counts.reduce((sum, value) => sum + value, 0);

  if (total === 0 || topN <= 0 || counts.length === 0) {
    return { kind: "unavailable" };
  }

  const cumulative: number[] = [];
  let running = 0;

  for (const count of counts) {
    running += count / total;
    cumulative.push(running);
  }

  const random = createRandom(seed);
  const samples: number[] = [];

  for (let draw = 0; draw < draws; draw += 1) {
    const drawn = new Array<number>(counts.length).fill(0);

    for (let pick = 0; pick < total; pick += 1) {
      const target = random();
      let low = 0;
      let high = cumulative.length - 1;

      while (low < high) {
        const middle = (low + high) >> 1;
        if (target < cumulative[middle]) {
          high = middle;
        } else {
          low = middle + 1;
        }
      }

      drawn[low] += 1;
    }

    drawn.sort((a, b) => b - a);
    let top = 0;

    for (let index = 0; index < topN && index < drawn.length; index += 1) {
      top += drawn[index];
    }

    samples.push((top / total) * 100);
  }

  const observed = [...counts].sort((a, b) => b - a);
  let observedTop = 0;

  for (let index = 0; index < topN && index < observed.length; index += 1) {
    observedTop += observed[index];
  }

  return buildInterval((observedTop / total) * 100, samples, level, seed);
}

/** Whether an interval excludes a threshold, and on which side. */
export function comparedToThreshold(
  interval: IntervalResult,
  threshold: number,
): "entirely-below" | "entirely-above" | "straddles" | "unavailable" {
  if (interval.kind === "unavailable") {
    return "unavailable";
  }

  if (interval.upper < threshold) {
    return "entirely-below";
  }

  if (interval.lower > threshold) {
    return "entirely-above";
  }

  return "straddles";
}
