import { useLanguage, formatLocale } from "./i18n/Language";
import { LanguageProvider, stripLanguage, localizedHref, languageFromPath } from "./i18n/Language";
import { SiteHeader } from "./SiteHeader";
import { useEffect, useMemo, useState } from "react";
import { type CandleSeries, type DataResult, type MetricSeries, type SourceKind } from "./data/prlstats";
import { loadLighterCandles, loadMetricSeries, loadNetworkSnapshot, startDataRefresh, subscribeToDataUpdates } from "./data/runtime";
import type { NetworkSnapshot } from "./data/schema";
import { formatBlockDeviation, formatHashrate, formatUsd } from "./lib/format";
import ChainPage from "./ChainPage";
import ValuationPage from "./ValuationPage";
import PearlVsBitcoinPage from "./PearlVsBitcoinPage";
import { OverviewMarketCapSection } from "./OverviewMarketCapSection";
import ArchiveHomePage from "./ArchiveHomePage";
import CoreMechanismPage from "./CoreMechanismPage";
import WhitepaperPage from "./WhitepaperPage";
import ArticlesPage from "./ArticlesPage";
import PeoplePage from "./PeoplePage";
import CommunityDiscussionPage from "./CommunityDiscussionPage";
import CommunityArticlePage from "./CommunityArticlePage";
import CommunityAdminPage from "./CommunityAdminPage";
import { DataFreshness } from "./DataFreshness";
import { DataStatusSummary, metricLabels } from "./DataStatusSummary";

type Range = "7D" | "30D";
const liveMetricIds = ["cost_allin", "txs", "onchain_volume", "funded_addresses", "top10_share", "fdv_vs_btc", "prl_btc", "marginal_cost", "crossover"] as const;
type LiveMetricId = typeof liveMetricIds[number];

function currentRoute() {
  const pathname = stripLanguage(window.location.pathname);
  if (pathname === "/archive" && window.location.hash === "#community-discussion") return "/archive/community-discussion";
  return pathname === "/" && window.location.hash === "#overview" ? "/overview" : pathname;
}

function MetricCard({ label, value, detail, kind = "live", tone = "ink" }: {
  label: string; value: string; detail: string; kind?: "live" | "fallback"; tone?: "ink" | "rose" | "blue";
}) {
  const { t, href: localizeHref, language } = useLanguage();
  return <article className={`metric-card tone-${tone}`}>
    <p className="metric-label">{t(label)}</p>
    <p className="metric-value">{t(value)}</p>
    <div className="metric-detail"><span className={`status-dot ${kind}`} />{t(detail)}</div>
  </article>;
}

export function CandlestickChart({ candles, zoom }: { candles: CandleSeries["candles"]; zoom: number }) {
  const { t, href: localizeHref, language } = useLanguage();
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

  if (!chart) return <div className="chart-interaction" data-testid="candlestick-interaction"><div className="chart-empty">{t("Lighter K 线正在同步中")}</div></div>;
  const hoveredCandle = hoverIndex === null ? null : visibleCandles[hoverIndex];
  const formatDate = (date: Date, withTime = false) => new Intl.DateTimeFormat(formatLocale(), withTime ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false } : { month: "numeric", day: "numeric" }).format(date);
  const pointerToIndex = (clientX: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * chart.width;
    return Math.max(0, Math.min(visibleCandles.length - 1, Math.floor(((svgX - chart.left) / chart.plotWidth) * visibleCandles.length)));
  };
  return <div className="chart-interaction" data-testid="candlestick-interaction">
    <svg className="candlestick-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={t("Lighter PEARL 永续 K 线图")} onMouseMove={(event) => setHoverIndex(pointerToIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onMouseLeave={() => setHoverIndex(null)}>
    <defs><clipPath id="candle-clip"><rect x={chart.left} y={chart.top} width={chart.plotWidth} height={chart.plotHeight} /></clipPath></defs>
    <g className="chart-grid">{chart.yTicks.map((value) => <g key={value}><line x1={chart.left} x2={chart.left + chart.plotWidth} y1={chart.priceY(value)} y2={chart.priceY(value)} /><text x={chart.left + chart.plotWidth + 11} y={chart.priceY(value) + 4}>${t(value.toFixed(2))}</text></g>)}</g>
    <g className="chart-axis">{chart.xTicks.map((index) => <text key={index} x={chart.x(index)} y={chart.height - 8} textAnchor="middle">{t(formatDate(visibleCandles[index].timestamp))}</text>)}</g>
    <g clipPath="url(#candle-clip)"><path className="candle-close-line" d={chart.closePath} />{visibleCandles.map((candle, index) => { const rising = candle.close >= candle.open; const openY = chart.priceY(candle.open); const closeY = chart.priceY(candle.close); return <g className={`candle ${rising ? "up" : "down"}`} key={candle.timestamp.getTime()} style={{ animationDelay: `${Math.min(index * 10, 620)}ms` }}><line className="candle-wick" x1={chart.x(index)} x2={chart.x(index)} y1={chart.priceY(candle.high)} y2={chart.priceY(candle.low)} /><rect x={chart.x(index) - chart.candleWidth / 2} y={Math.min(openY, closeY)} width={chart.candleWidth} height={Math.max(1.2, Math.abs(openY - closeY))} rx=".8" /></g>; })}{hoveredCandle && <g className="chart-crosshair"><line x1={chart.x(hoverIndex!)} x2={chart.x(hoverIndex!)} y1={chart.top} y2={chart.top + chart.plotHeight} /><circle cx={chart.x(hoverIndex!)} cy={chart.priceY(hoveredCandle.close)} r="3.2" /></g>}</g>
    </svg>
    {hoveredCandle && <div className="chart-tooltip" style={{ left: `${Math.max(8, Math.min(78, ((hoverIndex! + .5) / visibleCandles.length) * 100))}%` }}><b>{t(formatDate(hoveredCandle.timestamp, true))}</b><span>{t("开 ")}{t(formatUsd(hoveredCandle.open))}</span><span>{t("高 ")}{t(formatUsd(hoveredCandle.high))}</span><span>{t("低 ")}{t(formatUsd(hoveredCandle.low))}</span><span>{t("收 ")}{t(formatUsd(hoveredCandle.close))}</span></div>}
  </div>;
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <header className="section-header"><p className="eyebrow">{t(eyebrow)}</p><h2>{t(title)}</h2><p>{t(description)}</p></header>;
}

function formatCount(value: number | undefined, digits = 0) {
  return value === undefined ? "读取中" : new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: digits }).format(value);
}

function formatMetricPercent(value: number | undefined, digits = 2) {
  return value === undefined ? "读取中" : `${value.toFixed(digits)}%`;
}

function OverviewPage() {
  const { t, href: localizeHref, language } = useLanguage();
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
      liveMetricIds.forEach(id => { void loadMetricSeries(id).then(result => { if (active) setMetrics(previous => ({ ...previous, [id]: result })); }); });
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
    <SiteHeader />

    <section className="hero" id="overview">
      <DataStatusSummary items={[{ label: "网络概览", result: network }, { label: "PEARL 市场参考价", result: price }, ...liveMetricIds.map(id => ({ label: metricLabels[id], result: metrics[id] })), { label: "Lighter · PEARL 永续", result: candles }]} />
      <div className="overview-dashboard">
        <article className="feature-panel overview-market-panel" data-testid="overview-market-panel">
          <div className="panel-kicker"><span>{t("Lighter · PEARL 永续")}</span><div className="chart-controls"><div className="range-tabs">{(["7D", "30D"] as Range[]).map((item) => <button className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{t(item)}</button>)}</div><div className="zoom-controls" aria-label={t("图表缩放")}><button type="button" aria-label={t("缩小图表")} disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value / 2))}>−</button><span>{t(zoom)}×</span><button type="button" aria-label={t("放大图表")} disabled={zoom >= 4} onClick={() => setZoom((value) => Math.min(4, value * 2))}>+</button></div></div></div>
          <div className="price-readout">{t(lastCandle === undefined ? "—" : formatUsd(lastCandle.close))}<span> / PEARL</span></div>
          <CandlestickChart candles={candles?.data.candles ?? []} zoom={zoom} />
          <DataFreshness result={candles} />
          <p className="fineprint">{t("单一数据源：Lighter PEARL 永续合约 · 1 小时 OHLC K 线 · 悬停查看时间与 OHLC · 右侧为 USD 价格坐标。")}</p>
        </article>
        <div className="hero-metrics">
          <MetricCard label={t("网络算力")} value={t(snapshot ? formatHashrate(snapshot.hashrateHs) : "—")} detail={t("由当前难度与链上出块推导")} kind={sourceKind} tone="blue" />
          <MetricCard label={t("网络难度")} value={t(snapshot ? snapshot.difficulty.toLocaleString(formatLocale(), { maximumFractionDigits: 0 }) : "—")} detail={t(snapshot ? `区块高度 ${snapshot.height.toLocaleString(formatLocale())}` : "等待网络快照")} kind={sourceKind} />
          <MetricCard label={t("平均出块")} value={t(snapshot ? `${snapshot.avgBlockTimeSeconds.toFixed(0)}s` : "—")} detail={t(blockDetail)} kind={sourceKind} />
          <MetricCard label={t("供应进度")} value={t(snapshot ? `${snapshot.supplyPercent.toFixed(2)}%` : "—")} detail={t(snapshot ? `${(snapshot.supplyPrl / 1e6).toFixed(1)}M PEARL 已发行` : "等待网络快照")} kind={sourceKind} />
          <MetricCard label={t("每日排放")} value={t(snapshot ? `${(snapshot.emissionPrlDay / 1e6).toFixed(2)}M PEARL` : "—")} detail={t("当前区块补贴推导")} kind={sourceKind}/>
          <MetricCard label={t("全网全成本")} value={t(allInCost === undefined ? "读取中" : formatUsd(allInCost))} detail={t("模型化网络混合成本 · 每 PEARL")} kind={metricKind("cost_allin")} />
        </div>
      </div>
    </section>

    <OverviewMarketCapSection />

    <section className="section band-line" id="chain"><SectionHeader eyebrow="03 / CHAIN" title={t("链上实况")} description={t("交易、转账与持仓已读取公开序列；进入子页可查看矿池、活跃度、TX Size 与 Holders 的完整数据。")} />
      <div className="status-grid"><article><span>{t("链上交易（24h）")}</span><strong>{t(formatCount(txs))}</strong><p><i className={`status-dot ${metricKind("txs")}`} />{t("非 coinbase 交易笔数")}</p></article><article><span>{t("链上转账额（24h）")}</span><strong>{t(onchainVolume === undefined ? "读取中" : `${(onchainVolume / 1e6).toFixed(2)}M PEARL`)}</strong><p><i className={`status-dot ${metricKind("onchain_volume")}`} />{t("非 coinbase 输出总额")}</p></article><article><span>{t("活跃持仓地址")}</span><strong>{t(formatCount(fundedAddresses))}</strong><p><i className={`status-dot ${metricKind("funded_addresses")}`} />{t("余额超过 0.01 PEARL 的地址")}</p></article><article><span>{t("前十地址占比")}</span><strong>{t(formatMetricPercent(top10Share))}</strong><p><i className={`status-dot ${metricKind("top10_share")}`} />{t("可验证的地址层集中度")}</p></article></div>
      <a className="chain-page-link" href={localizeHref("/chain")}>{t("查看全部链上数据 ")}<span>→</span></a>
    </section>

    <section className="section" id="valuation"><SectionHeader eyebrow="04 / DATA" title={t("PEARL 数据")} description={t("让价格回到供应、网络和对照口径之中，而不是只看一个报价。")} />
      <div className="valuation-grid"><MetricCard label={t("PEARL 市场参考价")} value={t(lastPrice === undefined ? "读取中" : formatUsd(lastPrice))} detail={t("prlstats / CoinGecko 聚合参考")} kind={price?.sourceKind ?? "fallback"} tone="rose"/><MetricCard label={t("FDV")} value={t(fdv === undefined ? "读取中" : formatUsd(fdv))} detail={t("参考价 × 21 亿 PEARL 最大供应量")} kind={price?.sourceKind ?? "fallback"}/><MetricCard label={t("FDV / BTC")} value={t(formatMetricPercent(fdvVsBtc, 3))} detail={t("Pearl 完全稀释估值占 Bitcoin 的比例")} kind={metricKind("fdv_vs_btc")} /></div>
      <a className="chain-page-link" href={localizeHref("/valuation")}>{t("查看全部数据汇总 ")}<span>→</span></a>
    </section>

    <section className="section band-pearl" id="ai"><SectionHeader eyebrow="05 / AI CROSSOVER" title={t("AI 交叉")} description={t("Pearl 的价值不只在出块，也在于计算如何与真实推理负载相遇。")} />
      <div className="ai-layout"><article><p className="label-line">{t("推理并行成本")}</p><h3>{t(inferenceCost === undefined ? "读取中" : `${formatUsd(inferenceCost)} / PEARL`)}</h3><p>{t("一张正在承载推理负载的卡并行挖矿时，按被挤占的推理收入与新增电力计入的模型成本。此项是模型估算，非市场报价。")}</p><span className="tag"><i className={`status-dot ${metricKind("marginal_cost")}`} />{t("prlstats 模型序列")}</span></article><article><p className="label-line">{t("挖矿 / 推理收入交点")}</p><h3>{t(formatMetricPercent(crossover, 1))}</h3><p>{t("每 GPU 小时挖矿收入相对于 H200 按需推理租赁价格的比例；越接近 100%，纯挖矿与出租算力的收入越接近。")}</p><span className="tag"><i className={`status-dot ${metricKind("crossover")}`} />{t("公开模型序列 · PEARL/BTC ")}{t(prlBtc === undefined ? "读取中" : `${formatCount(prlBtc)} sats`)}</span></article></div>
    </section>

  </main>;
}

function AppContent() {
  const { t, href: localizeHref, language } = useLanguage();
  const [pathname, setPathname] = useState(currentRoute);
  useEffect(() => startDataRefresh(), []);
  useEffect(() => {
    const syncPathname = () => {
      if (stripLanguage(window.location.pathname) === "/archive" && window.location.hash === "#community-discussion") {
        window.history.replaceState(window.history.state, "", localizedHref("/archive/community-discussion", languageFromPath(window.location.pathname)) + window.location.search);
      }
      setPathname(currentRoute());
    };
    syncPathname();
    window.addEventListener("popstate", syncPathname);
    window.addEventListener("hashchange", syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
      window.removeEventListener("hashchange", syncPathname);
    };
  }, []);
  if (pathname === "/overview") return <OverviewPage />;
  if (pathname === "/pearl-vs-bitcoin") return <PearlVsBitcoinPage />;
  if (pathname === "/chain") return <ChainPage />;
  if (pathname === "/valuation") return <ValuationPage />;
  if (pathname === "/admin/community-discussions" || pathname.startsWith("/admin/community-discussions/")) return <CommunityAdminPage route={pathname} />;
  if (pathname === "/archive/core-mechanism") return <CoreMechanismPage />;
  if (pathname === "/archive/whitepaper") return <WhitepaperPage />;
  if (pathname === "/archive/articles") return <ArticlesPage />;
  if (pathname === "/archive/people") return <PeoplePage />;
  if (pathname === "/archive/community-discussion" || pathname === "/archive/community-discussion/") return <CommunityDiscussionPage />;
  if (pathname.startsWith("/archive/community-discussion/")) {
    const slug = pathname.slice("/archive/community-discussion/".length).replace(/\/$/, "");
    return <CommunityArticlePage slug={slug} key={slug} />;
  }
  return <ArchiveHomePage />;
}

export default function App() {
  return <LanguageProvider><AppContent /></LanguageProvider>;
}
