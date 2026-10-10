# Pearl Whitepaper Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone Pearl whitepaper archive page with an embedded, user-provided PDF.

**Architecture:** Keep page markup and document metadata in `WhitepaperPage.tsx`; keep visual behavior in a dedicated stylesheet. Serve the supplied PDF from Vite's `public` directory so the in-page reader can use a deployable relative URL, then route the archive menu and application path to the page.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS, browser PDF reader.

---

### Task 1: Establish archive navigation and route contracts

**Files:**
- Modify: `src/ArchiveNavigation.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/ArchiveNavigation.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the failing menu expectation**

```tsx
expect(screen.getByRole("link", { name: "Pearl白皮书" }).getAttribute("href")).toBe("/archive/whitepaper");
```

- [ ] **Step 2: Add the failing router expectation**

```tsx
window.history.replaceState({}, "", "/archive/whitepaper");
render(<App />);
expect(screen.getByRole("heading", { name: "Pearl 白皮书" })).not.toBeNull();
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `npm test -- --run src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: `Pearl白皮书` still targets the archive hash and the page route falls back to the archive home.

- [ ] **Step 4: Route the menu and page**

```tsx
["Pearl白皮书", "/archive/whitepaper"]
```

```tsx
import WhitepaperPage from "./WhitepaperPage";

if (pathname === "/archive/whitepaper") return <WhitepaperPage />;
```

### Task 2: Build the user-provided PDF reader page

**Files:**
- Create: `src/WhitepaperPage.tsx`
- Create: `src/WhitepaperPage.test.tsx`
- Create: `src/styles/whitepaper.css`
- Modify: `src/main.tsx`
- Create: `public/documents/pearl-whitepaper.pdf`

- [ ] **Step 1: Create a failing page-content test**

```tsx
render(<WhitepaperPage />);
expect(screen.getByRole("heading", { name: "Pearl 白皮书" })).not.toBeNull();
expect(screen.getByTitle("Pearl 白皮书原文 PDF")).not.toBeNull();
expect(screen.getByRole("link", { name: "在新窗口打开原文" }).getAttribute("href")).toBe("/documents/pearl-whitepaper.pdf");
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --run src/WhitepaperPage.test.tsx`

Expected: import resolution fails because the page does not exist.

- [ ] **Step 3: Copy the supplied PDF into the public document path**

Run:

```powershell
New-Item -ItemType Directory -Force "public/documents"
Copy-Item -LiteralPath "C:\Users\admin\Desktop\pearl白皮书 (2).pdf" -Destination "public/documents/pearl-whitepaper.pdf"
```

Expected: static file exists at `public/documents/pearl-whitepaper.pdf` and can be served as `/documents/pearl-whitepaper.pdf`.

- [ ] **Step 4: Implement page and stylesheet**

Render an editorial hero, metadata panel, narrow table-of-contents rail, `iframe` with title `Pearl 白皮书原文 PDF`, and a visible fallback link. Import `whitepaper.css` from `main.tsx`. Use a single-column arrangement below 850px.

- [ ] **Step 5: Run focused tests to confirm green**

Run: `npm test -- --run src/WhitepaperPage.test.tsx src/ArchiveNavigation.test.tsx src/App.test.tsx`

Expected: all selected tests pass.

### Task 3: Document and verify the integration

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the whitepaper route to the route list**

```md
- `/archive/whitepaper`：原始 Pearl 白皮书的站内阅读页。
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`

Expected: all test files pass.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite complete without errors.

