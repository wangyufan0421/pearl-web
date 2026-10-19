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
  it("keeps the latest observed point per UTC day and calculates unissued supply", () => {
    const rows = prepareSupplyHistory([
      point("2026-10-08T02:00:00Z", 310_000_000),
      point("2026-10-08T20:00:00Z", 320_000_000),
      point("2026-10-09T08:00:00Z", 330_000_000),
      point("2026-10-10T08:00:00Z", 340_000_000, true),
    ], "ALL", new Date("2026-10-19T00:00:00Z").getTime());

    expect(rows.map(row => row.issued)).toEqual([320_000_000, 330_000_000]);
    expect(rows.map(row => row.remaining)).toEqual([1_780_000_000, 1_770_000_000]);
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

  it("shows both PRL quantities and the date on pointer hover, then hides them", () => {
    render(<SupplyHistoryChart result={result([
      point("2026-10-08T00:00:00Z", 320_000_000),
      point("2026-10-09T00:00:00Z", 330_000_000),
    ])} />);

    const chart = screen.getByTestId("supply-history-interaction");
    expect(chart.textContent).toContain("PRL");
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 840 }) });
    fireEvent.pointerMove(chart, { clientX: 780 });

    const tooltip = screen.getByTestId("supply-history-tooltip");
    expect(tooltip.textContent).toContain("2026");
    expect(tooltip.textContent).toContain("330,000,000 PRL");
    expect(tooltip.textContent).toContain("1,770,000,000 PRL");

    fireEvent.pointerLeave(chart);
    expect(screen.queryByTestId("supply-history-tooltip")).toBeNull();
  });
});
