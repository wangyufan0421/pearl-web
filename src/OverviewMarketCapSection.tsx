import { useEffect, useState } from "react";
import { MarketCapComparisonChart, marketCapAssets, type MarketCapAsset, type MarketCapSeries } from "./MarketCapComparisonChart";
import { loadMetricSeries, loadPeerMarketCap, subscribeToDataUpdates } from "./data/runtime";
import type { DataResult, MetricSeries } from "./data/prlstats";
import { useLanguage } from "./i18n/Language";

type Results = Partial<Record<MarketCapAsset, DataResult<MetricSeries>>>;
const peerAssets = ["btc", "bch", "fil", "zec", "tao"] as const;

export function OverviewMarketCapSection() {
  const { language } = useLanguage();
  const [results, setResults] = useState<Results>({});

  useEffect(() => {
    let active = true;
    const sync = () => {
      void loadMetricSeries("mcap").then(result => { if (active) setResults(previous => ({ ...previous, pearl: result })); });
      for (const asset of peerAssets) {
        void loadPeerMarketCap(asset).then(result => { if (active) setResults(previous => ({ ...previous, [asset]: result })); });
      }
    };
    sync();
    const unsubscribe = subscribeToDataUpdates(sync);
    return () => { active = false; unsubscribe(); };
  }, []);

  const series = Object.fromEntries(marketCapAssets.map(asset => [asset, results[asset]?.data.points ?? []])) as MarketCapSeries;
  const available = marketCapAssets.filter(asset => (series[asset]?.length ?? 0) > 0).length;

  return <section className="section band-line overview-market-cap" id="market-cap">
    <header className="section-header">
      <p className="eyebrow">02 / MARKET CAP</p>
      <h2>{language === "zh" ? "PEARL 市值对比图" : "PEARL market-cap comparison"}</h2>
      <p>{language === "zh" ? "PEARL 与 BTC、BCH、FIL、ZEC、TAO 的历史市值同图对照，不是 FDV。" : "Historical market caps for PEARL, BTC, BCH, FIL, ZEC and TAO on one chart—not FDV."}</p>
    </header>
    <div className="comparison-market-history-panel">
      <MarketCapComparisonChart series={series} />
      <div className="market-cap-notes">
        <span>{language === "zh" ? `已读取 ${available}/6 条序列；缺失的代币显示为「—」，不会使用模拟数据。` : `${available}/6 series loaded; missing assets are shown as “—”, never simulated.`}</span>
        <span>{language === "zh"
          ? "PEARL：prlstats 已发行市值；BTC/BCH/ZEC：Coin Metrics 当前供应市值；FIL：Coin Metrics 估计流通市值。TAO 仅近一年：CoinGecko 免费接口不提供更早历史，TAO 的高点也只代表近一年。每条曲线都从自身首条可用数据开始，按自身时间等距延伸至最新数据；同一横向位置不代表同一天。悬停会分别显示各币种的实际观测日期和市值。纵轴共用对数市值刻度；上方卡片的观测高点仍按各来源全部可用历史计算。"
          : "PEARL: prlstats issued-supply cap; BTC/BCH/ZEC: Coin Metrics current-supply cap; FIL: Coin Metrics estimated circulating cap. TAO covers only the past year from CoinGecko's free API, so its peak is a one-year peak. Each line runs from its own first available observation to its latest, with even time spacing within that asset. The same horizontal position does not mean the same calendar date. Hover shows each asset's observed date and market cap. All lines share a logarithmic market-cap scale; observed peaks use all available source history."}</span>
        <span><a href="https://prlstats.com" target="_blank" rel="noreferrer">prlstats</a> · <a href="https://docs.coinmetrics.io/api/v4" target="_blank" rel="noreferrer">Coin Metrics Community Data</a> (<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a>) · <a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">TAO {language === "zh" ? "数据来自 CoinGecko" : "data by CoinGecko"}</a></span>
      </div>
    </div>
  </section>;
}
