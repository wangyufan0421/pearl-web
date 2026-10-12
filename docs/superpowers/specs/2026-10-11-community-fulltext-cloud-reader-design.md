# 社区讨论全文云端阅读器设计

## 目标

将 `WTF Is Pearl?` 讨论页从 X 官方嵌入卡片改为云端服务端抓取的完整原文阅读器。页面保留左右对话式布局与“在 X 查看原文”链接，但文章与长帖正文直接在站内可滚动阅读。

## 边界

- 前端绝不持有 Twitter241/RapidAPI 密钥。
- 服务端从 `TWITTER241_API_KEY` 环境变量读取密钥并请求 Twitter241。
- 本期只支持 `wtf-is-pearl` 的 blocmates Article 与 Tulip King 长帖；不做管理后台、数据库或定时任务。
- 正文实时从云端接口读取；原帖删除、私密或上游接口不可用时，页面显示错误状态并保留 X 来源链接。

## 数据流

浏览器请求 `/api/community-discussion?discussion=wtf-is-pearl`。Vercel 函数与 Vite 开发中间件复用同一个服务端模块。模块根据两个固定 Tweet ID 请求 Twitter241，锁定与目标 ID 相同的根 Tweet，读取 Article 的 `content_state.blocks` 或长帖的 `note_tweet_results.result.text`，再返回标准化 JSON。

## 页面行为

- 初始加载显示“正在读取完整原文”。
- 成功后，左侧呈现 Article 全文段落；右侧呈现 Tulip 全文（包括原先 Show more 之后的文本）。
- 两个正文框均固定高度、纵向滚动；卡片下方始终保留“在 X 查看原文”。
- 失败时，单张卡片显示可理解的失败提示与来源外链，不退回会截断正文的官方 iframe。

## 验证

为提取函数提供模拟 Twitter241 载荷：验证 Article 块、长帖全文与错误情形。组件测试验证成功时渲染完整段落、加载状态及失败链接。生产构建与全部 Vitest 测试必须通过。
