import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ValuationPage, { chartLatestValue, latestObservedSupply, PriceTrend, supplyProgress } from "./ValuationPage";
import type { DataResult, MetricSeries } from "./data/prlstats";

afterEach(cleanup);

describe("PriceTrend", () => {
  it("reveals the pointed data through one chart interaction surface", () => {
    render(<PriceTrend
      label="PRL挖矿成本"
      formatter={(value) => `$${value.toFixed(2)}`}
      points={[
        { timestamp: new Date("2026-10-09T00:00:00Z"), value: 1.1 },
        { timestamp: new Date("2026-10-10T00:00:00Z"), value: 1.24 },
      ]}
    />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);

    const chart = screen.getByTestId("price-trend-interaction");
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 840 }) });
    fireEvent.mouseMove(chart, { clientX: 630 });

    expect(screen.getByTestId("price-trend-tooltip").textContent).toContain("$1.24");
  });

  it("formats the newest chart point for the chart title", () => {
    expect(chartLatestValue([{ timestamp: new Date("2026-10-10T00:00:00Z"), value: 1.24 }], (value) => `$${value.toFixed(2)}`)).toBe("$1.24");
  });
});

describe("ValuationPage supply section", () => {
  it("takes supply cards and market cap from the latest observed point, not the forecast", () => {
    const series: DataResult<MetricSeries> = {
      data: { id: "supply", label: "Circulating supply", unit: "PRL", points: [
        { timestamp: new Date("2026-10-09T00:00:00Z"), value: 350_000_000, projected: false },
        { timestamp: new Date("2026-10-10T00:00:00Z"), value: 2_500_000_000, projected: false },
        { timestamp: new Date("2026-11-09T00:00:00Z"), value: 1_240_000_000, projected: true },
      ] },
      sourceKind: "live", fetchedAt: new Date("2026-10-09T00:00:00Z"),
    };
    expect(latestObservedSupply(series, new Date("2026-10-19T00:00:00Z").getTime())).toBe(350_000_000);
  });

  it("prioritizes observed supply over an older network snapshot for progress", () => {
    expect(supplyProgress(350_000_000, 338_000_000)).toEqual({ issued: 350_000_000, percent: 350_000_000 / 2_100_000_000 * 100 });
    expect(supplyProgress(undefined, 338_000_000)?.issued).toBe(338_000_000);
  });

  it("places the supply history chart immediately below the six supply cards", () => {
    render(<ValuationPage />);

    const cards = document.querySelector(".supply-cards");
    const chart = screen.getByRole("region", { name: "PRL 供应历史" });
    expect(cards?.children).toHaveLength(6);
    expect(cards?.nextElementSibling).toBe(chart);
    expect(chart.textContent).toContain("prlstats · 实际观测数据");
  });
});
