import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChainPage, { Trend } from "./ChainPage";
import { fallbackNetworkSnapshot } from "./data/fixtures";
import * as runtime from "./data/runtime";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ChainPage", () => {
  it("keeps hashrate history visible when the current network snapshot is unavailable", async () => {
    vi.spyOn(runtime, "loadNetworkSnapshot").mockResolvedValue({ data: fallbackNetworkSnapshot, sourceKind: "fallback", fetchedAt: new Date("2026-10-19T05:00:00Z"), notice: "暂时无法读取实时数据，当前仅展示最近可用样本。" });
    vi.spyOn(runtime, "loadMetricSeries").mockResolvedValue({ data: { id: "hashrate", label: "Network hashrate", unit: "H/s", points: [
      { timestamp: new Date("2026-10-08T00:00:00Z"), value: 60e18 },
      { timestamp: new Date("2026-10-09T00:00:00Z"), value: 68e18 },
    ] }, sourceKind: "live", fetchedAt: new Date("2026-10-19T05:00:00Z") });
    render(<ChainPage />);
    expect(await screen.findByText("暂时无法读取实时数据，当前仅展示最近可用样本。")).not.toBeNull();
    expect(await screen.findByTestId("hashrate-history-interaction", {}, { timeout: 1000 })).not.toBeNull();
  });
  it("keeps saved pool data visible alongside a stale-data notice", async () => {
    vi.spyOn(runtime, "loadPools").mockResolvedValue({ data: [{ id: "saved", name: "Saved Pool", blocks24h: 2, share24h: 12, feePct: null, payoutScheme: null }], sourceKind: "live", fetchedAt: new Date("2026-10-12T00:00:00Z"), stale: true, notice: "当前显示上次成功保存的数据，后台仍在尝试更新。" });
    render(<ChainPage />);
    expect(await screen.findByText("当前显示上次成功保存的数据，后台仍在尝试更新。")).toBeTruthy();
    expect(screen.getByText("Saved Pool")).toBeTruthy();
  });
  it("renders every public-chain module with its provenance boundary", () => {
    render(<ChainPage />);

    expect(screen.queryByRole("heading", { name: "链上数据" })).toBeNull();
    expect(screen.getByRole("heading", { name: "网络概览" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "PEARL 全网算力历史" })).not.toBeNull();
    expect(document.querySelector(".chain-overview-grid")?.nextElementSibling?.classList.contains("hashrate-history-panel")).toBe(true);
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
