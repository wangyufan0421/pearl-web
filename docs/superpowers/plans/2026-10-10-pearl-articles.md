# Pearl相关文章页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flat, card-based Pearl research archive at `/archive/articles`.

**Architecture:** Keep the article catalogue as a local typed array inside a focused React page component. Reuse the shared archive navigation and existing site shell, with a dedicated stylesheet for the research-card layout. Route selection remains centralized in `App.tsx`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Define user-visible routing expectations

**Files:**
- Modify: `src/ArchiveNavigation.test.tsx`
- Modify: `src/App.test.tsx`
- Create: `src/ArticlesPage.test.tsx`

- [ ] **Step 1: Write failing navigation and page tests**

```tsx
expect(screen.getByRole("link", { name: "Pearl相关文章" }).getAttribute("href")).toBe("/archive/articles");

window.history.replaceState({}, "", "/archive/articles");
render(<App />);
expect(screen.getByRole("heading", { name: "Pearl相关文章" })).not.toBeNull();
```

Also assert the dedicated page renders nine article cards, links the Komargodski and Weinstein paper to `https://arxiv.org/abs/2504.09971`, and links the Pearl INT whitepaper card to `/archive/whitepaper`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/ArticlesPage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: failure because the component and route do not exist and the old menu label remains.

### Task 2: Build the research-card page and route it

**Files:**
- Create: `src/ArticlesPage.tsx`
- Modify: `src/ArchiveNavigation.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Implement a typed nine-item article array**

Each item includes a title, authors or organization, tags, Chinese abstract, source URL, and whether its source is internal. Include Hawkeye once only, with tags that communicate both validation and audit relevance.

- [ ] **Step 2: Render the shared header, hero, and cards**

Use semantic `article` elements carrying `data-testid="article-card"`. Render external title and source links with `target="_blank"` and `rel="noreferrer"`; render the local INT whitepaper card as a normal same-window route.

- [ ] **Step 3: Connect navigation and route**

Replace the existing `Pearl相关论文` entry with `PEARL相关文章` and `/archive/articles`. Import and select `ArticlesPage` in `App.tsx`; import its stylesheet from `main.tsx`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/ArticlesPage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: all focused tests pass.

### Task 3: Style and document the archive

**Files:**
- Create: `src/styles/articles.css`
- Modify: `README.md`

- [ ] **Step 1: Add responsive pearl-style card styling**

Use a three-column CSS grid on wide screens and collapse to two then one column. Keep the visual hierarchy flat: tags, author line, title, summary, source action; do not add visible category sections.

- [ ] **Step 2: Add the route to the README**

List `/archive/articles` as the Pearl-related article archive and list `ArticlesPage.tsx` in the primary file map.

- [ ] **Step 3: Run full verification**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite emits a production build.
