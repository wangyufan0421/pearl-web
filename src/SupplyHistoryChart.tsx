import { useMemo, useState } from "react";
import { DataFreshness } from "./DataFreshness";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";
import { formatLocale, useLanguage } from "./i18n/Language";

export type SupplyRange = "30D" | "90D" | "ALL";
export type SupplyHistoryPoint = { timestamp: Date; issued: number };
export const SUPPLY_CAP = 2_100_000_000;
const DAY_MS = 86_400_000;
const WIDTH = 840;
const HEIGHT = 294;
const LEFT = 75;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 35;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export function prepareSupplyHistory(points: MetricPoint[], range: SupplyRange, now = Date.now()): SupplyHistoryPoint[] {
  const observed = points.filter(({ timestamp, value, projected }) => {
    const time = timestamp.getTime();
    return projected !== true && Number.isFinite(time) && time <= now && Number.isFinite(value) && value >= 0 && value <= SUPPLY_CAP;
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const daily = new Map<string, MetricPoint>();
  for (const point of observed) daily.set(point.timestamp.toISOString().slice(0, 10), point);
  const rows = [...daily.values()].map(({ timestamp, value }) => ({
    timestamp,
    issued: value,
  }));
  const lastTime = rows.at(-1)?.timestamp.getTime();
  if (lastTime === undefined || range === "ALL") return rows;
  const cutoff = lastTime - (range === "30D" ? 30 : 90) * DAY_MS;
  return rows.filter((row) => row.timestamp.getTime() >= cutoff);
}

function formatQuantity(value: number) {
  return `${new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value)} PEARL`;
}

function formatAxisQuantity(value: number) {
  return new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(formatLocale(), { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

function axisScale(rows: SupplyHistoryPoint[]) {
  const target = Math.max(...rows.map(row => row.issued), 1) * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(target / 4));
  const step = [1, 2, 5, 10].map(multiplier => multiplier * magnitude).find(candidate => candidate >= target / 4) ?? 10 * magnitude;
  const count = Math.ceil(target / step);
  return { max: step * count, step, count };
}

export function SupplyHistoryChart({ result }: { result?: DataResult<MetricSeries> }) {
  const { t } = useLanguage();
  const [range, setRange] = useState<SupplyRange>("ALL");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const rows = useMemo(() => prepareSupplyHistory(result?.data.points ?? [], range), [result, range]);
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const start = rows[0].timestamp.getTime();
    const span = rows[rows.length - 1].timestamp.getTime() - start || 1;
    const scale = axisScale(rows);
    const x = (index: number) => LEFT + (rows[index].timestamp.getTime() - start) / span * PLOT_WIDTH;
    const y = (issued: number) => TOP + (1 - issued / scale.max) * PLOT_HEIGHT;
    const boundary = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(row.issued).toFixed(2)}`).join(" ");
    const dateTicks = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    return { x, y, boundary, dateTicks, scale };
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

  return <section className="supply-history-panel" aria-label={t("PEARL 供应历史")}>
    <div className="supply-history-heading">
      <div><p className="supply-history-eyebrow">PEARL / SUPPLY</p><h3>{t("PEARL 供应历史")}</h3><span>{t("prlstats · 实际观测数据")}</span></div>
      <div className="valuation-range-tabs" aria-label={t("供应图表时间范围")}>{(["30D", "90D", "ALL"] as const).map((item) => <button key={item} type="button" className={range === item ? "active" : ""} aria-pressed={range === item} onClick={() => { setRange(item); setHoveredIndex(null); }}>{t(item)}</button>)}</div>
    </div>
    <div className="supply-history-legend"><span className="issued">{t("已发行 PEARL")}</span></div>
    {chart ? <div className="supply-history-plot">
      <svg data-testid="supply-history-interaction" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("PEARL 已发行历史图")} onPointerMove={(event) => selectAtPointer(event.clientX, event.currentTarget)} onPointerDown={(event) => selectAtPointer(event.clientX, event.currentTarget)} onPointerLeave={() => setHoveredIndex(null)}>
        <text className="supply-history-unit" x={LEFT - 12} y={TOP - 7} textAnchor="end">PEARL</text>
        <rect className="supply-history-frame" x={LEFT} y={TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
        <g className="supply-history-grid">{Array.from({ length: chart.scale.count + 1 }, (_, index) => {
          const value = chart.scale.max - index * chart.scale.step;
          const y = TOP + index * PLOT_HEIGHT / chart.scale.count;
          return <text key={index} x={LEFT - 12} y={y + 4} textAnchor="end">{formatAxisQuantity(value)}</text>;
        })}</g>
        <path className="supply-history-boundary" d={chart.boundary} />
        <g className="supply-history-axis">{chart.dateTicks.map((index) => <text key={index} x={chart.x(index)} y={HEIGHT - 7} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}>{formatDate(rows[index].timestamp)}</text>)}</g>
        {hovered && hoveredIndex !== null ? <g className="supply-history-crosshair"><line x1={chart.x(hoveredIndex)} x2={chart.x(hoveredIndex)} y1={TOP} y2={TOP + PLOT_HEIGHT} /><circle cx={chart.x(hoveredIndex)} cy={chart.y(hovered.issued)} r="5" /></g> : null}
      </svg>
      {hovered ? <div className="supply-history-tooltip" data-testid="supply-history-tooltip"><b>{formatDate(hovered.timestamp)}</b><span><i className="issued" />{t("已发行 PEARL")}<strong>{formatQuantity(hovered.issued)}</strong></span></div> : null}
    </div> : <div className="price-trend-empty">{t(result ? "暂无可用供应历史" : "正在读取供应历史")}</div>}
    <div className="supply-history-footer"><DataFreshness result={result} /></div>
    {result?.notice ? <p className="supply-history-notice">{t(result.notice)}</p> : null}
  </section>;
}
