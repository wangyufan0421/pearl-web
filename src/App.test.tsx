import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { CandlestickChart } from "./App";
import { resetDataRuntime } from "./data/runtime";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetDataRuntime();
  window.history.replaceState({}, "", "/");
});

describe("Pearl community pages", () => {
  it("renders the Pearl introduction archive at the root path", () => {
    window.history.replaceState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Pearl 是什么" })).not.toBeNull();
    expect(screen.queryByText("Lighter · PRL 永续")).toBeNull();
    expect(screen.getByRole("link", { name: "数据总览" }).getAttribute("href")).toBe("/overview");
  });

  it("keeps existing /#overview bookmarks pointed at the real-time dashboard", () => {
    window.history.replaceState({}, "", "/#overview");
    render(<App />);

    expect(screen.getByText("Lighter · PRL 永续")).not.toBeNull();
  });

  it("keeps the data overview chrome focused on navigation and data", async () => {
    window.history.replaceState({}, "", "/overview");
    render(<App />);

    expect(screen.getByRole("link", { name: /Pearl 中文社区/i })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "AI" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Pearl 数据总览" })).toBeNull();
    expect(screen.queryByText("PEARL NETWORK / CHINESE COMMUNITY")).toBeNull();
    expect(screen.queryByText("文本 · 即将上线")).toBeNull();
    expect(screen.getByText("Lighter · PRL 永续")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "挖矿经济" })).toBeNull();
    expect(screen.getByRole("heading", { name: "链上实况" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "PRL 数据" })).not.toBeNull();
    expect(screen.getByRole("link", { name: /查看全部数据汇总/ }).getAttribute("href")).toBe("/valuation");
    expect(screen.getByRole("heading", { name: "AI 交叉" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "方法与版本" })).toBeNull();
    expect(screen.queryByRole("link", { name: "挖矿" })).toBeNull();
    expect(screen.queryByRole("link", { name: "方法" })).toBeNull();
  });

  it("reserves data cards for the public overview, on-chain, valuation, and AI series", () => {
    window.history.replaceState({}, "", "/overview");
    render(<App />);

    expect(screen.getAllByText("全网全成本").length).toBeGreaterThan(0);
    expect(screen.getByText("链上交易（24h）")).not.toBeNull();
    expect(screen.getByText("FDV / BTC")).not.toBeNull();
    expect(screen.getByText("推理并行成本")).not.toBeNull();
  });

  it("places the market trend inside the overview dashboard", () => {
    window.history.replaceState({}, "", "/overview");
    render(<App />);

    expect(screen.getByTestId("overview-market-panel")).not.toBeNull();
    expect(screen.getByText("Lighter · PRL 永续")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "网络脉搏" })).toBeNull();
  });

  it("provides K-line zoom controls and an accessible chart interaction surface", () => {
    window.history.replaceState({}, "", "/overview");
    render(<App />);

    expect(screen.getByRole("button", { name: "放大图表" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "缩小图表" })).not.toBeNull();
    expect(screen.getByTestId("candlestick-interaction")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "放大图表" }));
    expect(screen.getByText("2×")).not.toBeNull();
  });

  it("shows the selected candle's time and OHLC values on hover", () => {
    render(<CandlestickChart zoom={1} candles={[
      { timestamp: new Date("2026-10-08T00:00:00Z"), open: 1, high: 1.3, low: .8, close: 1.2, volume: 10 },
      { timestamp: new Date("2026-10-08T01:00:00Z"), open: 1.2, high: 1.6, low: 1.1, close: 1.5, volume: 12 },
    ]} />);

    const chart = screen.getByRole("img", { name: "Lighter PRL 永续 K 线图" });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 660 }) });
    fireEvent.mouseMove(chart, { clientX: 500 });

    expect(screen.getByText("开 $1.20")).not.toBeNull();
    expect(screen.getByText("高 $1.60")).not.toBeNull();
    expect(screen.getByText("低 $1.10")).not.toBeNull();
    expect(screen.getByText("收 $1.50")).not.toBeNull();
  });

  it("maps pointer coordinates to the candle plot instead of the right-hand price axis", () => {
    const candles = Array.from({ length: 100 }, (_, index) => {
      const open = 1 + index / 100;
      return { timestamp: new Date(1760000000000 + index * 3600000), open, high: open + .05, low: open - .05, close: open + .02, volume: 10 };
    });
    render(<CandlestickChart zoom={1} candles={candles} />);

    const chart = screen.getByRole("img", { name: "Lighter PRL 永续 K 线图" });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 660 }) });
    fireEvent.mouseMove(chart, { clientX: 303 });

    expect(screen.getByText("开 $1.50")).not.toBeNull();
  });

  it("renders the Chain subpage at the /chain path", () => {
    window.history.replaceState({}, "", "/chain");
    render(<App />);

    expect(screen.getByRole("heading", { name: "网络概览" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "AI" })).toBeNull();
  });

  it("renders the valuation subpage at the /valuation path without the Lighter K-line", () => {
    window.history.replaceState({}, "", "/valuation");
    render(<App />);

    expect(screen.getByRole("heading", { name: "PRL 数据图表" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "AI" })).toBeNull();
    expect(screen.getByRole("heading", { name: "估值" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "供给" })).not.toBeNull();
    expect(screen.queryByText("Lighter · PRL 永续")).toBeNull();
  });

  it("shows the exact date and sats value for a hovered selected chart point", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("m=prl_btc")
        ? [{ meta: { id: "prl_btc", label: "PRL priced in Bitcoin", unit: "sats" }, points: [{ t: 1760054400, v: 1200 }, { t: 1760140800, v: 1370 }] }]
        : [];
      return new Response(JSON.stringify(payload), { status: 200 });
    }));
    window.history.replaceState({}, "", "/valuation");
    render(<App />);

    const point = await screen.findByRole("button", { name: /2025\/10\/11.*1,370 sats/ });
    fireEvent.mouseEnter(point);

    expect(screen.getByTestId("price-trend-tooltip").textContent).toContain("1,370 sats");
  });

  it("keeps the final valuation module focused on supply data", () => {
    window.history.replaceState({}, "", "/valuation");
    render(<App />);

    expect(screen.getByRole("heading", { name: "供给" })).not.toBeNull();
    expect(screen.queryByText("SafeTrade 成交量")).toBeNull();
    expect(screen.queryByText("永续交易量")).toBeNull();
    expect(screen.queryByText("永续未平仓量")).toBeNull();
  });

  it("switches the valuation chart to the metric selected from its dropdown", async () => {
    const series = {
      price: [{ meta: { id: "price", label: "PRL price", unit: "USD" }, points: [{ t: 1760054400, v: 1.2 }, { t: 1760140800, v: 1.37 }] }],
      fdv_vs_btc: [{ meta: { id: "fdv_vs_btc", label: "Pearl FDV vs Bitcoin", unit: "%" }, points: [{ t: 1760054400, v: .12 }, { t: 1760140800, v: .164 }] }],
    } as Record<string, unknown>;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const metric = new URL(String(input), "http://localhost").searchParams.get("m") ?? "";
      return new Response(JSON.stringify(series[metric] ?? []), { status: 200 });
    }));
    window.history.replaceState({}, "", "/valuation");
    render(<App />);

    const selector = await screen.findByLabelText("图表指标");
    fireEvent.change(selector, { target: { value: "fdv_vs_btc" } });

    expect(await screen.findByRole("button", { name: /2025\/10\/11.*0\.164%/ })).not.toBeNull();
  });

  it("presents the PRL chart summary without a standalone PRL price option", () => {
    window.history.replaceState({}, "", "/valuation");
    render(<App />);

    expect(screen.getByRole("heading", { name: "PRL 数据图表" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "数据" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "PRL挖矿成本" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "PRL price" })).toBeNull();
  });
});
