# Pearl Chain Subpage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/chain` route that presents public prlstats Pools, Activity, TX Size, and Holders data with source-aware wording and isolated error states.

**Architecture:** Add a focused `chain` data adapter that validates and normalizes the six prlstats endpoint payloads. `App` owns browser-path state and renders a new `ChainPage` only at `/chain`; the page initiates each module independently and leaves the existing homepage intact. Plain React/SVG/CSS components render compact charts, tables, and summary cards without a new routing or chart dependency.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing Vite `/api/prlstats` proxy.

---

### Task 1: Normalize public Chain API payloads

**Files:**
- Create: `src/data/chain.ts`
- Create: `src/data/chain.test.ts`

- [ ] **Step 1: Write failing parsing tests**

```ts
it("reads pools, holder summaries, and activity points from public payloads", async () => {
  const result = await getChainData("pools", fetcher);
  expect(result.data[0]).toMatchObject({ name: "Kryptex Pool", share24h: 53.3 });
});
```

- [ ] **Step 2: Run the data tests and verify the missing-module failure**

Run: `npm test -- --run src/data/chain.test.ts`

Expected: FAIL because `src/data/chain.ts` does not exist.

- [ ] **Step 3: Add typed adapters with per-endpoint fallbacks**

```ts
export async function getPools(fetcher = fetch): Promise<DataResult<Pool[]>> {
  return request("/api/prlstats/api/pools", parsePools, [], "暂时无法读取矿池数据。", fetcher);
}
```

Implement the same `DataResult` contract for pools/history, activity/coinage, TX sizes, holders/mined, and use the existing proxy prefix for every prlstats request.

- [ ] **Step 4: Re-run the data tests**

Run: `npm test -- --run src/data/chain.test.ts`

Expected: PASS.

### Task 2: Add the Chain page components

**Files:**
- Create: `src/ChainPage.tsx`
- Create: `src/ChainPage.test.tsx`
- Create: `src/styles/chain.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing page tests**

```tsx
render(<ChainPage />);
expect(screen.getByRole("heading", { name: "链上数据" })).not.toBeNull();
expect(screen.getByRole("heading", { name: "矿池 Pools" })).not.toBeNull();
expect(screen.getByRole("heading", { name: "持币地址 Holders" })).not.toBeNull();
```

- [ ] **Step 2: Run the page tests**

Run: `npm test -- --run src/ChainPage.test.tsx`

Expected: FAIL because `ChainPage` does not exist.

- [ ] **Step 3: Implement independently loaded page modules**

```tsx
<ChainModule title="矿池 Pools" source="prlstats 链上归因">
  <PoolTable pools={pools.data} />
</ChainModule>
```

Render network overview, Pools, Activity, TX Size, and Holders. Each module begins its own request in a `useEffect`; a request failure renders its notice in that module only. Label pool attribution as `Solo / unknown` when unrecognised and describe the limitations of Top 100 addresses and first-spend movement.

- [ ] **Step 4: Add pearl-white responsive styles and import them**

```ts
import "./styles/chain.css";
```

Use an editorial single-column reading rhythm, CSS grids for cards, responsive overflow for tables, and lightweight SVG line/bar charts.

- [ ] **Step 5: Re-run the page tests**

Run: `npm test -- --run src/ChainPage.test.tsx`

Expected: PASS.

### Task 3: Route navigation between homepage and Chain page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the route behaviour test**

```tsx
window.history.pushState({}, "", "/chain");
render(<App />);
expect(screen.getByRole("heading", { name: "链上数据" })).not.toBeNull();
```

- [ ] **Step 2: Run the route test**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because `App` always renders the homepage.

- [ ] **Step 3: Implement History API route state**

```tsx
const [pathname, setPathname] = useState(window.location.pathname);
useEffect(() => {
  const sync = () => setPathname(window.location.pathname);
  window.addEventListener("popstate", sync);
  return () => window.removeEventListener("popstate", sync);
}, []);
```

Render `ChainPage` for `/chain`. Update the top navigation so “链上” links to `/chain`; keep all remaining homepage navigation links as anchors to `/` sections.

- [ ] **Step 4: Re-run route and homepage tests**

Run: `npm test -- --run src/App.test.tsx src/ChainPage.test.tsx`

Expected: PASS.

### Task 4: Verify the integrated build

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the Chain data sources and local route**

```md
## 链上子页

`/chain` 读取 prlstats 的公开 Pools、Activity、TX Size 和 Holders API；矿池归因与地址持仓均保留来源边界说明。
```

- [ ] **Step 2: Run complete verification**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite emits the production bundle.

- [ ] **Step 3: Verify local navigation visually**

Open `http://127.0.0.1:5173/chain`, verify every module heading appears, then use the brand link to return to `/`.
