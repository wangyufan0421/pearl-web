import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveChainPanel } from "./OverviewLiveChain";
import type { DataResult } from "./data/prlstats";
import type { InsightPayload } from "./data/insights";

afterEach(cleanup);

describe("overview live chain", () => {
  it("keeps six-block movement and 24-hour destinations visibly distinct", () => {
    const live: DataResult<InsightPayload<"kairos-live">> = { sourceKind: "live", fetchedAt: new Date("2026-11-15T09:20:10Z"), data: {
      blocks: [{ height: 143518, time: "2026-11-15T09:20:00Z", tx_count: 2, pool: "Kryptex", txs: [{ txid: "a", grains: 150_000_000, to: [] }] }],
      mempool: { time: "2026-11-15T09:20:10Z", transactions: 41 },
    } };
    const flows: DataResult<InsightPayload<"kairos-flow24">> = { sourceKind: "live", fetchedAt: new Date("2026-11-15T09:20:10Z"), data: {
      until: "2026-11-15T09:20:00Z", items: [{ from_kind: "miner", to_kind: "exchange", grains: 500_000_000, transfers: 1 }],
    } };
    render(<LiveChainPanel live={live} flows={flows} now={Date.parse("2026-11-15T09:21:00Z")} />);
    expect(screen.getAllByText("143,518")).toHaveLength(2);
    expect(screen.getAllByText("41")).toHaveLength(2);
    expect(screen.getAllByText(/最近 6 个区块/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "内存池、最近区块和资金去向" })).not.toBeNull();
    expect(screen.getByText(/1\.5 PEARL/)).not.toBeNull();
    expect(screen.getByText(/^5 PEARL$/)).not.toBeNull();
    expect(screen.getByText("SafeTrade")).not.toBeNull();
    expect(screen.getByText("Coinbase（线索）")).not.toBeNull();
    expect(screen.getByText("Gate（线索）")).not.toBeNull();
    expect(screen.getByText("Kraken")).not.toBeNull();
    expect(screen.queryByText("已识别交易所")).toBeNull();
    expect(screen.queryByText(/Kairos/)).toBeNull();
  });

  it("uses each venue's reported deposits instead of assigning one aggregate amount to an exchange", () => {
    const venues: DataResult<InsightPayload<"kairos-exchange-venues">> = { sourceKind: "live", fetchedAt: new Date("2026-11-15T06:36:05Z"), data: [
      { venue: "SafeTrade", label: "SafeTrade", dep_24h: 100, as_of: "2026-11-15T06:36:05Z" },
      { venue: "Coinbase", label: "Coinbase", dep_24h: 30, as_of: "2026-11-15T06:36:05Z" },
      { venue: "Gate", label: "Gate", dep_24h: 50, as_of: "2026-11-15T06:36:05Z" },
      { venue: "Kraken", label: "Kraken", dep_24h: 1, as_of: "2026-11-15T06:36:05Z" },
    ] };
    render(<LiveChainPanel live={null} flows={null} venues={venues} now={Date.parse("2026-11-15T09:21:00Z")} />);
    expect(screen.getByText("SafeTrade").parentElement?.textContent).toContain("100 PEARL");
    expect(screen.getByText("Gate（线索）").parentElement?.textContent).toContain("50 PEARL");
    expect(screen.getByText("Coinbase（线索）").parentElement?.textContent).toContain("30 PEARL");
    expect(screen.getByText("Kraken").parentElement?.textContent).toContain("1 PEARL");
  });
});
