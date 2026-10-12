import { requestedDataset } from "./datasets.js";
import type { ReadStore } from "./store.js";
import type { Snapshot } from "./store.js";

export type MarketResponse = { status: number; headers: Record<string, string>; body: unknown };
export function createMarketHandler(store: ReadStore, now: () => number = Date.now) {
  const cache = new Map<string, { expires: number; promise: Promise<Snapshot | null> }>();
  function read(key: string) {
    const previous = cache.get(key); if (previous && previous.expires > now()) return previous.promise;
    const promise = Promise.resolve().then(() => store.get(key));
    const entry = { expires: now() + 5000, promise }; cache.set(key, entry);
    void promise.then(snapshot => { if (!snapshot && cache.get(key) === entry) cache.delete(key); }, () => { if (cache.get(key) === entry) cache.delete(key); });
    return promise;
  }
  return async (url: URL): Promise<MarketResponse> => {
    const headers = { "cache-control": "no-store" };
    const dataset = requestedDataset(url);
    if (!dataset) return { status: url.pathname === "/api/market/candles" || url.pathname.endsWith("/series") ? 400 : 404, headers, body: { error: "invalid_dataset" } };
    try {
      const snapshot = await read(dataset.key);
      if (!snapshot) return { status: 503, headers, body: { error: "data_unavailable" } };
      const stale = snapshot.failed || now() - Date.parse(snapshot.fetchedAt) > dataset.interval * 2;
      return { status: 200, headers: { ...headers, "x-data-fetched-at": snapshot.fetchedAt, "x-data-stale": String(stale) }, body: snapshot.payload };
    } catch { return { status: 503, headers, body: { error: "data_unavailable" } }; }
  };
}
