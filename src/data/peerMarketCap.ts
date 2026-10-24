import type { DataResult, MetricPoint, MetricSeries } from "./prlstats";
import { snapshotMetadata } from "./snapshotMetadata";

export type PeerMarketCapAsset = "btc" | "bch" | "fil" | "zec" | "tao";
const metrics: Record<Exclude<PeerMarketCapAsset, "tao">, string> = { btc: "CapMrktCurUSD", bch: "CapMrktCurUSD", fil: "CapMrktEstUSD", zec: "CapMrktCurUSD" };

export async function getPeerMarketCap(asset: PeerMarketCapAsset, fetcher: typeof fetch = fetch): Promise<DataResult<MetricSeries>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`/api/market/market-cap?asset=${asset}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Market cap request failed: ${response.status}`);
    const payload = await response.json() as { data?: unknown; market_caps?: unknown };
    let points: MetricPoint[];
    if (asset === "tao") {
      if (!Array.isArray(payload.market_caps) || !payload.market_caps.length) throw new Error("TAO market cap series is empty");
      points = payload.market_caps.map(entry => {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "number" || typeof entry[1] !== "number" || !Number.isFinite(entry[0]) || !Number.isFinite(entry[1]) || entry[1] <= 0) throw new Error("Invalid TAO market cap observation");
        return { timestamp: new Date(entry[0]), value: entry[1] };
      });
    } else {
      if (!Array.isArray(payload.data) || !payload.data.length) throw new Error("Market cap series is empty");
      const metric = metrics[asset];
      points = payload.data.map(entry => {
        const row = entry as Record<string, unknown>;
        const value = Number(row[metric]);
        const timestamp = new Date(String(row.time));
        if (row.asset !== asset || !Number.isFinite(value) || value <= 0 || Number.isNaN(timestamp.getTime())) throw new Error("Invalid market cap observation");
        return { timestamp, value };
      });
    }
    points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return { data: { id: asset, label: asset.toUpperCase(), unit: "USD", points }, sourceKind: "live", ...snapshotMetadata(response) };
  } catch {
    return { data: { id: asset, label: asset.toUpperCase(), unit: "USD", points: [] }, sourceKind: "fallback", fetchedAt: new Date(), notice: "暂时无法读取该代币的历史市值。" };
  } finally {
    window.clearTimeout(timeout);
  }
}
