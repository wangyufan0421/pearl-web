import { useState } from "react";
import { useLanguage } from "./i18n/Language";
import { useInsight } from "./data/useInsight";
import { CostBasisPanel } from "./ValuationInsights";
import { WhaleActivity } from "./WhaleActivity";

type Point = { date: string; value: number };
function History({ title, points, percent = false, reference }: { title: string; points: Point[]; percent?: boolean; reference?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(percent ? 1 : 0, reference ?? 0, ...points.map(p => p.value), .01) * (percent ? 1 : 1.08);
  const x = (i: number) => 48 + i / Math.max(points.length - 1, 1) * 520;
  const y = (v: number) => 190 - v / max * 160;
  const label = (v: number) => percent ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(2)}×`;
  return <article className="profit-chart-card"><h3>{title}</h3>{points.length > 1 ? <div className="profit-chart-wrap"><svg viewBox="0 0 600 220" role="img" aria-label={title} onMouseMove={e => { const box = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - box.left) / box.width * 600 - 48) / 520 * (points.length - 1))))); }} onMouseLeave={() => setHover(null)}>
    {[0,.5,1].map(f => <g key={f}><line x1="48" x2="568" y1={y(max*f)} y2={y(max*f)} className="profit-grid"/><text x="43" y={y(max*f)+4} textAnchor="end">{label(max*f)}</text></g>)}
    {reference !== undefined && <line x1="48" x2="568" y1={y(reference)} y2={y(reference)} className="profit-reference"/>}
    <path d={points.map((p,i) => `${i ? "L" : "M"}${x(i)} ${y(p.value)}`).join(" ")} className="profit-line" />
    {hover !== null && <circle cx={x(hover)} cy={y(points[hover].value)} r="4" className="profit-dot"/>}<text x="48" y="214">{points[0].date}</text><text x="568" y="214" textAnchor="end">{points.at(-1)?.date}</text>
  </svg>{hover !== null && <div className="profit-tooltip">{points[hover].date}<br/>{label(points[hover].value)}</div>}</div> : <p className="insight-empty">—</p>}</article>;
}

export function NetworkProfitPanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const [selectedOwner, setSelectedOwner] = useState<string|null>(null);
  const [showAllOwners, setShowAllOwners] = useState(false);
  const daily = useInsight("kairos-cost-daily", 15*60_000);
  const bands = useInsight("kairos-cost-bands", 15*60_000);
  const owners = useInsight("kairos-owner-cost", 15*60_000);
  const addresses = useInsight("kairos-owner-addresses", 15*60_000);
  const histories = useInsight("kairos-owner-history", 60*60_000);
  const rows = daily?.data ?? []; const latest = rows.at(-1);
  const ages = ["Under 1 month", "1 to 3 months", "3 to 6 months", "6 months or more"] as const;
  const labels = zh ? ["不足 1 个月", "1–3 个月", "3–6 个月", "6 个月以上"] : [...ages];
  const maxBand = Math.max(1, ...(bands?.data ?? []).map(b => b.prl));
  return <section className="network-profit-section"><header className="chain-module-header"><p>01 / HOLDERS</p><h2>{zh ? "持币盈亏与成本" : "Holder profit and cost basis"}</h2><span>{zh ? "按代币最后一次链上移动的价格估算" : "Estimated from the price at last onchain movement"}</span></header>
    <CostBasisPanel />
    <div className="profit-chart-grid"><History title={zh ? "MVRV 历史走势" : "MVRV history"} points={rows.map(r => ({ date:r.date, value:r.mvrv }))} reference={1}/><History title={zh ? "盈利供应占比历史" : "Supply in profit history"} points={rows.map(r => ({ date:r.date, value:r.in_profit }))} percent /></div>
    <div className="profit-chart-grid"><article className="profit-chart-card"><h3>{zh ? "上次移动价格分布" : "Supply by last-move price"}</h3><p className="profit-explain">{zh ? "每个价格区间内的 PEARL 数量；早期无报价代币按首个价格估值。" : "PEARL by price band; pre-market coins use the first market price."}</p>{bands?.data.map(b => <div className="profit-band" key={b.band}><span>{b.band}</span><i><em style={{width:`${b.prl/maxBand*100}%`}}/></i><b>{(b.prl/1e6).toFixed(1)}M</b></div>) ?? <p className="insight-empty">—</p>}</article>
    <article className="profit-chart-card"><h3>{zh ? "持币时长分布" : "Time since last movement"}</h3><p className="profit-explain">{zh ? `最近快照 ${latest?.date ?? "—"} · 再次移动后重新计时` : `Latest ${latest?.date ?? "—"} · resets when coins move`}</p>{ages.map((age,i) => <div className="profit-band" key={age}><span>{labels[i]}</span><i><em style={{width:`${Math.max(0,(latest?.[age] ?? 0)*100)}%`}}/></i><b>{latest?.[age] === undefined ? "—" : `${(latest[age]! * 100).toFixed(1)}%`}</b></div>)}</article></div>
    <div className="profit-chart-grid">{ages.map((age,i) => <History key={age} title={`${labels[i]} · ${zh ? "供应占比历史" : "supply share history"}`} points={rows.filter(r => r[age] !== undefined).map(r => ({date:r.date,value:r[age]!}))} percent />)}</div>
    <article className="profit-chart-card profit-owners"><h3>{zh ? "PEARL大户持币统计" : "PEARL large holder statistics"}</h3><p className="profit-explain">{zh ? "按当前持有代币进入钱包时的价格估算；近期转入可能重置成本。未命名持有人显示代表地址；持有人可能包含多个地址，归属为推断。周度变化按相邻周快照计算，当前周可能未结束；表格内滚动查看更多。" : "Estimated from prices when coins entered current wallets; recent transfers can reset cost. Ownership is inferred. Weekly changes compare consecutive snapshots; scroll to see more."}</p><div className="table-scroll owners-scroll" tabIndex={0} aria-label={zh ? "大户持币统计，滚动查看更多" : "Holder statistics, scroll for more"}><table><thead><tr><th>#</th><th>{zh ? "持有人" : "Owner"}</th><th>{zh ? "持有量" : "Balance"}</th><th>{zh ? "持仓价值" : "Value"}</th><th>{zh ? "估计成本" : "Cost basis"}</th><th>{zh ? "估计盈亏" : "Estimated gain"}</th><th>{zh ? "代币进入时间" : "Coins arrived from"}</th><th>{zh ? "地址数" : "Addresses"}</th><th>{zh ? "周度变化" : "Weekly change"}</th><th>{zh ? "30 日变化" : "30-day change"}</th><th>{zh ? "类型" : "Kind"}</th><th>{zh ? "早期代币占比" : "Launch-week share"}</th></tr></thead><tbody>{owners?.data.slice(0,showAllOwners ? undefined : 20).map(o => { const owner = addresses?.data.find(a => a.id === o.id); const h = histories?.data.find(item => item.id === o.id); const delta = h && h.prl.length > 1 ? h.prl[h.prl.length - 1] - h.prl[h.prl.length - 2] : undefined; return <tr key={o.id}><td>{o.rank}</td><td><button type="button" className="whale-link" onClick={() => { setSelectedOwner(o.id); window.setTimeout(() => document.getElementById("whale-details")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }}>{o.name || addresses?.data.find(a => a.id === o.id)?.address || (zh ? "地址暂不可用" : "Address unavailable")}</button></td><td>{(o.balance_prl/1e6).toFixed(2)}M PEARL</td><td>{o.value_usd === undefined ? "—" : `$${new Intl.NumberFormat("en-US", { maximumFractionDigits:0 }).format(o.value_usd)}`}</td><td>${o.cost_basis.toFixed(2)}</td><td>{o.fresh ? (zh ? "近期转入，成本重置" : "Reset by recent move") : o.gain === null ? "—" : `${(o.gain*100).toFixed(1)}%`}</td><td>{o.since || "—"}</td><td>{owner?.addresses ?? "—"}</td><td>{delta === undefined ? "—" : `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(delta)} PEARL`}</td><td>{owner?.d30_prl === undefined ? "—" : `${owner.d30_prl > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(owner.d30_prl)} PEARL`}</td><td>{o.kind_name || "—"}</td><td>{o.pre_market_share === undefined ? "—" : `${(o.pre_market_share*100).toFixed(1)}%`}</td></tr>})}</tbody></table></div>{!owners?.data && <p className="insight-empty">—</p>}{owners && owners.data.length > 20 && <button type="button" className="owners-more" onClick={() => setShowAllOwners(!showAllOwners)}>{showAllOwners ? (zh ? "收起至前 20 条" : "Show top 20") : (zh ? `查看全部 ${owners.data.length} 条` : `Show all ${owners.data.length}`)}</button>}</article>
    <WhaleActivity selected={selectedOwner} setSelected={setSelectedOwner} />
    <p className="profit-explain">{zh ? "数据来自 Kairos 链上估算；钱包移动、地址归属及上市前估值会影响结果。" : "Kairos onchain estimates; transfers, attribution and pre-market valuation affect results."}{daily?.stale || bands?.stale || owners?.stale ? (zh ? " 当前显示上次成功数据。" : " Showing last saved data.") : ""}</p>
  </section>;
}
