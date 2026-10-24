import { getActivity, getCoinAge, getHolders, getMined, getPoolHistory, getPools, getTxSizes } from "./chain";
import { getLighterCandles, getMetricSeries, getNetworkSnapshot, type CandleRange } from "./prlstats";
import { getPeerMarketCap, type PeerMarketCapAsset } from "./peerMarketCap";

export const refreshInterval = {
  fast: 30_000,
  medium: 5 * 60_000,
  slow: 15 * 60_000,
} as const;

type CacheEntry = { loadedAt: number; promise: Promise<unknown>; ttl: number };

export function createRequestCache(now: () => number = Date.now) {
  const entries = new Map<string, CacheEntry>();

  return {
    get<T>(key: string, ttl: number, loader: () => Promise<T>, force = false, fallbackTtl = ttl): Promise<T> {
      const cached = entries.get(key);
      if (!force && cached && now() - cached.loadedAt < cached.ttl) return cached.promise as Promise<T>;

      const promise = Promise.resolve().then(loader).then(async result => {
        if (result && typeof result === "object" && "sourceKind" in result && result.sourceKind === "fallback") {
          const entry = entries.get(key);
          if (entry?.promise === promise) entry.ttl = fallbackTtl;
          if (!cached) return result;
          const previous = await cached.promise.catch(() => null);
          if (previous && typeof previous === "object" && "sourceKind" in previous && previous.sourceKind === "live") {
            return { ...previous, stale: true, notice: "当前显示上次成功保存的数据，后台仍在尝试更新。" } as T;
          }
        }
        return result;
      });
      entries.set(key, { loadedAt: now(), promise, ttl });
      void promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
      });
      return promise;
    },
    clear() { entries.clear(); },
  };
}

const cache = createRequestCache();
const listeners = new Set<() => void>();
const metricIds = ["price", "cost_allin", "txs", "onchain_volume", "funded_addresses", "top10_share", "fdv_vs_btc", "prl_btc", "marginal_cost", "crossover", "volume", "supply", "mcap_vs_btc", "inflation", "miner_revenue"] as const;

function notify() { listeners.forEach((listener) => listener()); }

export function subscribeToDataUpdates(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDataRuntime() {
  cache.clear();
  listeners.clear();
}

export function loadNetworkSnapshot(force = false) {
  return cache.get("network", refreshInterval.fast, () => getNetworkSnapshot(), force);
}

export function loadMetricSeries(metric: string, force = false) {
  return cache.get(`metric:${metric}`, refreshInterval.fast, () => getMetricSeries(metric), force);
}

export function loadComparisonSeries(metric: string, force = false) {
  return cache.get(`comparison:${metric}`, refreshInterval.slow, () => getMetricSeries(metric), force, refreshInterval.fast);
}

export function loadPeerMarketCap(asset: PeerMarketCapAsset, force = false) {
  return cache.get(`peer-mcap:${asset}`, refreshInterval.slow, () => getPeerMarketCap(asset), force, refreshInterval.fast);
}

export function loadLighterCandles(range: CandleRange, force = false) {
  return cache.get(`lighter:${range}`, refreshInterval.fast, () => getLighterCandles(range), force);
}

export function loadPools(force = false) { return cache.get("pools", refreshInterval.medium, () => getPools(), force); }
export function loadActivity(force = false) { return cache.get("activity", refreshInterval.medium, () => getActivity(), force); }
export function loadTxSizes(force = false) { return cache.get("txsizes", refreshInterval.medium, () => getTxSizes(), force); }
export function loadPoolHistory(force = false) { return cache.get("pool-history", refreshInterval.slow, () => getPoolHistory(), force); }
export function loadCoinAge(force = false) { return cache.get("coin-age", refreshInterval.slow, () => getCoinAge(), force); }
export function loadHolders(force = false) { return cache.get("holders", refreshInterval.slow, () => getHolders(), force); }
export function loadMined(force = false) { return cache.get("mined", refreshInterval.slow, () => getMined(), force); }

export async function preloadFastData(force = false) {
  await Promise.all([loadNetworkSnapshot(force), ...metricIds.map((metric) => loadMetricSeries(metric, force)), loadLighterCandles("7D", force), loadLighterCandles("30D", force)]);
  notify();
}

export async function preloadMediumData(force = false) {
  await Promise.all([loadPools(force), loadActivity(force), loadTxSizes(force)]);
  notify();
}

export async function preloadSlowData(force = false) {
  await Promise.all([loadPoolHistory(force), loadCoinAge(force), loadHolders(force), loadMined(force)]);
  notify();
}

export function startDataRefresh() {
  void Promise.all([preloadFastData(), preloadMediumData(), preloadSlowData()]);
  const timers = [
    window.setInterval(() => { void preloadFastData(true); }, refreshInterval.fast),
    window.setInterval(() => { void preloadMediumData(true); }, refreshInterval.medium),
    window.setInterval(() => { void preloadSlowData(true); }, refreshInterval.slow),
  ];
  return () => timers.forEach((timer) => window.clearInterval(timer));
}
