import { z } from "zod";

const n = z.number().finite();
const point = z.object({ t: n, v: n });
const series = z.array(z.object({ meta: z.object({ id: z.string(), label: z.string(), unit: z.string() }), points: z.array(point).min(1) })).min(1);
const network = z.object({ ts: n, height: n, difficulty: n, hashrate_hs: n, avg_block_time_s: n, target_block_s: n, supply_prl: n, supply_pct: n, subsidy_prl: n, emission_prl_day: n });
const pools = z.array(z.object({ id: z.string(), name: z.string(), blocks_24h: n, share_24h: n }));
const history = z.object({ days: z.array(n), series: z.array(z.object({ pool_id: z.string(), name: z.string(), values: z.array(n), blocks: z.array(n), total: n })), complete: z.boolean(), walked_to: n, tip: n });
const age = z.object({ days: z.array(z.union([n, z.string()])), bands: z.array(z.object({ name: z.string(), values: z.array(n) })), total: z.array(n) });
const share = n.min(0).max(1);
const topShare = z.union([share, z.array(z.tuple([n.min(0).max(100), share])).refine(pairs => pairs.some(pair => pair[0] === 1), "Top 1% share missing")]);
const sizes = z.object({ range: z.string(), unit: z.string(), basis: z.string(), stats: z.object({ count: n, median: n, max: n, top_share: topShare }), whales: z.array(z.object({ at_least: n, count: n, share: n })), daily: z.array(z.object({ t: n, n, p50: n, p90: n, p99: n })) });
const holders = z.object({ funded: n, held_prl: n, mined_prl: n, gini: n, top1_pct: n, top10_pct: n, top100_pct: n, top1pct_pct: n, dust_prl: n, rows: z.array(z.object({ rank: n, address: z.string(), balance_prl: n, share_pct: n, first_day: z.string() })) });
const candles = z.object({ code: z.literal(200), c: z.array(z.object({ t: n, o: n, h: n, l: n, c: n, v: n })).min(1) });

export const metricIds = ["price", "cost_allin", "txs", "onchain_volume", "funded_addresses", "top10_share", "fdv_vs_btc", "prl_btc", "marginal_cost", "crossover", "volume", "supply", "mcap_vs_btc", "inflation", "miner_revenue"] as const;
export const activityIds = "txs,onchain_volume,velocity,tx_fees,tx_fees_usd,new_addresses,funded_addresses,supply";
export type Dataset = { key: string; interval: number; url(now: number): string; validate(payload: unknown): void };
const fast = 30_000; const medium = 300_000; const slow = 900_000;
function prl(key: string, interval: number, path: string, schema: z.ZodType): Dataset {
  return { key, interval, url: () => `https://prlstats.com${path}`, validate: payload => { schema.parse(payload); } };
}
export const datasets: Dataset[] = [
  prl("network", fast, "/api/network", network),
  ...metricIds.map(id => prl(`metric:${id}`, fast, `/api/series?m=${id}`, series.refine(rows => rows.length === 1 && rows[0].meta.id === id, "Metric identity mismatch"))),
  ...(["7D", "30D"] as const).map(range => ({
    key: `candles:${range}`, interval: fast,
    url(now: number) {
      const end = Math.floor(now / 1000); const hours = (range === "7D" ? 7 : 30) * 24;
      return `https://mainnet.zklighter.elliot.ai/api/v1/candles?market_id=4097&resolution=1h&start_timestamp=${end - hours * 3600}&end_timestamp=${end}&count_back=${hours}`;
    }, validate(payload: unknown) { candles.parse(payload); },
  })),
  prl("pools", medium, "/api/pools", pools),
  prl("activity", medium, `/api/series?m=${activityIds}&range=all`, series.refine(rows => rows.length === activityIds.split(",").length && new Set(rows.map(row => row.meta.id)).size === rows.length && activityIds.split(",").every(id => rows.some(row => row.meta.id === id)), "Activity identity mismatch")),
  prl("txsizes", medium, "/api/txsizes?range=30d", sizes),
  prl("pool-history", slow, "/api/pools/history", history),
  prl("coin-age", slow, "/api/coinage", age),
  prl("holders", slow, "/api/holders", holders),
  prl("mined", slow, "/api/mined", age),
];

export function requestedDataset(url: URL): Dataset | undefined {
  const path = url.pathname;
  let key: string | undefined;
  if (path === "/api/market/candles") key = `candles:${url.searchParams.get("range")}`;
  else if (path === "/api/prlstats/api/series") {
    const metric = url.searchParams.get("m");
    key = metric === activityIds ? "activity" : `metric:${metric}`;
  } else key = ({ "/api/prlstats/api/network": "network", "/api/prlstats/api/pools": "pools", "/api/prlstats/api/pools/history": "pool-history", "/api/prlstats/api/txsizes": "txsizes", "/api/prlstats/api/coinage": "coin-age", "/api/prlstats/api/holders": "holders", "/api/prlstats/api/mined": "mined" } as Record<string, string>)[path];
  return datasets.find(item => item.key === key);
}
