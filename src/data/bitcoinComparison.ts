import type { MetricPoint } from "./prlstats";

export type ComparisonRange = "30D" | "90D" | "ALL";
const dayMs = 86_400_000;

function observed(point: MetricPoint, now: number) {
  const time = point.timestamp.getTime();
  return Number.isFinite(time) && time <= now && Number.isFinite(point.value) && point.value >= 0 && point.projected !== true;
}

export function latestObservedPoint(points: MetricPoint[], now = new Date()): MetricPoint | null {
  const cutoff = now.getTime();
  let latest: MetricPoint | null = null;
  for (const point of points) {
    if (observed(point, cutoff) && (!latest || point.timestamp.getTime() > latest.timestamp.getTime())) latest = point;
  }
  return latest;
}

export function selectComparisonPoints(points: MetricPoint[], range: ComparisonRange, now = new Date(), maxPoints = 240): MetricPoint[] {
  const end = now.getTime();
  const start = range === "ALL" ? Number.NEGATIVE_INFINITY : end - (range === "30D" ? 30 : 90) * dayMs;
  const selected = points.filter(point => observed(point, end) && point.timestamp.getTime() >= start)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const cap = Math.max(3, maxPoints);
  if (selected.length <= cap) return selected;
  const first = selected[0];
  const last = selected[selected.length - 1];
  const span = Math.max(1, last.timestamp.getTime() - first.timestamp.getTime());
  const slots = cap - 2;
  const buckets = new Map<number, MetricPoint>();
  for (const point of selected.slice(1, -1)) {
    const bucket = Math.min(slots - 1, Math.floor(((point.timestamp.getTime() - first.timestamp.getTime()) / span) * slots));
    buckets.set(bucket, point);
  }
  return [first, ...buckets.values(), last];
}
