# Pearl 中文社区

面向 Pearl 中文社区的双层策展站：根路径是「Pearl 是什么」项目档案导读；`/overview` 提供实时网络与市场数据，`/chain` 提供完整链上实况，`/valuation` 提供 PRL 数据汇总。

## 页面入口

- `/`：Pearl 是什么——项目档案的第一份导读；
- `/overview`：实时数据总览，含 Lighter K 线、网络、链上、PRL 数据与 AI 交叉摘要；
- `/chain`：链上实况；
- `/valuation`：PRL 数据汇总；
- `/archive`：当前显示项目档案入口，后续扩展其余专题。
- `/archive/core-mechanism`：Pearl 核心机制研究档案。
- `/archive/whitepaper`：原始 Pearl 白皮书的站内阅读页。
- `/archive/articles`：Pearl 相关文章阅读卡（学术/协议原文 + 英文社区长文/thread）。
- `/archive/people`：人物、研究关联与合作线索的证据地图。

## 本地运行

```powershell
npm install
npm run dev
```

打开终端显示的本地地址（默认是 `http://localhost:5173`）。

## 校验

```powershell
npm test
npm run build
```

## 数据接入

页面当前通过 Vite 的同源代理读取 [prlstats](https://prlstats.com/) 的公开接口：

- `GET /api/network`：高度、难度、算力、出块时间、供应与排放；
- `GET /api/series?m=price`：PRL 价格序列。
- `GET /api/series?m=prl_btc,volume,supply,mcap_vs_btc,fdv_vs_btc,inflation,miner_revenue`：估值页的相对价格、成交量、供应、通胀、相对 BTC 尺度与矿工收入序列。
- `GET /api/pools`、`/api/pools/history`：矿池当前出块、份额与历史归因；
- `GET /api/series?...`、`/api/coinage`：链上活跃度和币龄；
- `GET /api/txsizes?range=30d`：交易规模统计与分布；
- `GET /api/holders`、`/api/mined`：持币地址、集中度和新挖币首次移动。
- `GET https://mainnet.zklighter.elliot.ai/api/v1/candles`：Lighter `PRL` 永续合约的单一来源 1 小时 OHLC K 线。

本地开发时，浏览器请求 `/api/prlstats/*`，由 [`vite.config.ts`](./vite.config.ts) 转发至 `https://prlstats.com`。上线时应在部署平台配置等价的服务端或 Edge 代理；不要让静态前端跨域直连该来源。读取失败时，页面会展示最近可用样本，并在状态中标明。

Lighter 的 K 线接口允许浏览器跨域读取，因此价格图不经 prlstats 代理；它展示的是永续合约价格，不等同于现货聚合参考价。

## 加载与刷新

页面打开时会并行预取公开数据，并在浏览器内存中建立共享缓存；在数据总览、链上实况和 PRL 数据汇总之间切换时，会复用同一份结果，避免重复请求。

- **快速数据：30 秒** — 网络概览、指标序列与 Lighter K 线。`prlstats` 的网络及指标接口响应头标注了 30 秒缓存周期。
- **中速数据：5 分钟** — 矿池、活跃度和交易尺寸。
- **慢速数据：15 分钟** — 矿池历史、Coin Age、持币地址和已挖数量。

刷新完成后，当前页面会自动采用最新缓存结果；请求进行中也会被合并，避免同一数据被并发抓取多次。

## 链上子页

`/chain` 的 Pools、Activity、TX Size 与 Holders 模块均独立读取和降级。矿池归因中的 `Solo / unknown` 是未被识别的区块，并不等于独立矿工；Holders 仅展示公开 API 提供的 Top 100 地址；新挖币的移动不等于卖出。

## PRL 数据汇总子页

`/valuation` 只使用 prlstats 的参考价格与公开指标，不复用首页的 Lighter 永续 K 线。顶部图表可切换 `prl_btc`、`mcap_vs_btc`、`fdv_vs_btc`、`volume` 与 `cost_allin` 五组历史序列；流通市值按最新 `price × supply` 计算；FDV 按最新 `price × 2,100,000,000 PRL` 计算。

## 主要文件

- `src/ArchiveHomePage.tsx`：根路径的 Pearl 项目档案导读；
- `src/CoreMechanismPage.tsx`：Pearl 核心机制专题档案；
- `src/WhitepaperPage.tsx`：嵌入原始 PDF 的 Pearl 白皮书阅读页；
- `src/ArticlesPage.tsx`：平铺展示的 Pearl 相关研究与英文社区长文阅读卡页。
- `src/PeoplePage.tsx`：人物与关系专题的事实、能力地图和推测隔离页；
- `src/App.tsx`：数据总览路由、实时数据看板与交互；
- `src/ChainPage.tsx`：`/chain` 链上数据子页；
- `src/ValuationPage.tsx`：`/valuation` PRL 数据汇总子页；
- `src/data/chain.ts`：Pools、Activity、TX Size 与 Holders 的公开接口适配；
- `src/data/prlstats.ts`：公开接口读取、校验与降级；
- `src/data/runtime.ts`：跨页面请求缓存、启动预取与刷新调度；
- `src/data/schema.ts`：数据结构校验；
- `src/styles/`：珍珠白视觉系统；
- `src/styles/archive.css`：项目档案首页布局；
- `public/assets/pearl-iridescent-background.png`：为本项目生成的低饱和珠光背景资产。
