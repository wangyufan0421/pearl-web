import { describe, expect, it, vi } from "vitest";
import { getLighterCandles, getMetricSeries, getNetworkSnapshot } from "./prlstats";

const networkPayload = {
  ts: 1791423735,
  height: 124752,
  difficulty: 34714717.88,
  hashrate_hs: 4.78e19,
  avg_block_time_s: 204.2,
  target_block_s: 194,
  supply_prl: 338047273.6,
  supply_pct: 16.09,
  subsidy_prl: 2273.55,
  emission_prl_day: 1011969,
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getNetworkSnapshot", () => {
  it("requests the same-origin prlstats proxy path", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(networkPayload));

    const result = await getNetworkSnapshot(fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/prlstats/api/network",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.sourceKind).toBe("live");
  });

  it("returns labeled fallback data when the endpoint fails", async () => {
    const result = await getNetworkSnapshot(async () => {
      throw new Error("offline");
    });

    expect(result.sourceKind).toBe("fallback");
    expect(result.notice).toContain("暂时无法读取");
  });
});

describe("getMetricSeries", () => {
  it("normalizes price points returned by prlstats", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse([
      {
        meta: { id: "price", label: "PRL price", unit: "USD" },
        points: [{ t: 1791423600, v: 0.56 }, { t: 1791510000, v: 0.61 }],
      },
    ]));

    const result = await getMetricSeries("price", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/prlstats/api/series?m=price",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.data.points[1].value).toBe(0.61);
  });

  it("preserves projected supply points so charts can omit forecasts", async () => {
    const response = jsonResponse([{
      meta: { id: "supply", label: "Circulating supply", unit: "PRL" },
      points: [
        { t: 1791423600, v: 338_000_000 },
        { t: 1794015600, v: 370_000_000, projected: true },
      ],
    }]);

    const result = await getMetricSeries("supply", async () => response);

    expect(result.data.points.map((point) => point.projected)).toEqual([false, true]);
  });
});

describe("getLighterCandles", () => {
  it("reads saved PRL OHLC candles from the same-origin backend", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      code: 200,
      r: "1h",
      c: [{ t: 1791460800000, o: 1.2, h: 1.4, l: 1.1, c: 1.3, v: 99, V: 128.7, i: 1 }],
    }));

    const result = await getLighterCandles("7D", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/market/candles?range=7D",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.sourceKind).toBe("live");
    expect(result.data.candles[0]).toMatchObject({ open: 1.2, high: 1.4, low: 1.1, close: 1.3 });
    vi.useRealTimers();
  });
});

describe("saved snapshot metadata", () => {
  it("uses backend collection time and marks retained stale data", async () => {
    const response = jsonResponse(networkPayload);
    response.headers.set("x-data-fetched-at", "2026-10-12T00:00:00Z");
    response.headers.set("x-data-stale", "true");
    const result = await getNetworkSnapshot(async () => response);
    expect(result.fetchedAt.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(result.notice).toContain("上次成功");
    expect(result.sourceKind).toBe("live");
  });
});

