import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLanguage } from "./i18n/Language";
import { useInsight } from "./data/useInsight";
import { summarizeLiveBlocks, type InsightPayload } from "./data/insights";
import type { DataResult } from "./data/prlstats";

type Live = DataResult<InsightPayload<"kairos-live">> | null | undefined;
type Flows = DataResult<InsightPayload<"kairos-flow24">> | null | undefined;
type Venues = DataResult<InsightPayload<"kairos-exchange-venues">> | null | undefined;

const kindNames: Record<string, [string, string]> = {
  exchange: ["SafeTrade", "SafeTrade"], coinbase: ["Coinbase（线索）", "Coinbase (lead)"], gate: ["Gate（线索）", "Gate (lead)"], kraken: ["Kraken", "Kraken"],
  bridge: ["跨链桥", "Bridges"], otc: ["OTC", "OTC"], pool: ["矿池", "Mining pools"], miner: ["矿工", "Miners"],
  holder: ["已命名持有人", "Named holders"], fund: ["基金与机构", "Funds"], service: ["托管服务", "Custodial services"],
  other: ["未命名钱包", "Unnamed wallets"], launch: ["早期发行地址", "Launch wallets"], compute: ["算力运营方", "Compute operators"],
};
const exchangeKinds = ["exchange", "coinbase", "gate", "kraken"];
const exchangeVenueNames: Record<string, string> = { exchange: "SafeTrade", coinbase: "Coinbase", gate: "Gate", kraken: "Kraken" };
const flowColors = ["#c77955", "#91a893", "#c49a58", "#7297a4", "#d4ae70", "#a789a9", "#9f9b8e", "#8eaeaa"];

function number(value: number, digits = 0) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value); }
function prl(value: number) { return `${number(value, value < 10 ? 2 : 1)} PEARL`; }
function compactPrl(value: number) { return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)} PEARL`; }
function elapsed(time: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(time)) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function LiveChainPanel({ live, flows, venues, now }: { live: Live; flows: Flows; venues?: Venues; now: number }) {
  const { language, href } = useLanguage();
  const zh = language === "zh";
  const chain = live?.data;
  const latest = chain ? summarizeLiveBlocks(chain.blocks) : null;
  const destinations = useMemo(() => {
    if (!flows?.data && !venues?.data) return [];
    const totals = new Map<string, number>();
    for (const row of flows?.data.items ?? []) totals.set(row.to_kind, (totals.get(row.to_kind) ?? 0) + row.grains / 1e8);
    const namedExchanges: Array<[string, number | null]> = exchangeKinds.map(kind => [kind, venues?.data ? venues.data.find(row => row.venue === exchangeVenueNames[kind])?.dep_24h ?? null : totals.get(kind) ?? null]);
    const otherDestinations = [...totals].filter(([kind, value]) => !exchangeKinds.includes(kind) && value > 0).sort((a, b) => b[1] - a[1]);
    return [...namedExchanges, ...otherDestinations].slice(0, 8);
  }, [flows, venues]);
  const fresh = live && !live.stale && now - live.fetchedAt.getTime() < 90_000;
  const dotCount = Math.min(chain?.mempool.transactions ?? 0, 32);
  const flowHeight = Math.max(420, destinations.length * 55 + Math.max(0, destinations.length - 1) * 7);
  const venueAsOf = venues?.data?.[0]?.as_of.slice(0, 16).replace("T", " ");
  const flowNote = venues?.data
    ? zh
      ? `最近 6 个区块的转账量按逐笔记录去找零计算；交易所分项为已识别地址近 24 小时入金${venueAsOf ? `（截至 ${venueAsOf} UTC）` : ""}，其他去向使用独立的 24 小时分类口径，不可相加。带「线索」的地址归属尚待确认；链上移动不等于卖出。`
      : `Six-block movement excludes change. Named exchange amounts are 24-hour deposits to attributed addresses${venueAsOf ? ` (as of ${venueAsOf} UTC)` : ""}; other destinations use a separate 24-hour classification and must not be added together. Lead labels are unconfirmed; transfers do not imply selling.`
    : zh
      ? "最近 6 个区块的转账量按逐笔记录去找零计算；右侧为过去 24 小时的地址分类。无记录显示「—」；带「线索」的地址归属尚待确认。链上移动不等于卖出。"
      : "Six-block movement excludes change; destinations use 24-hour address classifications. A dash means no recorded flow. Lead labels are unconfirmed; transfers do not imply selling.";

  return <article className="live-chain-panel" aria-label={zh ? "实时链上动态" : "Live chain activity"}>
    <div className="live-chain-heading"><div><p className="insight-eyebrow">LIVE CHAIN / PEARL</p><h3>{zh ? "实时链上动态" : "Live chain activity"}</h3></div><span className={`insight-health ${fresh ? "is-live" : ""}`}>{fresh ? (zh ? "约每 20 秒更新" : "Updates about every 20s") : (zh ? "数据更新中或已过期" : "Updating or stale")}</span></div>
    <div className="live-chain-stats">
      <div><span>{zh ? "最新区块" : "Latest block"}</span><strong>{chain ? number(latest?.blocks[0]?.height ?? 0) : "—"}</strong></div>
      <div><span>{zh ? "距上一块" : "Since last block"}</span><strong>{latest?.blocks[0] ? elapsed(latest.blocks[0].time, now) : "—"}</strong></div>
      <div><span>{zh ? "待确认交易" : "Pending transactions"}</span><strong>{chain ? number(chain.mempool.transactions) : "—"}</strong></div>
      <div><span>{zh ? "最近 6 个区块转账量" : "Moved in last 6 blocks"}</span><strong>{latest ? prl(latest.movedPrl) : "—"}</strong></div>
    </div>
    <div className="live-chain-diagram" role="group" aria-label={zh ? "内存池、最近区块和资金去向" : "Mempool, recent blocks and destinations"} style={{ "--flow-height": `${flowHeight}px` } as CSSProperties}>
      <div className="live-chain-mempool">
        <div className="mempool-orbit" title={chain ? `${chain.mempool.transactions} pending` : ""}>
          {Array.from({ length: dotCount }, (_, index) => {
            const angle = index * 2.39996;
            const radius = 39 + (index % 3) * 3;
            return <i key={index} style={{ left: `${50 + Math.cos(angle) * radius}%`, top: `${50 + Math.sin(angle) * radius}%` }} />;
          })}
          <div className="mempool-core"><strong>{chain ? number(chain.mempool.transactions) : "—"}</strong><small>MEMPOOL</small></div>
        </div>
        <span>{zh ? "待打包交易" : "Pending transactions"}</span>
      </div>
      <div className="live-chain-block-track">
        <div className="live-blocks">{latest?.blocks.slice().reverse().map(block => <div className="live-block" key={block.height} title={`${block.time} · ${block.pool}`}><b>{number(block.height)}</b><span>{number(block.tx_count)} tx</span><small>{block.pool.replaceAll("/", "").slice(0, 15) || "—"}</small></div>) ?? <p className="insight-empty">{zh ? "正在读取逐块数据" : "Loading blocks"}</p>}</div>
      </div>
      <div className="live-chain-destinations">
        {destinations.length ? <>
          <svg className="flow-branches" viewBox={`0 0 70 ${flowHeight}`} preserveAspectRatio="none" aria-hidden="true">{destinations.map(([kind], index) => <path key={kind} d={`M 0 ${flowHeight / 2} C 35 ${flowHeight / 2} 30 ${(index + .5) * flowHeight / destinations.length} 70 ${(index + .5) * flowHeight / destinations.length}`} stroke={flowColors[index % flowColors.length]} />)}</svg>
          <div className="destination-list">{destinations.map(([kind, value], index) => <div className="destination-row" key={kind} style={{ "--flow-color": flowColors[index % flowColors.length] } as CSSProperties}><span>{kindNames[kind]?.[zh ? 0 : 1] ?? kind}</span><strong>{value === null ? "—" : compactPrl(value)}</strong></div>)}</div>
        </> : <p className="insight-empty">{zh ? "24 小时地址分类数据暂不可用" : "24-hour address classifications unavailable"}</p>}
      </div>
    </div>
    <footer className="insight-source"><span>{flowNote}</span><a className="insight-more" href={href("/chain")}>{zh ? "查看链上数据 ↗" : "Explore chain data ↗"}</a></footer>
  </article>;
}

export function OverviewLiveChain() {
  const live = useInsight("kairos-live", 20_000);
  const flows = useInsight("kairos-flow24", 60_000);
  const venues = useInsight("kairos-exchange-venues", 15 * 60_000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  return <LiveChainPanel live={live} flows={flows} venues={venues} now={now} />;
}
