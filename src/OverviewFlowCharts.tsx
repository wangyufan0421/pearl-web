import { useState } from "react";
import { useInsight } from "./data/useInsight";
import { useLanguage } from "./i18n/Language";

const money = (n: number) => `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
const units = (n: number) => `${n > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n)}`;

export function OverviewFlowCharts() {
  const { language } = useLanguage(); const zh = language === "zh";
  const daily = useInsight("kairos-venue-daily", 15 * 60_000);
  const monthly = useInsight("kairos-exchange-monthly", 60 * 60_000);
  const [hover, setHover] = useState<number | null>(null);
  const rows = daily?.data ?? [];
  const values = rows.map(r => ({ ...r, buy: Math.max(0, (r.dex_usd ?? 0) - (r.dex_sell_usd ?? 0)) + (r.otc_usd ?? 0) }));
  const max = Math.max(1, ...values.flatMap(r => [r.emission_usd, r.buy]));
  const x = (i: number) => 62 + (i + .5) * 510 / Math.max(values.length, 1);
  const y = (v: number) => 240 - v / max * 205;
  const line = values.map((r, i) => `${i ? "L" : "M"}${x(i)} ${y(r.buy)}`).join(" ");
  const months = monthly?.data ?? [];
  const nets = months.map(r => r.in - r.out);
  const span = Math.max(1, ...nets.map(Math.abs));
  const selected = hover === null ? null : values[hover];
  return <div className="overview-flow-charts">
    <article className="overview-flow-card"><div className="overview-flow-head"><div><p className="insight-eyebrow">ISSUANCE / DEMAND</p><h3>{zh ? "每日发行价值与链上买入" : "Daily issuance and onchain buying"}</h3></div></div>
      <div className="overview-flow-legend"><span><i />{zh ? "发行价值" : "Value issued"}</span><span><i />{zh ? "可验证链上买入" : "Verifiable onchain buying"}</span></div>
      {values.length ? <div className="overview-flow-plot"><svg viewBox="0 0 600 275" role="img" aria-label={zh ? "每日发行价值与链上买入图" : "Daily issuance and onchain buying chart"} onMouseMove={e => { const b = e.currentTarget.getBoundingClientRect(); const p = (e.clientX - b.left) / b.width * 600; setHover(Math.max(0, Math.min(values.length - 1, Math.floor((p - 62) / 510 * values.length)))); }} onMouseLeave={() => setHover(null)}>
        {[0,.5,1].map(f => <g key={f}><line x1="62" x2="572" y1={y(max*f)} y2={y(max*f)} className="overview-flow-grid"/><text x="54" y={y(max*f)+4} textAnchor="end">${(max*f/1e6).toFixed(1)}M</text></g>)}
        {values.map((r,i) => <rect key={r.day} x={x(i)-Math.max(1, 510/values.length*.36)} y={y(r.emission_usd)} width={Math.max(2,510/values.length*.72)} height={240-y(r.emission_usd)} className="issuance-bar" />)}<path d={line} className="buy-line" />
        <text x="62" y="264">{values[0].day}</text><text x="572" y="264" textAnchor="end">{values.at(-1)?.day}</text>
      </svg>{selected && <div className="overview-flow-tip"><b>{selected.day}</b><span>{zh ? "发行价值" : "Issued"} {money(selected.emission_usd)}</span><span>{zh ? "链上买入" : "Buying"} {money(selected.buy)}</span></div>}</div> : <p className="insight-empty">{zh ? "正在读取每日数据" : "Loading daily data"}</p>}
      <p className="overview-flow-note">{zh ? "买入包含 wPRL DEX 买入及已结算 OTC，不代表全部市场买盘。美元计价。" : "Buying includes wPRL DEX buys and settled OTC, not all market demand. USD."}{daily?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
    </article>
    <article className="overview-flow-card"><div className="overview-flow-head"><div><p className="insight-eyebrow">EXCHANGE / MONTHLY</p><h3>{zh ? "交易所月度净流入" : "Monthly exchange net inflow"}</h3></div></div>
      {months.length ? <svg className="overview-flow-monthly" viewBox="0 0 600 275" role="img" aria-label={zh ? "交易所月度净流入图" : "Monthly exchange net inflow chart"}>
        <defs><pattern id="flow-current-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#d99078"/><rect width="2" height="6" fill="#f5e4d9"/></pattern></defs>
        {[-1,-.5,0,.5,1].map(f => <g key={f}><line x1="65" x2="575" y1={135-f*93} y2={135-f*93} className="overview-flow-grid"/><text x="57" y={139-f*93} textAnchor="end">{units(span*f)}</text></g>)}
        {months.map((r,i) => { const v=nets[i]; const w=510/months.length; const h=Math.abs(v)/span*93; return <g key={r.month}><rect x={65+i*w+w*.15} y={v>=0?135-h:135} width={w*.7} height={h} fill={i===months.length-1?'url(#flow-current-stripes)':v>=0?'#cc866f':'#78a795'}><title>{`${r.month}: ${units(v)} PEARL`}</title></rect><text x={65+i*w+w/2} y={v>=0?Math.max(19,130-h):Math.min(251,150+h)} textAnchor="middle">{units(v)}</text><text x={65+i*w+w/2} y="268" textAnchor="middle">{r.month.slice(5,7)}/{r.month.slice(2,4)}</text></g>; })}
      </svg> : <p className="insight-empty">{zh ? "正在读取月度数据" : "Loading monthly data"}</p>}
      <p className="overview-flow-note">{zh ? "净流入 = 流入 − 流出；斜纹表示最新月份尚未结束。交易所流入不等于卖出。" : "Net inflow = deposits − withdrawals. The hatched latest month is incomplete. Deposits do not imply sales."}{monthly?.stale ? (zh ? " · 上次成功数据" : " · Last saved data") : ""}</p>
    </article>
  </div>;
}
