import { useMemo, useState } from "react";
import { DataFreshness } from "./DataFreshness";
import type { DataResult, MetricPoint, MetricSeries } from "./data/prlstats";
import { formatLocale, useLanguage } from "./i18n/Language";

export type SupplyRange = "30D" | "90D" | "ALL";
export type SupplyHistoryPoint = { timestamp: Date; issued: number; remaining: number };
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
    remaining: SUPPLY_CAP - value,
  }));
  const lastTime = rows.at(-1)?.timestamp.getTime();
  if (lastTime === undefined || range === "ALL") return rows;
  const cutoff = lastTime - (range === "30D" ? 30 : 90) * DAY_MS;
  return rows.filter((row) => row.timestamp.getTime() >= cutoff);
}

function formatQuantity(value: number) {
  return `${new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: 0 }).format(value)} PRL`;
}

function formatAxisQuantity(value: number) {
  return new Intl.NumberFormat(formatLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(formatLocale(), { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

export function SupplyHistoryChart({ result }: { result?: DataResult<MetricSeries> }) {
  const { t } = useLanguage();
  const [range, setRange] = useState<SupplyRange>("90D");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const rows = useMemo(() => prepareSupplyHistory(result?.data.points ?? [], range), [result, range]);
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const start = rows[0].timestamp.getTime();
    const span = rows[rows.length - 1].timestamp.getTime() - start || 1;
    const x = (index: number) => LEFT + (rows[index].timestamp.getTime() - start) / span * PLOT_WIDTH;
    const y = (issued: number) => TOP + (1 - issued / SUPPLY_CAP) * PLOT_HEIGHT;
    const boundary = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(row.issued).toFixed(2)}`).join(" ");
    const issuedArea = `${boundary} L${x(rows.length - 1).toFixed(2)} ${TOP + PLOT_HEIGHT} L${x(0).toFixed(2)} ${TOP + PLOT_HEIGHT} Z`;
    const unissuedArea = `M${x(0).toFixed(2)} ${TOP} L${x(rows.length - 1).toFixed(2)} ${TOP} ${rows.map((_, reverseIndex) => {
      const index = rows.length - 1 - reverseIndex;
      return `L${x(index).toFixed(2)} ${y(rows[index].issued).toFixed(2)}`;
    }).join(" ")} Z`;
    const dateTicks = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    return { x, y, boundary, issuedArea, unissuedArea, dateTicks };
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

  return <section className="supply-history-panel" aria-label={t("PRL 供应历史")}>
    <div className="supply-history-heading">
      <div><p className="supply-history-eyebrow">PRL / SUPPLY</p><h3>{t("PRL 供应历史")}</h3><span>{t("prlstats · 实际观测数据")}</span></div>
      <div className="valuation-range-tabs" aria-label={t("供应图表时间范围")}>{(["30D", "90D", "ALL"] as const).map((item) => <button key={item} type="button" className={range === item ? "active" : ""} aria-pressed={range === item} onClick={() => { setRange(item); setHoveredIndex(null); }}>{t(item)}</button>)}</div>
    </div>
    <div className="supply-history-legend"><span className="issued">{t("已发行 PRL")}</span><span className="unissued">{t("尚未发行 PRL")}</span></div>
    {chart ? <div className="supply-history-plot">
      <svg data-testid="supply-history-interaction" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("PRL 已发行与尚未发行历史图")} onPointerMove={(event) => selectAtPointer(event.clientX, event.currentTarget)} onPointerDown={(event) => selectAtPointer(event.clientX, event.currentTarget)} onPointerLeave={() => setHoveredIndex(null)}>
        <text className="supply-history-unit" x={LEFT - 12} y={TOP - 7} textAnchor="end">PRL</text>
        <g className="supply-history-grid">{[0, 1, 2, 3].map((index) => {
          const value = SUPPLY_CAP * (3 - index) / 3;
          const y = TOP + index * PLOT_HEIGHT / 3;
          return <g key={index}><line x1={LEFT} x2={LEFT + PLOT_WIDTH} y1={y} y2={y} /><text x={LEFT - 12} y={y + 4} textAnchor="end">{formatAxisQuantity(value)}</text></g>;
        })}</g>
        <path className="supply-history-unissued" d={chart.unissuedArea} />
        <path className="supply-history-issued" d={chart.issuedArea} />
        <path className="supply-history-boundary" d={chart.boundary} />
        <g className="supply-history-axis">{chart.dateTicks.map((index) => <text key={index} x={chart.x(index)} y={HEIGHT - 7} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}>{formatDate(rows[index].timestamp)}</text>)}</g>
        {hovered && hoveredIndex !== null ? <g className="supply-history-crosshair"><line x1={chart.x(hoveredIndex)} x2={chart.x(hoveredIndex)} y1={TOP} y2={TOP + PLOT_HEIGHT} /><circle cx={chart.x(hoveredIndex)} cy={chart.y(hovered.issued)} r="5" /></g> : null}
      </svg>
      {hovered ? <div className="supply-history-tooltip" data-testid="supply-history-tooltip"><b>{formatDate(hovered.timestamp)}</b><span><i className="issued" />{t("已发行 PRL")}<strong>{formatQuantity(hovered.issued)}</strong></span><span><i className="unissued" />{t("尚未发行 PRL")}<strong>{formatQuantity(hovered.remaining)}</strong></span></div> : null}
    </div> : <div className="price-trend-empty">{t(result ? "暂无可用供应历史" : "正在读取供应历史")}</div>}
    <div className="supply-history-footer"><p>{t("尚未发行 = 21 亿 PRL − 已发行；这里不是锁仓解锁数据。")}</p><DataFreshness result={result} /></div>
    {result?.notice ? <p className="supply-history-notice">{t(result.notice)}</p> : null}
  </section>;
}
