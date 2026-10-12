import type { DataResult } from "./prlstats";
import { snapshotMetadata } from "./snapshotMetadata";

type Fetcher = typeof fetch;
type RecordValue = Record<string, unknown>;

export type ChainPoint = { timestamp: Date; value: number };
export type ChainMetric = { id: string; label: string; unit: string; points: ChainPoint[] };
export type Pool = { id: string; name: string; feePct: number | null; payoutScheme: string | null; blocks24h: number; share24h: number };
export type PoolHistory = { days: Date[]; series: { poolId: string; name: string; values: number[]; blocks: number[]; total: number }[]; complete: boolean; walkedTo: number; tip: number };
export type AgeBandData = { days: Date[]; bands: { name: string; values: number[] }[]; total: number[] };
export type TxSizeData = { range: string; unit: string; basis: string; stats: Record<string, number>; whales: { atLeast: number; count: number; share: number }[]; daily: { timestamp: Date; count: number; median: number; p90: number; p99: number }[] };
export type HolderSnapshot = { funded: number; heldPrl: number; minedPrl: number; gini: number; top1Pct: number; top10Pct: number; top100Pct: number; top1PctPct: number; dustPrl: number; rows: { rank: number; address: string; balancePrl: number; sharePct: number; firstDay: string; pool: string | null }[] };

const activityIds = "txs,onchain_volume,velocity,tx_fees,tx_fees_usd,new_addresses,funded_addresses,supply";

function object(value: unknown): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected an object");
  return value as RecordValue;
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expected a number");
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected text");
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("Expected a number array");
  return value.map(number);
}

async function request<T>(path: string, parse: (payload: unknown) => T, fallback: T, notice: string, fetcher: Fetcher): Promise<DataResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(`/api/prlstats${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`${path} failed`);
    return { data: parse(await response.json()), sourceKind: "live", ...snapshotMetadata(response) };
  } catch {
    return { data: fallback, sourceKind: "fallback", fetchedAt: new Date(), notice };
  } finally {
    window.clearTimeout(timeout);
  }
}

function parsePool(value: unknown): Pool {
  const row = object(value);
  return { id: text(row.id), name: text(row.name), feePct: typeof row.fee_pct === "number" ? row.fee_pct : null, payoutScheme: optionalText(row.payout_scheme), blocks24h: number(row.blocks_24h), share24h: number(row.share_24h) };
}

export function getPools(fetcher: Fetcher = fetch) {
  return request("/api/pools", (payload) => {
    if (!Array.isArray(payload)) throw new Error("Expected pool array");
    return payload.map(parsePool);
  }, [], "暂时无法读取矿池数据。", fetcher);
}

export function getPoolHistory(fetcher: Fetcher = fetch) {
  return request("/api/pools/history", (payload): PoolHistory => {
    const data = object(payload);
    if (!Array.isArray(data.days) || !Array.isArray(data.series)) throw new Error("Invalid pool history");
    return {
      days: data.days.map((day) => new Date(number(day) * 1000)),
      series: data.series.map((item) => { const row = object(item); return { poolId: text(row.pool_id), name: text(row.name), values: numberList(row.values), blocks: numberList(row.blocks), total: number(row.total) }; }),
      complete: data.complete === true,
      walkedTo: number(data.walked_to),
      tip: number(data.tip),
    };
  }, { days: [], series: [], complete: false, walkedTo: 0, tip: 0 }, "暂时无法读取矿池历史。", fetcher);
}

export function getActivity(fetcher: Fetcher = fetch) {
  return request(`/api/series?m=${activityIds}&range=all`, (payload): ChainMetric[] => {
    if (!Array.isArray(payload)) throw new Error("Expected activity series");
    return payload.map((item) => {
      const series = object(item); const meta = object(series.meta);
      if (!Array.isArray(series.points)) throw new Error("Missing activity points");
      return { id: text(meta.id), label: text(meta.label), unit: text(meta.unit), points: series.points.map((point) => { const row = object(point); return { timestamp: new Date(number(row.t) * 1000), value: number(row.v) }; }) };
    });
  }, [], "暂时无法读取链上活跃度。", fetcher);
}

function parseAgeBands(payload: unknown): AgeBandData {
  const data = object(payload);
  if (!Array.isArray(data.days) || !Array.isArray(data.bands)) throw new Error("Invalid age bands");
  return { days: data.days.map((day) => new Date(typeof day === "number" ? day * 1000 : `${day}T00:00:00Z`)), bands: data.bands.map((item) => { const band = object(item); return { name: text(band.name), values: numberList(band.values) }; }), total: numberList(data.total) };
}

export function getCoinAge(fetcher: Fetcher = fetch) { return request("/api/coinage", parseAgeBands, { days: [], bands: [], total: [] }, "暂时无法读取币龄数据。", fetcher); }
export function getMined(fetcher: Fetcher = fetch) { return request("/api/mined", parseAgeBands, { days: [], bands: [], total: [] }, "暂时无法读取新挖币移动数据。", fetcher); }

export function getTxSizes(fetcher: Fetcher = fetch) {
  return request("/api/txsizes?range=30d", (payload): TxSizeData => {
    const data = object(payload); const stats = object(data.stats);
    if (!Array.isArray(data.whales) || !Array.isArray(data.daily)) throw new Error("Invalid TX size data");
    const rawShare = stats.top_share;
    const topShare = Array.isArray(rawShare) ? number(rawShare.find(pair => Array.isArray(pair) && pair[0] === 1)?.[1]) : number(rawShare);
    return {
      range: text(data.range), unit: text(data.unit), basis: text(data.basis),
      stats: { ...Object.fromEntries(Object.entries(stats).filter(([, value]) => typeof value === "number")), top_share: topShare } as Record<string, number>,
      whales: data.whales.map((item) => { const row = object(item); return { atLeast: number(row.at_least), count: number(row.count), share: number(row.share) }; }),
      daily: data.daily.map((item) => { const row = object(item); return { timestamp: new Date(number(row.t) * 1000), count: number(row.n), median: number(row.p50), p90: number(row.p90), p99: number(row.p99) }; }),
    };
  }, { range: "30d", unit: "PRL", basis: "gross", stats: {}, whales: [], daily: [] }, "暂时无法读取交易金额分布。", fetcher);
}

export function getHolders(fetcher: Fetcher = fetch) {
  return request("/api/holders", (payload): HolderSnapshot => {
    const data = object(payload);
    if (!Array.isArray(data.rows)) throw new Error("Invalid holder rows");
    return {
      funded: number(data.funded), heldPrl: number(data.held_prl), minedPrl: number(data.mined_prl), gini: number(data.gini), top1Pct: number(data.top1_pct), top10Pct: number(data.top10_pct), top100Pct: number(data.top100_pct), top1PctPct: number(data.top1pct_pct), dustPrl: number(data.dust_prl),
      rows: data.rows.map((item) => { const row = object(item); return { rank: number(row.rank), address: text(row.address), balancePrl: number(row.balance_prl), sharePct: number(row.share_pct), firstDay: text(row.first_day), pool: optionalText(row.pool) }; }),
    };
  }, { funded: 0, heldPrl: 0, minedPrl: 0, gini: 0, top1Pct: 0, top10Pct: 0, top100Pct: 0, top1PctPct: 0, dustPrl: .01, rows: [] }, "暂时无法读取持币地址数据。", fetcher);
}
