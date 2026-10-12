import { useLanguage, formatLocale } from "./i18n/Language";
import { SiteHeader } from "./SiteHeader";
import { useEffect, useMemo, useState } from "react";
import { DataFreshness } from "./DataFreshness";
import { type AgeBandData, type ChainMetric, type HolderSnapshot, type Pool, type PoolHistory, type TxSizeData } from "./data/chain";
import { type DataResult } from "./data/prlstats";
import { loadActivity, loadCoinAge, loadHolders, loadMined, loadNetworkSnapshot, loadPoolHistory, loadPools, loadTxSizes, subscribeToDataUpdates } from "./data/runtime";
import type { NetworkSnapshot } from "./data/schema";
import { formatHashrate } from "./lib/format";

function formatNumber(value: number, digits = 0) { return new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: digits }).format(value); }
function formatPrl(value: number) { return value >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : value.toFixed(0); }
function formatDate(date: Date) { return new Intl.DateTimeFormat(formatLocale(), { month: "numeric", day: "numeric" }).format(date); }

function ChainModule({ eyebrow, title, source, children, notice, stale }: { eyebrow: string; title: string; source: string; children: React.ReactNode; notice?: string; stale?: boolean }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <section className="chain-module"><header className="chain-module-header"><p>{t(eyebrow)}</p><h2>{t(title)}</h2><span>{t(source)}</span></header>{notice && <p className="chain-notice">{t(notice)}</p>}{!notice || stale ? children : null}</section>;
}

export function Trend({ points, label, unit }: { points: ChainMetric["points"]; label: string; unit: string }) {
  const { t, href: localizeHref, language } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const recent = points.slice(-14); const max = Math.max(...recent.map((point) => point.value), 1);
  const hoveredPoint = hoveredIndex === null ? null : recent[hoveredIndex];
  return <div className="mini-trend" aria-label={t(label)} onMouseLeave={() => setHoveredIndex(null)}>{recent.map((point, index) => <button type="button" key={point.timestamp.getTime()} aria-label={t(`${formatDate(point.timestamp)} ${formatNumber(point.value, 2)} ${unit}`)} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)}><i style={{ height: `${Math.max(6, point.value / max * 100)}%` }} /></button>)}{hoveredPoint ? <span className="trend-tooltip" data-testid="trend-tooltip"><b>{t(formatDate(hoveredPoint.timestamp))}</b>{t(formatNumber(hoveredPoint.value, 2))} {t(unit)}</span> : null}</div>;
}

function activityMetric(activity: ChainMetric[] | undefined, id: string) { return activity?.find((metric) => metric.id === id); }

export default function ChainPage() {
  const { t, href: localizeHref, language } = useLanguage();
  const [network, setNetwork] = useState<DataResult<NetworkSnapshot> | null>(null);
  const [pools, setPools] = useState<DataResult<Pool[]> | null>(null);
  const [poolHistory, setPoolHistory] = useState<DataResult<PoolHistory> | null>(null);
  const [activity, setActivity] = useState<DataResult<ChainMetric[]> | null>(null);
  const [coinAge, setCoinAge] = useState<DataResult<AgeBandData> | null>(null);
  const [txSizes, setTxSizes] = useState<DataResult<TxSizeData> | null>(null);
  const [holders, setHolders] = useState<DataResult<HolderSnapshot> | null>(null);
  const [mined, setMined] = useState<DataResult<AgeBandData> | null>(null);

  useEffect(() => {
    let active = true;
    const update = <T,>(loader: () => Promise<T>, setter: (value: T) => void) => {
      void loader().then((result) => { if (active) setter(result); });
    };
    const sync = () => {
      update(loadNetworkSnapshot, setNetwork);
      update(loadPools, setPools);
      update(loadPoolHistory, setPoolHistory);
      update(loadActivity, setActivity);
      update(loadCoinAge, setCoinAge);
      update(loadTxSizes, setTxSizes);
      update(loadHolders, setHolders);
      update(loadMined, setMined);
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);

  const networkCards = useMemo(() => network ? [
    ["区块高度", formatNumber(network.data.height)], ["网络算力", formatHashrate(network.data.hashrateHs)], ["难度", formatNumber(network.data.difficulty)], ["平均出块", `${network.data.avgBlockTimeSeconds.toFixed(0)}s`], ["供应进度", `${network.data.supplyPercent.toFixed(2)}%`], ["日排放", `${formatPrl(network.data.emissionPrlDay)} PRL`],
  ] : [], [network]);
  const txs = activityMetric(activity?.data, "txs");
  const volume = activityMetric(activity?.data, "onchain_volume");
  const fees = activityMetric(activity?.data, "tx_fees");
  const newAddresses = activityMetric(activity?.data, "new_addresses");
  const funded = activityMetric(activity?.data, "funded_addresses");
  const recentAge = coinAge?.data.bands.map((band) => ({ name: band.name, value: band.values.at(-1) ?? 0 })) ?? [];

  return <main className="site-shell chain-page">
    <SiteHeader />
    <div className="chain-wrap">
      <ChainModule eyebrow="00 / NETWORK" title={t("网络概览")} source={t(network?.sourceKind === "live" ? "公开链上快照" : "最近可用样本")} notice={t(network?.notice)} stale={network?.stale}>
        <DataFreshness result={network} />
        <div className="chain-overview-grid">{networkCards.length ? networkCards.map(([label, value]) => <article key={label}><span>{t(label)}</span><b>{t(value)}</b></article>) : <p className="chain-loading">{t("正在读取网络快照")}</p>}</div>
      </ChainModule>

      <ChainModule eyebrow="01 / POOLS" title={t("矿池 Pools")} source={t("区块 coinbase 归因 · 24 小时")} notice={t(pools?.notice)} stale={pools?.stale}>
        <DataFreshness result={pools} /><DataFreshness result={poolHistory} />
        <div className="pool-layout"><div className="table-scroll"><table><thead><tr><th>{t("矿池")}</th><th>{t("出块 24h")}</th><th>{t("份额")}</th><th>{t("费率")}</th><th>{t("结算")}</th></tr></thead><tbody>{(pools?.data ?? []).filter((pool) => pool.blocks24h > 0).map((pool) => <tr key={pool.id}><td>{t(pool.name)}</td><td>{t(formatNumber(pool.blocks24h))}</td><td><span className="share-bar"><i style={{ width: `${Math.min(pool.share24h, 100)}%` }} /></span>{t(pool.share24h.toFixed(1))}%</td><td>{t(pool.feePct === null ? "—" : `${pool.feePct.toFixed(1)}%`)}</td><td>{t(pool.payoutScheme ?? "—")}</td></tr>)}</tbody></table></div><aside className="chain-aside"><b>{t(poolHistory?.data.days.length ?? 0)}{t(" 天")}</b><span>{t("可读取的历史归因序列")}</span><p>{t("先按 coinbase 收款地址和矿工标签归因；无法确认的区块显示为 ")}<em>Solo / unknown</em>{t("，不代表一定是单人挖矿。")}</p></aside></div>
      </ChainModule>

      <ChainModule eyebrow="02 / ACTIVITY" title={t("链上活跃度 Activity")} source={t("公开链上数据索引")} notice={t(activity?.notice)} stale={activity?.stale}>
        <DataFreshness result={activity} /><DataFreshness result={coinAge} />
        <div className="activity-grid">{[
          ["交易数 / 日", txs], ["链上转账额 / 日", volume], ["交易费 / 日", fees], ["新地址 / 日", newAddresses], ["活跃持币地址", funded],
        ].map(([label, metric]) => { const series = metric as ChainMetric | undefined; const value = series?.points.at(-1)?.value; return <article key={label as string}><span>{t(label as string)}</span><b>{t(value === undefined ? "—" : formatPrl(value))}</b>{series ? <Trend points={series.points} unit={t(series.unit)} label={t(`${label as string} 近 14 日趋势`)} /> : null}</article>; })}</div>
        <div className="age-row"><div><b>{t("币龄结构")}</b><span>{t("按输出被花费前的持有时长分层")}</span></div>{recentAge.slice(0, 5).map((band) => <div key={band.name}><span>{t(band.name)}</span><b>{t(formatPrl(band.value))} PRL</b></div>)}</div>
      </ChainModule>

      <ChainModule eyebrow="03 / TX SIZE" title={t("交易规模 TX Size")} source={t("30 日 UTXO 交易金额分布")} notice={t(txSizes?.notice)} stale={txSizes?.stale}>
        <DataFreshness result={txSizes} />
        <div className="tx-grid"><article><span>{t("交易笔数")}</span><b>{t(formatNumber(txSizes?.data.stats.count ?? 0))}</b></article><article><span>{t("中位交易额")}</span><b>{t(formatPrl(txSizes?.data.stats.median ?? 0))} {t(txSizes?.data.unit ?? "PRL")}</b></article><article><span>{t("最大交易额")}</span><b>{t(formatPrl(txSizes?.data.stats.max ?? 0))} {t(txSizes?.data.unit ?? "PRL")}</b></article><article><span>{t("Top 1% 交易额占比")}</span><b>{t(((txSizes?.data.stats.top_share ?? 0) * 100).toFixed(1))}%</b></article></div>
        <div className="whale-row"><b>{t("巨鲸交易分档")}</b>{(txSizes?.data.whales ?? []).slice(0, 4).map((whale) => <span key={whale.atLeast}>≥ {t(formatPrl(whale.atLeast))} PRL · {t(formatNumber(whale.count))}{t(" 笔 · ")}{t(whale.share.toFixed(1))}%</span>)}</div>
        <p className="chain-caveat">{t("交易规模是 UTXO 统计口径；若使用 net 口径会尝试剔除找零输出，因此不应直接等同于逐笔真实支付金额。")}</p>
      </ChainModule>

      <ChainModule eyebrow="04 / HOLDERS" title={t("持币地址 Holders")} source={t("当前 UTXO 集 · Top 100 公开地址")} notice={t(holders?.notice)} stale={holders?.stale}>
        <DataFreshness result={holders} /><DataFreshness result={mined} />
        <div className="holder-grid"><article><span>{t("活跃持币地址")}</span><b>{t(formatNumber(holders?.data.funded ?? 0))}</b></article><article><span>{t("已统计持币量")}</span><b>{t(formatPrl(holders?.data.heldPrl ?? 0))} PRL</b></article><article><span>Gini</span><b>{t((holders?.data.gini ?? 0).toFixed(3))}</b></article><article><span>{t("Top 10 占比")}</span><b>{t((holders?.data.top10Pct ?? 0).toFixed(2))}%</b></article><article><span>{t("Top 100 占比")}</span><b>{t((holders?.data.top100Pct ?? 0).toFixed(2))}%</b></article></div>
        <div className="table-scroll holder-table"><table><thead><tr><th>#</th><th>{t("地址")}</th><th>{t("余额")}</th><th>{t("份额")}</th><th>{t("首次收币")}</th></tr></thead><tbody>{(holders?.data.rows ?? []).slice(0, 12).map((row) => <tr key={row.address}><td>{t(row.rank)}</td><td><code>{t(row.address.slice(0, 13))}…{t(row.address.slice(-7))}</code>{row.pool ? <small>{t(row.pool)} payout</small> : null}</td><td>{t(formatPrl(row.balancePrl))} PRL</td><td>{t(row.sharePct.toFixed(2))}%</td><td>{t(row.firstDay)}</td></tr>)}</tbody></table></div>
        <div className="mined-row"><b>{t("新挖币的首次移动")}</b><span>{t(mined?.data.bands.length ? `${formatDate(mined.data.days.at(-1) ?? new Date())} 的发行按首次花费等待时间分层` : "正在读取新挖币移动数据")}</span><p>{t("coinbase 输出在链上被标记并追踪其首次花费；移动不等于卖出，矿池向矿工付款同样会显示为移动。")}</p></div>
      </ChainModule>
    </div>
  </main>;
}
