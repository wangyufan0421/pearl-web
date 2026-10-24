import type { DataResult } from "./data/prlstats";
import { useLanguage } from "./i18n/Language";
import { DataFreshness } from "./DataFreshness";

export const metricLabels: Record<string, string> = { price: "PEARL 市场参考价", cost_allin: "全网全成本", txs: "链上交易（24h）", onchain_volume: "链上转账额（24h）", funded_addresses: "活跃持仓地址", top10_share: "前十地址占比", fdv_vs_btc: "FDV / BTC", prl_btc: "PEARL / BTC", marginal_cost: "推理并行成本", crossover: "挖矿 / 推理收入交点", volume: "24h 成交量", supply: "流通供应量", mcap_vs_btc: "流通市值 / BTC", inflation: "年化通胀率", miner_revenue: "矿工收入 / 日" };
export function DataStatusSummary({ items }: { items: Array<{ label: string; result: DataResult<unknown> | null | undefined }> }) {
  const { t } = useLanguage();
  const saved = items.filter(item => item.result?.sourceKind === "live");
  if (!saved.length) return null;
  return <aside className="data-status-summary">
    {saved.some(item => item.result?.stale) && <p className="chain-notice" role="status">{t("部分数据暂用上次成功结果，后台仍在更新。")}</p>}
    <details><summary>{t("查看各项数据更新时间")}</summary><div className="data-status-grid">{saved.map(item => <div key={item.label}><b>{t(item.label)}</b><DataFreshness result={item.result} /></div>)}</div></details>
  </aside>;
}
