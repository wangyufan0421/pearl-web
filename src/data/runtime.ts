import { getActivity, getCoinAge, getHolders, getMined, getPoolHistory, getPools, getTxSizes } from "./chain";
import { getLighterCandles, getMetricSeries, getNetworkSnapshot, type CandleRange } from "./prlstats";

export const refreshInterval = {
  fast: 30_000,
  medium: 5 * 60_000,
  slow: 15 * 60_000,
} as const;

type CacheEntry = { loadedAt: number; promise: Promise<unknown> };

export function createRequestCache(now: () => number = Date.now) {
  const entries = new Map<string, CacheEntry>();

  return {
    get<T>(key: string, ttl: number, loader: () => Promise<T>, force = false): Promise<T> {
      const cached = entries.get(key);
      if (!force && cached && now() - cached.loadedAt < ttl) return cached.promise as Promise<T>;

      const promise = Promise.resolve().then(loader);
      entries.set(key, { loadedAt: now(), promise });
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
