import { z } from "zod";
import type { DataResult } from "./prlstats";
import { snapshotMetadata } from "./snapshotMetadata";

const n = z.number().finite();
const amount = z.union([n, z.string()]);
const order = z.object({ price: amount, remaining_base_amount: amount });
const block = z.object({ height: n, time: z.string(), tx_count: n, pool: z.string(), txs: z.array(z.object({ txid: z.string(), grains: n, to: z.array(z.unknown()) })) });

export const insightSchemas = {
  "lighter-details": z.object({ code: z.literal(200), order_book_details: z.array(z.object({ market_id: z.literal(4097), mark_price: amount, open_interest: amount, open_interest_usd: amount.optional(), daily_quote_token_volume: n })).length(1) }),
  "lighter-funding": z.object({ code: z.literal(200), funding_rates: z.array(z.object({ market_id: n, exchange: z.string(), symbol: z.string(), rate: n })) }),
  "lighter-book": z.object({ code: z.literal(200), asks: z.array(order), bids: z.array(order) }),
  "kairos-live": z.object({ blocks: z.array(block).min(1), mempool: z.object({ time: z.string(), transactions: n }), note: z.string().optional() }),
  "kairos-flow24": z.object({ until: z.string(), items: z.array(z.object({ from_kind: z.string(), to_kind: z.string(), grains: n, transfers: n })) }),
  "kairos-venue-daily": z.array(z.object({ day: z.string(), emission_usd: n.nonnegative(), dex_usd: n.nonnegative().nullable(), dex_sell_usd: n.nonnegative().nullable(), otc_usd: n.nonnegative().nullable() })),
  "kairos-supply-meta": z.array(z.object({ as_of:z.string(), height:n, max_supply:n, supply_actual:n, reward_now:n, block_time_30d:n, inflation_12m:n, share_of_max:n, quarter_date:z.string(), reward_half_date:z.string(), halfway_date:z.string() })),
  "kairos-supply-proj": z.array(z.object({ date:z.string(), recent:n, target:n, fast:n, recent_inflation:n.nullable(), target_inflation:n.nullable(), fast_inflation:n.nullable() })),
  "kairos-econ-meta": z.array(z.object({ as_of:z.string(), market_cap_usd:n, fdv_usd:n, issued_per_day_prl:n, fees_30d_prl:n, fee_share_30d:n })),
  "kairos-econ-age": z.array(z.object({ age:z.string(), prl:n })),
  "kairos-econ-usage": z.array(z.object({ date:z.string(), txs:n, fees_prl:n, rewards_prl:n })),
  "kairos-exchange-venues": z.array(z.object({ venue: z.string(), label: z.string(), dep_24h: n.nonnegative(), as_of: z.string(), spot_24h_usd: n.nonnegative().nullable().optional(), spot_24h_source: z.string().nullable().optional() })),
  "kairos-exchange-daily": z.array(z.object({ day:z.string(), venue:z.string(), dep:n, wd:n, net:n, held:n, partial:z.boolean() })),
  "kairos-exchange-moves": z.array(z.object({ venue:z.string(), dir:z.enum(["in","out"]), time:z.string(), txid:z.string(), prl:n, address:z.string(), name:z.string() })),
  "kairos-exchange-monthly": z.array(z.object({ month: z.string(), in: n, out: n, net_exchange: n, in_pool: n.optional(), in_miner: n.optional() })),
  "kairos-index-monthly": z.array(z.object({ month: z.string(), pool_total: n, pool_to_exchange: n, exchange_in: n, exchange_out: n, exchange_net: n })),
  "kairos-chain-meta": z.array(z.object({ as_of: z.string(), pool_to_exchange_30d: n, pool_paid_30d_prl: n, exchange_net_30d_prl: n })),
  "kairos-pool-weekly": z.array(z.object({ week_end: z.string(), blocks: n }).catchall(n)),
  "kairos-cost-daily": z.array(z.object({ date: z.string(), price: n, realized_price: n, mvrv: n, in_profit: n, "Under 1 month": n.optional(), "1 to 3 months": n.optional(), "3 to 6 months": n.optional(), "6 months or more": n.optional() })),
  "kairos-cost-bands": z.array(z.object({ band: z.string(), low: n, prl: n, share: n, pre_market_prl: n })),
  "kairos-owner-cost": z.array(z.object({ id: z.string(), rank: n, name: z.string(), kind_name:z.string().optional(), balance_prl: n, value_usd:n.optional(), cost_basis: n, gain: n.nullable(), pre_market_share:n.optional(), since:z.string().nullable().optional(), fresh: z.boolean() })),
  "kairos-owner-addresses": z.array(z.object({ id: z.string(), address: z.string(), name:z.string().optional(), d30_prl:n.optional(), addresses:n.optional(), owners:n.optional(), confidence:z.string().optional(), in_mix:z.array(z.object({ kind:z.string(), prl:n })).optional() })),
  "kairos-owner-history": z.array(z.object({ id:z.string(), dates_from:z.string(), prl:z.array(n) })),
  "kairos-owner-moves": z.array(z.object({ time:z.string(), prl:n, txid:z.string(), from:z.object({ address:z.string(), label:z.string(), owner:z.string() }), to:z.object({ address:z.string(), label:z.string(), owner:z.string() }) })),
  "kairos-cost-meta": z.array(z.object({ as_of: z.string(), realized_price: n, realized_price_market: n, mvrv: n, in_profit: n, first_price_day: z.string(), price: n })),
  "kairos-market-daily": z.array(z.object({ day: z.string(), safetrade_volume_usd: n })),
} as const;

export type InsightKey = keyof typeof insightSchemas;
export type InsightPayload<K extends InsightKey> = z.infer<(typeof insightSchemas)[K]>;
export type LiveBlock = InsightPayload<"kairos-live">["blocks"][number];

export async function getInsight<K extends InsightKey>(key: K, fetcher: typeof fetch = fetch): Promise<DataResult<InsightPayload<K>> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`/api/market/insights?dataset=${key}`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = insightSchemas[key].parse(await response.json()) as InsightPayload<K>;
    return { data, sourceKind: "live", ...snapshotMetadata(response) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeLiveBlocks(blocks: LiveBlock[]) {
  const latest = [...blocks].sort((a, b) => b.height - a.height).slice(0, 6);
  return { blocks: latest, movedPrl: latest.reduce((sum, item) => sum + item.txs.reduce((txSum, tx) => txSum + tx.grains, 0), 0) / 1e8 };
}

export function summarizeExchangeFlows(rows: Array<{ exchange_in: number; exchange_out: number; exchange_net: number; pool_total: number; pool_to_exchange: number }>) {
  const latest = rows.at(-1);
  return {
    inPrl: latest?.exchange_in ?? 0,
    outPrl: latest?.exchange_out ?? 0,
    netPrl: latest ? latest.exchange_in - latest.exchange_out : 0,
    poolShare: latest?.pool_total ? latest.pool_to_exchange / latest.pool_total : null,
  };
}

export function orderBookDepth(book: { asks: Array<{ price: string | number; remaining_base_amount: string | number }>; bids: Array<{ price: string | number; remaining_base_amount: string | number }> }, mark: number) {
  const sum = (rows: typeof book.asks, side: "ask" | "bid") => rows.reduce((total, row) => {
    const price = Number(row.price); const size = Number(row.remaining_base_amount);
    if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) return total;
    if (side === "ask" ? price > mark * 1.02 || price < mark : price < mark * .98 || price > mark) return total;
    return total + price * size;
  }, 0);
  return { askUsd: sum(book.asks, "ask"), bidUsd: sum(book.bids, "bid") };
}

export function perpOpenInterestUsd(detail: { open_interest: string | number; open_interest_usd?: string | number; mark_price: string | number }) {
  const reported = Number(detail.open_interest_usd);
  if (detail.open_interest_usd !== undefined && Number.isFinite(reported) && reported >= 0) return reported;
  const base = Number(detail.open_interest); const mark = Number(detail.mark_price);
  return Number.isFinite(base * mark) ? base * mark * 2 : 0;
}

export function poolShareChanges(rows: Array<{ week_end: string; blocks: number; [name: string]: string | number }>) {
  const latest = rows.at(-1); const previous = rows[Math.max(0, rows.length - 5)];
  if (!latest) return [];
  return Object.entries(latest).filter(([name, share]) => name !== "week_end" && name !== "blocks" && typeof share === "number")
    .map(([name, share]) => ({ name, share: share as number, change: (share as number) - (typeof previous?.[name] === "number" ? previous[name] as number : 0) }))
    .sort((a, b) => b.share - a.share);
}

export function latestPositiveVenueVolume<T extends { day: string; safetrade_volume_usd: number }>(rows: T[]): T | undefined {
  return [...rows].reverse().find(row => row.safetrade_volume_usd > 0);
}
