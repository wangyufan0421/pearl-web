import { useMemo, useState } from "react";
import { DataFreshness } from "./DataFreshness";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";
import { formatLocale, useLanguage } from "./i18n/Language";

export type HashrateRange = "30D" | "90D" | "ALL";
export type HashrateHistoryPoint = { timestamp: Date; value: number };

const DAY_MS = 86_400_000;
const WIDTH = 840;
const HEIGHT = 294;
const LEFT = 76;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 35;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export function prepareHashrateHistory(points: MetricPoint[], range: HashrateRange, now = Date.now()): HashrateHistoryPoint[] {
  const observed = points.filter(({ timestamp, value, projected }) => {
    const time = timestamp.getTime();
    return projected !== true && Number.isFinite(time) && time <= now && Number.isFinite(value) && value >= 0;
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const daily = new Map<string, HashrateHistoryPoint>();
  for (const { timestamp, value } of observed) daily.set(timestamp.toISOString().slice(0, 10), { timestamp, value });
  const rows = [...daily.values()];
  const lastTime = rows.at(-1)?.timestamp.getTime();
  if (lastTime === undefined || range === "ALL") return rows;
  const cutoff = lastTime - (range === "30D" ? 30 : 90) * DAY_MS;
  return rows.filter(row => row.timestamp.getTime() >= cutoff);
}

export function formatHashrateValue(value: number) {
  const units: Array<[number, string]> = [[1e18, "EH/s"], [1e15, "PH/s"], [1e12, "TH/s"], [1e9, "GH/s"], [1e6, "MH/s"], [1e3, "kH/s"]];
  const [divisor, unit] = units.find(([threshold]) => value >= threshold) ?? [1, "H/s"];
  return `${new Intl.NumberFormat(formatLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / divisor)} ${unit}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(formatLocale(), { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

function axisScale(rows: HashrateHistoryPoint[]) {
  const target = Math.max(...rows.map(row => row.value), 1) * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(target / 4));
  const step = [1, 2, 5, 10].map(multiplier => multiplier * magnitude).find(candidate => candidate >= target / 4) ?? 10 * magnitude;
  const count = Math.ceil(target / step);
  return { max: step * count, step, count };
}

export function HashrateHistoryChart({ result }: { result?: DataResult<MetricSeries> | null }) {
  const { t } = useLanguage();
  const [range, setRange] = useState<HashrateRange>("ALL");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const rows = useMemo(() => prepareHashrateHistory(result?.data.points ?? [], range), [result, range]);
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const start = rows[0].timestamp.getTime();
    const span = rows.at(-1)!.timestamp.getTime() - start || 1;
    const scale = axisScale(rows);
    const x = (index: number) => LEFT + (rows[index].timestamp.getTime() - start) / span * PLOT_WIDTH;
    const y = (value: number) => TOP + (1 - value / scale.max) * PLOT_HEIGHT;
    const line = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(row.value).toFixed(2)}`).join(" ");
    const dateTicks = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    return { x, y, line, dateTicks, scale };
  }, [rows]);
  const hovered = hoveredIndex === null ? null : rows[hoveredIndex];

  const selectAtPointer = (clientX: number, svg: SVGSVGElement) => {
    if (!chart) return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width) return;
    const logicalX = (clientX - bounds.left) / bounds.width * WIDTH;
    let nearest = 0;
    for (let index = 1; index < rows.length; index++) {
      if (Math.abs(chart.x(index) - logicalX) < Math.abs(chart.x(nearest) - logicalX)) nearest = index;
    }
    setHoveredIndex(nearest);
  };

  return <section className="hashrate-history-panel" aria-label={t("PEARL 全网算力历史")}>
    <div className="hashrate-history-heading">
      <div><p className="hashrate-history-eyebrow">PEARL / HASHRATE</p><h3>{t("PEARL 全网算力历史")}</h3><span>{t("prlstats · 社区节点估算")}</span></div>
      <div className="hashrate-range-tabs" aria-label={t("算力图表时间范围")}>{(["30D", "90D", "ALL"] as const).map(item => <button key={item} type="button" className={range === item ? "active" : ""} aria-pressed={range === item} onClick={() => { setRange(item); setHoveredIndex(null); }}>{t(item)}</button>)}</div>
    </div>
    {chart ? <div className="hashrate-history-plot">
      <div className="hashrate-history-scroll">
      <svg data-testid="hashrate-history-interaction" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("PEARL 全网算力历史图")} onPointerMove={event => selectAtPointer(event.clientX, event.currentTarget)} onPointerDown={event => selectAtPointer(event.clientX, event.currentTarget)} onPointerLeave={() => setHoveredIndex(null)}>
        <rect className="hashrate-history-frame" x={LEFT} y={TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
        <g className="hashrate-history-y-axis">{Array.from({ length: chart.scale.count + 1 }, (_, index) => {
          const value = chart.scale.max - index * chart.scale.step;
          const y = TOP + index * PLOT_HEIGHT / chart.scale.count;
          return <text key={index} x={LEFT - 12} y={y + 4} textAnchor="end">{formatHashrateValue(value)}</text>;
        })}</g>
        <path className="hashrate-history-line" d={chart.line} />
        <g className="hashrate-history-x-axis">{chart.dateTicks.map(index => <text key={index} x={chart.x(index)} y={HEIGHT - 7} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}>{formatDate(rows[index].timestamp)}</text>)}</g>
        {hovered && hoveredIndex !== null ? <g className="hashrate-history-crosshair"><line x1={chart.x(hoveredIndex)} x2={chart.x(hoveredIndex)} y1={TOP} y2={TOP + PLOT_HEIGHT} /><circle cx={chart.x(hoveredIndex)} cy={chart.y(hovered.value)} r="5" /></g> : null}
      </svg>
      </div>
      {hovered ? <div className="hashrate-history-tooltip" data-testid="hashrate-history-tooltip"><b>{formatDate(hovered.timestamp)}</b><span>{t("网络算力")}<strong>{formatHashrateValue(hovered.value)}</strong></span></div> : null}
    </div> : <div className="hashrate-history-empty">{t(result ? "暂无可用算力历史" : "正在读取算力历史")}</div>}
    <div className="hashrate-history-footer"><span>{t("每个 UTC 日保留最后一次观测；不是日均算力。")}</span><DataFreshness result={result} /></div>
    {result?.notice ? <p className="hashrate-history-notice">{t(result.notice)}</p> : null}
  </section>;
}
