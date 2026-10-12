# 可持续社区讨论归档设计

## 目标

将现有仅支持 `wtf-is-pearl` 的静态社区讨论，升级为由管理员通过受保护服务端接口持续录入的云端讨论库。管理员提交一条 X 原文章链接，即可创建讨论列表卡片与 `/archive/community-discussion/{slug}` 页面；后续提交一个或多个回应链接，即可将完整正文快照加入对应讨论。新增内容无需修改前端代码或重新部署。

## 边界与非目标

- 本期实现受保护 HTTP 管理接口，不实现网页登录后台。管理员可用命令、脚本或由站点维护者代为调用接口；网页表单可在后续加在同一接口之上。
- 使用 Supabase Postgres 作为独立云端持久化层。站点可部署在 Vercel 或任意支持服务端函数与环境变量的平台，不与具体托管平台绑定。
- 不自动总结、翻译、标注立场或将转述表述为事实。页面以原始 X 内容快照和原文链接为中心。
- 不在浏览器中调用 Twitter241，也不在公共页面访问时重新抓取 X。公共页面只读取已持久化的快照。

## 运行时与密钥

仅服务端可读取下列环境变量：

- `TWITTER241_API_KEY`：Twitter241/RapidAPI 抓取密钥；沿用现有名称。
- `SUPABASE_URL`：Supabase 项目 URL。
- `SUPABASE_SERVICE_ROLE_KEY`：仅服务端访问数据库的服务角色密钥。
- `COMMUNITY_ADMIN_TOKEN`：管理接口的 Bearer Token。

这些变量均不使用 `VITE_` 前缀，不能提交到 Git，也不能从任何公共 API 返回。前端只请求站点同源的公共读取接口；管理接口必须校验 `Authorization: Bearer <COMMUNITY_ADMIN_TOKEN>`。

## 数据模型

### `discussions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `slug` | text unique | URL 使用的稳定标识 |
| `title` | text | Article 标题优先；非 Article 使用管理员标题或首段自动截取标题 |
| `description` | text nullable | 管理员可选简介；未设置时使用主来源前文摘要 |
| `primary_source_id` | UUID | 主来源的 `discussion_sources.id` |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 讨论或来源最后成功写入时间 |
| `status` | `draft | published` | 草稿不出现在公共列表与详情接口 |

### `discussion_sources`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `discussion_id` | UUID | 指向讨论 |
| `x_status_id` | text unique | 从 X URL 解析出的 status ID；全库去重 |
| `url` | text | 规范化后的 X 原文 URL |
| `role` | `primary | response` | 原文章或回应 |
| `author` / `handle` / `avatar_url` | text nullable | 最近成功抓取的作者快照 |
| `published_at` | timestamptz nullable | X 原始发布时间 |
| `fetched_at` | timestamptz nullable | 最近一次成功抓取时间 |
| `last_attempted_at` | timestamptz | 最近一次抓取尝试时间 |
| `blocks` | jsonb | 完整正文块：`[{ id, kind, text }]`，含标题/引文/段落 |
| `source_type` | `tweet | noteTweet | article` | 来源正文类型 |
| `position` | integer | 主文为 0；回应写入时记录的稳定序号 |
| `fetch_status` | `success | failed` | 最近抓取结果 |
| `last_fetch_error` | text nullable | 仅供提示与管理员排查，不替换成功快照 |

`x_status_id` 的全局唯一约束是去重的最终保障。读取时不依赖 `position` 排序：主文永远第一，其余内容以 `published_at ASC, position ASC` 排序；这样可处理抓取顺序和发文顺序不同的情形。

## 抓取与快照策略

服务端只接受 `x.com`、`twitter.com` 与其移动子域的 status URL，并从路径提取 status ID；无效 URL 在写入前返回 400。Twitter241 读取后沿用并扩展现有提取器：锁定目标 status ID 对应根结果，优先读取 Article `content_state.blocks`，其次读取 `note_tweet` 完整文本，最后读取普通 tweet 的 `full_text`。引用推文只抓取管理员给出的目标 status ID，不会误将被引用内容写成该条回应。

首次成功抓取时持久化正文、身份、时间及块结构。刷新同一来源时先完成抓取和标准化，再在单个数据库写入中替换快照；抓取或解析失败时只更新 `last_attempted_at`、`fetch_status` 与错误信息，绝不清空或覆盖已有成功的 `blocks`、身份和发布时间。新来源首次抓取失败时保留一条失败记录与原始链接，供管理员重试；公共页面会展示可理解的“暂时无法更新，可重试”提示和 X 链接。

## 服务端接口

所有接口共用 URL 解析、Twitter241 提取器、`DiscussionStore` 仓储接口和 Supabase 实现。Vercel 风格的 `api/` 函数与 Vite 开发中间件均调用这些通用处理器，避免开发/生产行为分叉。

### 管理写入接口

- `POST /api/admin/community-discussions`
  - 请求：`{ primaryUrl, title?, description?, slug?, status? }`。
  - 行为：鉴权、验证 URL、抓取完整主来源、推导标题与 slug、创建讨论与主来源快照。标题优先顺序为 Article 标题、`title`、主来源首个非空正文块截断后的短标题。默认创建为 `published`。
  - 响应：讨论摘要、主来源、`detailUrl`。
- `POST /api/admin/community-discussions/:slug/sources`
  - 请求：`{ urls: string[] }`，每次可批量提交多个回应。
  - 行为：鉴权、逐条规范化与抓取。已存在的 `x_status_id` 不新增，响应中标记为 `duplicate`；成功项目立即写入；失败项目保留失败记录或已有快照，响应中标记为 `failed`，不让单条失败回滚其他项目。
- `POST /api/admin/community-discussions/:slug/sources/:statusId/refresh`
  - 行为：鉴权并重试指定来源。成功才替换快照；失败遵循保留旧内容规则。

### 公共读取接口

- `GET /api/community-discussions`：只返回 `published` 讨论的列表卡片数据：标题、主来源身份/头像、服务端生成的简短摘要、回应数、最后收录时间与详情 URL。
- `GET /api/community-discussion?slug={slug}`：只返回公开讨论与其来源快照。来源按主文优先、回应发布时间升序排列，并包含 `fetchStatus`、`fetchedAt` 与 `lastFetchError` 的安全展示字段。

公共读取响应禁止携带数据库凭据、管理 token、Twitter241 响应原文或内部错误堆栈。

## 前端页面与刷新

`/archive/community-discussion` 改为远端列表：每张讨论卡片显示主文章标题、主作者与头像、摘要、回应数量、最新收录时间与“进入讨论”链接。加载和公共接口失败时保留现有页面框架并显示读取状态，不能展示硬编码旧讨论数据。

`/archive/community-discussion/{slug}` 改为单一参数化页面，不再针对 `wtf-is-pearl` 硬编码来源、标题或路由条件。页头使用讨论标题、简介和返回列表链接；第一张大卡片始终是主文；其后按 API 排序渲染回应，保留左右交替、两侧头像、卡内固定高度滚动、作者/账号/原始发布时间与“在 X 查看原文”链接。若某来源最近刷新失败但保有快照，仍显示快照并附小型可重试状态；无快照则显示失败提示和外链。

页面在初次加载、窗口重新获得焦点及 60 秒轮询时重读公共接口。管理员写入完成后，下一次读取即可显示新增内容；不需要构建、发布或由访问者直接触发 Twitter241 请求。

## 现有讨论迁移

删除前端及服务端的 `DISCUSSION_SOURCES` 静态业务清单与固定 `wtf-is-pearl` 分支。保留通用 X 内容提取器，并以一次性的受保护导入调用将目前 `wtf-is-pearl` 主文和现有四条回应写入新模型。迁移完成后，该讨论和新讨论走完全相同的列表、详情、去重、刷新和失败恢复路径。

## 测试与验证

- 单元测试：X URL/status ID 校验、普通 tweet/长推文/Article/引用载荷的完整块提取与标题推导。
- 服务端测试：管理员鉴权、创建讨论、批量回应、全局去重、发布时间排序、失败后保留旧快照、失败新来源可刷新、公共接口只读已发布数据。
- 仓储测试：使用内存 `DiscussionStore` 验证领域逻辑；对 Supabase adapter 测试传入的查询/写入边界，不在测试中使用真实密钥。
- 组件测试：列表卡片字段与动态链接；详情页主文第一、回应左右交替、完整 blocks、失败提示和来源链接。
- 回归验证：全量 Vitest、TypeScript/Vite 生产构建、`git diff --check`，并人工以管理 token 创建一个草稿讨论、添加重复和失败链接、再发布后检查公共页面。

## 部署准备

部署位置确定后，创建 Supabase 项目并执行随代码提供的 schema migration；在部署平台仅配置上述四个服务端变量。只要平台支持同源服务端函数，应用代码保持不变；若平台的函数路由形式不同，只替换薄路由适配层，不替换抓取、领域逻辑、数据模型或 React 页面。
