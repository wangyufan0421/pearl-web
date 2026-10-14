# Pearl 中文社区

社区管理后台现为讨论卡片首页、加号新建页和单个讨论的两栏管理页。支持隐藏、恢复公开，以及输入讨论地址标识确认后彻底删除整组主题/回应/译文。此次升级复用现有数据库结构，无需新增迁移；云端需同时更新前端与服务端并重启。具体操作见 [后台指南](docs/community-admin-guide.md)。

## 中英文版本

所有现有网页提供中英文内容。右上角 `EN / ZH` 原地切换语言，保留当前页面、查询参数、锚点和图表状态。中文地址保持不变；英文地址增加 `/en` 前缀，例如 `/en/overview` 和 `/en/archive/core-mechanism`。主动选择会保存在浏览器中，并在下次进入根路径时使用；带明确页面路径的链接优先采用 URL 语言。

`src/i18n/catalogue.ts` 集中维护英文文案，以中文源文字为查找键。页面通过 `useLanguage()` 的 `t()` 与 `href()` 翻译内容及生成站内链接；API、外链和静态资源地址不添加语言前缀。数字与日期使用对应的 locale。新增网站文字需要同时维护目录，并检查英文排版。

中文白皮书继续读取 `public/documents/pearl-whitepaper.pdf`。英文读取 `public/documents/pearl-whitepaper-en.pdf`：它由项目已有的官方 INT 原文网页存档导出为 PDF，保留英文正文、公式与三张原图，来源为 https://pearlresearch.ai/research/int-whitepaper 。它不是根目录中另一个 22 页的 Floating Point Scheme PDF，避免语言切换同时换掉协议版本。此文件是官方英文网页的阅读副本，不是官方提供的独立 PDF 排版文件。

社区原帖保留原语言，中文译文另行保存，不将原帖正文传入界面翻译函数 `t()`。讨论列表和详情从同源公共 API 读取已保存的快照。

社区正文现在也支持单独保存的中文机器译文：英文原文始终保留，中文界面默认显示已完成的译文，英文界面默认显示原文，每条来源可单独切换。自动翻译由独立后台进程执行；长文分批处理，失败保留原文并重试。译文保存在既有 `discussion_sources.blocks` JSON 中的 `translationZh` 字段，无需新增 SQL 迁移。已收录来源会自动补译，刷新未变化的正文会复用译文。作者字段兼容 Twitter241 新的 user core/avatar 格式；页面始终显示 @账号，头像失败不影响身份与原帖链接。

在服务端配置 `COMMUNITY_TRANSLATION_BASE_URL`、`COMMUNITY_TRANSLATION_API_KEY`、`COMMUNITY_TRANSLATION_MODEL` 后，`npm run dev` 和 `npm start` 会自动启动翻译进程。当前已验证的模型为 `gpt-6-luna`。正式部署可启用 `deploy/pearl-translation.service`，与行情采集器分别常驻运行。阅读页面不会发起翻译 API 请求；译文未经人工核对，页面会标明机器翻译。

本项目当前依赖需要 Node 24.15 或更新版本（或满足依赖要求的 Node 22.22.2）。Vitest 只读取主目录 `src/` 与 `server/` 中的测试，避免读取 worktree 和备份。

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
- `/archive/community-discussion`：已发布社区讨论列表。
- `/archive/community-discussion/{slug}`：原文章、推文及回应的完整原文阅读页；英文路径对应 `/en/archive/community-discussion/{slug}`。
- `/admin/community-discussions`：网页管理员入口；英文入口为 `/en/admin/community-discussions`。讨论页的“管理讨论”链接也可进入。

旧 `/archive#community-discussion` 和 `/en/archive#community-discussion` 地址会转到独立讨论列表。接口不可用时展示读取失败及重试，数据库为空时展示空状态，不回退为首页或硬编码旧讨论。列表和详情初次打开、窗口重新获得焦点及每 60 秒重读公共接口，刷新失败时保留已有原文。

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

后台常驻采集器读取 [prlstats](https://prlstats.com/) 的公开接口，将成功结果保存到本地磁盘或 Supabase。浏览器只读取本站后端保存的快照：

- `GET /api/network`：高度、难度、算力、出块时间、供应与排放；
- `GET /api/series?m=price`：PRL 价格序列。
- `GET /api/series?m=prl_btc,volume,supply,mcap_vs_btc,fdv_vs_btc,inflation,miner_revenue`：估值页的相对价格、成交量、供应、通胀、相对 BTC 尺度与矿工收入序列。
- `GET /api/pools`、`/api/pools/history`：矿池当前出块、份额与历史归因；
- `GET /api/series?...`、`/api/coinage`：链上活跃度和币龄；
- `GET /api/txsizes?range=30d`：交易规模统计与分布；
- `GET /api/holders`、`/api/mined`：持币地址、集中度和新挖币首次移动。
- `GET https://mainnet.zklighter.elliot.ai/api/v1/candles`：Lighter `PRL` 永续合约的单一来源 1 小时 OHLC K 线。

本地开发和生产中，浏览器请求 `/api/prlstats/*`，由本站接口读取已保存的快照，不转发现场抓取。首次成功采集前接口返回不可用；后续采集失败保留最后成功数据，并显示过期状态及真实采集时间。

Lighter K 线由后端采集，浏览器读取同源 `/api/market/candles?range=7D` 或 `range=30D`。它展示的是永续合约价格，不等同于现货聚合参考价。

## 社区讨论持久化

### 网页管理员操作

1. 部署后打开 `/admin/community-discussions`，输入部署环境中设置的统一管理员密钥 `COMMUNITY_ADMIN_TOKEN`，点击“验证令牌”。验证通过前只显示验证入口；验证通过后才显示主文章、回应及来源管理表单。退出、刷新或密钥失效后返回验证入口，服务器也会对每次写入重新鉴权。
2. 在“创建主文章讨论”中粘贴 X status 链接，可选填写备用标题、简介与 slug，点击“创建并发布讨论”。Article 原标题优先，普通推文可使用备用标题。本表单会直接公开发布，成功后提供讨论页链接。
3. 在“添加辩论与回应”中选择一篇已发布讨论，粘贴一行一个回应链接（每次最多 50 条），点击“添加回应”。逐条结果显示新增、重复或抓取失败；失败条目可重试。
4. 选中讨论的“已保存的来源”支持刷新原文。刷新失败不会清空成功保存过的正文。网络请求无法确认完成时，先检查公开讨论页再重试，写入请求不会自动重复发送。
5. 点击“退出管理”清除当前页面中的令牌。令牌不写入 URL、localStorage 或 sessionStorage；刷新页面或离开后需要重新验证。Twitter241 与 Supabase 密钥始终只配置在服务器端。

管理员验证使用受保护 `GET /api/admin/community-discussions`，它只检查令牌，不访问数据库、不抓取 X。浏览器表单复用已有 POST 创建、批量添加和刷新接口。此版本管理已发布讨论，没有草稿发布、编辑或删除工作流。

本地开发先复制 `.env.example` 为 `.env.local`，填入自己的服务端配置后重启开发服务器；Vite 开发接口会读取这些变量。浏览已保存内容需要 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`，新增或刷新 X 来源还需要 `TWITTER241_API_KEY`，管理写入接口需要 `COMMUNITY_ADMIN_TOKEN`。未配置数据库时公共读取接口返回不可用状态。现有讨论需已通过管理接口导入数据库并发布，才会出现在列表里。

在 Supabase SQL Editor 中按文件名顺序依次执行以下迁移：先执行 `supabase/migrations/202610110001_persistent_community_discussions.sql`，再执行 `supabase/migrations/202610110002_atomic_discussion_response.sql`。它们会创建社区讨论及其来源的表、约束、服务端写入函数，以及原子化的响应写入函数。随后在部署主机（deployment host）配置以下同一组环境变量；它们仅可在服务端使用，绝不可使用 `VITE_` 前缀暴露到浏览器：

- `TWITTER241_API_KEY`：Twitter241 抓取 API 密钥；
- `SUPABASE_URL`：Supabase 项目 URL；
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务角色密钥；
- `COMMUNITY_ADMIN_TOKEN`：社区管理接口令牌。

## 加载与刷新

云服务器运行独立采集进程，即使没有页面访问也会持续更新。网站接口只读取持久快照，不触发外部抓取。详细部署、开机自启、异常恢复和无人访问验证见 [普通云服务器部署说明](./deploy/README.md)。新增数据库迁移为 `supabase/migrations/202610120003_market_snapshots.sql`，需在原有两项迁移之后执行。

`npm run dev` 同时启动 Vite 与采集器；`npm start` 同时启动生产 HTTP 服务与采集器。行情无需 Supabase 凭据即可启动，默认保存到 `.data/market/`。设置 `MARKET_STORAGE=file` 可明确使用本地文件；设置 `MARKET_STORAGE=supabase` 并配置数据库后可保存到 Supabase。未指定存储模式时，有 Supabase 变量则选择 Supabase，否则选择本地文件。正式部署使用 `deploy/` 下的两个 systemd 服务，保证关闭终端后继续运行；磁盘模式需保留存储目录和读写权限。请只运行一个采集器实例。社区讨论功能仍需要 Supabase 配置。

- **快速数据：30 秒** — 网络概览、指标序列与 Lighter K 线。
- **中速数据：5 分钟** — 矿池、活跃度和交易尺寸。
- **慢速数据：15 分钟** — 矿池历史、Coin Age、持币地址和已挖数量。

后台刷新成功后更新数据库；失败保留原快照。HTTP 服务合并五秒内的数据库读取。浏览器仍按上述频率重读本站接口以更新画面，但关闭浏览器不会停止采集。普通导航目前会重新加载页面，其内存缓存会重建；它读取的是已准备好的服务器结果。数据模块分别显示，单个慢请求不阻塞其他已返回指标；暂时读不到本站 API 时，当前页面已有成功数据继续保留并标注状态。

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
