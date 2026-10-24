import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "./SiteHeader";
import { DataFreshness } from "./DataFreshness";
import { useLanguage, formatLocale } from "./i18n/Language";
import { loadComparisonSeries, loadMetricSeries, subscribeToDataUpdates } from "./data/runtime";
import { latestObservedPoint, selectComparisonPoints, type ComparisonRange } from "./data/bitcoinComparison";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";

type Tone = "rose" | "blue";
type ChartProps = { title: string; points: MetricPoint[]; unit: string; color: Tone; range?: ComparisonRange; controls?: boolean; now?: Date };
type SeriesMap = Partial<Record<string, DataResult<MetricSeries>>>;
const physicalIds = ["prl_energy", "btc_energy", "energy_vs_btc", "prl_machines", "btc_machines", "prl_capex", "btc_capex", "prl_issuance_usd", "btc_issuance_usd"] as const;
const valuationIds = ["prl_btc", "mcap_vs_btc", "fdv_vs_btc"] as const;
const ranges: ComparisonRange[] = ["30D", "90D", "ALL"];

function numeric(value: number, digits = 1) { return new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: digits }).format(value); }
function compact(value: number, digits = 2) { return new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: digits }).format(value); }
function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "MW") return value >= 1_000 ? `${numeric(value / 1_000, 2)} GW` : `${numeric(value, 1)} MW`;
  if (unit === "USD") return `$${compact(value)}`;
  if (unit === "USD/day") return `$${compact(value)} / ${formatLocale().startsWith("zh") ? "日" : "day"}`;
  if (unit === "sats") return `${numeric(value, 0)} sats`;
  return `${compact(value)} ${unit}`.trim();
}
function formatDate(point: MetricPoint, detail = false) {
  return new Intl.DateTimeFormat(formatLocale(), detail
    ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
    : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(point.timestamp);
}

export function ComparisonHistoryChart({ title, points, unit, color, range, controls = true, now }: ChartProps) {
  const { language } = useLanguage();
  const [ownRange, setOwnRange] = useState<ComparisonRange>("90D");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const activeRange = range ?? ownRange;
  const referenceTime = now ?? new Date();
  const visible = useMemo(() => selectComparisonPoints(points, activeRange, referenceTime), [points, activeRange, referenceTime.getTime()]);
  const plot = useMemo(() => {
    if (visible.length < 2) return null;
    const width = 800, height = controls ? 248 : 170, left = 52, right = 20, top = 15, bottom = 30;
    const areaWidth = width - left - right, areaHeight = height - top - bottom;
    const values = visible.map(point => point.value);
    const low = Math.min(...values), high = Math.max(...values);
    const pad = Math.max((high - low) * .13, Math.max(Math.abs(high), 1) * .01);
    const min = Math.max(0, low - pad), max = high + pad;
    const span = max - min || 1;
    const firstTime = visible[0].timestamp.getTime();
    const timeSpan = Math.max(1, visible[visible.length - 1].timestamp.getTime() - firstTime);
    const x = (point: MetricPoint) => left + ((point.timestamp.getTime() - firstTime) / timeSpan) * areaWidth;
    const y = (value: number) => top + ((max - value) / span) * areaHeight;
    const path = visible.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
    return { width, height, left, right, top, areaWidth, areaHeight, x, y, path, min, max };
  }, [visible, controls]);
  const hovered = hoveredIndex === null ? null : visible[hoveredIndex] ?? null;
  const selectAtPointer = (clientX: number, svg: SVGSVGElement) => {
    if (!plot) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((clientX - rect.left) / rect.width) * plot.width;
    let nearest = 0, distance = Number.POSITIVE_INFINITY;
    visible.forEach((point, index) => { const delta = Math.abs(plot.x(point) - x); if (delta < distance) { nearest = index; distance = delta; } });
    setHoveredIndex(nearest);
  };
  return <div className={`comparison-chart comparison-chart-${color}`}>
    {controls ? <div className="comparison-chart-toolbar"><span>{language === "zh" ? "历史走势" : "History"}</span><div className="comparison-range" role="group" aria-label={language === "zh" ? "时间范围" : "Time range"}>{ranges.map(item => <button key={item} type="button" aria-pressed={activeRange === item} onClick={() => { setOwnRange(item); setHoveredIndex(null); }}>{item}</button>)}</div></div> : null}
    {plot ? <div className="comparison-chart-plot"><svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" tabIndex={0} aria-label={`${title}${language === "zh" ? "历史图" : " history chart"}`} onPointerMove={event => selectAtPointer(event.clientX, event.currentTarget)} onPointerDown={event => selectAtPointer(event.clientX, event.currentTarget)} onPointerLeave={event => { if (event.pointerType !== "touch") setHoveredIndex(null); }} onFocus={() => { setKeyboardFocused(true); setHoveredIndex(visible.length - 1); }} onBlur={() => { setKeyboardFocused(false); setHoveredIndex(null); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setHoveredIndex(index => Math.max(0, Math.min(visible.length - 1, (index ?? visible.length - 1) + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
      {[0, 1, 2, 3].map(index => { const value = plot.max - (plot.max - plot.min) * index / 3; const y = plot.y(value); return <g className="comparison-chart-grid" key={index}><line x1={plot.left} x2={plot.left + plot.areaWidth} y1={y} y2={y} /><text x={plot.left - 7} y={y + 3} textAnchor="end">{compact(value, 1)}</text></g>; })}
      <rect className="comparison-chart-frame" x={plot.left} y={plot.top} width={plot.areaWidth} height={plot.areaHeight} />
      <path className="comparison-chart-line" d={plot.path} />
      {hovered ? <g className="comparison-chart-focus"><line x1={plot.x(hovered)} x2={plot.x(hovered)} y1={plot.top} y2={plot.top + plot.areaHeight} /><circle cx={plot.x(hovered)} cy={plot.y(hovered.value)} r="5" /></g> : null}
      <g className="comparison-chart-axis"><text x={plot.left} y={plot.height - 6}>{formatDate(visible[0])}</text><text x={plot.left + plot.areaWidth} y={plot.height - 6} textAnchor="end">{formatDate(visible[visible.length - 1])}</text></g>
    </svg><span className="comparison-sr-only" role="status" aria-live="polite" aria-atomic="true">{keyboardFocused && hovered ? `${formatDate(hovered, true)}: ${formatValue(hovered.value, unit)}` : ""}</span>{hovered ? <div className="comparison-tooltip" data-testid="comparison-tooltip"><b>{formatDate(hovered, true)}</b><span>{formatValue(hovered.value, unit)}</span></div> : null}</div> : <div className="comparison-chart-empty">{language === "zh" ? "这一时间范围暂无可用历史数据" : "No history is available for this range"}</div>}
  </div>;
}

function useComparisonSeries(): SeriesMap {
  const [series, setSeries] = useState<SeriesMap>({});
  useEffect(() => {
    let active = true;
    const sync = () => {
      for (const id of physicalIds) void loadComparisonSeries(id).then(result => { if (active) setSeries(previous => ({ ...previous, [id]: result })); });
      for (const id of valuationIds) void loadMetricSeries(id).then(result => { if (active) setSeries(previous => ({ ...previous, [id]: result })); });
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);
  return series;
}

function SnapshotValue({ result, unit }: { result: DataResult<MetricSeries> | undefined; unit: string }) {
  const { language } = useLanguage();
  const latest = latestObservedPoint(result?.data.points ?? []);
  return <><strong>{latest ? formatValue(latest.value, unit) : result ? (language === "zh" ? "暂无数据" : "Unavailable") : (language === "zh" ? "读取中" : "Loading")}</strong><small>{latest ? `${language === "zh" ? "最近观测" : "Observed"} · ${formatDate(latest)}` : language === "zh" ? "等待已保存序列" : "Waiting for saved series"}{result?.stale ? ` · ${language === "zh" ? "上次成功快照" : "Last saved snapshot"}` : ""}</small></>;
}

type Pair = { id: string; network: "PEARL" | "BTC"; unit: string; tone: Tone };
const comparisonSections: { key: string; zh: string; en: string; noteZh: string; noteEn: string; pairs: [Pair, Pair] }[] = [
  { key: "power", zh: "两网功耗", en: "Network power", noteZh: "按各自算力和前沿设备效率推算，不是电表读数。", noteEn: "Derived from each network’s hashrate and frontier hardware efficiency; not metered power.", pairs: [{ id: "prl_energy", network: "PEARL", unit: "MW", tone: "rose" }, { id: "btc_energy", network: "BTC", unit: "MW", tone: "blue" }] },
  { key: "machines", zh: "等效设备数", en: "Frontier machines implied", noteZh: "如果全网都使用模型中的前沿设备，需要多少 GPU 或 ASIC；不是设备普查。", noteEn: "The GPU or ASIC count implied by frontier hardware, not a census of installed machines.", pairs: [{ id: "prl_machines", network: "PEARL", unit: "GPUs", tone: "rose" }, { id: "btc_machines", network: "BTC", unit: "ASICs", tone: "blue" }] },
  { key: "capital", zh: "硬件重建成本", en: "Hardware replacement cost", noteZh: "按前沿设备价格重建当前网络的模型成本，不代表历史实际投资。", noteEn: "Modelled cost to rebuild each network with frontier equipment, not historical spending.", pairs: [{ id: "prl_capex", network: "PEARL", unit: "USD", tone: "rose" }, { id: "btc_capex", network: "BTC", unit: "USD", tone: "blue" }] },
  { key: "issuance", zh: "每日发行价值", en: "Daily issuance value", noteZh: "当天新发行币量乘以当天价格；这是发行规模，不等于实际卖压。", noteEn: "New coins minted that day times that day’s price; issuance is not necessarily sell pressure.", pairs: [{ id: "prl_issuance_usd", network: "PEARL", unit: "USD/day", tone: "rose" }, { id: "btc_issuance_usd", network: "BTC", unit: "USD/day", tone: "blue" }] },
];

export default function PearlVsBitcoinPage() {
  const { language, href } = useLanguage();
  const series = useComparisonSeries();
  const [range, setRange] = useState<ComparisonRange>("90D");
  const ratio = series.energy_vs_btc;
  return <main className="site-shell comparison-page">
    <SiteHeader />
    <div className="comparison-wrap">
      <section className="comparison-intro"><div><p className="comparison-kicker">PHYSICAL SCALE / 01</p><h1>Pearl <em>vs</em> Bitcoin</h1><p className="comparison-lede">{language === "zh" ? "同一张图里，比较真正可比的量。" : "Compare what can actually be compared."}</p></div><aside><span>FP8 ≠ SHA-256</span><p>{language === "zh" ? "两种算法不可直接比较算力（H/s）。这里对照功耗、设备规模、硬件资本和发行价值。功耗与硬件数字来自 prlstats 模型估算，不是现场测量或设备普查。" : "FP8 and SHA-256 hashes are not directly comparable. This page compares power, equipment, hardware capital and issuance value. Power and hardware figures are prlstats model estimates, not measurements or a fleet census."}</p></aside></section>

      <section className="comparison-headline" aria-label={language === "zh" ? "当前对比" : "Latest comparison"}>
        <article className="comparison-headline-lead"><span>{language === "zh" ? "Pearl 功耗 / Bitcoin" : "Pearl power / Bitcoin"}</span><SnapshotValue result={ratio} unit="%" /><p>{language === "zh" ? "相同物理单位的模型比例" : "A modelled ratio of like physical units"}</p></article>
        <article><span>Pearl {language === "zh" ? "网络功耗" : "network power"}</span><SnapshotValue result={series.prl_energy} unit="MW" /></article>
        <article><span>Bitcoin {language === "zh" ? "网络功耗" : "network power"}</span><SnapshotValue result={series.btc_energy} unit="MW" /></article>
      </section>

      <section className="comparison-ratio-section"><div className="comparison-section-title"><div><p>01 / RELATIVE POWER</p><h2>{language === "zh" ? "功耗占比" : "Power share"}</h2></div><span>{language === "zh" ? "Pearl 模型功耗 ÷ Bitcoin 模型功耗" : "Modelled Pearl power ÷ modelled Bitcoin power"}</span></div><div className="comparison-ratio-panel"><ComparisonHistoryChart title={language === "zh" ? "功耗占比" : "Power share"} points={ratio?.data.points ?? []} unit="%" color="rose" /><DataFreshness result={ratio} /></div></section>

      <section className="comparison-details"><div className="comparison-section-title"><div><p>02 / SIDE BY SIDE</p><h2>{language === "zh" ? "两条网络，同一口径" : "Two networks, one method"}</h2></div><span>{language === "zh" ? "曲线各用自身刻度；数字请看单位与日期" : "Each chart uses its own scale; compare units and observation dates"}</span></div><div className="comparison-global-range" role="group" aria-label={language === "zh" ? "对比图时间范围" : "Comparison chart range"}>{ranges.map(item => <button type="button" key={item} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}</div>
        {comparisonSections.map((section, index) => <article className="comparison-pair-section" key={section.key}><div className="comparison-pair-heading"><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{language === "zh" ? section.zh : section.en}</h3></div><p>{language === "zh" ? section.noteZh : section.noteEn}</p></div><div className="comparison-pair-grid">{section.pairs.map(pair => { const result = series[pair.id]; return <div className={`comparison-network-panel ${pair.tone}`} key={pair.id}><div className="comparison-network-head"><span>{pair.network}</span><SnapshotValue result={result} unit={pair.unit} /></div><ComparisonHistoryChart title={`${pair.network} ${language === "zh" ? section.zh : section.en}`} points={result?.data.points ?? []} unit={pair.unit} color={pair.tone} range={range} controls={false} /></div>; })}</div></article>)}
      </section>

      <section className="comparison-market"><div className="comparison-section-title"><div><p>03 / MARKET CONTEXT</p><h2>{language === "zh" ? "再看市场尺度" : "The market lens"}</h2></div><span>{language === "zh" ? "这些比例已在数据汇总页展示，此处用于交叉参照" : "These ratios also remain on the data summary page"}</span></div><div className="comparison-market-grid">{([{ id: "prl_btc", zh: "每枚 PEARL 的 BTC 计价", en: "PEARL priced in BTC", unit: "sats" }, { id: "mcap_vs_btc", zh: "流通市值 / BTC", en: "Market cap / BTC", unit: "%" }, { id: "fdv_vs_btc", zh: "FDV / BTC", en: "FDV / BTC", unit: "%" }] as const).map(item => <article key={item.id}><span>{language === "zh" ? item.zh : item.en}</span><SnapshotValue result={series[item.id]} unit={item.unit} /></article>)}</div><a href={href("/valuation")}>{language === "zh" ? "查看完整数据汇总 ↗" : "Explore the full data summary ↗"}</a></section>


      <aside className="comparison-method"><div><p>METHOD / SOURCE</p><h2>{language === "zh" ? "模型，不是普查" : "A model, not a census"}</h2></div><p>{language === "zh" ? "prlstats 以观测算力和前沿硬件效率估算功耗与设备数；硬件资本是按当前设备重建的成本。Pearl 与 Bitcoin 的原始算力并不具有相同物理含义，因此本站不绘制“算力比例”。两网历史点可能更新于不同日期，图表不会将旧观测外推成今天的数据。" : "prlstats models power and machine counts from observed hashrate and frontier hardware efficiency; capital is a replacement-cost estimate. The two raw hashrates have different physical meanings, so this page does not chart a hashrate ratio. Historical observations may update on different dates and are never extrapolated to today."}</p><a href="https://prlstats.com/networks" target="_blank" rel="noreferrer">prlstats {language === "zh" ? "方法与来源 ↗" : "method and sources ↗"}</a></aside>
    </div>
  </main>;
}
