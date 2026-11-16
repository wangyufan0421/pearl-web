import { useMemo, useState } from "react";
import { useLanguage } from "./i18n/Language";
import { latestPositiveVenueVolume, orderBookDepth, perpOpenInterestUsd } from "./data/insights";
import { useInsight } from "./data/useInsight";
import { formatUsd } from "./lib/format";

function amount(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value); }
function state(value: number | undefined, loading: boolean, zh: boolean, formatter = formatUsd) { return value === undefined ? loading ? (zh ? "读取中" : "Loading") : "—" : formatter(value); }

export function PerpMarketPanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const details = useInsight("lighter-details", 30_000);
  const funding = useInsight("lighter-funding", 60_000);
  const detail = details?.data.order_book_details[0];
  const rate = funding?.data.funding_rates.find(row => row.market_id === 4097 && row.exchange === "lighter")?.rate;
  const oi = detail ? perpOpenInterestUsd(detail) : undefined;
  return <div className="insight-panel perp-insights" aria-label={zh ? "PEARL 永续合约市场" : "PEARL perpetual market"}>
    <div className="insight-panel-heading"><div><p className="insight-eyebrow">LIGHTER / PERPETUAL</p><h3>{zh ? "永续合约市场" : "Perpetual market"}</h3></div><span>{zh ? "最新公开报价" : "Latest public quote"}</span></div>
    <div className="insight-card-grid three">
      <article><span>{zh ? "双边未平仓名义额" : "Two-sided open interest"}</span><strong>{state(oi, details === undefined, zh)}</strong><small>{zh ? "多空名义额合计 · USD" : "Long and short notional · USD"}</small></article>
      <article><span>{zh ? "24 小时成交量" : "24-hour volume"}</span><strong>{state(detail?.daily_quote_token_volume, details === undefined, zh)}</strong><small>{zh ? "Lighter PEARL 永续 · USD" : "Lighter PEARL perp · USD"}</small></article>
      <article><span>{zh ? "当前资金费率" : "Current funding rate"}</span><strong>{state(rate === undefined ? undefined : rate * 100, funding === undefined, zh, value => `${value.toFixed(4)}%`)}</strong><small>{zh ? "Lighter 报告的原始费率" : "Lighter reported rate"}</small></article>
    </div>
    <p className="insight-note">{zh ? "这些数值来自 Lighter 同一 PEARL 永续市场；未平仓量按多空双边名义额展示，成交量为滚动 24 小时。" : "Values refer to the same Lighter PEARL perpetual market. Open interest is two-sided notional; volume covers the rolling 24 hours."} <a href="https://docs.lighter.xyz/" target="_blank" rel="noreferrer">Lighter ↗</a>{details?.stale || funding?.stale ? (zh ? " · 当前显示上次成功数据" : " · Last saved data") : ""}</p>
  </div>;
}

function CostHistory({ rows, zh }: { rows: Array<{ date: string; price: number; realized_price: number }>; zh: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = rows.slice(-90);
  const plot = useMemo(() => {
    if (points.length < 2) return null;
    const width = 900, height = 230, left = 35, right = 15, top = 16, bottom = 30;
    const max = Math.max(...points.flatMap(row => [row.price, row.realized_price])) * 1.08;
    const x = (index: number) => left + index / (points.length - 1) * (width - left - right);
    const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
    const line = (field: "price" | "realized_price") => points.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(row[field]).toFixed(1)}`).join(" ");
    return { width, height, x, y, line, max };
  }, [points]);
  if (!plot) return <div className="insight-empty">{zh ? "历史成本数据尚未就绪" : "Cost history unavailable"}</div>;
  const row = hover === null ? null : points[hover];
  return <div className="cost-chart"><svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={zh ? "价格与已实现价格历史曲线" : "Price and realized price history"} onMouseMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width) setHover(Math.max(0, Math.min(points.length - 1, Math.round(((event.clientX - bounds.left) / bounds.width * plot.width - 35) / 850 * (points.length - 1))))); }} onMouseLeave={() => setHover(null)}>
    {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1="35" x2="885" y1={plot.y(plot.max * fraction)} y2={plot.y(plot.max * fraction)} className="cost-grid-line" /><text x="29" y={plot.y(plot.max * fraction) + 3} textAnchor="end">${(plot.max * fraction).toFixed(1)}</text></g>)}
    <path d={plot.line("price")} className="cost-price-line" /><path d={plot.line("realized_price")} className="cost-realized-line" />
    {row && hover !== null ? <g className="cost-crosshair"><line x1={plot.x(hover)} x2={plot.x(hover)} y1="16" y2="200" /><circle cx={plot.x(hover)} cy={plot.y(row.price)} r="4" /></g> : null}
    <text x="35" y="222">{points[0].date}</text><text x="885" y="222" textAnchor="end">{points.at(-1)?.date}</text>
  </svg>{row ? <div className="cost-tooltip"><b>{row.date}</b><span>{zh ? "价格" : "Price"} {formatUsd(row.price)}</span><span>{zh ? "已实现价格" : "Realized"} {formatUsd(row.realized_price)}</span></div> : null}</div>;
}

export function CostBasisPanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const meta = useInsight("kairos-cost-meta", 15 * 60_000);
  const daily = useInsight("kairos-cost-daily", 15 * 60_000);
  const current = meta?.data[0];
  return <div className="insight-panel" aria-label={zh ? "持币成本" : "Cost basis"}>
    <div className="insight-panel-heading"><div><p className="insight-eyebrow">COST BASIS / ONCHAIN</p><h3>{zh ? "持币成本与盈亏" : "Cost basis and profit"}</h3></div><span>{current?.as_of ?? "—"}</span></div>
    <div className="insight-card-grid three">
      <article><span>{zh ? "已实现价格" : "Realized price"}</span><strong>{state(current?.realized_price, meta === undefined, zh)}</strong><small>{zh ? "按币上次移动时的价格加权" : "Weighted by price at last movement"}</small></article>
      <article><span>MVRV</span><strong>{state(current?.mvrv, meta === undefined, zh, value => `${value.toFixed(2)}×`)}</strong><small>{zh ? "市场价格 ÷ 已实现价格" : "Market price ÷ realized price"}</small></article>
      <article><span>{zh ? "盈利供应占比" : "Supply in profit"}</span><strong>{state(current?.in_profit, meta === undefined, zh, value => `${(value * 100).toFixed(1)}%`)}</strong><small>{zh ? "上次移动价格低于当前价" : "Last move below current price"}</small></article>
    </div>
    <div className="cost-history-heading"><b>{zh ? "价格与已实现价格 · 近 90 日" : "Price and realized price · 90 days"}</b><span><i />{zh ? "市场价格" : "Market price"}<i />{zh ? "已实现价格" : "Realized price"}</span></div>
    <CostHistory rows={daily?.data ?? []} zh={zh} />
    <p className="insight-note">{zh ? "Kairos 的链上模型：早于首次市场报价的币按首个市场价格估值，故已实现价格并非矿工真实成本。资金移动可能包含内部转账。" : "Kairos onchain model: coins moved before the first market quote use that first price, so realized price is not actual mining cost. Movement can include internal transfers."} <a href="https://prl.kairosresear.ch/#cost" target="_blank" rel="noreferrer">Kairos ↗</a>{meta?.stale || daily?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
  </div>;
}

export function MarketStructurePanel() {
  const { language } = useLanguage(); const zh = language === "zh";
  const detail = useInsight("lighter-details", 30_000);
  const book = useInsight("lighter-book", 30_000);
  const market = useInsight("kairos-market-daily", 15 * 60_000);
  const venues = useInsight("kairos-exchange-venues", 15 * 60_000);
  const currentSafetrade = venues?.data.find(row => row.venue === "SafeTrade");
  const mark = Number(detail?.data.order_book_details[0]?.mark_price);
  const depth = book && Number.isFinite(mark) && mark > 0 ? orderBookDepth(book.data, mark) : null;
  const safetrade = latestPositiveVenueVolume(market?.data ?? []);
  const latestMarketDay = market?.data.at(-1)?.day;
  const reportingGap = !!(safetrade && latestMarketDay && latestMarketDay > safetrade.day);
  const days = market?.data.filter(row => !safetrade || row.day <= safetrade.day).slice(-30) ?? [];
  const max = Math.max(...days.map(row => row.safetrade_volume_usd), 1);
  return <div className="insight-panel" aria-label={zh ? "市场结构" : "Market structure"}>
    <div className="insight-panel-heading"><div><p className="insight-eyebrow">MARKET STRUCTURE / LIQUIDITY</p><h3>{zh ? "交易场所与订单簿" : "Venues and order book"}</h3></div><span>{zh ? "不同来源分别标注" : "Sources shown separately"}</span></div>
    <div className="insight-card-grid three">
      <article><span>{zh ? "Lighter 买盘深度 ±2%" : "Lighter bid depth ±2%"}</span><strong>{state(depth?.bidUsd, book === undefined || detail === undefined, zh)}</strong><small>{zh ? "标记价下方 2% · 可见前 250 档" : "Within 2% below mark · first 250 levels"}</small></article>
      <article><span>{zh ? "Lighter 卖盘深度 ±2%" : "Lighter ask depth ±2%"}</span><strong>{state(depth?.askUsd, book === undefined || detail === undefined, zh)}</strong><small>{zh ? "标记价上方 2% · 可见前 250 档" : "Within 2% above mark · first 250 levels"}</small></article>
      <article><span>{zh ? "SafeTrade 24 小时成交量" : "SafeTrade 24-hour volume"}</span><strong>{state(currentSafetrade?.spot_24h_usd ?? undefined, venues === undefined, zh)}</strong><small>{currentSafetrade?.as_of ? `${currentSafetrade.as_of.slice(0, 16).replace("T", " ")} UTC · USD` : (zh ? "场所报告值 · USD" : "Venue reported · USD")}</small></article>
    </div>
    <div className="insight-bars-heading">{zh ? "SafeTrade 每日报告成交量 · 截至最近非零报告日的 30 日" : "SafeTrade reported daily volume · 30 days through last nonzero report"}</div>
    {days.length ? <div className="insight-bars" role="img" aria-label={zh ? "SafeTrade 每日成交量历史" : "SafeTrade daily volume history"}>{days.map(row => <div key={row.day} title={`${row.day} · ${formatUsd(row.safetrade_volume_usd)}`} style={{ height: `${Math.max(2, row.safetrade_volume_usd / max * 100)}%` }} />)}</div> : <p className="insight-empty">{zh ? "场所成交量正在读取" : "Loading venue volume"}</p>}
    <p className="insight-note">{zh ? "订单簿深度是可见挂单估算，不保证全部成交；SafeTrade 成交量为场所报告值，并非链上验证的成交额。" : "Visible depth estimates resting orders, not executable volume. SafeTrade volume is venue-reported, not verified onchain."}{reportingGap ? (zh ? ` 下方历史序列在 ${safetrade?.day} 后持续为 0，无法确认是真实无成交还是停止上报。` : ` The historical series reports zero after ${safetrade?.day}; this may mean no trading or a reporting gap.`) : ""} <a href="https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails?market_id=4097" target="_blank" rel="noreferrer">Lighter ↗</a> · <a href="https://prl.kairosresear.ch/#venues" target="_blank" rel="noreferrer">Kairos ↗</a>{book?.stale || market?.stale || venues?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
  </div>;
}
