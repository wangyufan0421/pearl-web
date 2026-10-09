export function formatHashrate(value: number): string {
  return `${(value / 1e18).toFixed(1)} EH/s`;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

export function formatBlockDeviation(actual: number, target: number): string {
  const percent = ((actual - target) / target) * 100;
  const direction = percent > 0 ? "慢" : percent < 0 ? "快" : "持平";
  return `${direction} ${Math.abs(percent).toFixed(1)}%`;
}
