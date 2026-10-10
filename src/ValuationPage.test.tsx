import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { chartLatestValue, PriceTrend } from "./ValuationPage";

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
