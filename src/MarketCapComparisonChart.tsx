import { useMemo, useState, type CSSProperties } from "react";
import { formatLocale, useLanguage } from "./i18n/Language";
import type { MetricPoint } from "./data/prlstats";

export const marketCapAssets = ["pearl", "btc", "bch", "fil", "zec", "tao"] as const;
export type MarketCapAsset = (typeof marketCapAssets)[number];
export type MarketCapSeries = Partial<Record<MarketCapAsset, MetricPoint[]>>;
const colors: Record<MarketCapAsset, string> = { pearl: "#b65b7d", btc: "#26343d", bch: "#4b8d6c", fil: "#537fbb", zec: "#bb8835", tao: "#70629a" };
const day = 86_400_000;
const name = (asset: MarketCapAsset) => asset === "pearl" ? "PEARL" : asset.toUpperCase();
const money = (value: number) => `$${new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
const date = (value: number) => new Intl.DateTimeFormat(formatLocale(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(value);

function latestAt(points: MetricPoint[], time: number): MetricPoint | undefined {
  let low = 0, high = points.length;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (points[mid].timestamp.getTime() <= time) low = mid + 1; else high = mid; }
  const point = points[low - 1];
  return point && time - point.timestamp.getTime() <= 2 * day ? point : undefined;
}

function pathPoints(points: MetricPoint[], first: number, last: number, columns: number) {
  const buckets = new Map<number, MetricPoint[]>();
  for (const point of points) {
    const column = Math.min(columns - 1, Math.floor((point.timestamp.getTime() - first) / Math.max(1, last - first) * columns));
    const bucket = buckets.get(column) ?? [];
    bucket.push(point); buckets.set(column, bucket);
  }
  return [...buckets.values()].flatMap(bucket => {
    const low = bucket.reduce((a, b) => a.value < b.value ? a : b);
    const high = bucket.reduce((a, b) => a.value > b.value ? a : b);
    return [...new Set([bucket[0], low, high, bucket[bucket.length - 1]])].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  });
}

export function MarketCapComparisonChart({ series }: { series: MarketCapSeries }) {
  const { language } = useLanguage();
  const [selectedPeers, setSelectedPeers] = useState<MarketCapAsset[]>(["btc"]);
  const [focusFraction, setFocusFraction] = useState<number | null>(null);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const activeAssets = marketCapAssets.filter(asset => asset === "pearl" || selectedPeers.includes(asset));
  const togglePeer = (asset: MarketCapAsset) => setSelectedPeers(peers => peers.includes(asset) ? peers.filter(peer => peer !== asset) : [...peers, asset]);
  const plot = useMemo(() => {
    const available = activeAssets.flatMap(asset => series[asset] ?? []).filter(point => point.value > 0 && !point.projected);
    if (!available.length) return null;
    const visible = Object.fromEntries(marketCapAssets.map(asset => [asset, (series[asset] ?? []).filter(point => point.value > 0 && !point.projected)])) as Record<MarketCapAsset, MetricPoint[]>;
    const values = activeAssets.flatMap(asset => visible[asset]).map(point => point.value);
    if (!values.length) return null;
    const floor = Math.floor(Math.log10(Math.min(...values)));
    const ceiling = Math.ceil(Math.log10(Math.max(...values)));
    const low = Math.max(0, floor - (floor === ceiling ? 1 : 0));
    const high = Math.max(low + 1, ceiling);
    const width = 1000, height = 390, left = 77, right = 22, top = 22, bottom = 41;
    const areaWidth = width - left - right, areaHeight = height - top - bottom;
    const bounds = Object.fromEntries(marketCapAssets.map(asset => {
      const points = visible[asset];
      return [asset, points.length ? { first: points[0].timestamp.getTime(), last: points[points.length - 1].timestamp.getTime() } : null];
    })) as Record<MarketCapAsset, { first: number; last: number } | null>;
    const x = (asset: MarketCapAsset, time: number) => {
      const span = bounds[asset];
      return left + (span ? (time - span.first) / Math.max(1, span.last - span.first) : 0) * areaWidth;
    };
    const timeAtFraction = (asset: MarketCapAsset, fraction: number) => {
      const span = bounds[asset];
      return span ? span.first + fraction * (span.last - span.first) : null;
    };
    const y = (value: number) => top + (high - Math.log10(value)) / (high - low) * areaHeight;
    return { width, height, left, right, top, bottom, areaWidth, areaHeight, low, high, x, timeAtFraction, y, visible, bounds };
  }, [series, selectedPeers]);
  const selected = focusFraction === null ? null : Math.max(0, Math.min(1, focusFraction));
  const move = (clientX: number, svg: SVGSVGElement) => {
    if (!plot) return;
    const rect = svg.getBoundingClientRect(); if (!rect.width) return;
    const svgX = (clientX - rect.left) / rect.width * plot.width;
    const fraction = Math.max(0, Math.min(1, (svgX - plot.left) / plot.areaWidth));
    setFocusFraction(fraction);
  };
  const observationAt = (asset: MarketCapAsset) => {
    if (!plot || selected === null) return null;
    const time = plot.timeAtFraction(asset, selected);
    return time === null ? null : latestAt(plot.visible[asset], time) ?? null;
  };
  return <div className="market-cap-chart">
    <div className="market-cap-toolbar"><span>{language === "zh" ? "各币种独立时间轴 · 首条可用数据 → 最新数据 · 美元 · 对数刻度" : "Independent timelines · first available observation → latest · USD · logarithmic scale"}</span></div>
    <div className="market-cap-legend" aria-label={language === "zh" ? "点击币种卡片切换市值曲线" : "Select market-cap lines"}>{marketCapAssets.map(asset => {
      const observations = (series[asset] ?? []).filter(point => point.value > 0 && !point.projected);
      const current = observations[observations.length - 1];
      const peak = observations.reduce<MetricPoint | undefined>((best, point) => !best || point.value > best.value ? point : best, undefined);
      const content = <><span className="market-cap-legend-name"><i />{name(asset)}</span><strong>{current ? money(current.value) : "—"}</strong><small>{asset === "tao" ? (language === "zh" ? "近一年高点" : "1Y peak") : (language === "zh" ? "观测高点" : "Observed peak")} {peak ? money(peak.value) : "—"}</small></>;
      const className = `market-cap-legend-item ${activeAssets.includes(asset) ? "is-selected" : "is-unselected"}`;
      const style = { "--asset-color": colors[asset] } as CSSProperties;
      return asset === "pearl"
        ? <div key={asset} className={className} style={style}>{content}</div>
        : <button key={asset} type="button" className={className} style={style} aria-pressed={activeAssets.includes(asset)} onClick={() => togglePeer(asset)}>{content}</button>;
    })}</div>
    {plot ? <div className="market-cap-plot"><svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" tabIndex={0} aria-label={language === "zh" ? "PEARL 与 BTC、BCH、FIL、ZEC、TAO 市值对比历史图" : "PEARL, BTC, BCH, FIL, ZEC and TAO market cap comparison chart"} onPointerMove={event => move(event.clientX, event.currentTarget)} onPointerDown={event => move(event.clientX, event.currentTarget)} onPointerLeave={event => { if (event.pointerType !== "touch") setFocusFraction(null); }} onFocus={() => { setKeyboardFocused(true); setFocusFraction(fraction => fraction ?? 1); }} onBlur={() => { setKeyboardFocused(false); setFocusFraction(null); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setFocusFraction(fraction => Math.max(0, Math.min(1, (fraction ?? 1) + (event.key === "ArrowRight" ? 1 : -1) / 30))); } }}>
      {Array.from({ length: plot.high - plot.low + 1 }, (_, index) => plot.low + index).map(power => <g className="market-cap-grid" key={power}><line x1={plot.left} x2={plot.left + plot.areaWidth} y1={plot.y(10 ** power)} y2={plot.y(10 ** power)} /><text x={plot.left - 10} y={plot.y(10 ** power) + 4} textAnchor="end">{money(10 ** power)}</text></g>)}
      <rect className="market-cap-frame" x={plot.left} y={plot.top} width={plot.areaWidth} height={plot.areaHeight} />
      {activeAssets.map(asset => { const span = plot.bounds[asset]; const points = span ? pathPoints(plot.visible[asset], span.first, span.last, Math.ceil(plot.areaWidth)) : []; return points.length > 1 ? <path key={asset} data-asset={asset} d={points.map((point, index) => `${index ? "L" : "M"}${plot.x(asset, point.timestamp.getTime()).toFixed(2)},${plot.y(point.value).toFixed(2)}`).join(" ")} fill="none" stroke={colors[asset]} strokeWidth={asset === "pearl" ? 3 : 2.3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null; })}
      {selected !== null ? <g className="market-cap-focus"><line x1={plot.left + selected * plot.areaWidth} x2={plot.left + selected * plot.areaWidth} y1={plot.top} y2={plot.top + plot.areaHeight} />{activeAssets.map(asset => { const point = observationAt(asset); return point ? <circle key={asset} cx={plot.left + selected * plot.areaWidth} cy={plot.y(point.value)} r="5" fill={colors[asset]} stroke="#fffefa" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null; })}</g> : null}
    </svg><span className="comparison-sr-only" role="status" aria-live="polite">{keyboardFocused && selected !== null ? activeAssets.map(asset => { const point = observationAt(asset); return `${name(asset)} ${point ? `${date(point.timestamp.getTime())}: ${money(point.value)}` : "—"}`; }).join(", ") : ""}</span>{selected !== null ? <div className="market-cap-tooltip" data-testid="market-cap-tooltip"><b>{language === "zh" ? `各自历史进程 ${Math.round(selected * 100)}%` : `Individual history ${Math.round(selected * 100)}%`}</b>{activeAssets.map(asset => { const point = observationAt(asset); return <span key={asset} style={{ "--asset-color": colors[asset] } as CSSProperties}><i />{name(asset)}<time>{point ? date(point.timestamp.getTime()) : "—"}</time><strong>{point ? money(point.value) : "—"}</strong></span>; })}</div> : null}</div> : <div className="comparison-chart-empty">{language === "zh" ? "等待已保存的历史市值数据" : "Waiting for saved market-cap history"}</div>}
  </div>;
}
