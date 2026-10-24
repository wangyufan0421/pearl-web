import { describe, expect, it } from "vitest";
import type { MetricPoint } from "./prlstats";
import { latestObservedPoint, selectComparisonPoints } from "./bitcoinComparison";

const day = 24 * 60 * 60 * 1000;
const point = (date: string, value: number, projected = false): MetricPoint => ({ timestamp: new Date(date), value, projected });

describe("Bitcoin comparison history", () => {
  it("filters by the requested window without charting projected, invalid or future observations", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const points = [
      point("2026-07-01T00:00:00Z", 1),
      point("2026-09-21T00:00:00Z", 2),
      point("2026-10-20T00:00:00Z", 3),
      point("2026-10-20T01:00:00Z", Number.NaN),
      point("2026-10-20T02:00:00Z", 99, true),
      point("2026-10-22T00:00:00Z", 100),
    ];
    expect(selectComparisonPoints(points, "30D", now).map(row => row.value)).toEqual([2, 3]);
    expect(selectComparisonPoints(points, "90D", now).map(row => row.value)).toEqual([2, 3]);
    expect(selectComparisonPoints(points, "ALL", now).map(row => row.value)).toEqual([1, 2, 3]);
  });

  it("keeps the start and latest point while bounding dense history", () => {
    const start = Date.parse("2026-10-01T00:00:00Z");
    const points = Array.from({ length: 1000 }, (_, index) => ({ timestamp: new Date(start + index * day / 50), value: index }));
    const selected = selectComparisonPoints(points, "ALL", new Date(start + 30 * day), 100);
    expect(selected.length).toBeLessThanOrEqual(100);
    expect(selected[0].value).toBe(0);
    expect(selected.at(-1)?.value).toBe(999);
    expect(selected.some(row => row.value > 400 && row.value < 600)).toBe(true);
  });

  it("reads the latest actual date from each series, never a projection", () => {
    const points = [point("2026-10-20T00:00:00Z", 50), point("2026-10-19T00:00:00Z", 40), point("2026-10-21T00:00:00Z", 70, true)];
    expect(latestObservedPoint(points, new Date("2026-10-21T01:00:00Z"))?.value).toBe(50);
    expect(latestObservedPoint([], new Date())).toBeNull();
  });
});
