# Pearl vs Bitcoin Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user has requested direct edits to the existing `D:\pearl web` checkout; do not create a worktree or publish the site.

**Goal:** Add a bilingual Pearl vs Bitcoin comparison subpage with real persisted model series and a navigation link directly after Data Overview.

**Architecture:** Extend the existing prlstats dataset whitelist with nine slow-refresh historical metrics. A focused page reads those series through the existing snapshot API, renders a principal ratio chart and four matched comparison sections, and labels model assumptions and freshness. Existing route and language infrastructure provides navigation.

**Tech Stack:** React, TypeScript, Vitest, existing market worker/Supabase snapshot layer, SVG/CSS.

---

## Task 1: Data contract and collection

**Files:** `server/market/datasets.ts`, `server/market/http.test.ts`, `src/data/runtime.ts`, related tests.

- [ ] Add a failing test that resolves `/api/prlstats/api/series?m=energy_vs_btc` and another that checks all nine new IDs are scheduled at the slow interval.
- [ ] Run `npm test -- --run server/market/http.test.ts`; confirm the new route fails as an unrecognized dataset.
- [ ] Add the nine IDs as validated one-series datasets at 15-minute intervals, keeping all existing metric IDs and URLs unchanged.
- [ ] Run the focused test and `npm run build:server`; confirm pass.

## Task 2: Route and navigation

**Files:** `src/App.tsx`, `src/SiteHeader.tsx`, `src/App.test.tsx`, `src/i18n/catalogue.ts`.

- [ ] Add a failing rendering test for `/pearl-vs-bitcoin` and `/en/pearl-vs-bitcoin`, plus a test that the nav link immediately follows Data Overview.
- [ ] Run `npm test -- --run src/App.test.tsx`; confirm missing route/nav fails.
- [ ] Add the focused page import, route, nav item, and bilingual title copy without changing existing route behavior.
- [ ] Run the focused test; confirm pass.

## Task 3: Comparison logic and page

**Files:** `src/PearlVsBitcoinPage.tsx`, `src/PearlVsBitcoinPage.test.tsx`, `src/styles/pearl-vs-bitcoin.css`, `src/main.tsx`, `src/i18n/catalogue.ts`.

- [ ] Add failing pure-function tests for 30D/90D/ALL filtering, time-bucket downsampling, empty series, and latest-observation date handling. Add a rendering test for model caveat and the five comparison sections.
- [ ] Run `npm test -- --run src/PearlVsBitcoinPage.test.tsx`; confirm the page/logic is missing.
- [ ] Implement finite-point filtering and bounded downsampling, then build the ratio chart with accessible range controls and hover/focus details.
- [ ] Implement paired power, machines, capital, and issuance charts with distinct scales, latest-value cards, per-series timestamps, loading/empty states, source links, and responsive styling.
- [ ] Run focused tests; confirm pass.

## Task 4: Final verification

**Files:** all task-owned files.

- [ ] Run `npm test -- --run` and `npm run build` after the last edit.
- [ ] Inspect `git diff --check`, stage only task-owned files, and verify no unrelated dirty changes or secrets are staged.
- [ ] Check the local page in a browser if the available preview tooling supports it; otherwise report the browser-verification limit.
- [ ] Report local completion and clearly state that GitHub upload and server deployment were not performed.
