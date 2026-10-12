# Pearl 首页与项目档案入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将根路径改造成「Pearl 是什么」档案式导读首页，并把现有实时数据总览迁移到 `/overview`。

**Architecture:** 新建独立 `ArchiveHomePage` 承载首页内容与页内探索卡片；当前 `HomePage` 保留为实时看板，只改名为 `OverviewPage` 并由 `/overview` 渲染。现有数据缓存、链上和 PRL 数据页面不改变数据逻辑。

**Tech Stack:** React、TypeScript、Vite、Vitest、Testing Library、现有 CSS 变量和字体。

---

## 文件结构

- Create: `src/ArchiveHomePage.tsx` — 首页首屏、五个正文模块与关联阅读。
- Create: `src/ArchiveHomePage.test.tsx` — 首屏定义、链接和章节锚点测试。
- Create: `src/styles/archive.css` — 档案首页的双栏、流程、标签和响应式布局。
- Modify: `src/App.tsx` — 新增根路径和 `/overview` 路由分发。
- Modify: `src/ChainPage.tsx`、`src/ValuationPage.tsx` — 统一顶部导航。
- Modify: `src/main.tsx`、`src/App.test.tsx`、`README.md` — 样式、回归测试、文档。

### Task 1: 用失败测试定义档案首页

**Files:**
- Create: `src/ArchiveHomePage.test.tsx`
- Test: `src/ArchiveHomePage.test.tsx`

- [ ] **Step 1: 写入首页结构测试**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ArchiveHomePage from "./ArchiveHomePage";

describe("ArchiveHomePage", () => {
  it("opens with Pearl's definition and the data overview entry", () => {
    render(<ArchiveHomePage />);
    expect(screen.getByRole("heading", { name: "Pearl 是什么" })).not.toBeNull();
    expect(screen.getByText(/PoW 区块链/)).not.toBeNull();
    expect(screen.getByRole("link", { name: /查看数据总览/ }).getAttribute("href")).toBe("/overview");
  });

  it("links its four exploration cards to content anchors", () => {
    render(<ArchiveHomePage />);
    expect(screen.getByRole("link", { name: /Duplex Work/ }).getAttribute("href")).toBe("#duplex-work");
    expect(screen.getByRole("link", { name: /挖矿如何嵌入计算/ }).getAttribute("href")).toBe("#mining-flow");
    expect(screen.getByRole("link", { name: /Pearl-GEMM/ }).getAttribute("href")).toBe("#pearl-gemm");
    expect(screen.getByRole("link", { name: /两套里程碑/ }).getAttribute("href")).toBe("#milestones");
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- --run src/ArchiveHomePage.test.tsx`

Expected: FAIL，无法解析 `./ArchiveHomePage`。

### Task 2: 实现首页档案内容

**Files:**
- Create: `src/ArchiveHomePage.tsx`
- Test: `src/ArchiveHomePage.test.tsx`

- [ ] **Step 1: 创建顶部导航与左文右卡首屏**

实现根元素 `<main className="site-shell archive-page">`。导航只包含 `数据总览`（`/overview`）、`链上`（`/chain`）、`数据`（`/valuation`）和 `项目档案`（`/archive`），不显示“Pearl 是什么”。

首屏左侧使用：档案编号 `01 / START HERE`、标题「Pearl 是什么」、一句话定义“Pearl 是一条 PoW 区块链，旨在让 AI 计算负载参与挖取原生代币 PRL。”，以及“开始阅读”与“查看数据总览”两个链接。

首屏右侧建立下列四张链接卡：

```ts
const topics = [
  ["01", "Duplex Work", "一份 AI 计算负载，如何服务两种目标？", "#duplex-work"],
  ["02", "挖矿如何嵌入计算", "应用结果与出块证明，在哪一步分开？", "#mining-flow"],
  ["03", "Pearl-GEMM", "从整数方案到浮点方案，改变了什么？", "#pearl-gemm"],
  ["04", "两套里程碑", "挖矿与 AI 算力支付，分别走到哪里？", "#milestones"],
] as const;
```

- [ ] **Step 2: 完整呈现已提供的第一份档案**

按以下 `id` 建立正文模块：`introduction`、`duplex-work`、`mining-flow`、`pearl-gemm`、`milestones`。保持用户提供的结构：核心定位、Duplex Work、准备/计算/检查/返回、整数到 Pearl-GEMM、算力→PRL 与 PRL→算力、总结。

将“准备 → 计算 → 检查 → 返回”做成四格流程，而不是代码块。性能 0–3%、数周内时间表、主网状态和完整推理证明等相关段落分别附 `<span className="evidence-tag">`，显示 `公开机制`、`团队表述` 或 `待验证`。不把团队性能宣称写成独立验证结果。

页尾提供 `/overview` 的“进入数据总览”和 `/chain` 的“查看链上实况”链接。

- [ ] **Step 3: 验证组件测试**

Run: `npm test -- --run src/ArchiveHomePage.test.tsx`

Expected: PASS，2 tests passed。

- [ ] **Step 4: 提交组件与测试**

```bash
git add src/ArchiveHomePage.tsx src/ArchiveHomePage.test.tsx
git commit -m "feat: add Pearl archive home page"
```

### Task 3: 添加珍珠白档案样式

**Files:**
- Create: `src/styles/archive.css`
- Modify: `src/main.tsx`
- Test: `src/ArchiveHomePage.test.tsx`

- [ ] **Step 1: 实现桌面与移动排版**

在 `archive.css` 中将 `.archive-hero` 设置为最大 1220px 的双栏网格，左栏比例 1.05、右栏 0.95；标题使用 `var(--font-display)` 和 `clamp(58px, 8vw, 118px)`。主题卡片以两列网格、18px 圆角、半透明珍珠白底色展示，悬停上移 4px。

正文宽度限制为 720px；四格流程在宽屏横排。三种证据标签分别用蓝灰、金色、玫瑰色描边。小于 800px 时首屏与流程变为单列；小于 460px 时主题卡片改为单列。

- [ ] **Step 2: 引入样式**

在 `src/main.tsx` 增加：

```ts
import "./styles/archive.css";
```

- [ ] **Step 3: 验证样式不破坏语义测试**

Run: `npm test -- --run src/ArchiveHomePage.test.tsx`

Expected: PASS，2 tests passed。

- [ ] **Step 4: 提交样式**

```bash
git add src/styles/archive.css src/main.tsx
git commit -m "style: add archive home layout"
```

### Task 4: 迁移数据总览到 /overview 并更新导航

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ChainPage.tsx`
- Modify: `src/ValuationPage.tsx`
- Modify: `src/App.test.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: 将现有首页看板测试改为 /overview**

在测试渲染前添加：

```ts
window.history.replaceState({}, "", "/overview");
```

新增根路径测试：

```tsx
it("renders the Pearl introduction archive at the root path", () => {
  window.history.replaceState({}, "", "/");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Pearl 是什么" })).not.toBeNull();
  expect(screen.queryByText("Lighter · PRL 永续")).toBeNull();
});
```

- [ ] **Step 2: 运行路由测试，确认根路径测试失败**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL，根路径仍会出现实时 K 线。

- [ ] **Step 3: 调整路由和导航**

在 `App.tsx` 导入 `ArchiveHomePage`，将当前 `HomePage` 更名为 `OverviewPage`，并按以下顺序分发：

```tsx
if (pathname === "/overview") return <OverviewPage />;
if (pathname === "/chain") return <ChainPage />;
if (pathname === "/valuation") return <ValuationPage />;
return <ArchiveHomePage />;
```

保留 `startDataRefresh()`，以便无论从哪个页面进入都会预取数据。将 `OverviewPage`、`ChainPage`、`ValuationPage` 的顶部导航更改为“数据总览 / 链上 / 数据 / 项目档案”，分别链接 `/overview`、`/chain`、`/valuation`、`/archive`，且当前页保留 `aria-current="page"`。`/archive` 在索引页完成前先渲染 `ArchiveHomePage`，避免死链接。

- [ ] **Step 4: 验证路由测试**

Run: `npm test -- --run src/App.test.tsx src/ArchiveHomePage.test.tsx`

Expected: PASS，根路径、数据总览与现有两个数据子页均通过。

- [ ] **Step 5: 提交路由改动**

```bash
git add src/App.tsx src/ChainPage.tsx src/ValuationPage.tsx src/App.test.tsx
git commit -m "feat: move dashboard to overview route"
```

### Task 5: 更新说明并全量验证

**Files:**
- Modify: `README.md`
- Test: 全部 Vitest 测试与 Vite 生产构建

- [ ] **Step 1: 更新 README**

用以下描述替换首页说明：

```md
面向 Pearl 中文社区的双层策展站：根路径是「Pearl 是什么」项目档案导读；`/overview` 提供实时网络与市场数据，`/chain` 提供完整链上实况，`/valuation` 提供 PRL 数据汇总。
```

并在主要文件中加入 `src/ArchiveHomePage.tsx`、`src/styles/archive.css`，注明 `/overview` 是原实时数据首页的新地址。

- [ ] **Step 2: 运行全量测试**

Run: `npm test -- --run`

Expected: PASS，所有测试通过。

- [ ] **Step 3: 构建生产版本**

Run: `npm run build`

Expected: PASS，输出 `✓ built`。

- [ ] **Step 4: 人工核对本地预览**

打开 `http://127.0.0.1:5173/`，确认左侧定义、右侧四张探索卡和数据总览链接。打开 `http://127.0.0.1:5173/overview`，确认 Lighter K 线与原有数据模块完整可用。

- [ ] **Step 5: 提交文档**

```bash
git add README.md
git commit -m "docs: document archive and overview routes"
```

