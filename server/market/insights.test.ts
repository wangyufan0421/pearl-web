import { describe, expect, it } from "vitest";
import { requestedDataset } from "./datasets.js";

describe("market insight datasets", () => {
  it("only exposes whitelisted insight feeds and validates their identity", () => {
    const detail = requestedDataset(new URL("http://local/api/market/insights?dataset=lighter-details"));
    expect(detail?.url(0)).toContain("orderBookDetails?market_id=4097");
    expect(() => detail?.validate({ code: 200, order_book_details: [{ market_id: 1, open_interest: "1", mark_price: "1", daily_quote_token_volume: 1 }] })).toThrow();
    expect(requestedDataset(new URL("http://local/api/market/insights?dataset=https://evil.test"))).toBeUndefined();
  });

  it("accepts real live-chain structure but rejects invented blocks", () => {
    const live = requestedDataset(new URL("http://local/api/market/insights?dataset=kairos-live"));
    expect(() => live?.validate({ blocks: [{ height: 143518, time: "2026-11-15T09:20:00Z", tx_count: 2, pool: "pool", txs: [{ txid: "a", grains: 100_000_000, to: [] }] }], mempool: { time: "2026-11-15T09:20:00Z", transactions: 41 } })).not.toThrow();
    expect(() => live?.validate({ blocks: [], mempool: { transactions: 41 } })).toThrow();
  });

  it("validates named exchange 24-hour deposits", () => {
    const venues = requestedDataset(new URL("http://local/api/market/insights?dataset=kairos-exchange-venues"));
    expect(venues?.url(0)).toContain("/out/ex_venues.json");
    expect(() => venues?.validate([{ venue: "SafeTrade", label: "SafeTrade", dep_24h: 100, as_of: "2026-11-15T06:36:05+00:00" }])).not.toThrow();
    expect(() => venues?.validate([{ venue: "SafeTrade", dep_24h: -1 }])).toThrow();
  });
});
