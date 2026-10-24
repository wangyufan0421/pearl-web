import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "./i18n/Language";
import PearlVsBitcoinPage, { ComparisonHistoryChart } from "./PearlVsBitcoinPage";
import { MarketCapComparisonChart } from "./MarketCapComparisonChart";
import { resetDataRuntime } from "./data/runtime";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetDataRuntime(); window.history.replaceState({}, "", "/"); });

describe("Pearl vs Bitcoin page", () => {
  it("explains the model and displays all five physical and issuance comparisons", () => {
    window.history.replaceState({}, "", "/pearl-vs-bitcoin");
    render(<LanguageProvider><PearlVsBitcoinPage /></LanguageProvider>);
    expect(screen.getByRole("heading", { name: "Pearl vs Bitcoin" })).not.toBeNull();
    expect(screen.getByText(/不可直接比较算力/)).not.toBeNull();
    for (const heading of ["功耗占比", "两网功耗", "等效设备数", "硬件重建成本", "每日发行价值"]) {
      expect(screen.getByRole("heading", { name: heading })).not.toBeNull();
    }
    expect(screen.queryByRole("heading", { name: "六条市值曲线" })).toBeNull();
    expect(screen.getByRole("link", { name: /prlstats.*方法/ }).getAttribute("href")).toBe("https://prlstats.com/networks");
  });

  it("shows exact history values on pointer hover and changes time range", () => {
    const now = Date.now();
    const points = [{ timestamp: new Date(now - 10 * 86_400_000), value: .5 }, { timestamp: new Date(now - 86_400_000), value: .8 }];
    render(<LanguageProvider><ComparisonHistoryChart title="功耗占比" points={points} unit="%" color="rose" /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: "功耗占比历史图" });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 800 }) });
    fireEvent.pointerMove(chart, { clientX: 700 });
    expect(screen.getByTestId("comparison-tooltip").textContent).toContain("0.80%");
    fireEvent.click(screen.getByRole("button", { name: "ALL" }));
    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a tapped data point visible after a touch pointer leaves the chart", () => {
    const now = Date.now();
    const points = [{ timestamp: new Date(now - 10 * 86_400_000), value: .5 }, { timestamp: new Date(now - 86_400_000), value: .8 }];
    render(<LanguageProvider><ComparisonHistoryChart title="功耗占比" points={points} unit="%" color="rose" /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: "功耗占比历史图" });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 800 }) });
    fireEvent.pointerDown(chart, { clientX: 700, pointerType: "touch" });
    fireEvent.pointerLeave(chart, { pointerType: "touch" });
    expect(screen.getByTestId("comparison-tooltip").textContent).toContain("0.80%");
  });

  it("announces the selected value when navigating a chart by keyboard", () => {
    const now = Date.now();
    const points = [{ timestamp: new Date(now - 10 * 86_400_000), value: .5 }, { timestamp: new Date(now - 86_400_000), value: .8 }];
    render(<LanguageProvider><ComparisonHistoryChart title="功耗占比" points={points} unit="%" color="rose" /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: "功耗占比历史图" });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status").textContent).toContain("0.50%");
  });
  it("keeps PEARL visible and lets peer cards independently toggle market-cap lines", () => {
    const points = (values: number[]) => values.map((value, index) => ({ timestamp: new Date(Date.UTC(2026, 9, 1 + index)), value }));
    render(<LanguageProvider><MarketCapComparisonChart series={{ pearl: points([100, 150]), btc: points([1000, 1100]), bch: points([500, 400]), fil: points([300, 350]), zec: points([200, 220]), tao: points([600, 650]) }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    const visible = () => [...chart.querySelectorAll("path[data-asset]")].map(path => path.getAttribute("data-asset"));
    expect(visible()).toEqual(["pearl", "btc"]);
    const btc = screen.getByRole("button", { name: /BTC/ });
    const bch = screen.getByRole("button", { name: /BCH/ });
    const fil = screen.getByRole("button", { name: /FIL/ });
    expect(btc.getAttribute("aria-pressed")).toBe("true");
    expect(bch.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(bch);
    expect(visible()).toEqual(["pearl", "btc", "bch"]);
    fireEvent.click(btc);
    expect(visible()).toEqual(["pearl", "bch"]);
    fireEvent.click(fil);
    expect(visible()).toEqual(["pearl", "bch", "fil"]);
    fireEvent.click(bch);
    fireEvent.click(fil);
    expect(visible()).toEqual(["pearl"]);
    expect(screen.queryByRole("button", { name: /^PEARL$/ })).toBeNull();
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 800 }) });
    fireEvent.pointerMove(chart, { clientX: 700 });
    const tooltip = screen.getByTestId("market-cap-tooltip");
    expect(tooltip.textContent).toContain("PEARL");
    for (const symbol of ["BTC", "BCH", "FIL", "ZEC", "TAO"]) expect(tooltip.textContent).not.toContain(symbol);
  });
  it("aligns each asset's available history edge to edge without calendar ticks", () => {
    const point = (date: string, value: number, projected = false) => ({ timestamp: new Date(`${date}T00:00:00Z`), value, projected });
    render(<LanguageProvider><MarketCapComparisonChart series={{
      pearl: [point("2026-03-01", 50, true), point("2026-06-22", 100), point("2026-10-23", 200)],
      btc: [point("2010-07-18", 10), point("2013-06-28", 100), point("2018-09-04", 1000), point("2022-09-29", 500), point("2026-01-01", 900), point("2026-10-23", 1200)],
    }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    const pearlPath = chart.querySelector('path[data-asset="pearl"]')?.getAttribute("d") ?? "";
    const btcPath = chart.querySelector('path[data-asset="btc"]')?.getAttribute("d") ?? "";
    expect(btcPath).toMatch(/^M77\.00,/);
    expect(btcPath.match(/[ML]/g)).toHaveLength(6);
    const btcXs = [...btcPath.matchAll(/[ML]([\d.]+),/g)].map(match => Number(match[1]));
    const pearlXs = [...pearlPath.matchAll(/[ML]([\d.]+),/g)].map(match => Number(match[1]));
    expect(pearlXs[0]).toBeCloseTo(77, 1);
    expect(pearlXs.at(-1)).toBeCloseTo(978, 1);
    expect(btcXs.at(-1)).toBeCloseTo(978, 1);
    expect(chart.querySelectorAll(".market-cap-axis")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "市值图时间范围" })).toBeNull();
    expect(screen.getByText(/各币种独立时间轴/)).not.toBeNull();
  });
  it("keeps the hover guide and highlighted points directly under the pointer", () => {
    const points = (values: number[]) => values.map((value, index) => ({ timestamp: new Date(Date.UTC(2026, 9, 1 + index)), value }));
    render(<LanguageProvider><MarketCapComparisonChart series={{ pearl: points([100, 150]), btc: points([1000, 1100]) }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 100, width: 800 }) });
    const expectedSvgX = 77 + 901 / 2;
    fireEvent.pointerMove(chart, { clientX: 100 + expectedSvgX / 1000 * 800 });
    const guide = chart.querySelector(".market-cap-focus line");
    expect(Number(guide?.getAttribute("x1"))).toBeCloseTo(expectedSvgX, 2);
    for (const circle of chart.querySelectorAll(".market-cap-focus circle")) expect(Number(circle.getAttribute("cx"))).toBeCloseTo(expectedSvgX, 2);
  });
  it("shows each asset's own observed date and value at the same relative position", () => {
    const point = (date: string, value: number) => ({ timestamp: new Date(`${date}T00:00:00Z`), value });
    render(<LanguageProvider><MarketCapComparisonChart series={{
      pearl: [point("2026-01-01", 100), point("2026-07-02", 150), point("2026-12-31", 200)],
      btc: [point("2010-01-01", 10), point("2018-01-01", 900), point("2026-01-01", 1200)],
    }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 1000 }) });
    const midpointX = 77 + 901 / 2;
    fireEvent.pointerMove(chart, { clientX: midpointX });
    const tooltip = screen.getByTestId("market-cap-tooltip");
    expect(tooltip.textContent).toContain("2026年7月2日");
    expect(tooltip.textContent).toContain("2018年1月1日");
    expect(tooltip.textContent).toContain("$150");
    expect(tooltip.textContent).toContain("$900");
    expect(Number(chart.querySelector(".market-cap-focus line")?.getAttribute("x1"))).toBeCloseTo(midpointX, 2);
  });
  it("moves keyboard focus by a visible step on the relative axis", () => {
    const point = (date: string, value: number) => ({ timestamp: new Date(`${date}T00:00:00Z`), value });
    render(<LanguageProvider><MarketCapComparisonChart series={{
      pearl: [point("2026-06-22", 100), point("2026-10-23", 200)],
      btc: [point("2010-07-18", 10), point("2026-01-01", 900), point("2026-10-23", 1200)],
    }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(Number(chart.querySelector(".market-cap-focus line")?.getAttribute("x1"))).toBeCloseTo(978 - 901 / 30, 1);
  });
  it("does not jump to the final date when a pointer click focuses the chart", () => {
    const points = [100, 150].map((value, index) => ({ timestamp: new Date(Date.UTC(2026, 9, 1 + index)), value }));
    render(<LanguageProvider><MarketCapComparisonChart series={{ pearl: points }} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: /市值对比/ });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 1000 }) });
    fireEvent.pointerDown(chart, { clientX: 77 + 901 / 2 });
    fireEvent.focus(chart);
    expect(Number(chart.querySelector(".market-cap-focus line")?.getAttribute("x1"))).toBeCloseTo(77 + 901 / 2, 2);
  });
});
