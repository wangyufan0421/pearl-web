import { describe, expect, it, vi } from "vitest";
import { getPeerMarketCap } from "./peerMarketCap";

describe("getPeerMarketCap", () => {
  it("reads saved FIL estimated-cap observations and preserves dates", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ asset: "fil", time: "2021-04-01T00:00:00.000000000Z", CapMrktEstUSD: "1200000" }] }), { status: 200 }));
    const result = await getPeerMarketCap("fil", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/market/market-cap?asset=fil", expect.anything());
    expect(result.data.points[0]).toMatchObject({ value: 1_200_000 });
    expect(result.data.points[0].timestamp.toISOString()).toBe("2021-04-01T00:00:00.000Z");
  });
  it("does not silently chart another asset's points", async () => {
    const response = new Response(JSON.stringify({ data: [{ asset: "btc", time: "2021-04-01T00:00:00Z", CapMrktEstUSD: "1200000" }] }), { status: 200 });
    expect((await getPeerMarketCap("fil", async () => response)).data.points).toHaveLength(0);
  });
  it("reads TAO market caps from CoinGecko's real one-year history", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ market_caps: [[1790812800000, 4_200_000_000], [1790899200000, 4_300_000_000]] }), { status: 200 }));
    const result = await getPeerMarketCap("tao", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/market/market-cap?asset=tao", expect.anything());
    expect(result.data.points.map(point => point.value)).toEqual([4_200_000_000, 4_300_000_000]);
    expect(result.data.points[0].timestamp.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
