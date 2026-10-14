# 普通云服务器部署与持续采集

网站与采集器是两个常驻 Node 进程。采集器不依赖 HTTP 请求、浏览器页面或访客人数。本地磁盘或 Supabase 保存每项数据最后一次成功结果；网站接口只读取这些结果，不转发外部抓取。请只运行 **一个采集器实例**，避免重复调用外部接口。

行情现在无需数据库凭据也会自动采集。没有 Supabase 配置时默认使用 `.data/market/`。云服务器可同样使用本地磁盘，需保留目录、允许服务用户读写、让网站和采集器使用同一个绝对路径；不要将缓存目录放进静态网站 `dist/` 中。重启服务或更新代码时保留该目录。多个云主机需改用共享数据库，不要使用各主机互不共享的文件。

## 1. 数据库准备

使用 Supabase 行情存储或社区讨论功能时，在 Supabase SQL Editor 按顺序执行：

1. `supabase/migrations/202610110001_persistent_community_discussions.sql`
2. `supabase/migrations/202610110002_atomic_discussion_response.sql`
3. `supabase/migrations/202610120003_market_snapshots.sql`

第三个迁移新增 `market_snapshots`，保存原始 JSON、成功采集时间、最后尝试时间及失败状态。采集成功才更新正文；失败只更新尝试状态。所有表和函数只允许服务角色访问，匿名客户端经本站 API 读取。

## 2. 运行环境

安装 Node **24.15 或更新的 24.x 版本**，将项目放在 `/opt/pearl`，为服务创建 `pearl` 系统用户并给予项目读取权限。在项目目录运行：

```sh
npm ci
npm run build
```

构建产生静态网站 `dist/` 和可独立运行的后端 `dist-server/`。不要只上传 `dist/` 到静态托管平台；该方式不会运行采集器。

创建 `/etc/pearl/pearl.env`，限制读取权限为服务用户及管理员。填写真实值（不要保留示例占位值）：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
COMMUNITY_ADMIN_TOKEN=your_admin_token
TWITTER241_API_KEY=your_twitter241_key
HOST=127.0.0.1
PORT=3000
MARKET_STORAGE=supabase
```

Supabase 行情存储需要两个 Supabase 变量。社区管理与 X 原文抓取需要相应数据库和管理/API 配置；密钥不发到浏览器，也不要使用 `VITE_` 前缀。系统服务的环境文件路径与手动运行时使用的项目 `.env.local` 是不同入口，请按启动方式配置。

若只运行行情采集，可先用以下配置，完全不需要 Supabase：

```dotenv
MARKET_STORAGE=file
MARKET_DATA_DIR=/opt/pearl/.data/market
HOST=127.0.0.1
PORT=3000
```

首次启动前创建存储目录并给 `pearl` 用户读写权限：`sudo install -d -o pearl -g pearl -m 700 /opt/pearl/.data/market`。两个服务使用相同的 `MARKET_STORAGE` 和 `MARKET_DATA_DIR`。

## 3. 常驻服务与自动恢复

检查 `command -v node`，将两个 service 文件的 `/usr/bin/node` 改为服务器实际 Node 路径；如果部署目录或运行用户不同，也同时修改 `WorkingDirectory`、`ExecStart` 和 `User`。

```sh
sudo cp deploy/pearl-web.service /etc/systemd/system/
sudo cp deploy/pearl-collector.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pearl-web pearl-collector
sudo systemctl status pearl-web pearl-collector
```

两项服务开机自启，退出后五秒重启。采集器启动后立即拉取全部数据，之后按各自频率更新；HTTP 服务重启不影响采集器，网站没有访客也不影响采集器。

如果两个服务已运行，不要额外运行 `npm start` 或 `npm run collect`，避免启动第二份采集器。

## 4. 对外网站入口

在已有 HTTPS 反向代理中，将域名请求转发到 `http://127.0.0.1:3000`，包括 `/api/`、静态资源以及中文/英文页面。不要继续把 `/api/prlstats/` 代理到 prlstats.com。Node 服务默认仅监听本机，通过代理对外提供网站；管理员页面也应通过 HTTPS 使用。

Node 服务会提供 `/en/overview` 等深层路径的 SPA 回退、白皮书 PDF、社区公共读取与已鉴权的管理员写入接口。

社区后台支持卡片首页、`/admin/community-discussions/new` 新建页和 `/admin/community-discussions/:slug` 管理页，英文入口加 `/en`。卡片可隐藏、恢复或永久删除讨论；此次功能复用已有数据库状态和级联删除，无需新 SQL 迁移。更新前端构建和编译服务端后重启网站及翻译服务；不要只替换静态前端。操作说明见 `docs/community-admin-guide.md`。

## 5. 验证无人访问也在更新

先检查日志：

```sh
sudo journalctl -u pearl-collector -n 60 --no-pager
curl -i http://127.0.0.1:3000/api/prlstats/api/network
curl -i 'http://127.0.0.1:3000/api/market/candles?range=7D'
```

成功日志为 `dataset-key saved`；失败日志只包含安全状态，不输出密钥或上游响应正文。响应头 `x-data-fetched-at` 是数据库中的真实采集时间，`x-data-stale` 表示最近一次失败或成功快照超过两倍更新周期。

关闭所有浏览器，不访问站点，等待一个或多个更新周期：Supabase 模式查看 `market_snapshots.fetched_at`，文件模式查看存储目录中各 JSON 的 `fetchedAt`，时间都应持续变化；日志也应继续出现成功记录。首次采集尚未成功时，该项接口返回 503，其他已完成的数据正常显示。初始抓取总时长取决于外部接口与存储速度。

## 6. 频率、失败处理和流量

| 数据 | 采集周期 |
| --- | --- |
| 网络、15 个指标、7D/30D Lighter K 线 | 30 秒 |
| 矿池当前数据、活跃度、交易规模 | 5 分钟 |
| 矿池历史、币龄、持币地址、新挖币移动 | 15 分钟 |

这些是定时采集频率，不代表上游每个周期都有新内容。最多四个上游请求同时运行；同一项未结束不会再重复发起。上游慢时实际完成时间可能晚于周期。网络、格式或写入失败不会清空已保存正文；没有成功过的数据不伪造快照。HTTP 服务用五秒内存缓存合并访客的数据库读取，重启后从数据库恢复；不由访客触发抓取。

社区讨论正文不定时重新抓取 Twitter241：管理员添加或刷新时抓取并持久保存，普通浏览只读 Supabase。

## 7. 本地开发和手动启动

直接运行（行情默认用本地文件，无需配置）：

```sh
npm run dev
```

此命令编译后端并同时启动 Vite 和独立采集器。未配置 Supabase 时自动使用本地持久文件，网站和采集器共享同一目录。若需要社区讨论或选择 Supabase 行情存储，再配置 `.env.local` 并执行相应迁移。

生产手动运行可用 `npm start` 同时启动两个进程，但终端关闭后不会得到 systemd 的恢复保障。排查时可分别用 `npm run start:web` 和 `npm run collect`；二者均读取项目 `.env` / `.env.local`。`npm run dev:web` 仅运行 Vite，适用于已有独立采集器的情况。

## 8. 版本更新

更新代码并运行 `npm ci`、`npm run build`，应用新增迁移后执行：

```sh
sudo systemctl restart pearl-web pearl-collector
```

重启不删除 Supabase 快照。采集中断或云服务器长期离线时，页面会标注旧数据，直到后台重新成功采集。

## 9. 社区中文译文

翻译 API 地址、密钥和模型已按项目所有者要求放在 `server/translation/config.ts`，随源码交付。部署时无需再填写翻译密钥；以下环境变量仅用于覆盖仓库默认配置，使用默认值时保持注释：

```dotenv
# COMMUNITY_TRANSLATION_BASE_URL=https://api.erisedai.com/v1
# COMMUNITY_TRANSLATION_API_KEY=your_translation_api_key
# COMMUNITY_TRANSLATION_MODEL=gpt-6-luna
```

确认现有社区数据库迁移已经执行。无需额外建表，译文以 `translationZh` 附加在原始块的 JSON 中；英文 `text` 不被覆盖。中文界面优先使用完整译文，英文界面优先使用原文，并提供每条来源的切换按钮。

调整 `deploy/pearl-translation.service` 的 Node 路径、用户与目录后启用：

```sh
sudo cp deploy/pearl-translation.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pearl-translation
sudo journalctl -u pearl-translation -n 40 --no-pager
```

只运行一个翻译进程。它会扫描已保存的来源，自动处理现有和新增英文正文，保存每批进度，失败后延迟重试，已完成的块不会重复请求。原文版本更新时会放弃旧版本的写入，未变化的正文块保留已有译文。长文完成时间受篇幅、服务速度与排队情况影响，录入接口先保存原文，不等待翻译。

正常日志为 `translation <source-id> progress saved`。读取译文无需翻译 API 密钥；普通访客不会触发付费翻译。缺少翻译配置时，网站继续显示原文，手动运行 `npm run translate` 只用于排查，不能与已运行的 systemd 翻译服务并行。

实现参考：[Node 环境变量加载](https://nodejs.org/api/environment_variables.html)、[Supabase 自定义 fetch 配置](https://supabase.com/docs/reference/javascript/initializing)。
