import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { CandlestickChart } from "./App";
import { LanguageProvider } from "./i18n/Language";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); localStorage.clear(); });

describe("bilingual site", () => {
  it.each(["/en", "/en/archive", "/en/overview", "/en/chain", "/en/valuation", "/en/archive/core-mechanism", "/en/archive/articles", "/en/archive/people", "/en/archive/whitepaper"])("translates all website text and readable labels on %s", async (path) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("heading").length).toBeGreaterThan(0));
    // Allow requests to settle so that error and fallback copy are checked too.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/);
    expect(document.body.textContent).not.toMatch(/\bPRL\b/);
    for (const element of document.querySelectorAll("[aria-label], [title], [alt]")) {
      if (element.getAttribute("lang") === "zh-CN") continue;
      expect([element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("alt")].join(" ")).not.toMatch(/[\u3400-\u9fff]/);
    }
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
      expect(link.getAttribute("href")).toMatch(/^\/(?:en(?:\/|$)|documents\/)/);
    }
  });
  it("renders the English introduction with localized navigation and metadata", () => {
    window.history.replaceState({}, "", "/en");
    render(<App />);
    expect(screen.getByRole("heading", { name: "What is Pearl?", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "On-chain data" })).toHaveAttribute("href", "/en/chain");
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", "Understand Pearl's duplex computation, proof of useful work and technical limits.");
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/);
  });
  it("switches languages on the same page and preserves its fragment", () => {
    window.history.replaceState({}, "", "/archive/core-mechanism?view=reading#pearl-gemm");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/en/archive/core-mechanism?view=reading#pearl-gemm");
    expect(screen.getByRole("heading", { name: "Core mechanism", level: 1 })).toBeInTheDocument();
    expect(localStorage.getItem("pearl-language")).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("heading", { name: "核心机制", level: 1 })).toBeInTheDocument();
  });
  it("uses the original English PDF on the English whitepaper page", () => {
    window.history.replaceState({}, "", "/en/archive/whitepaper");
    render(<App />);
    expect(screen.getAllByRole("link", { name: /Open original in a new tab/ })[0]).toHaveAttribute("href", "/documents/pearl-whitepaper-en.pdf");
  });
  it("retains chart selection, zoom and shared data when switching language", async () => {
    window.history.replaceState({}, "", "/overview");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "30D" }));
    fireEvent.click(screen.getByRole("button", { name: "放大图表" }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
    const requestsBeforeSwitch = vi.mocked(fetch).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "30D" })).toHaveClass("active");
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(requestsBeforeSwitch);
  });
  it("translates live OHLC tooltip labels and dates without changing values", () => {
    window.history.replaceState({}, "", "/en/overview");
    render(<LanguageProvider><CandlestickChart zoom={1} candles={Array.from({ length: 4 }, (_, index) => ({ timestamp: new Date(Date.UTC(2026, 9, 8, index)), open: 1.2, high: 1.6, low: 1.1, close: 1.5, volume: 12 }))} /></LanguageProvider>);
    const chart = screen.getByRole("img", { name: "Lighter PEARL perpetual candlestick chart" });
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 660 }) });
    fireEvent.mouseMove(chart, { clientX: 500 });
    expect(screen.getByText("Open $1.20")).toBeInTheDocument();
    expect(screen.getByText("High $1.60")).toBeInTheDocument();
    expect(screen.getByText("Low $1.10")).toBeInTheDocument();
    expect(screen.getByText("Close $1.50")).toBeInTheDocument();
    expect(document.querySelector('.chart-tooltip')?.textContent).not.toMatch(/[\u3400-\u9fff]/);
  });
  it("remembers English at the root entry while explicit Chinese routes take precedence", () => {
    localStorage.setItem("pearl-language", "en");
    window.history.replaceState({}, "", "/");
    render(<App />);
    expect(window.location.pathname).toBe("/en");
    expect(screen.getByRole("heading", { name: "What is Pearl?", level: 1 })).toBeInTheDocument();
    act(() => { window.history.replaceState({}, "", "/chain"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("heading", { name: "网络概览" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
  });
  it("switches even when preference storage is unavailable", () => {
    window.history.replaceState({}, "", "/valuation");
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(window.location.pathname).toBe("/en/valuation");
    expect(screen.getByRole("heading", { name: "PEARL data", level: 1 })).toBeInTheDocument();
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", "Explore PEARL reference prices, market cap, relative BTC measures and issuance data.");
    storage.mockRestore();
  });
  it("uses overview metadata for a legacy overview bookmark", () => {
    window.history.replaceState({}, "", "/en#overview");
    render(<App />);
    expect(document.title).toBe("Overview · Pearl Community");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });
});
