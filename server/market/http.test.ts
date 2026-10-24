import { describe, expect, it, vi } from "vitest";
import { createMarketHandler } from "./http.js";
import { datasets } from "./datasets.js";

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
  it("allows the public hashrate history from the saved dataset", async () => {
    const get = vi.fn(async () => ({ payload: [{ meta: { id: "hashrate", label: "Network hashrate", unit: "H/s" }, points: [{ t: 100, v: 68e18 }] }], fetchedAt: "2026-10-12T00:00:00Z", lastAttemptedAt: "2026-10-12T00:00:00Z", failed: false }));
    const handler = createMarketHandler({ get });
    const result = await handler(new URL("http://localhost/api/prlstats/api/series?m=hashrate"));
    expect(get).toHaveBeenCalledWith("metric:hashrate");
    expect(result).toMatchObject({ status: 200, body: [{ meta: { id: "hashrate" } }] });
  });
  it("serves the saved Pearl versus Bitcoin energy ratio series", async () => {
    const get = vi.fn(async () => ({ payload: [{ meta: { id: "energy_vs_btc", label: "Pearl energy vs Bitcoin", unit: "%" }, points: [{ t: 100, v: .7 }] }], fetchedAt: "2026-10-21T00:00:00Z", lastAttemptedAt: "2026-10-21T00:00:00Z", failed: false }));
    const result = await createMarketHandler({ get })(new URL("http://localhost/api/prlstats/api/series?m=energy_vs_btc"));
    expect(get).toHaveBeenCalledWith("metric:energy_vs_btc");
    expect(result).toMatchObject({ status: 200, body: [{ meta: { id: "energy_vs_btc" } }] });
  });
  it("collects Pearl and four peer market-cap histories with the right supply definitions", async () => {
    const pearl = datasets.find(entry => entry.key === "metric:mcap");
    expect(pearl?.url(0)).toBe("https://prlstats.com/api/series?m=mcap");
    expect(() => pearl?.validate([{ meta: { id: "mcap", label: "Market cap", unit: "USD" }, points: [{ t: 100, v: 2 }] }])).not.toThrow();
    for (const asset of ["btc", "bch", "zec", "fil"]) {
      const dataset = datasets.find(entry => entry.key === `peer-mcap:${asset}`);
      const metric = asset === "fil" ? "CapMrktEstUSD" : "CapMrktCurUSD";
      expect(dataset?.url(0)).toContain(`assets=${asset}&metrics=${metric}`);
      expect(() => dataset?.validate({ data: [{ asset, time: "2021-01-01T00:00:00Z", [metric]: "1000000" }] })).not.toThrow();
      expect(() => dataset?.validate({ data: [{ asset: "wrong", time: "2021-01-01T00:00:00Z", [metric]: "1000000" }] })).toThrow();
      expect(() => dataset?.validate({ data: [{ asset, time: "2021-01-01T00:00:00Z", [metric]: "not a number" }] })).toThrow();
    }
  });
  it("serves only whitelisted peer market caps from saved snapshots", async () => {
    const get = vi.fn(async () => ({ payload: { data: [{ asset: "btc", time: "2021-01-01T00:00:00Z", CapMrktCurUSD: "1000000" }] }, fetchedAt: new Date().toISOString(), lastAttemptedAt: new Date().toISOString(), failed: false }));
    const handler = createMarketHandler({ get });
    expect(await handler(new URL("http://localhost/api/market/market-cap?asset=btc"))).toMatchObject({ status: 200, body: { data: [{ asset: "btc" }] } });
    expect(get).toHaveBeenCalledWith("peer-mcap:btc");
    expect(await handler(new URL("http://localhost/api/market/market-cap?asset=bad"))).toMatchObject({ status: 400 });
  });
  it("collects a one-year TAO market-cap history without accepting malformed points", () => {
    const dataset = datasets.find(entry => entry.key === "peer-mcap:tao");
    expect(dataset?.url(0)).toBe("https://api.coingecko.com/api/v3/coins/bittensor/market_chart?vs_currency=usd&days=365");
    expect(() => dataset?.validate({ market_caps: [[1790812800000, 4_200_000_000]] })).not.toThrow();
    expect(() => dataset?.validate({ market_caps: [[1790812800000, -1]] })).toThrow();
    expect(() => dataset?.validate({ market_caps: [] })).toThrow();
  });
  it("collects all nine comparison series at the slow interval", () => {
    const ids = ["prl_energy", "btc_energy", "energy_vs_btc", "prl_machines", "btc_machines", "prl_capex", "btc_capex", "prl_issuance_usd", "btc_issuance_usd"];
    for (const id of ids) {
      const dataset = datasets.find(entry => entry.key === `metric:${id}`);
      expect(dataset?.interval, id).toBe(15 * 60_000);
      expect(dataset?.url(0), id).toBe(`https://prlstats.com/api/series?m=${id}`);
    }
  });
  it("rejects a comparison snapshot when upstream changes the advertised unit", () => {
    const expectedUnits = { prl_energy: "MW", btc_energy: "MW", energy_vs_btc: "%", prl_machines: "GPUs", btc_machines: "ASICs", prl_capex: "USD", btc_capex: "USD", prl_issuance_usd: "USD/day", btc_issuance_usd: "USD/day" };
    for (const [id, unit] of Object.entries(expectedUnits)) {
      const dataset = datasets.find(entry => entry.key === `metric:${id}`);
      const payload = (value: string) => [{ meta: { id, label: id, unit: value }, points: [{ t: 100, v: 1 }] }];
      expect(() => dataset?.validate(payload(unit)), id).not.toThrow();
      expect(() => dataset?.validate(payload("unexpected-unit")), id).toThrow();
    }
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
