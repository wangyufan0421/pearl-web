import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ChainPage, { Trend } from "./ChainPage";

afterEach(cleanup);

describe("ChainPage", () => {
  it("renders every public-chain module with its provenance boundary", () => {
    render(<ChainPage />);

    expect(screen.queryByRole("heading", { name: "链上数据" })).toBeNull();
    expect(screen.getByRole("heading", { name: "网络概览" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "矿池 Pools" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "链上活跃度 Activity" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "交易规模 TX Size" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "持币地址 Holders" })).not.toBeNull();
    expect(screen.getByText(/Solo \/ unknown/)).not.toBeNull();
    expect(screen.getByText(/移动不等于卖出/)).not.toBeNull();
    expect(screen.queryByText(/prlstats 节点快照/)).toBeNull();
    expect(screen.queryByText(/全节点 UTXO/)).toBeNull();
  });

  it("shows the exact date, value, and unit for a hovered activity bar", () => {
    render(<Trend label="交易数趋势" unit="tx/day" points={[
      { timestamp: new Date("2026-10-08T00:00:00Z"), value: 12 },
      { timestamp: new Date("2026-10-09T00:00:00Z"), value: 42 },
    ]} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /42 tx\/day/ }));

    expect(screen.getByTestId("trend-tooltip").textContent).toContain("42 tx/day");
  });
});
