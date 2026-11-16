import { describe, expect, it } from "vitest";
import { summarizeExchangeFlows, summarizeLiveBlocks, orderBookDepth, perpOpenInterestUsd, poolShareChanges, latestPositiveVenueVolume } from "./insights";

describe("insight calculations", () => {
  it("counts only the most recent six blocks and converts grains to PEARL", () => {
    expect(summarizeLiveBlocks([{ height: 3, time: "2026-11-15T09:20:00Z", tx_count: 2, pool: "a", txs: [{ txid: "a", grains: 150_000_000, to: [] }] }, { height: 2, time: "2026-11-15T09:19:00Z", tx_count: 1, pool: "b", txs: [] }]).movedPrl).toBe(1.5);
  });

  it("separates exchange inflow, outflow and net rather than summing both sides", () => {
    expect(summarizeExchangeFlows([{ exchange_in: 100, exchange_out: 60, exchange_net: 40, pool_total: 20, pool_to_exchange: 5 }])).toMatchObject({ inPrl: 100, outPrl: 60, netPrl: 40, poolShare: .25 });
    expect(summarizeExchangeFlows([{ exchange_in: 100, exchange_out: 60, exchange_net: 25, pool_total: 20, pool_to_exchange: 5 }]).netPrl).toBe(40);
  });

  it("calculates visible orderbook depth inside two percent of mark", () => {
    expect(orderBookDepth({ asks: [{ price: "1.01", remaining_base_amount: "10" }, { price: "1.05", remaining_base_amount: "10" }], bids: [{ price: "0.99", remaining_base_amount: "20" }] }, 1)).toEqual({ askUsd: 10.1, bidUsd: 19.8 });
  });

  it("uses Lighter's double-sided USD open interest when present", () => {
    expect(perpOpenInterestUsd({ open_interest: "200", open_interest_usd: "600", mark_price: "1.5" })).toBe(600);
    expect(perpOpenInterestUsd({ open_interest: "200", mark_price: "1.5" })).toBe(600);
  });

  it("compares observed pool shares across weeks without treating solo as one known pool", () => {
    const changes = poolShareChanges([{ week_end: "2026-11-01", blocks: 100, Kryptex: .3, "Solo and unlabeled": .2 }, { week_end: "2026-11-15", blocks: 100, Kryptex: .4, "Solo and unlabeled": .1 }]);
    expect(changes.map(({ name }) => name)).toEqual(["Kryptex", "Solo and unlabeled"]);
    expect(changes[0]?.share).toBeCloseTo(.4);
    expect(changes[0]?.change).toBeCloseTo(.1);
    expect(changes[1]?.share).toBeCloseTo(.1);
    expect(changes[1]?.change).toBeCloseTo(-.1);
  });

  it("does not present a long run of zero venue reports as confirmed zero trading", () => {
    expect(latestPositiveVenueVolume([{ day: "2026-09-12", safetrade_volume_usd: 1844264 }, { day: "2026-11-15", safetrade_volume_usd: 0 }])).toEqual({ day: "2026-09-12", safetrade_volume_usd: 1844264 });
  });
});
