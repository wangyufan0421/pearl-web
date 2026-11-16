import { useLanguage } from "./i18n/Language";
import { poolShareChanges, summarizeExchangeFlows } from "./data/insights";
import { useInsight } from "./data/useInsight";
import { ExchangeVenueDetails } from "./ExchangeVenueDetails";

function prl(value: number) { return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 2 : 0 }).format(value)} PEARL`; }

export function MinerFlowPanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const monthly = useInsight("kairos-index-monthly", 60 * 60_000);
  const meta = useInsight("kairos-chain-meta", 60 * 60_000);
  const weekly = useInsight("kairos-pool-weekly", 60 * 60_000);
  const row = monthly?.data.at(-1);
  const snapshot = meta?.data[0];
  const share = snapshot?.pool_to_exchange_30d;
  const changes = poolShareChanges(weekly?.data ?? []).slice(0, 5);
  return <section className="insight-panel chain-insight-panel" aria-label={zh ? "矿工产出流向" : "Miner output flows"}>
    <div className="insight-panel-heading"><div><p className="insight-eyebrow">MINER FLOWS</p><h3>{zh ? "新挖币流向" : "Where newly mined coins move"}</h3></div><span>{snapshot?.as_of?.slice(0, 10) ?? "—"}</span></div>
    <div className="insight-card-grid three">
      <article><span>{zh ? "矿池支付 · 近 30 日" : "Pool payouts · 30 days"}</span><strong>{snapshot ? prl(snapshot.pool_paid_30d_prl) : "—"}</strong><small>{zh ? "Kairos 归属的矿池付款" : "Kairos-attributed pool payouts"}</small></article>
      <article><span>{zh ? "到交易所的比例" : "Share reaching exchanges"}</span><strong>{share === undefined ? "—" : `${(share * 100).toFixed(1)}%`}</strong><small>{zh ? "30 日矿池支付的流向估计" : "Estimated path of 30-day pool payouts"}</small></article>
      <article><span>{zh ? "本月矿池→交易所" : "Pool → exchange this month"}</span><strong>{row ? prl(row.pool_to_exchange) : "—"}</strong><small>{row?.month?.slice(0, 7) ?? "—"}{zh ? " · 本月尚未结束" : " · month in progress"}</small></article>
    </div>
    <div className="pool-share-title">{zh ? "周度矿池份额变化 · 与四周前对比" : "Weekly pool share · versus four weeks ago"}</div>
    {changes.length ? <div className="pool-share-list">{changes.map(pool => <div className="pool-share-row" key={pool.name}><span>{pool.name === "Solo and unlabeled" && zh ? "独立及未识别" : pool.name}</span><div><i style={{ width: `${Math.max(2, pool.share * 100)}%` }} /></div><strong>{(pool.share * 100).toFixed(1)}%</strong><small className={pool.change >= 0 ? "up" : "down"}>{pool.change >= 0 ? "+" : ""}{(pool.change * 100).toFixed(1)}pp</small></div>)}</div> : <p className="insight-empty">{zh ? "矿池周度份额正在读取" : "Loading weekly pool shares"}</p>}
    <p className="insight-note">{zh ? "矿池付款到交易所是地址归属推断，不能据此断定矿工卖出；月底前的月度数据会继续变化。" : "Pool-to-exchange movement relies on address attribution and does not prove miners sold. The current month remains partial."} <a href="https://prl.kairosresear.ch/#miners" target="_blank" rel="noreferrer">Kairos ↗</a>{monthly?.stale || meta?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
  </section>;
}

export function ExchangeFlowPanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const monthly = useInsight("kairos-exchange-monthly", 60 * 60_000);
  const rows = monthly?.data ?? [];
  const latest = summarizeExchangeFlows(rows.map(row => ({ exchange_in: row.in, exchange_out: row.out, exchange_net: row.net_exchange, pool_total: 0, pool_to_exchange: 0 })));
  const max = Math.max(...rows.flatMap(row => [row.in, row.out]), 1);
  return <section className="chain-module" aria-label={zh ? "交易所资金流向" : "Exchange flows"}>
    <header className="chain-module-header"><p>04 / EXCHANGE FLOWS</p><h2>{zh ? "资金流向" : "Exchange flows"}</h2><span>{zh ? "已识别交易所地址 · 月度" : "Attributed exchange addresses · monthly"}</span></header>
    <div className="insight-panel chain-insight-panel">
      <div className="insight-card-grid three">
        <article><span>{zh ? "本月流入交易所" : "Exchange inflow this month"}</span><strong>{rows.length ? prl(latest.inPrl) : "—"}</strong><small>{rows.at(-1)?.month ?? "—"}</small></article>
        <article><span>{zh ? "本月流出交易所" : "Exchange outflow this month"}</span><strong>{rows.length ? prl(latest.outPrl) : "—"}</strong><small>{zh ? "交易所向外转出" : "Moved out of exchanges"}</small></article>
        <article><span>{zh ? "本月净流入" : "Net inflow this month"}</span><strong className={latest.netPrl < 0 ? "negative" : ""}>{rows.length ? `${latest.netPrl > 0 ? "+" : ""}${prl(latest.netPrl)}` : "—"}</strong><small>{zh ? "流入减流出" : "Inflow minus outflow"}</small></article>
      </div>
      {rows.length ? <div className="exchange-flow-chart" role="img" aria-label={zh ? "交易所月度流入流出图" : "Monthly exchange inflow and outflow"}>{rows.map(row => <div className="exchange-flow-month" key={row.month} title={`${row.month} · ${zh ? "流入" : "in"} ${prl(row.in)} · ${zh ? "流出" : "out"} ${prl(row.out)}`}><div className="exchange-flow-bars"><i style={{ height: `${Math.max(2, row.in / max * 100)}%` }} /><i style={{ height: `${Math.max(2, row.out / max * 100)}%` }} /></div><span>{row.month.slice(5)}</span></div>)}</div> : <p className="insight-empty">{zh ? "交易所月度流向正在读取" : "Loading monthly exchange flows"}</p>}
      <div className="insight-legend"><span><i className="in" />{zh ? "流入" : "Inflow"}</span><span><i className="out" />{zh ? "流出" : "Outflow"}</span></div>
      <p className="insight-note">{zh ? "Kairos 的地址归属估计，净流入等于流入减流出；交易所转账不等于实际成交，本月数据尚未完成。" : "Kairos address attribution; net flow equals inflow minus outflow. Exchange transfers do not prove trading; the current month is incomplete."} <a href="https://prl.kairosresear.ch/#exchange" target="_blank" rel="noreferrer">Kairos ↗</a>{monthly?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
      <ExchangeVenueDetails />
    </div>
  </section>;
}
