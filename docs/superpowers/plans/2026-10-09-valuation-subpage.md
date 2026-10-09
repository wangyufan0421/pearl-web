# Pearl 估值与价格子页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建由 prlstats 驱动的 `/valuation` 子页，以价格、估值、供给与交易三层展示 Pearl 的详细估值信息。

**Architecture:** 新增 `ValuationPage` 和局部样式文件，复用 `getMetricSeries`、`getNetworkSnapshot` 及既有的 `DataResult` 降级约定。页面将通过 `App` 的轻量路由分发，所有页面的估值导航统一指向 `/valuation`；价格曲线独立于首页 Lighter K 线，只使用 prlstats 的 `price` 序列。

**Tech Stack:** React、TypeScript、Vite、Vitest、Testing Library、现有 prlstats Vite 代理。

**Status:** 已在 2026-10-09 完成；23 项测试与生产构建均通过，并在本地 `/valuation` 验证了实时数据加载。

---

## File Structure

- Create: `src/ValuationPage.tsx` — 页面、指标编排与价格曲线交互。
- Create: `src/ValuationPage.test.tsx` — 路由页结构、公式口径、价格图悬停行为。
- Create: `src/styles/valuation.css` — 子页独有布局、价格图与响应式规则。
- Modify: `src/App.tsx` — 注册 `/valuation` 路由与导航链接。
- Modify: `src/App.test.tsx` — 覆盖顶部「估值」的子页路由。
- Modify: `src/styles/app.css` — 引入或保留共享样式的最小改动。
- Modify: `README.md` — 说明估值页入口和所读的 prlstats 指标。

### Task 1: 建立页面行为测试（RED）

**Files:**
- Create: `src/ValuationPage.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: 写入估值页与路由的失败测试**

```tsx
it("renders the valuation subpage at the /valuation path", () => {
  window.history.replaceState({}, "", "/valuation");
  render(<App />);
  expect(screen.getByRole("heading", { name: "估值与价格" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "价格走势" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "估值尺度" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "供给与交易环境" })).not.toBeNull();
  expect(screen.queryByText("Lighter · PRL 永续")).toBeNull();
});
```

- [ ] **Step 2: 运行测试，确认因缺少页面与路由而失败**

Run: `npm test -- --run src/App.test.tsx src/ValuationPage.test.tsx`

Expected: FAIL，提示 `ValuationPage` 或 `/valuation` 页面尚未实现。

- [ ] **Step 3: 增加价格图提示交互的失败测试**

```tsx
render(<PriceTrend points={[
  { timestamp: new Date("2026-10-08T00:00:00Z"), value: 1.2 },
  { timestamp: new Date("2026-10-09T00:00:00Z"), value: 1.37 },
]} />);
fireEvent.mouseEnter(screen.getByRole("button", { name: /10\/9.*1\.37/ }));
expect(screen.getByTestId("price-trend-tooltip").textContent).toContain("$1.37");
```

- [ ] **Step 4: 运行测试，确认提示组件尚不存在而失败**

Run: `npm test -- --run src/ValuationPage.test.tsx`

Expected: FAIL，提示 `PriceTrend` 尚未导出。

### Task 2: 实现 prlstats 价格、估值与供给交易页面（GREEN）

**Files:**
- Create: `src/ValuationPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现仅依赖 prlstats 价格序列的可访问折线图**

```tsx
export function PriceTrend({ points }: { points: MetricPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const recent = points.slice(-180);
  return <div className="valuation-price-chart" aria-label="PRL 参考价格走势">
    {recent.map((point, index) => <button
      aria-label={`${formatDate(point.timestamp)} ${formatUsd(point.value)}`}
      onMouseEnter={() => setHoveredIndex(index)}
      onFocus={() => setHoveredIndex(index)}
    />)}
    {hoveredIndex !== null ? <span data-testid="price-trend-tooltip">{formatUsd(recent[hoveredIndex].value)}</span> : null}
  </div>;
}
```

- [ ] **Step 2: 实现三层数据读取和透明计算**

```tsx
const ids = ["price", "prl_btc", "volume", "supply", "mcap_vs_btc", "fdv_vs_btc", "inflation", "miner_revenue"] as const;
const latest = (id: ValuationMetricId) => metrics[id]?.data.points.at(-1)?.value;
const marketCap = price === undefined || supply === undefined ? undefined : price * supply;
const fdv = price === undefined ? undefined : price * 2_100_000_000;
```

- [ ] **Step 3: 为空或不可用的交易指标提供明确占位卡片**

```tsx
<article className="valuation-unavailable-card">
  <p>永续未平仓量</p>
  <strong>暂未提供</strong>
  <span>当前公开序列未返回可用数据。</span>
</article>
```

- [ ] **Step 4: 注册路由与统一导航目标**

```tsx
return pathname === "/chain"
  ? <ChainPage />
  : pathname === "/valuation"
    ? <ValuationPage />
    : <HomePage />;
```

- [ ] **Step 5: 运行针对性测试，确认全部转绿**

Run: `npm test -- --run src/App.test.tsx src/ValuationPage.test.tsx`

Expected: PASS。

### Task 3: 完成视觉系统与响应式行为

**Files:**
- Create: `src/styles/valuation.css`
- Modify: `src/ValuationPage.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: 加入模块标题、卡片矩阵与珍珠白半透明面板样式**

```css
.valuation-page { min-height:100vh; padding-bottom:72px; }
.valuation-module { width:min(1180px, calc(100% - 48px)); margin:0 auto; padding:76px 0; }
.valuation-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
.valuation-panel { border:1px solid var(--line); border-radius:22px; background:rgba(255,254,250,.73); box-shadow:var(--shadow); }
```

- [ ] **Step 2: 为价格图加入趋势线、可见焦点与不遮挡提示框**

```css
.price-point:focus-visible { outline:2px solid var(--rose); outline-offset:3px; }
.price-trend-tooltip { pointer-events:none; font-family:var(--font-mono); }
```

- [ ] **Step 3: 加入移动端单列规则并复跑页面测试**

Run: `npm test -- --run src/App.test.tsx src/ValuationPage.test.tsx`

Expected: PASS。

### Task 4: 验证数据边界、构建与文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 的子页入口与 prlstats 指标清单**

```md
- `/valuation`：使用 `price`、`prl_btc`、`volume`、`supply`、`mcap_vs_btc`、`fdv_vs_btc`、`inflation` 与 `miner_revenue` 展示估值页。
```

- [ ] **Step 2: 运行所有测试**

Run: `npm test -- --run`

Expected: PASS，所有历史测试及新增估值页测试通过。

- [ ] **Step 3: 执行生产构建**

Run: `npm run build`

Expected: PASS，TypeScript 检查和 Vite 构建成功。

- [ ] **Step 4: 在本地 `/valuation` 验证导航、图表提示和空数据状态**

Run: 打开 `http://127.0.0.1:5173/valuation`，确认顶部导航、价格曲线和三层模块可见。
