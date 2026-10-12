# Pearl人物与关系页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evidence-bound People & Relationships archive at `/archive/people`.

**Architecture:** A focused React page will contain typed local arrays for public people, anonymous roles, public connection records and unfilled speculation categories. Existing archive navigation and the central App route switch will remain the shared integration points; page-specific CSS will keep evidence, ambiguity and speculation visually separated.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Lock down route and content boundaries with tests

**Files:**
- Create: `src/PeoplePage.test.tsx`
- Modify: `src/ArchiveNavigation.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
expect(screen.getByRole("link", { name: "Pearl人物与关系" }).getAttribute("href")).toBe("/archive/people");
expect(screen.getByRole("heading", { name: "Pearl人物与关系" })).not.toBeNull();
expect(screen.getByRole("heading", { name: "匿名工程能力地图" })).not.toBeNull();
expect(screen.getByText("证明到哪")).not.toBeNull();
expect(screen.getByText("证不到哪")).not.toBeNull();
```

- [ ] **Step 2: Run tests and confirm the route/component are absent**

Run: `npm test -- --run src/PeoplePage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: the new component cannot resolve and route/menu assertions fail.

### Task 2: Implement evidence-map content and route integration

**Files:**
- Create: `src/PeoplePage.tsx`
- Modify: `src/ArchiveNavigation.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create public, anonymous and connection datasets**

Add exactly four public-profile cards, fifteen anonymous role labels, five public connection records, and five speculation categories. Each public connection record must have separate `proves` and `doesNotProve` strings.

- [ ] **Step 2: Render semantic evidence-map sections**

Use headings for each collection and `article` cards for people and connection records. Use a distinct speculation section that says it is historical editorial inference and carries no concrete candidate or percentage.

- [ ] **Step 3: Wire navigation and routing**

Change the existing relationship menu entry to `/archive/people`, import `PeoplePage` in `App.tsx`, select it before the archive fallback, and import the new stylesheet.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/PeoplePage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: all focused tests pass.

### Task 3: Add responsive styling and document the page

**Files:**
- Create: `src/styles/people.css`
- Modify: `README.md`

- [ ] **Step 1: Style facts, role map, evidence records and speculation separately**

Use the existing pearl-white visual system. Facts use pale cards, role labels use compact chips, and speculation has a subdued rose-tinted panel. Maintain a responsive one-column view on small screens.

- [ ] **Step 2: Update route documentation**

Add `/archive/people` to the route list and `PeoplePage.tsx` to the primary file map.

- [ ] **Step 3: Verify the full app**

Run: `npm test -- --run && npm run build`

Expected: all tests and production build pass.
