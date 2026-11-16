import { z } from "zod";
import type { Dataset } from "./datasets.js";

const n = z.number().finite();
const amount = z.union([n, z.string().regex(/^-?\d+(?:\.\d+)?$/)]);
const order = z.object({ price: amount, remaining_base_amount: amount });
const detail = z.object({
  market_id: z.literal(4097), symbol: z.literal("PRL"), market_type: z.literal("perp"),
  mark_price: amount, open_interest: amount, open_interest_usd: amount.optional(),
  daily_quote_token_volume: n.nonnegative(),
});
const funding = z.object({ market_id: z.literal(4097), exchange: z.literal("lighter"), symbol: z.literal("PRL"), rate: n });
const block = z.object({ height: n.int().positive(), time: z.string().datetime({ offset: true }), tx_count: n.int().nonnegative(), pool: z.string(), txs: z.array(z.object({ txid: z.string(), grains: n.nonnegative(), to: z.array(z.unknown()) })) });

function feed(key: string, interval: number, url: string, schema: z.ZodType, timeoutMs?: number): Dataset {
  return { key: `insight:${key}`, interval, timeoutMs, url: () => url, validate: payload => { schema.parse(payload); } };
}

const lighter = "https://mainnet.zklighter.elliot.ai/api/v1";
const kairos = "https://prl.kairosresear.ch";

export const insightDatasets: Dataset[] = [
  feed("lighter-details", 30_000, `${lighter}/orderBookDetails?market_id=4097`, z.object({ code: z.literal(200), order_book_details: z.array(detail).length(1) })),
  feed("lighter-funding", 60_000, `${lighter}/funding-rates`, z.object({ code: z.literal(200), funding_rates: z.array(z.object({ market_id: n, exchange: z.string(), symbol: z.string(), rate: n })).refine(rows => rows.some(row => funding.safeParse(row).success), "PEARL Lighter funding missing") })),
  feed("lighter-book", 30_000, `${lighter}/orderBookOrders?market_id=4097&limit=250`, z.object({ code: z.literal(200), asks: z.array(order), bids: z.array(order) })),
  feed("kairos-live", 20_000, `${kairos}/api/v1/live`, z.object({ blocks: z.array(block).min(1), mempool: z.object({ time: z.string().datetime({ offset: true }), transactions: n.int().nonnegative() }), note: z.string().optional() })),
  feed("kairos-flow24", 60_000, `${kairos}/api/v1/flows/recent?hours=24`, z.object({ until: z.string(), items: z.array(z.object({ from_kind: z.string(), to_kind: z.string(), grains: n.nonnegative(), transfers: n.int().nonnegative() })) })),
  feed("kairos-venue-daily", 15 * 60_000, `${kairos}/out/venue_daily.json`, z.array(z.object({ day: z.string(), emission_usd: n.nonnegative(), dex_usd: n.nonnegative().nullable(), dex_sell_usd: n.nonnegative().nullable(), otc_usd: n.nonnegative().nullable() })).min(1)),
  feed("kairos-supply-meta", 60 * 60_000, `${kairos}/out/supply_meta.json`, z.array(z.object({ as_of:z.string(), height:n, max_supply:n, supply_actual:n, reward_now:n, block_time_30d:n, inflation_12m:n, share_of_max:n, quarter_date:z.string(), reward_half_date:z.string(), halfway_date:z.string() })).length(1)),
  feed("kairos-supply-proj", 60 * 60_000, `${kairos}/out/supply_proj.json`, z.array(z.object({ date:z.string(), recent:n, target:n, fast:n, recent_inflation:n.nullable(), target_inflation:n.nullable(), fast_inflation:n.nullable() })).min(2)),
  feed("kairos-econ-meta", 60 * 60_000, `${kairos}/out/econ_meta.json`, z.array(z.object({ as_of:z.string(), market_cap_usd:n, fdv_usd:n, issued_per_day_prl:n, fees_30d_prl:n, fee_share_30d:n })).length(1)),
  feed("kairos-econ-age", 60 * 60_000, `${kairos}/out/econ_age.json`, z.array(z.object({ age:z.string(), prl:n.nonnegative() })).min(1)),
  feed("kairos-econ-usage", 60 * 60_000, `${kairos}/out/econ_usage.json`, z.array(z.object({ date:z.string(), txs:n.nonnegative(), fees_prl:n.nonnegative(), rewards_prl:n.nonnegative() })).min(1)),
  feed("kairos-exchange-venues", 15 * 60_000, `${kairos}/out/ex_venues.json`, z.array(z.object({ venue: z.string().min(1), label: z.string().min(1), dep_24h: n.nonnegative(), as_of: z.string().datetime({ offset: true }) })).min(1)),
  feed("kairos-exchange-daily", 15 * 60_000, `${kairos}/out/ex_daily.json`, z.array(z.object({ day:z.string(), venue:z.string(), dep:n.nonnegative(), wd:n.nonnegative(), net:n, held:n.nonnegative(), partial:z.boolean() })).min(1)),
  feed("kairos-exchange-moves", 15 * 60_000, `${kairos}/out/ex_moves.json`, z.array(z.object({ venue:z.string(), dir:z.enum(["in","out"]), time:z.string().datetime({ offset:true }), txid:z.string(), prl:n.nonnegative(), address:z.string(), name:z.string() }))),
  feed("kairos-exchange-monthly", 60 * 60_000, `${kairos}/out/ch_exchange_monthly.json`, z.array(z.object({ month: z.string(), in: n.nonnegative(), out: n.nonnegative(), net_exchange: n, in_pool: n.nonnegative().optional(), in_miner: n.nonnegative().optional() })).min(1)),
  feed("kairos-index-monthly", 60 * 60_000, `${kairos}/out/idx_monthly.json`, z.array(z.object({ month: z.string(), pool_total: n.nonnegative(), pool_to_exchange: n.nonnegative(), exchange_in: n.nonnegative(), exchange_out: n.nonnegative(), exchange_net: n })).min(1)),
  feed("kairos-chain-meta", 60 * 60_000, `${kairos}/out/ch_meta.json`, z.array(z.object({ as_of: z.string(), pool_to_exchange_30d: n.min(0).max(1), pool_paid_30d_prl: n.nonnegative(), exchange_net_30d_prl: n })).length(1)),
  feed("kairos-pool-weekly", 60 * 60_000, `${kairos}/out/ch_pool_weekly.json`, z.array(z.object({ week_end: z.string(), blocks: n.int().nonnegative() }).catchall(n)).min(2)),
  feed("kairos-cost-daily", 15 * 60_000, `${kairos}/out/val_daily.json`, z.array(z.object({ date: z.string(), price: n.positive(), realized_price: n.nonnegative(), mvrv: n.nonnegative(), in_profit: n.min(0).max(1) })).min(1)),
  feed("kairos-cost-bands", 15 * 60_000, `${kairos}/out/val_cost_basis.json`, z.array(z.object({ band: z.string(), low: n.nonnegative(), prl: n.nonnegative(), share: n.nonnegative(), pre_market_prl: n.nonnegative() })).min(1)),
  feed("kairos-owner-cost", 15 * 60_000, `${kairos}/out/val_owner_cost.json`, z.array(z.object({ id: z.string(), rank: n, name: z.string(), balance_prl: n.nonnegative(), cost_basis: n.nonnegative(), gain: n.nullable(), fresh: z.boolean() })).min(1)),
  feed("kairos-owner-addresses", 15 * 60_000, `${kairos}/out/ch_owners.json`, z.array(z.object({ id: z.string(), address: z.string() })).min(1)),
  feed("kairos-owner-history", 60 * 60_000, `${kairos}/out/ch_owner_hist.json`, z.array(z.object({ id:z.string(), dates_from:z.string(), prl:z.array(n.nonnegative()) })).min(1)),
  feed("kairos-owner-moves", 60 * 60_000, `${kairos}/out/moves_week.json`, z.array(z.object({ time:z.string(), prl:n.nonnegative(), txid:z.string(), from:z.object({ address:z.string(), label:z.string(), owner:z.string() }), to:z.object({ address:z.string(), label:z.string(), owner:z.string() }) })), 55_000),
  feed("kairos-cost-meta", 15 * 60_000, `${kairos}/out/val_meta.json`, z.array(z.object({ as_of: z.string(), realized_price: n.nonnegative(), realized_price_market: n.nonnegative(), mvrv: n.nonnegative(), in_profit: n.min(0).max(1), first_price_day: z.string(), price: n.positive() })).length(1)),
  feed("kairos-market-daily", 15 * 60_000, `${kairos}/out/market.json`, z.array(z.object({ day: z.string(), safetrade_volume_usd: n.nonnegative() })).min(1)),
];

export const insightIds = insightDatasets.map(item => item.key.slice("insight:".length));
