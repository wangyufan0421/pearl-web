import { useLanguage, formatLocale } from "./i18n/Language";
import { SiteHeader } from "./SiteHeader";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DataFreshness } from "./DataFreshness";
import { DataStatusSummary, metricLabels } from "./DataStatusSummary";
import { type DataResult, type MetricPoint, type MetricSeries, type SourceKind } from "./data/prlstats";
import { loadMetricSeries, loadNetworkSnapshot, subscribeToDataUpdates } from "./data/runtime";
import type { NetworkSnapshot } from "./data/schema";
import { formatUsd } from "./lib/format";
import { SUPPLY_CAP, SupplyHistoryChart } from "./SupplyHistoryChart";

const metricIds = ["price", "prl_btc", "volume", "cost_allin", "supply", "mcap_vs_btc", "fdv_vs_btc", "inflation", "miner_revenue"] as const;
type MetricId = typeof metricIds[number];
type PriceRange = "30D" | "90D" | "ALL";
type ChartMetricId = Extract<MetricId, "price" | "prl_btc" | "mcap_vs_btc" | "fdv_vs_btc" | "volume" | "cost_allin">;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(formatLocale(), { month: "numeric", day: "numeric", year: "numeric" }).format(date);
}

function formatCompact(value: number, digits = 2) {
  return new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: digits }).format(value);
}

function formatPrl(value: number) { return `${formatCompact(value)} PEARL`; }
function formatPercent(value: number, digits = 3) { return `${value.toFixed(digits)}%`; }
function formatSats(value: number) { return `${new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: 0 }).format(value)} sats`; }

export function chartLatestValue(points: MetricPoint[], formatter: (value: number) => string) {
  const value = points.at(-1)?.value;
  return value === undefined ? "—" : formatter(value);
}

const chartOptions: { id: ChartMetricId; label: string; source: string; formatter: (value: number) => string }[] = [
  { id: "prl_btc", label: "PEARL priced in Bitcoin", source: "PEARL / BTC · prlstats 历史序列", formatter: formatSats },
  { id: "mcap_vs_btc", label: "Pearl market cap vs Bitcoin", source: "流通市值 / BTC · prlstats 历史序列", formatter: formatPercent },
  { id: "fdv_vs_btc", label: "Pearl FDV vs Bitcoin", source: "FDV / BTC · prlstats 历史序列", formatter: formatPercent },
  { id: "volume", label: "24h volume", source: "24 小时成交量 · prlstats 历史序列", formatter: formatUsd },
  { id: "cost_allin", label: "PEARL挖矿成本", source: "全成本 / PEARL · prlstats 历史序列", formatter: formatUsd },
];

function latest(result: DataResult<MetricSeries> | undefined) { return result?.data.points.at(-1)?.value; }
export function latestObservedSupply(result: DataResult<MetricSeries> | undefined, now = Date.now()) {
  let latestPoint: MetricPoint | undefined;
  for (const point of result?.data.points ?? []) {
    const time = point.timestamp.getTime();
    if (point.projected === true || !Number.isFinite(time) || time > now || !Number.isFinite(point.value) || point.value < 0 || point.value > SUPPLY_CAP) continue;
    if (!latestPoint || time > latestPoint.timestamp.getTime()) latestPoint = point;
  }
  return latestPoint?.value;
}
export function supplyProgress(observedSupply: number | undefined, networkSupply: number | undefined) {
  const issued = observedSupply ?? networkSupply;
  return issued === undefined ? undefined : { issued, percent: issued / SUPPLY_CAP * 100 };
}
function valueOrState(result: DataResult<MetricSeries> | undefined, formatter: (value: number) => string) {
  const value = latest(result);
  return result === undefined ? "读取中" : value === undefined ? "暂未提供" : formatter(value);
}
function sourceKind(result: DataResult<MetricSeries> | undefined): SourceKind { return result?.sourceKind ?? "fallback"; }

function DataCard({ label, value, detail, kind = "live", tone = "ink" }: { label: string; value: string; detail: string; kind?: SourceKind; tone?: "ink" | "rose" | "blue" | "yellow" }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <article className={`valuation-card tone-${tone}`}>
    <p>{t(label)}</p><strong>{t(value)}</strong><span><i className={`status-dot ${kind}`} />{t(detail)}</span>
  </article>;
}

function ModuleHeader({ eyebrow, title, source }: { eyebrow: string; title: ReactNode; source: string }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <header className="valuation-module-header"><p>{t(eyebrow)}</p><h2>{t(title)}</h2><span>{t(source)}</span></header>;
}

export function PriceTrend({ points, range = "90D", label, formatter }: { points: MetricPoint[]; range?: PriceRange; label: string; formatter: (value: number) => string }) {
  const { t, href: localizeHref, language } = useLanguage();
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
  const selectPointAtPointer = (clientX: number, element: SVGSVGElement) => {
    const bounds = element.getBoundingClientRect();
    if (!chart || !bounds.width) return;
    const logicalX = (clientX - bounds.left) / bounds.width * chart.width;
    const index = Math.round((logicalX - chart.left) / chart.plotWidth * visible.length - .5);
    const nextIndex = Math.max(0, Math.min(visible.length - 1, index));
    setHoveredIndex((current) => current === nextIndex ? current : nextIndex);
  };

  if (!chart) return <div className="price-trend-empty">{t("图表序列正在同步中")}</div>;
  return <div className="price-trend" onMouseLeave={() => setHoveredIndex(null)}>
    <svg data-testid="price-trend-interaction" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={t(`${label} 历史走势`)} onMouseMove={(event) => selectPointAtPointer(event.clientX, event.currentTarget)}>
      <defs><linearGradient id="price-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="rgba(168,63,98,.20)" /><stop offset="1" stopColor="rgba(168,63,98,0)" /></linearGradient></defs>
      <g className="price-trend-grid">{chart.ticks.map((value) => <g key={value}><line x1={chart.left} x2={chart.left + chart.plotWidth} y1={chart.y(value)} y2={chart.y(value)} /><text x={chart.left + chart.plotWidth + 10} y={chart.y(value) + 4}>{t(formatter(value))}</text></g>)}</g>
      <path className="price-trend-area" d={`${chart.path} L${chart.x(visible.length - 1)} ${chart.top + chart.plotHeight} L${chart.x(0)} ${chart.top + chart.plotHeight} Z`} />
      <path className="price-trend-line" d={chart.path} />
      <g className="price-trend-axis">{chart.xTicks.map((index) => <text key={index} x={chart.x(index)} y={chart.height - 8} textAnchor="middle">{t(formatDate(visible[index].timestamp))}</text>)}</g>
      {hovered && hoveredIndex !== null ? <g className="price-trend-crosshair"><line x1={chart.x(hoveredIndex)} x2={chart.x(hoveredIndex)} y1={chart.top} y2={chart.top + chart.plotHeight} /><circle cx={chart.x(hoveredIndex)} cy={chart.y(hovered.value)} r="3.5" /></g> : null}
    </svg>
    {hovered ? <div className="price-trend-tooltip" data-testid="price-trend-tooltip"><b>{t(formatDate(hovered.timestamp))}</b><span>{t(formatter(hovered.value))}</span></div> : null}
  </div>;
}

export default function ValuationPage() {
  const { t, href: localizeHref, language } = useLanguage();
  const [metrics, setMetrics] = useState<Partial<Record<MetricId, DataResult<MetricSeries>>>>({});
  const [network, setNetwork] = useState<DataResult<NetworkSnapshot> | null>(null);
  const [range, setRange] = useState<PriceRange>("90D");
  const [selectedChartMetric, setSelectedChartMetric] = useState<ChartMetricId>("prl_btc");

  useEffect(() => {
    let active = true;
    const sync = () => {
      metricIds.forEach(id => { void loadMetricSeries(id).then(result => { if (active) setMetrics(previous => ({ ...previous, [id]: result })); }); });
      void loadNetworkSnapshot().then((result) => { if (active) setNetwork(result); });
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);

  const metric = (id: MetricId) => metrics[id];
  const selectedChartOption = chartOptions.find((option) => option.id === selectedChartMetric) ?? chartOptions[0];
  const selectedChartPoints = metric(selectedChartMetric)?.data.points ?? [];
  const price = latest(metric("price")); const supply = latestObservedSupply(metric("supply"));
  const marketCap = price === undefined || supply === undefined ? undefined : price * supply;
  const fdv = price === undefined ? undefined : price * SUPPLY_CAP;
  const marketCapState = metric("price") === undefined || metric("supply") === undefined ? "读取中" : marketCap === undefined ? "暂未提供" : formatUsd(marketCap);
  const fdvState = metric("price") === undefined ? "读取中" : fdv === undefined ? "暂未提供" : formatUsd(fdv);
  const issuanceValue = network === null || price === undefined ? undefined : network.data.emissionPrlDay * price;
  const supplyCardValue = metric("supply") === undefined ? "读取中" : supply === undefined ? "暂未提供" : formatPrl(supply);
  const progress = supplyProgress(supply, network?.data.supplyPrl);
  const progressKind = supply === undefined ? network?.sourceKind ?? "fallback" : sourceKind(metric("supply"));

  return <main className="site-shell valuation-page">
    <SiteHeader />
    <div className="valuation-wrap">
      <DataStatusSummary items={[{ label: "网络概览", result: network }, ...metricIds.map(id => ({ label: metricLabels[id], result: metrics[id] }))]} />
      <header className="valuation-intro"><p>PEARL / DATA</p><h1>{t("PEARL 数据汇总")}</h1><span>{t("价格、供应、流动性与相对尺度，共同构成完整的数据语境。")}</span></header>

      <section className="valuation-module">
        <ModuleHeader eyebrow="01 / CHART" title={t("PEARL 数据图表")} source={t(selectedChartOption.source)} />
        <div className="valuation-price-panel">
          <div className="valuation-toolbar"><span>{t(selectedChartOption.label)}<b data-testid="chart-latest-value">{t(chartLatestValue(selectedChartPoints, selectedChartOption.formatter))}</b></span><div className="price-chart-controls"><label className="chart-metric-select"><span>{t("图表指标")}</span><select aria-label={t("图表指标")} value={t(selectedChartMetric)} onChange={(event) => setSelectedChartMetric(event.target.value as ChartMetricId)}>{chartOptions.map((option) => <option key={option.id} value={t(option.id)}>{t(option.label)}</option>)}</select></label><div className="valuation-range-tabs">{(["30D", "90D", "ALL"] as PriceRange[]).map((item) => <button type="button" className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{t(item)}</button>)}</div></div></div>
          <PriceTrend points={selectedChartPoints} range={range} label={t(selectedChartOption.label)} formatter={selectedChartOption.formatter} />
          <DataFreshness result={metric(selectedChartMetric)} />
          <p>{t("选择不同指标即可切换历史序列。图表为单值时间序列，并非 OHLC K 线。")}</p>
        </div>
        <div className="valuation-card-grid price-cards"><DataCard label={t("PEARL 参考价")} value={t(valueOrState(metric("price"), formatUsd))} detail={t("公开价格序列 · USD / PEARL")} kind={sourceKind(metric("price"))} tone="rose" /><DataCard label={t("PEARL / BTC")} value={t(valueOrState(metric("prl_btc"), formatSats))} detail={t("一枚 PEARL 折算的 BTC 价值")} kind={sourceKind(metric("prl_btc"))} /><DataCard label={t("24h 成交量")} value={t(valueOrState(metric("volume"), formatUsd))} detail={t("公开汇总成交量 · USD")} kind={sourceKind(metric("volume"))} /></div>
      </section>

      <section className="valuation-module">
        <ModuleHeader eyebrow="02 / VALUATION" title={t("估值")} source={t("供应量与 BTC 相对尺度")} />
        <div className="valuation-card-grid valuation-cards"><DataCard label={t("流通市值")} value={t(marketCapState)} detail={t("PEARL 参考价 × 流通供应量")} kind={sourceKind(metric("price"))} tone="blue" /><DataCard label={t("FDV")} value={t(fdvState)} detail={t("PEARL 参考价 × 21 亿 PEARL 最大供应量")} kind={sourceKind(metric("price"))} /><DataCard label={t("流通市值 / BTC")} value={t(valueOrState(metric("mcap_vs_btc"), (value) => formatPercent(value)))} detail={t("Pearl 流通市值占 Bitcoin 市值")} kind={sourceKind(metric("mcap_vs_btc"))} /><DataCard label={t("FDV / BTC")} value={t(valueOrState(metric("fdv_vs_btc"), (value) => formatPercent(value)))} detail={t("Pearl FDV 占 Bitcoin FDV")} kind={sourceKind(metric("fdv_vs_btc"))} /></div>
        <aside className="valuation-formula"><b>{t("口径说明")}</b><span>{t("流通市值采用价格序列的最新点 × 流通供应序列的最新点；FDV 使用同一价格 × 2,100,000,000 PEARL。两项 BTC 比例直接读取 prlstats 序列。")}</span></aside>
      </section>

      <section className="valuation-module">
        <ModuleHeader eyebrow="03 / SUPPLY" title={t("供给")} source={t("发行节奏与公开供应序列")} />
        <div className="valuation-card-grid supply-cards"><DataCard label={t("流通供应量")} value={t(supplyCardValue)} detail={t("prlstats 流通供应序列")} kind={sourceKind(metric("supply"))} /><DataCard label={t("供应进度")} value={t(progress === undefined ? "读取中" : `${progress.percent.toFixed(2)}%`)} detail={t(progress === undefined ? "公开链上快照" : `${formatPrl(progress.issued)} 已发行`)} kind={progressKind} /><DataCard label={t("年化通胀率")} value={t(valueOrState(metric("inflation"), (value) => formatPercent(value, 2)))} detail={t("按当前发行节奏年化")} kind={sourceKind(metric("inflation"))} /><DataCard label={t("每日排放")} value={t(network === null ? "读取中" : formatPrl(network.data.emissionPrlDay))} detail={t("公开网络快照")} kind={network?.sourceKind ?? "fallback"} /><DataCard label={t("每日发行价值")} value={t(issuanceValue === undefined ? network === null || metric("price") === undefined ? "读取中" : "暂未提供" : formatUsd(issuanceValue))} detail={t("参考价 × 当前日排放")} kind={sourceKind(metric("price"))} tone="yellow" /><DataCard label={t("矿工收入 / 日")} value={t(valueOrState(metric("miner_revenue"), formatUsd))} detail={t("prlstats 矿工收入序列")} kind={sourceKind(metric("miner_revenue"))} /></div>
        <SupplyHistoryChart result={metric("supply")} />
      </section>
    </div>
  </main>;
}
