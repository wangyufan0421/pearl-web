# Pearl Core Mechanism Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `/archive/core-mechanism` Chinese research-guide page and connect it to the Pearl archive navigation.

**Architecture:** Keep the page content isolated in `CoreMechanismPage.tsx`; use declarative arrays for repeated flow, evidence, and conclusion content. Extend the path switch in `App.tsx`, update the archive submenu route, and load a dedicated stylesheet that preserves the existing pearl-white theme while giving this page an editorial, field-guide reading rhythm.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS.

---

### Task 1: Define the route and menu contract

**Files:**
- Modify: `src/ArchiveNavigation.test.tsx`
- Modify: `src/ArchiveNavigation.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing route and menu tests**

```tsx
expect(screen.getByRole("link", { name: "Pearl 核心机制" }).getAttribute("href")).toBe("/archive/core-mechanism");

window.history.replaceState({}, "", "/archive/core-mechanism");
render(<App />);
expect(screen.getByRole("heading", { name: "核心机制" })).not.toBeNull();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: the menu has an anchor URL and the route falls back to the archive homepage, so the new assertions fail.

- [ ] **Step 3: Route the new page and update the first archive menu URL**

```tsx
import CoreMechanismPage from "./CoreMechanismPage";

if (pathname === "/archive/core-mechanism") return <CoreMechanismPage />;
```

```tsx
["Pearl 核心机制", "/archive/core-mechanism"]
```

- [ ] **Step 4: Re-run the focused route tests**

Run: `npm test -- --run src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: PASS once the page component exists.

### Task 2: Build the standalone mechanism research guide

**Files:**
- Create: `src/CoreMechanismPage.tsx`
- Create: `src/CoreMechanismPage.test.tsx`
- Create: `src/styles/core-mechanism.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write the failing page-content test**

```tsx
render(<CoreMechanismPage />);
expect(screen.getByRole("heading", { name: "核心机制" })).not.toBeNull();
expect(screen.getByText("同一次计算，两头办事")).not.toBeNull();
expect(screen.getByRole("heading", { name: "算力实际怎么走" })).not.toBeNull();
expect(screen.getByText("请求进来")).not.toBeNull();
expect(screen.getByText("Pearl-GEMM：为什么机制讨论会转向浮点")).not.toBeNull();
expect(screen.getByText("用四句话收束「核心机制」")).not.toBeNull();
```

- [ ] **Step 2: Run the page test to verify it fails**

Run: `npm test -- --run src/CoreMechanismPage.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the page in six research-guide sections**

```tsx
<section className="mechanism-hero">...</section>
<section id="mechanism-flow">...</section>
<section id="pearl-gemm">...</section>
<section id="mechanism-economics">...</section>
<section id="mechanism-engineering">...</section>
<section id="mechanism-summary">...</section>
```

The page must include: the inference/mining distinction, the four-stage duplex flow, integer-to-floating-point transition with evidence labels, cost-to-customer flow, engineering notes, and the supplied four-point conclusion. Use labels `机制说明`, `团队表述`, and `待验证` to avoid presenting reported claims as independently measured facts.

- [ ] **Step 4: Add the page stylesheet and import it**

```ts
import "./styles/core-mechanism.css";
```

Use the shared topbar and pearl background; build a full-width editorial hero, split comparison cards, numbered flow rows, a cost-flow diagram, and responsive one-column mobile rules.

- [ ] **Step 5: Re-run page tests**

Run: `npm test -- --run src/CoreMechanismPage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: PASS.

### Task 3: Verify the integrated page

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new page route**

```md
- `/archive/core-mechanism`：Pearl 核心机制研究档案。
```

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: all test files pass.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite complete without errors.

