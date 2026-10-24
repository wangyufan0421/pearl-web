import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatHashrateValue, HashrateHistoryChart, prepareHashrateHistory } from "./HashrateHistoryChart";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";

afterEach(cleanup);

const point = (day: string, value: number, projected = false): MetricPoint => ({ timestamp: new Date(day), value, projected });
const result = (points: MetricPoint[]): DataResult<MetricSeries> => ({
  data: { id: "hashrate", label: "Network hashrate", unit: "H/s", points },
  sourceKind: "live",
  fetchedAt: new Date("2026-10-19T05:00:00Z"),
});

describe("prepareHashrateHistory", () => {
  it("keeps the final observed reading per UTC day and excludes forecasts", () => {
    const rows = prepareHashrateHistory([
      point("2026-10-08T01:00:00Z", 60e18),
      point("2026-10-08T20:00:00Z", 65e18),
      point("2026-10-09T01:00:00Z", 68e18),
      point("2026-10-10T01:00:00Z", 70e18, true),
      point("2026-10-20T01:00:00Z", 72e18),
      point("2026-10-11T01:00:00Z", -1),
    ], "ALL", new Date("2026-10-19T00:00:00Z").getTime());
    expect(rows.map(row => row.value)).toEqual([65e18, 68e18]);
  });

  it("anchors the chosen time range to the latest observed reading", () => {
    const points = [
      point("2026-04-27T00:00:00Z", 290e12),
      point("2026-08-01T00:00:00Z", 30e18),
      point("2026-09-20T00:00:00Z", 60e18),
      point("2026-10-10T00:00:00Z", 68e18),
    ];
    expect(prepareHashrateHistory(points, "30D", new Date("2026-10-19T00:00:00Z").getTime()).map(row => row.value)).toEqual([60e18, 68e18]);
    expect(prepareHashrateHistory(points, "ALL", new Date("2026-10-19T00:00:00Z").getTime())).toHaveLength(4);
  });
});

describe("HashrateHistoryChart", () => {
  it("formats both early TH/s and current EH/s readings", () => {
    expect(formatHashrateValue(290e12)).toBe("290.0 TH/s");
    expect(formatHashrateValue(68e18)).toBe("68.0 EH/s");
  });

  it("shows observed history by default and reveals the reading on hover", () => {
    render(<HashrateHistoryChart result={result([
      point("2026-04-27T00:00:00Z", 290e12),
      point("2026-10-08T00:00:00Z", 60e18),
      point("2026-10-09T00:00:00Z", 68e18),
    ])} />);

    const chart = screen.getByTestId("hashrate-history-interaction");
    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe("true");
    expect(chart.textContent).toContain("2026/4/27");
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 840 }) });
    fireEvent.pointerMove(chart, { clientX: 825 });
    expect(screen.getByTestId("hashrate-history-tooltip").textContent).toContain("68.0 EH/s");
    fireEvent.pointerLeave(chart);
    expect(screen.queryByTestId("hashrate-history-tooltip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "30D" }));
    expect(chart.textContent).not.toContain("2026/4/27");
  });

  it("does not invent a trend when no history is available", () => {
    render(<HashrateHistoryChart result={result([])} />);
    expect(screen.getByText("暂无可用算力历史")).not.toBeNull();
  });
});
