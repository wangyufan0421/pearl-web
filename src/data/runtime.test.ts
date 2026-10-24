import { describe, expect, it, vi } from "vitest";
import { createRequestCache, loadComparisonSeries, refreshInterval, resetDataRuntime } from "./runtime";

describe("createRequestCache", () => {
  it("retains a successful snapshot if the saved-data API temporarily fails", async () => {
    let now = 0; const cache = createRequestCache(() => now);
    const saved = { data: { value: 42 }, sourceKind: "live", fetchedAt: new Date("2026-10-12T00:00:00Z") };
    const loader = vi.fn().mockResolvedValueOnce(saved).mockResolvedValueOnce({ data: {}, sourceKind: "fallback", fetchedAt: new Date() });
    await cache.get("network", 30_000, loader);
    now = 30_000;
    expect(await cache.get("network", 30_000, loader)).toMatchObject({ data: { value: 42 }, sourceKind: "live", fetchedAt: saved.fetchedAt, stale: true });
  });
  it("shares an in-flight request and reuses it until its TTL expires", async () => {
    let now = 0;
    const cache = createRequestCache(() => now);
    const loader = vi.fn(async () => ({ value: 1 }));

    const [first, second] = await Promise.all([
      cache.get("network", 30_000, loader),
      cache.get("network", 30_000, loader),
    ]);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);

    now = 29_999;
    await cache.get("network", 30_000, loader);
    expect(loader).toHaveBeenCalledTimes(1);

    now = 30_000;
    await cache.get("network", 30_000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("comparison series cache", () => {
  it("retries an unavailable comparison shortly after the collector creates its first snapshot", async () => {
    let now = 0;
    const cache = createRequestCache(() => now);
    const unavailable = { data: { points: [] }, sourceKind: "fallback" };
    const saved = { data: { points: [{ value: 42 }] }, sourceKind: "live" };
    const loader = vi.fn().mockResolvedValueOnce(unavailable).mockResolvedValueOnce(saved);

    expect(await cache.get("comparison:energy", refreshInterval.slow, loader, false, refreshInterval.fast)).toBe(unavailable);
    now = refreshInterval.fast - 1;
    await cache.get("comparison:energy", refreshInterval.slow, loader, false, refreshInterval.fast);
    expect(loader).toHaveBeenCalledTimes(1);
    now = refreshInterval.fast;
    expect(await cache.get("comparison:energy", refreshInterval.slow, loader, false, refreshInterval.fast)).toBe(saved);
    now += refreshInterval.fast;
    await cache.get("comparison:energy", refreshInterval.slow, loader, false, refreshInterval.fast);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reuses the stored 15-minute model snapshot between page refreshes", async () => {
    resetDataRuntime();
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ meta: { id: "prl_energy", label: "Pearl network power", unit: "MW" }, points: [{ t: 1_799_999_000, v: 50 }] }]), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await loadComparisonSeries("prl_energy");
      await loadComparisonSeries("prl_energy");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(refreshInterval.slow).toBe(15 * 60_000);
      await loadComparisonSeries("prl_energy", true);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); resetDataRuntime(); }
  });
});
