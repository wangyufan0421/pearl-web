import { describe, expect, it, vi } from "vitest";
import { createMarketHandler } from "./http.js";

describe("stored market HTTP reads", () => {
  it("shares database reads between visitors and expires the short server cache", async () => {
    let now = Date.parse("2026-10-12T00:00:00Z");
    const get = vi.fn(async () => ({ payload: { height: 42 }, fetchedAt: new Date(now).toISOString(), lastAttemptedAt: new Date(now).toISOString(), failed: false }));
    const handler = createMarketHandler({ get }, () => now); const url = new URL("http://local/api/prlstats/api/network");
    await Promise.all([handler(url), handler(url)]); expect(get).toHaveBeenCalledTimes(1);
    now += 5001; await handler(url); expect(get).toHaveBeenCalledTimes(2);
  });
  it("returns saved payload and actual collection time without an upstream fetch", async () => {
    const get = vi.fn(async () => ({ payload: [{ points: [{ t: 100, v: 2 }] }], fetchedAt: "2026-10-12T00:00:00Z", lastAttemptedAt: "2026-10-12T00:00:00Z", failed: false }));
    const handler = createMarketHandler({ get }, () => Date.parse("2026-10-12T00:00:20Z"));
    const result = await handler(new URL("http://localhost/api/prlstats/api/series?m=price"));
    expect(get).toHaveBeenCalledWith("metric:price");
    expect(result).toMatchObject({ status: 200, body: [{ points: [{ t: 100, v: 2 }] }], headers: { "x-data-fetched-at": "2026-10-12T00:00:00Z", "x-data-stale": "false" } });
  });
  it("serves stale snapshots after failure rather than erasing them", async () => {
    const handler = createMarketHandler({ get: async () => ({ payload: { height: 42 }, fetchedAt: "2026-10-12T00:00:00Z", lastAttemptedAt: "2026-10-12T00:01:00Z", failed: true }) });
    expect(await handler(new URL("http://local/api/prlstats/api/network"))).toMatchObject({ status: 200, body: { height: 42 }, headers: { "x-data-stale": "true" } });
  });
  it("returns safe unavailable errors before the first successful snapshot", async () => {
    const handler = createMarketHandler({ get: async () => null });
    expect(await handler(new URL("http://local/api/market/candles?range=7D"))).toMatchObject({ status: 503, body: { error: "data_unavailable" } });
  });
  it("rejects arbitrary upstream URLs and unsupported datasets", async () => {
    const get = vi.fn(); const handler = createMarketHandler({ get });
    expect(await handler(new URL("http://local/api/prlstats/private?url=https://bad"))).toMatchObject({ status: 404 });
    expect(await handler(new URL("http://local/api/market/candles?range=bad"))).toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });
});
