import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type DataResult, type MetricPoint, type MetricSeries, type SourceKind } from "./data/prlstats";
import { loadMetricSeries, loadNetworkSnapshot, subscribeToDataUpdates } from "./data/runtime";
import type { NetworkSnapshot } from "./data/schema";
import { formatUsd } from "./lib/format";

const metricIds = ["price", "prl_btc", "volume", "cost_allin", "supply", "mcap_vs_btc", "fdv_vs_btc", "inflation", "miner_revenue"] as const;
type MetricId = typeof metricIds[number];
type PriceRange = "30D" | "90D" | "ALL";
type ChartMetricId = Extract<MetricId, "price" | "prl_btc" | "mcap_vs_btc" | "fdv_vs_btc" | "volume" | "cost_allin">;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", year: "numeric" }).format(date);
}

function formatCompact(value: number, digits = 2) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: digits }).format(value);
}

function formatPrl(value: number) { return `${formatCompact(value)} PRL`; }
function formatPercent(value: number, digits = 3) { return `${value.toFixed(digits)}%`; }
function formatSats(value: number) { return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value)} sats`; }

const chartOptions: { id: ChartMetricId; label: string; source: string; formatter: (value: number) => string }[] = [
  { id: "prl_btc", label: "PRL priced in Bitcoin", source: "PRL / BTC · prlstats 历史序列", formatter: formatSats },
  { id: "mcap_vs_btc", label: "Pearl market cap vs Bitcoin", source: "流通市值 / BTC · prlstats 历史序列", formatter: formatPercent },
  { id: "fdv_vs_btc", label: "Pearl FDV vs Bitcoin", source: "FDV / BTC · prlstats 历史序列", formatter: formatPercent },
  { id: "volume", label: "24h volume", source: "24 小时成交量 · prlstats 历史序列", formatter: formatUsd },
  { id: "cost_allin", label: "PRL挖矿成本", source: "全成本 / PRL · prlstats 历史序列", formatter: formatUsd },
];

function latest(result: DataResult<MetricSeries> | undefined) { return result?.data.points.at(-1)?.value; }
function valueOrState(result: DataResult<MetricSeries> | undefined, formatter: (value: number) => string) {
  const value = latest(result);
  return result === undefined ? "读取中" : value === undefined ? "暂未提供" : formatter(value);
}
function sourceKind(result: DataResult<MetricSeries> | undefined): SourceKind { return result?.sourceKind ?? "fallback"; }

function DataCard({ label, value, detail, kind = "live", tone = "ink" }: { label: string; value: string; detail: string; kind?: SourceKind; tone?: "ink" | "rose" | "blue" | "yellow" }) {
  return <article className={`valuation-card tone-${tone}`}>
    <p>{label}</p><strong>{value}</strong><span><i className={`status-dot ${kind}`} />{detail}</span>
  </article>;
}

function ModuleHeader({ eyebrow, title, source }: { eyebrow: string; title: ReactNode; source: string }) {
  return <header className="valuation-module-header"><p>{eyebrow}</p><h2>{title}</h2><span>{source}</span></header>;
}

export function PriceTrend({ points, range = "90D", label, formatter }: { points: MetricPoint[]; range?: PriceRange; label: string; formatter: (value: number) => string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visible = useMemo(() => {
    if (range === "ALL") return points;
    const lastTime = points.at(-1)?.timestamp.getTime();
    if (lastTime === undefined) return [];
    const days = range === "30D" ? 30 : 90;
    return points.filter((point) => point.timestamp.getTime() >= lastTime - days * 86_400_000);
  }, [points, range]);
  const chart = useMemo(() => {
    if (visible.length < 2) return null;
    const width = 840; const height = 282; const left = 8; const right = 70; const top = 18; const bottom = 30;
    const values = visible.map((point) => point.value); const low = Math.min(...values); const high = Math.max(...values);
    const padding = Math.max((high - low) * .14, Math.max(high * .025, .01)); const min = low - padding; const max = high + padding; const span = max - min || 1;
    const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    const x = (index: number) => left + ((index + .5) / visible.length) * plotWidth;
    const y = (value: number) => top + ((max - value) / span) * plotHeight;
    const ticks = Array.from({ length: 4 }, (_, index) => max - span * index / 3);
    const xTicks = [...new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1])];
    const path = visible.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
    return { width, height, left, right, top, bottom, plotWidth, plotHeight, x, y, ticks, xTicks, path };
  }, [visible]);
  const hovered = hoveredIndex === null ? null : visible[hoveredIndex];

  if (!chart) return <div className="price-trend-empty">图表序列正在同步中</div>;
  return <div className="price-trend" onMouseLeave={() => setHoveredIndex(null)}>
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${label} 历史走势`}>
      <defs><linearGradient id="price-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="rgba(168,63,98,.20)" /><stop offset="1" stopColor="rgba(168,63,98,0)" /></linearGradient></defs>
      <g className="price-trend-grid">{chart.ticks.map((value) => <g key={value}><line x1={chart.left} x2={chart.left + chart.plotWidth} y1={chart.y(value)} y2={chart.y(value)} /><text x={chart.left + chart.plotWidth + 10} y={chart.y(value) + 4}>{formatter(value)}</text></g>)}</g>
      <path className="price-trend-area" d={`${chart.path} L${chart.x(visible.length - 1)} ${chart.top + chart.plotHeight} L${chart.x(0)} ${chart.top + chart.plotHeight} Z`} />
      <path className="price-trend-line" d={chart.path} />
      <g className="price-trend-axis">{chart.xTicks.map((index) => <text key={index} x={chart.x(index)} y={chart.height - 8} textAnchor="middle">{formatDate(visible[index].timestamp)}</text>)}</g>
      <g>{visible.map((point, index) => <g className={`price-point ${hoveredIndex === index ? "is-active" : ""}`} key={point.timestamp.getTime()} role="button" tabIndex={0} aria-label={`${formatDate(point.timestamp)} ${formatter(point.value)}`} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)}><circle cx={chart.x(index)} cy={chart.y(point.value)} r={hoveredIndex === index ? 4.5 : 7} /><circle className="price-point-dot" cx={chart.x(index)} cy={chart.y(point.value)} r={hoveredIndex === index ? 2.5 : 0} /></g>)}</g>
    </svg>
    {hovered ? <div className="price-trend-tooltip" data-testid="price-trend-tooltip"><b>{formatDate(hovered.timestamp)}</b><span>{formatter(hovered.value)}</span></div> : null}
  </div>;
}

export default function ValuationPage() {
  const [metrics, setMetrics] = useState<Partial<Record<MetricId, DataResult<MetricSeries>>>>({});
  const [network, setNetwork] = useState<DataResult<NetworkSnapshot> | null>(null);
  const [range, setRange] = useState<PriceRange>("90D");
  const [selectedChartMetric, setSelectedChartMetric] = useState<ChartMetricId>("prl_btc");

  useEffect(() => {
    let active = true;
    const sync = () => {
      void Promise.all(metricIds.map(async (id) => [id, await loadMetricSeries(id)] as const)).then((entries) => {
        if (active) setMetrics(Object.fromEntries(entries));
      });
      void loadNetworkSnapshot().then((result) => { if (active) setNetwork(result); });
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);

  const metric = (id: MetricId) => metrics[id];
  const selectedChartOption = chartOptions.find((option) => option.id === selectedChartMetric) ?? chartOptions[0];
  const price = latest(metric("price")); const supply = latest(metric("supply"));
  const marketCap = price === undefined || supply === undefined ? undefined : price * supply;
  const fdv = price === undefined ? undefined : price * 2_100_000_000;
  const marketCapState = metric("price") === undefined || metric("supply") === undefined ? "读取中" : marketCap === undefined ? "暂未提供" : formatUsd(marketCap);
  const fdvState = metric("price") === undefined ? "读取中" : fdv === undefined ? "暂未提供" : formatUsd(fdv);
  const issuanceValue = network === null || price === undefined ? undefined : network.data.emissionPrlDay * price;

  return <main className="site-shell valuation-page">
    <header className="topbar"><a className="brand" href="/">Pearl <span>中文社区</span></a><nav aria-label="数据导航"><a href="/">总览</a><a href="/chain">链上</a><a href="/valuation" aria-current="page">数据</a></nav></header>
    <div className="valuation-wrap">
      <header className="valuation-intro"><p>PEARL / DATA</p><h1>PRL 数据汇总</h1><span>价格、供应、流动性与相对尺度，共同构成完整的数据语境。</span></header>

      <section className="valuation-module">
        <ModuleHeader eyebrow="01 / CHART" title="PRL 数据图表" source={selectedChartOption.source} />
        <div className="valuation-price-panel">
          <div className="valuation-toolbar"><span>{selectedChartOption.label}</span><div className="price-chart-controls"><label className="chart-metric-select"><span>图表指标</span><select aria-label="图表指标" value={selectedChartMetric} onChange={(event) => setSelectedChartMetric(event.target.value as ChartMetricId)}>{chartOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><div className="valuation-range-tabs">{(["30D", "90D", "ALL"] as PriceRange[]).map((item) => <button type="button" className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{item}</button>)}</div></div></div>
          <PriceTrend points={metric(selectedChartMetric)?.data.points ?? []} range={range} label={selectedChartOption.label} formatter={selectedChartOption.formatter} />
          <p>选择不同指标即可切换历史序列。图表为单值时间序列，并非 OHLC K 线。</p>
        </div>
        <div className="valuation-card-grid price-cards"><DataCard label="PRL 参考价" value={valueOrState(metric("price"), formatUsd)} detail="公开价格序列 · USD / PRL" kind={sourceKind(metric("price"))} tone="rose" /><DataCard label="PRL / BTC" value={valueOrState(metric("prl_btc"), formatSats)} detail="一枚 PRL 折算的 BTC 价值" kind={sourceKind(metric("prl_btc"))} /><DataCard label="24h 成交量" value={valueOrState(metric("volume"), formatUsd)} detail="公开汇总成交量 · USD" kind={sourceKind(metric("volume"))} /></div>
      </section>

      <section className="valuation-module">
        <ModuleHeader eyebrow="02 / VALUATION" title="估值" source="供应量与 BTC 相对尺度" />
        <div className="valuation-card-grid valuation-cards"><DataCard label="流通市值" value={marketCapState} detail="PRL 参考价 × 流通供应量" kind={sourceKind(metric("price"))} tone="blue" /><DataCard label="FDV" value={fdvState} detail="PRL 参考价 × 21 亿 PRL 最大供应量" kind={sourceKind(metric("price"))} /><DataCard label="流通市值 / BTC" value={valueOrState(metric("mcap_vs_btc"), (value) => formatPercent(value))} detail="Pearl 流通市值占 Bitcoin 市值" kind={sourceKind(metric("mcap_vs_btc"))} /><DataCard label="FDV / BTC" value={valueOrState(metric("fdv_vs_btc"), (value) => formatPercent(value))} detail="Pearl FDV 占 Bitcoin FDV" kind={sourceKind(metric("fdv_vs_btc"))} /></div>
        <aside className="valuation-formula"><b>口径说明</b><span>流通市值采用价格序列的最新点 × 流通供应序列的最新点；FDV 使用同一价格 × 2,100,000,000 PRL。两项 BTC 比例直接读取 prlstats 序列。</span></aside>
      </section>

      <section className="valuation-module">
        <ModuleHeader eyebrow="03 / SUPPLY" title="供给" source="发行节奏与公开供应序列" />
        <div className="valuation-card-grid supply-cards"><DataCard label="流通供应量" value={valueOrState(metric("supply"), formatPrl)} detail="prlstats 流通供应序列" kind={sourceKind(metric("supply"))} /><DataCard label="供应进度" value={network === null ? "读取中" : `${network.data.supplyPercent.toFixed(2)}%`} detail={network === null ? "公开链上快照" : `${formatPrl(network.data.supplyPrl)} 已发行`} kind={network?.sourceKind ?? "fallback"} /><DataCard label="年化通胀率" value={valueOrState(metric("inflation"), (value) => formatPercent(value, 2))} detail="按当前发行节奏年化" kind={sourceKind(metric("inflation"))} /><DataCard label="每日排放" value={network === null ? "读取中" : formatPrl(network.data.emissionPrlDay)} detail="公开网络快照" kind={network?.sourceKind ?? "fallback"} /><DataCard label="每日发行价值" value={issuanceValue === undefined ? network === null || metric("price") === undefined ? "读取中" : "暂未提供" : formatUsd(issuanceValue)} detail="参考价 × 当前日排放" kind={sourceKind(metric("price"))} tone="yellow" /><DataCard label="矿工收入 / 日" value={valueOrState(metric("miner_revenue"), formatUsd)} detail="prlstats 矿工收入序列" kind={sourceKind(metric("miner_revenue"))} /></div>
      </section>
    </div>
  </main>;
}
