import { useEffect, useMemo, useState } from "react";
import { type CandleSeries, type DataResult, type MetricSeries, type SourceKind } from "./data/prlstats";
import { loadLighterCandles, loadMetricSeries, loadNetworkSnapshot, startDataRefresh, subscribeToDataUpdates } from "./data/runtime";
import type { NetworkSnapshot } from "./data/schema";
import { formatBlockDeviation, formatHashrate, formatUsd } from "./lib/format";
import ChainPage from "./ChainPage";
import ValuationPage from "./ValuationPage";

type Range = "7D" | "30D";
const liveMetricIds = ["cost_allin", "txs", "onchain_volume", "funded_addresses", "top10_share", "fdv_vs_btc", "prl_btc", "marginal_cost", "crossover"] as const;
type LiveMetricId = typeof liveMetricIds[number];

function MetricCard({ label, value, detail, kind = "live", tone = "ink" }: {
  label: string; value: string; detail: string; kind?: "live" | "fallback"; tone?: "ink" | "rose" | "blue";
}) {
  return <article className={`metric-card tone-${tone}`}>
    <p className="metric-label">{label}</p>
    <p className="metric-value">{value}</p>
    <div className="metric-detail"><span className={`status-dot ${kind}`} />{detail}</div>
  </article>;
}

export function CandlestickChart({ candles, zoom }: { candles: CandleSeries["candles"]; zoom: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const visibleCandles = useMemo(() => candles.slice(-Math.max(24, Math.ceil(candles.length / zoom))), [candles, zoom]);
  const chart = useMemo(() => {
    const width = 660; const height = 292; const left = 10; const right = 70; const top = 18; const bottom = 31;
    const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    if (visibleCandles.length < 2) return null;
    const prices = visibleCandles.flatMap((candle) => [candle.high, candle.low]);
    const low = Math.min(...prices); const high = Math.max(...prices); const padding = Math.max((high - low) * .12, .002);
    const min = low - padding; const max = high + padding; const span = max - min || 1;
    const priceY = (price: number) => top + ((max - price) / span) * plotHeight;
    const x = (index: number) => left + ((index + .5) / visibleCandles.length) * plotWidth;
    const candleWidth = Math.max(2, Math.min(10, (plotWidth / visibleCandles.length) * .62));
    const yTicks = Array.from({ length: 5 }, (_, index) => max - (span / 4) * index);
    const xTicks = [0, Math.floor((visibleCandles.length - 1) / 3), Math.floor((visibleCandles.length - 1) * 2 / 3), visibleCandles.length - 1];
    const closePath = visibleCandles.map((candle, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${priceY(candle.close).toFixed(2)}`).join(" ");
    return { width, height, left, right, top, bottom, plotWidth, plotHeight, priceY, x, candleWidth, yTicks, xTicks, closePath };
  }, [visibleCandles]);

  if (!chart) return <div className="chart-interaction" data-testid="candlestick-interaction"><div className="chart-empty">Lighter K 线正在同步中</div></div>;
  const hoveredCandle = hoverIndex === null ? null : visibleCandles[hoverIndex];
  const formatDate = (date: Date, withTime = false) => new Intl.DateTimeFormat("zh-CN", withTime ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false } : { month: "numeric", day: "numeric" }).format(date);
  const pointerToIndex = (clientX: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * chart.width;
    return Math.max(0, Math.min(visibleCandles.length - 1, Math.floor(((svgX - chart.left) / chart.plotWidth) * visibleCandles.length)));
  };
  return <div className="chart-interaction" data-testid="candlestick-interaction">
    <svg className="candlestick-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Lighter PRL 永续 K 线图" onMouseMove={(event) => setHoverIndex(pointerToIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onMouseLeave={() => setHoverIndex(null)}>
    <defs><clipPath id="candle-clip"><rect x={chart.left} y={chart.top} width={chart.plotWidth} height={chart.plotHeight} /></clipPath></defs>
    <g className="chart-grid">{chart.yTicks.map((value) => <g key={value}><line x1={chart.left} x2={chart.left + chart.plotWidth} y1={chart.priceY(value)} y2={chart.priceY(value)} /><text x={chart.left + chart.plotWidth + 11} y={chart.priceY(value) + 4}>${value.toFixed(2)}</text></g>)}</g>
    <g className="chart-axis">{chart.xTicks.map((index) => <text key={index} x={chart.x(index)} y={chart.height - 8} textAnchor="middle">{formatDate(visibleCandles[index].timestamp)}</text>)}</g>
    <g clipPath="url(#candle-clip)"><path className="candle-close-line" d={chart.closePath} />{visibleCandles.map((candle, index) => { const rising = candle.close >= candle.open; const openY = chart.priceY(candle.open); const closeY = chart.priceY(candle.close); return <g className={`candle ${rising ? "up" : "down"}`} key={candle.timestamp.getTime()} style={{ animationDelay: `${Math.min(index * 10, 620)}ms` }}><line className="candle-wick" x1={chart.x(index)} x2={chart.x(index)} y1={chart.priceY(candle.high)} y2={chart.priceY(candle.low)} /><rect x={chart.x(index) - chart.candleWidth / 2} y={Math.min(openY, closeY)} width={chart.candleWidth} height={Math.max(1.2, Math.abs(openY - closeY))} rx=".8" /></g>; })}{hoveredCandle && <g className="chart-crosshair"><line x1={chart.x(hoverIndex!)} x2={chart.x(hoverIndex!)} y1={chart.top} y2={chart.top + chart.plotHeight} /><circle cx={chart.x(hoverIndex!)} cy={chart.priceY(hoveredCandle.close)} r="3.2" /></g>}</g>
    </svg>
    {hoveredCandle && <div className="chart-tooltip" style={{ left: `${Math.max(8, Math.min(78, ((hoverIndex! + .5) / visibleCandles.length) * 100))}%` }}><b>{formatDate(hoveredCandle.timestamp, true)}</b><span>开 {formatUsd(hoveredCandle.open)}</span><span>高 {formatUsd(hoveredCandle.high)}</span><span>低 {formatUsd(hoveredCandle.low)}</span><span>收 {formatUsd(hoveredCandle.close)}</span></div>}
  </div>;
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="section-header"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></header>;
}

function formatCount(value: number | undefined, digits = 0) {
  return value === undefined ? "读取中" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value);
}

function formatMetricPercent(value: number | undefined, digits = 2) {
  return value === undefined ? "读取中" : `${value.toFixed(digits)}%`;
}

function HomePage() {
  const [network, setNetwork] = useState<DataResult<NetworkSnapshot> | null>(null);
  const [price, setPrice] = useState<DataResult<MetricSeries> | null>(null);
  const [candleCache, setCandleCache] = useState<Partial<Record<Range, DataResult<CandleSeries>>>>({});
  const [metrics, setMetrics] = useState<Partial<Record<LiveMetricId, DataResult<MetricSeries>>>>({});
  const [range, setRange] = useState<Range>("7D");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    const sync = () => {
      void loadNetworkSnapshot().then((result) => { if (active) setNetwork(result); });
      void loadMetricSeries("price").then((result) => { if (active) setPrice(result); });
      void Promise.all(liveMetricIds.map(async (id) => [id, await loadMetricSeries(id)] as const))
        .then((entries) => { if (active) setMetrics(Object.fromEntries(entries)); });
      (["7D", "30D"] as Range[]).forEach((candleRange) => {
        void loadLighterCandles(candleRange).then((result) => {
          if (active) setCandleCache((cache) => ({ ...cache, [candleRange]: result }));
        });
      });
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);

  const snapshot = network?.data;
  const sourceKind = network?.sourceKind ?? "fallback";
  const lastPrice = price?.data.points.at(-1)?.value;
  const candles = candleCache[range] ?? null;
  const lastCandle = candles?.data.candles.at(-1);
  const metric = (id: LiveMetricId) => metrics[id];
  const latest = (id: LiveMetricId) => metric(id)?.data.points.at(-1)?.value;
  const metricKind = (id: LiveMetricId): SourceKind => metric(id)?.sourceKind ?? "fallback";
  const allInCost = latest("cost_allin");
  const txs = latest("txs");
  const onchainVolume = latest("onchain_volume");
  const fundedAddresses = latest("funded_addresses");
  const top10Share = latest("top10_share");
  const fdvVsBtc = latest("fdv_vs_btc");
  const prlBtc = latest("prl_btc");
  const inferenceCost = latest("marginal_cost");
  const crossover = latest("crossover");
  const fdv = lastPrice === undefined ? undefined : lastPrice * 2_100_000_000;
  const blockDetail = snapshot ? `${snapshot.avgBlockTimeSeconds.toFixed(0)}s · 目标 ${snapshot.targetBlockSeconds.toFixed(0)}s · ${formatBlockDeviation(snapshot.avgBlockTimeSeconds, snapshot.targetBlockSeconds)}` : "正在读取网络状态";

  return <main className="site-shell">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="数据导航"><a href="#overview">总览</a><a href="/chain">链上</a><a href="/valuation">数据</a></nav>
    </header>

    <section className="hero" id="overview">
      <div className="overview-dashboard">
        <article className="feature-panel overview-market-panel" data-testid="overview-market-panel">
          <div className="panel-kicker"><span>Lighter · PRL 永续</span><div className="chart-controls"><div className="range-tabs">{(["7D", "30D"] as Range[]).map((item) => <button className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{item}</button>)}</div><div className="zoom-controls" aria-label="图表缩放"><button type="button" aria-label="缩小图表" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value / 2))}>−</button><span>{zoom}×</span><button type="button" aria-label="放大图表" disabled={zoom >= 4} onClick={() => setZoom((value) => Math.min(4, value * 2))}>+</button></div></div></div>
          <div className="price-readout">{lastCandle === undefined ? "—" : formatUsd(lastCandle.close)}<span> / PRL</span></div>
          <CandlestickChart candles={candles?.data.candles ?? []} zoom={zoom} />
          <p className="fineprint">单一数据源：Lighter PRL 永续合约 · 1 小时 OHLC K 线 · 悬停查看时间与 OHLC · 右侧为 USD 价格坐标。</p>
        </article>
        <div className="hero-metrics">
          <MetricCard label="网络算力" value={snapshot ? formatHashrate(snapshot.hashrateHs) : "—"} detail="由当前难度与链上出块推导" kind={sourceKind} tone="blue" />
          <MetricCard label="网络难度" value={snapshot ? snapshot.difficulty.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : "—"} detail={snapshot ? `区块高度 ${snapshot.height.toLocaleString("zh-CN")}` : "等待网络快照"} kind={sourceKind} />
          <MetricCard label="平均出块" value={snapshot ? `${snapshot.avgBlockTimeSeconds.toFixed(0)}s` : "—"} detail={blockDetail} kind={sourceKind} />
          <MetricCard label="供应进度" value={snapshot ? `${snapshot.supplyPercent.toFixed(2)}%` : "—"} detail={snapshot ? `${(snapshot.supplyPrl / 1e6).toFixed(1)}M PRL 已发行` : "等待网络快照"} kind={sourceKind} />
          <MetricCard label="每日排放" value={snapshot ? `${(snapshot.emissionPrlDay / 1e6).toFixed(2)}M PRL` : "—"} detail="当前区块补贴推导" kind={sourceKind}/>
          <MetricCard label="全网全成本" value={allInCost === undefined ? "读取中" : formatUsd(allInCost)} detail="模型化网络混合成本 · 每 PRL" kind={metricKind("cost_allin")} />
        </div>
      </div>
    </section>

    <section className="section band-line" id="chain"><SectionHeader eyebrow="02 / CHAIN" title="链上实况" description="交易、转账与持仓已读取公开序列；进入子页可查看矿池、活跃度、TX Size 与 Holders 的完整数据。" />
      <div className="status-grid"><article><span>链上交易（24h）</span><strong>{formatCount(txs)}</strong><p><i className={`status-dot ${metricKind("txs")}`} />非 coinbase 交易笔数</p></article><article><span>链上转账额（24h）</span><strong>{onchainVolume === undefined ? "读取中" : `${(onchainVolume / 1e6).toFixed(2)}M PRL`}</strong><p><i className={`status-dot ${metricKind("onchain_volume")}`} />非 coinbase 输出总额</p></article><article><span>活跃持仓地址</span><strong>{formatCount(fundedAddresses)}</strong><p><i className={`status-dot ${metricKind("funded_addresses")}`} />余额超过 0.01 PRL 的地址</p></article><article><span>前十地址占比</span><strong>{formatMetricPercent(top10Share)}</strong><p><i className={`status-dot ${metricKind("top10_share")}`} />可验证的地址层集中度</p></article></div>
      <a className="chain-page-link" href="/chain">查看全部链上数据 <span>→</span></a>
    </section>

    <section className="section" id="valuation"><SectionHeader eyebrow="03 / DATA" title="PRL 数据" description="让价格回到供应、网络和对照口径之中，而不是只看一个报价。" />
      <div className="valuation-grid"><MetricCard label="PRL 市场参考价" value={lastPrice === undefined ? "读取中" : formatUsd(lastPrice)} detail="prlstats / CoinGecko 聚合参考" kind={price?.sourceKind ?? "fallback"} tone="rose"/><MetricCard label="FDV" value={fdv === undefined ? "读取中" : formatUsd(fdv)} detail="参考价 × 21 亿 PRL 最大供应量" kind={price?.sourceKind ?? "fallback"}/><MetricCard label="FDV / BTC" value={formatMetricPercent(fdvVsBtc, 3)} detail="Pearl 完全稀释估值占 Bitcoin 的比例" kind={metricKind("fdv_vs_btc")} /></div>
      <a className="chain-page-link" href="/valuation">查看全部数据汇总 <span>→</span></a>
    </section>

    <section className="section band-pearl" id="ai"><SectionHeader eyebrow="04 / AI CROSSOVER" title="AI 交叉" description="Pearl 的价值不只在出块，也在于计算如何与真实推理负载相遇。" />
      <div className="ai-layout"><article><p className="label-line">推理并行成本</p><h3>{inferenceCost === undefined ? "读取中" : `${formatUsd(inferenceCost)} / PRL`}</h3><p>一张正在承载推理负载的卡并行挖矿时，按被挤占的推理收入与新增电力计入的模型成本。此项是模型估算，非市场报价。</p><span className="tag"><i className={`status-dot ${metricKind("marginal_cost")}`} />prlstats 模型序列</span></article><article><p className="label-line">挖矿 / 推理收入交点</p><h3>{formatMetricPercent(crossover, 1)}</h3><p>每 GPU 小时挖矿收入相对于 H200 按需推理租赁价格的比例；越接近 100%，纯挖矿与出租算力的收入越接近。</p><span className="tag"><i className={`status-dot ${metricKind("crossover")}`} />公开模型序列 · PRL/BTC {prlBtc === undefined ? "读取中" : `${formatCount(prlBtc)} sats`}</span></article></div>
    </section>

  </main>;
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => startDataRefresh(), []);
  useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);
  return pathname === "/chain" ? <ChainPage /> : pathname === "/valuation" ? <ValuationPage /> : <HomePage />;
}

export default App;
