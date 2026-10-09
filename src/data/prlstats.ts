import { fallbackNetworkSnapshot } from "./fixtures";
import { parseNetworkSnapshot, type NetworkSnapshot } from "./schema";

export type SourceKind = "live" | "fallback";

export type DataResult<T> = {
  data: T;
  sourceKind: SourceKind;
  fetchedAt: Date;
  notice?: string;
};

type Fetcher = typeof fetch;

export type MetricPoint = { timestamp: Date; value: number };
export type MetricSeries = {
  id: string;
  label: string;
  unit: string;
  points: MetricPoint[];
};

export type CandleRange = "7D" | "30D";
export type Candle = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type CandleSeries = {
  source: "Lighter";
  symbol: "PRL-PERP";
  resolution: "1h";
  candles: Candle[];
};

export async function getNetworkSnapshot(fetcher: Fetcher = fetch): Promise<DataResult<NetworkSnapshot>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetcher("/api/prlstats/api/network", { signal: controller.signal });
    if (!response.ok) throw new Error(`prlstats network request failed: ${response.status}`);
    return {
      data: parseNetworkSnapshot(await response.json()),
      sourceKind: "live",
      fetchedAt: new Date(),
    };
  } catch {
    return {
      data: fallbackNetworkSnapshot,
      sourceKind: "fallback",
      fetchedAt: new Date(),
      notice: "暂时无法读取实时数据，当前仅展示最近可用样本。",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getMetricSeries(metric: string, fetcher: Fetcher = fetch): Promise<DataResult<MetricSeries>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetcher(`/api/prlstats/api/series?m=${encodeURIComponent(metric)}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`prlstats series request failed: ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) throw new Error("prlstats series response is empty");
    const first = payload[0] as { meta?: { id?: string; label?: string; unit?: string }; points?: unknown };
    if (!Array.isArray(first.points)) throw new Error("prlstats series has no points");
    const points = first.points.map((point) => {
      const value = point as { t?: unknown; v?: unknown };
      if (typeof value.t !== "number" || typeof value.v !== "number") throw new Error("invalid prlstats point");
      return { timestamp: new Date(value.t * 1000), value: value.v };
    });
    return {
      data: {
        id: first.meta?.id ?? metric,
        label: first.meta?.label ?? metric,
        unit: first.meta?.unit ?? "",
        points,
      },
      sourceKind: "live",
      fetchedAt: new Date(),
    };
  } catch {
    return {
      data: { id: metric, label: metric, unit: "", points: [] },
      sourceKind: "fallback",
      fetchedAt: new Date(),
      notice: "暂时无法读取这项历史数据。",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getLighterCandles(range: CandleRange, fetcher: Fetcher = fetch): Promise<DataResult<CandleSeries>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  const endTimestamp = Math.floor(Date.now() / 1000);
  const hours = range === "7D" ? 7 * 24 : 30 * 24;
  const startTimestamp = endTimestamp - hours * 60 * 60;
  const url = `https://mainnet.zklighter.elliot.ai/api/v1/candles?market_id=4097&resolution=1h&start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&count_back=${hours}`;

  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Lighter candle request failed: ${response.status}`);
    const payload = await response.json() as { code?: unknown; c?: unknown };
    if (payload.code !== 200 || !Array.isArray(payload.c)) throw new Error("Lighter candle response is invalid");
    const candles = payload.c.map((entry) => {
      const raw = entry as { t?: unknown; o?: unknown; h?: unknown; l?: unknown; c?: unknown; v?: unknown };
      const { t, o, h, l, c, v } = raw;
      if (typeof t !== "number" || typeof o !== "number" || typeof h !== "number" || typeof l !== "number" || typeof c !== "number" || typeof v !== "number") {
        throw new Error("Lighter candle contains an invalid value");
      }
      return { timestamp: new Date(t), open: o, high: h, low: l, close: c, volume: v };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return {
      data: { source: "Lighter", symbol: "PRL-PERP", resolution: "1h", candles },
      sourceKind: "live",
      fetchedAt: new Date(),
    };
  } catch {
    return {
      data: { source: "Lighter", symbol: "PRL-PERP", resolution: "1h", candles: [] },
      sourceKind: "fallback",
      fetchedAt: new Date(),
      notice: "暂时无法读取 Lighter 的 PRL 永续 K 线。",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
