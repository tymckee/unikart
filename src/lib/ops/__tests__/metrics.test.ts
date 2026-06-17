import { describe, it, expect } from "vitest";
import {
  windowCounts,
  countWithin,
  delta,
  bucketByDay,
  bucketSuccessFailByDay,
  topBy,
  rate,
  demoSeries,
  DAY_MS,
} from "@/lib/ops/metrics";

const NOW = new Date("2026-06-17T12:00:00Z").getTime();

describe("windowCounts / countWithin", () => {
  it("buckets dates into today/7d/30d", () => {
    const dates = [
      new Date(NOW - 1 * 60 * 60 * 1000), // today
      new Date(NOW - 3 * DAY_MS), // within 7d
      new Date(NOW - 20 * DAY_MS), // within 30d
      new Date(NOW - 60 * DAY_MS), // outside
    ];
    const w = windowCounts(dates, NOW);
    expect(w.d30).toBe(3);
    expect(w.d7).toBe(2);
    expect(w.today).toBe(1);
  });

  it("countWithin respects the window", () => {
    const dates = [new Date(NOW - 2 * DAY_MS), new Date(NOW - 10 * DAY_MS)];
    expect(countWithin(dates, 7 * DAY_MS, NOW)).toBe(1);
  });
});

describe("delta", () => {
  it("computes signed percentage and direction", () => {
    expect(delta(120, 100).pct).toBe(20);
    expect(delta(120, 100).direction).toBe("up");
    expect(delta(80, 100).direction).toBe("down");
    expect(delta(100, 100).direction).toBe("flat");
  });
  it("handles zero previous", () => {
    expect(delta(5, 0).direction).toBe("up");
    expect(delta(0, 0).direction).toBe("flat");
  });
  it("carries upIsGood", () => {
    expect(delta(10, 5, false).upIsGood).toBe(false);
  });
});

describe("bucketByDay", () => {
  it("produces one point per day, counts placed correctly", () => {
    const items = [new Date(NOW), new Date(NOW), new Date(NOW - 1 * DAY_MS)];
    const pts = bucketByDay(items, 7, NOW);
    expect(pts).toHaveLength(7);
    expect(pts[6].value).toBe(2); // today
    expect(pts[5].value).toBe(1); // yesterday
    expect(pts[0].value).toBe(0);
  });
});

describe("bucketSuccessFailByDay", () => {
  it("splits success vs failure per day", () => {
    const rows = [
      { d: new Date(NOW), ok: true },
      { d: new Date(NOW), ok: false },
      { d: new Date(NOW), ok: true },
    ];
    const pts = bucketSuccessFailByDay(rows, (r) => r.d, (r) => r.ok, 3, NOW);
    expect(pts[2].value).toBe(2); // successes today
    expect(pts[2].value2).toBe(1); // failures today
  });
});

describe("topBy", () => {
  it("rolls up and sorts descending", () => {
    const rows = [{ k: "a" }, { k: "a" }, { k: "b" }];
    const top = topBy(rows, (r) => r.k);
    expect(top[0]).toEqual({ name: "a", value: 2 });
    expect(top[1]).toEqual({ name: "b", value: 1 });
  });
});

describe("rate", () => {
  it("computes a percentage and guards divide-by-zero", () => {
    expect(rate(9, 10)).toBe(90);
    expect(rate(0, 0)).toBe(0);
  });
});

describe("demoSeries", () => {
  it("is deterministic for a given seed (no hydration mismatch)", () => {
    const a = demoSeries("seed", 10, 20, 12, NOW);
    const b = demoSeries("seed", 10, 20, 12, NOW);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(a.every((p) => p.value >= 0)).toBe(true);
  });
});
