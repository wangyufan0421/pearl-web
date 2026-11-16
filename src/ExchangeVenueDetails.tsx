import { useState } from "react";
import { useLanguage } from "./i18n/Language";
import { useInsight } from "./data/useInsight";

type Day = { day:string; dep:number; wd:number; net:number; held:number; partial:boolean };
const compact=(v:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const full=(v:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v);
function VenueChart({ rows, holdings, zh }: { rows:Day[]; holdings?:boolean; zh:boolean }) {
  const [hover,setHover]=useState<number|null>(null);
  const series=holdings?([{key:'held',name:zh?'已识别地址持仓':'Attributed balance',color:'#518c79'}] as const):([{key:'dep',name:zh?'流入':'Inflow',color:'#c66f80'},{key:'wd',name:zh?'流出':'Outflow',color:'#729eaa'},{key:'net',name:zh?'净流入':'Net inflow',color:'#b5904a'}] as const);
  const vals=rows.flatMap(row=>series.map(s=>row[s.key])); const min=Math.min(0,...vals), max=Math.max(1,...vals); const span=max-min;
  const x=(i:number)=>65+i/Math.max(1,rows.length-1)*510; const y=(v:number)=>195-(v-min)/span*165;
  return <article className="venue-chart-card"><h4>{holdings?(zh?'已识别地址持仓变化':'Attributed balance'):(zh?'每日流入、流出与净流入':'Daily inflows and outflows')}</h4><div className="venue-legend">{series.map(s=><span key={s.key}><i style={{background:s.color}}/>{s.name}</span>)}</div>{rows.length>1?<div className="venue-plot"><svg viewBox="0 0 600 225" role="img" aria-label={holdings?(zh?'交易所持仓历史':'Exchange balance history'):(zh?'交易所每日资金流向':'Exchange daily flows')} onMouseMove={e=>{const b=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(rows.length-1,Math.round(((e.clientX-b.left)/b.width*600-65)/510*(rows.length-1)))));}} onMouseLeave={()=>setHover(null)}>
    {[0,.5,1].map(f=><g key={f}><line x1="65" x2="575" y1={y(min+span*f)} y2={y(min+span*f)} className="profit-grid"/><text x="59" y={y(min+span*f)+4} textAnchor="end">{compact(min+span*f)}</text></g>)}
    {series.map(s=><path key={s.key} d={rows.map((r,i)=>`${i?'L':'M'}${x(i)} ${y(r[s.key])}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke"/>)}<text x="65" y="220">{rows[0].day}</text><text x="575" y="220" textAnchor="end">{rows.at(-1)?.day}</text>
  </svg>{hover!==null&&<div className="profit-tooltip"><b>{rows[hover].day}{rows[hover].partial?(zh?' · 未结束':' · partial'):''}</b>{series.map(s=><div key={s.key}>{s.name}: {full(rows[hover][s.key])} PEARL</div>)}</div>}</div>:<p className="insight-empty">{zh?'暂无足够历史数据':'Not enough history'}</p>}</article>;
}
export function ExchangeVenueDetails() {
  const { language }=useLanguage(); const zh=language==='zh'; const [venue,setVenue]=useState('SafeTrade');
  const daily=useInsight('kairos-exchange-daily',15*60_000); const moves=useInsight('kairos-exchange-moves',15*60_000); const venues=useInsight('kairos-exchange-venues',15*60_000);
  const rows=(daily?.data??[]).filter(r=>r.venue===venue).sort((a,b)=>a.day.localeCompare(b.day));
  const transfers=(moves?.data??[]).filter(r=>r.venue===venue).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,10);
  const stamp=venues?.data.find(r=>r.venue===venue)?.as_of;
  return <section className="venue-details" aria-label={zh?'逐家交易所资金流向':'Exchange flows by venue'}><div className="insight-panel-heading"><div><p className="insight-eyebrow">EXCHANGE / DETAIL</p><h3>{zh?'逐家交易所资金流向':'Exchange flows by venue'}</h3></div></div>
    <div className="venue-tabs" role="group" aria-label={zh?'选择交易所':'Select exchange'}>{['SafeTrade','Gate','Coinbase','Kraken'].map(name=><button key={name} type="button" aria-pressed={venue===name} onClick={()=>setVenue(name)}>{name}{(name==='Gate'||name==='Coinbase')&&(zh?' · 线索':' · lead')}</button>)}</div>
    <p className="profit-explain">{zh?`数据截至 ${stamp?new Date(stamp).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'—'}（北京时间）。已识别地址仅覆盖部分交易所钱包；Gate 与 Coinbase 地址归属为线索。流入不等于卖出，跨交易所转账可计入双方。`:`Data as of ${stamp??'—'}. Attributed addresses cover only part of exchange wallets; Gate and Coinbase are leads. Deposits do not prove sales; transfers between exchanges may be counted on both sides.`}{daily?.stale||moves?.stale||venues?.stale?(zh?' 当前显示上次成功数据。':' Showing last saved data.'):''}</p>
    <div className="venue-chart-grid"><VenueChart rows={rows} zh={zh}/><VenueChart rows={rows} zh={zh} holdings/></div>
    <h4 className="venue-moves-title">{zh?'近期大额转账':'Recent large transfers'}</h4><p className="profit-explain">{zh?'按数据源提供的近 7 日大额转账排序；时间为北京时间，点击交易哈希查看原始记录。':'Recent large transfers supplied by the source, sorted by time; click transaction hash to inspect.'}</p>
    <div className="table-scroll"><table className="venue-moves"><thead><tr><th>{zh?'时间':'Time'}</th><th>{zh?'方向':'Direction'}</th><th>{zh?'数量':'Amount'}</th><th>{zh?'对手地址':'Counterparty'}</th><th>{zh?'交易':'Transaction'}</th></tr></thead><tbody>{transfers.map((r,i)=><tr key={`${r.txid}-${i}`}><td>{new Date(r.time).toLocaleString(zh?'zh-CN':'en-US',{timeZone:'Asia/Shanghai',hour12:false})}</td><td>{r.dir==='in'?(zh?'流入':'In'):(zh?'流出':'Out')}</td><td>{full(r.prl)} PEARL</td><td title={r.address}>{r.address?`${r.address.slice(0,12)}…${r.address.slice(-7)}`:r.name||'—'}</td><td><a href={`https://prlscan.com/tx/${encodeURIComponent(r.txid)}`} target="_blank" rel="noreferrer">{r.txid.slice(0,12)}… ↗</a></td></tr>)}</tbody></table></div>{!transfers.length&&<p className="insight-empty">{moves===undefined?(zh?'正在读取转账':'Loading transfers'):(zh?'暂无大额转账记录':'No large transfers available')}</p>}
  </section>;
}
