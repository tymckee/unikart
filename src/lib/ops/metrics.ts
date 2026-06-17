/**
 * UniKart Ops — aggregation helpers (pure, no DB).
 *
 * Shared math for the dashboards: windowed counts (today / 7d / 30d), deltas,
 * per-day bucketing for charts, top-N rollups, and a deterministic demo-series
 * generator for clearly-labelled fallback charts when there's no real data yet.
 */
import { hashUnit } from "../utils";
import { shortDate } from "./format";
import type { ChartPoint, MetricDelta, NamedValue } from "./types";

export const DAY_MS = 86_400_000;

const toTime = (d: Date | string | number): number => new Date(d).getTime();

/** Count items whose date falls within the last `ms` from `now`. */
export function countWithin(
  dates: (Date | string)[],
  ms: number,
  now = Date.now(),
): number {
  const cutoff = now - ms;
  return dates.reduce((n, d) => (toTime(d) >= cutoff ? n + 1 : n), 0);
}

/** today (since local midnight) / last 7d / last 30d counts. */
export function windowCounts(
  dates: (Date | string)[],
  now = Date.now(),
): { today: number; d7: number; d30: number } {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const midnightMs = midnight.getTime();
  let today = 0;
  let d7 = 0;
  let d30 = 0;
  for (const d of dates) {
    const t = toTime(d);
    if (t >= midnightMs) today++;
    if (t >= now - 7 * DAY_MS) d7++;
    if (t >= now - 30 * DAY_MS) d30++;
  }
  return { today, d7, d30 };
}

/** Signed % delta between two counts, as a MetricDelta. */
export function delta(
  current: number,
  previous: number,
  upIsGood = true,
): MetricDelta {
  if (previous === 0) {
    return {
      pct: current === 0 ? 0 : 100,
      direction: current === 0 ? "flat" : "up",
      upIsGood,
    };
  }
  const pct = ((current - previous) / previous) * 100;
  return {
    pct: Math.round(pct * 10) / 10,
    direction: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat",
    upIsGood,
  };
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Count per day for the last `days` days → ChartPoint[] (oldest → newest). */
export function bucketByDay(
  items: (Date | string)[],
  days = 30,
  now = Date.now(),
): ChartPoint[] {
  const todayStart = startOfDay(now);
  const buckets = new Array(days).fill(0);
  for (const item of items) {
    const t = startOfDay(toTime(item));
    const idx = days - 1 - Math.round((todayStart - t) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets.map((value, i) => ({
    label: shortDate(new Date(todayStart - (days - 1 - i) * DAY_MS)),
    value,
  }));
}

/** Per-day sum of a numeric field for the last `days` days. */
export function bucketSumByDay<T>(
  items: T[],
  getDate: (x: T) => Date | string,
  getValue: (x: T) => number,
  days = 30,
  now = Date.now(),
): ChartPoint[] {
  const todayStart = startOfDay(now);
  const buckets = new Array(days).fill(0);
  for (const item of items) {
    const t = startOfDay(toTime(getDate(item)));
    const idx = days - 1 - Math.round((todayStart - t) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] += getValue(item) || 0;
  }
  return buckets.map((value, i) => ({
    label: shortDate(new Date(todayStart - (days - 1 - i) * DAY_MS)),
    value: Math.round(value * 100) / 100,
  }));
}

/** Per-day success vs failure counts (value = success, value2 = failure). */
export function bucketSuccessFailByDay<T>(
  items: T[],
  getDate: (x: T) => Date | string,
  isSuccess: (x: T) => boolean,
  days = 30,
  now = Date.now(),
): ChartPoint[] {
  const todayStart = startOfDay(now);
  const ok = new Array(days).fill(0);
  const fail = new Array(days).fill(0);
  for (const item of items) {
    const t = startOfDay(toTime(getDate(item)));
    const idx = days - 1 - Math.round((todayStart - t) / DAY_MS);
    if (idx >= 0 && idx < days) {
      if (isSuccess(item)) ok[idx]++;
      else fail[idx]++;
    }
  }
  return ok.map((value, i) => ({
    label: shortDate(new Date(todayStart - (days - 1 - i) * DAY_MS)),
    value,
    value2: fail[i],
  }));
}

/** Top-N rollup by a key, summing a value (default: count). */
export function topBy<T>(
  items: T[],
  getKey: (x: T) => string,
  getValue: (x: T) => number = () => 1,
  limit = 8,
): NamedValue[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item) || "—";
    map.set(key, (map.get(key) ?? 0) + (getValue(item) || 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Success rate as a 0–100 percentage (0 when no data). */
export function rate(success: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((success / total) * 1000) / 10;
}

/**
 * Deterministic demo series for clearly-labelled fallback charts (no real data
 * yet). Seeded so it's stable across renders (no hydration mismatch).
 */
export function demoSeries(
  seed: string,
  points = 30,
  base = 20,
  variance = 12,
  now = Date.now(),
): ChartPoint[] {
  const todayStart = startOfDay(now);
  return Array.from({ length: points }, (_, i) => {
    const u = hashUnit(`${seed}:${i}`);
    const trend = (i / points) * variance * 0.6;
    const value = Math.max(0, Math.round(base + trend + (u - 0.5) * variance));
    return {
      label: shortDate(new Date(todayStart - (points - 1 - i) * DAY_MS)),
      value,
    };
  });
}
