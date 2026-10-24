import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { prepareSupplyHistory, SupplyHistoryChart } from "./SupplyHistoryChart";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";

afterEach(cleanup);

const point = (day: string, value: number, projected = false): MetricPoint => ({
  timestamp: new Date(day), value, projected,
});

const result = (points: MetricPoint[]): DataResult<MetricSeries> => ({
  data: { id: "supply", label: "Circulating supply", unit: "PRL", points },
  sourceKind: "live",
  fetchedAt: new Date("2026-10-10T12:00:00Z"),
});

describe("prepareSupplyHistory", () => {
  it("keeps the latest observed point per UTC day", () => {
    const rows = prepareSupplyHistory([
      point("2026-10-08T02:00:00Z", 310_000_000),
      point("2026-10-08T20:00:00Z", 320_000_000),
      point("2026-10-09T08:00:00Z", 330_000_000),
      point("2026-10-10T08:00:00Z", 340_000_000, true),
    ], "ALL", new Date("2026-10-19T00:00:00Z").getTime());

    expect(rows.map(row => row.issued)).toEqual([320_000_000, 330_000_000]);
  });

  it("anchors 30D and 90D to the final observed point and rejects future points", () => {
    const points = [
      point("2026-07-01T00:00:00Z", 260_000_000),
      point("2026-08-01T00:00:00Z", 280_000_000),
      point("2026-09-20T00:00:00Z", 310_000_000),
      point("2026-10-15T00:00:00Z", 330_000_000),
      point("2026-10-25T00:00:00Z", 350_000_000),
    ];
    const now = new Date("2026-10-19T00:00:00Z").getTime();

    expect(prepareSupplyHistory(points, "30D", now).map(row => row.issued)).toEqual([310_000_000, 330_000_000]);
    expect(prepareSupplyHistory(points, "90D", now).map(row => row.issued)).toEqual([280_000_000, 310_000_000, 330_000_000]);
  });
});

describe("SupplyHistoryChart", () => {
  it("explains when the supply series has too few observed points", () => {
    render(<SupplyHistoryChart result={result([point("2026-10-09T00:00:00Z", 330_000_000)])} />);
    expect(screen.queryByText("暂无可用供应历史")).not.toBeNull();
  });

  it("defaults to all observed history with an issued-only framed line and a readable tooltip", () => {
    render(<SupplyHistoryChart result={result([
      point("2026-04-08T00:00:00Z", 10_000_000),
      point("2026-10-08T00:00:00Z", 320_000_000),
      point("2026-10-09T00:00:00Z", 330_000_000),
    ])} />);

    const chart = screen.getByTestId("supply-history-interaction");
    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe("true");
    expect(chart.textContent).toContain("2026/4/8");
    expect(chart.textContent).toContain("4亿");
    expect(chart.textContent).not.toContain("21亿");
    expect(chart.querySelector(".supply-history-frame")).not.toBeNull();
    expect(chart.querySelector(".supply-history-issued")).toBeNull();
    expect(chart.querySelector(".supply-history-unissued")).toBeNull();
    expect(screen.queryByText("尚未发行 PRL")).toBeNull();
    expect(chart.textContent).toContain("PEARL");
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 840 }) });
    fireEvent.pointerMove(chart, { clientX: 825 });

    const tooltip = screen.getByTestId("supply-history-tooltip");
    expect(tooltip.textContent).toContain("2026");
    expect(tooltip.textContent).toContain("3.3亿 PEARL");
    expect(tooltip.textContent).not.toContain("尚未发行");

    fireEvent.pointerLeave(chart);
    expect(screen.queryByTestId("supply-history-tooltip")).toBeNull();
  });
});
