# Pearl vs Bitcoin Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user has requested direct edits to the existing `D:\pearl web` checkout; do not create a worktree or publish the site.

**Goal:** Add a bilingual Pearl vs Bitcoin comparison subpage with real persisted model series and a navigation link directly after Data Overview.

**Architecture:** Extend the existing prlstats dataset whitelist with nine slow-refresh historical metrics. A focused page reads those series through the existing snapshot API, renders a principal ratio chart and four matched comparison sections, and labels model assumptions and freshness. Existing route and language infrastructure provides navigation.

**Tech Stack:** React, TypeScript, Vitest, existing market worker/Supabase snapshot layer, SVG/CSS.

---

## Task 1: Data contract and collection

**Files:** `server/market/datasets.ts`, `server/market/http.test.ts`, `src/data/runtime.ts`, related tests.

- [x] Add a failing test that resolves `/api/prlstats/api/series?m=energy_vs_btc` and another that checks all nine new IDs are scheduled at the slow interval.
- [x] Run `npm test -- --run server/market/http.test.ts`; confirm the new route fails as an unrecognized dataset.
- [x] Add the nine IDs as validated one-series datasets at 15-minute intervals, keeping all existing metric IDs and URLs unchanged.
- [x] Run the focused test and `npm run build:server`; confirm pass.

## Task 2: Route and navigation

**Files:** `src/App.tsx`, `src/SiteHeader.tsx`, `src/App.test.tsx`, `src/i18n/catalogue.ts`.

- [x] Add a failing rendering test for `/pearl-vs-bitcoin` and `/en/pearl-vs-bitcoin`, plus a test that the nav link immediately follows Data Overview.
- [x] Run `npm test -- --run src/App.test.tsx`; confirm missing route/nav fails.
- [x] Add the focused page import, route, nav item, and bilingual title copy without changing existing route behavior.
- [x] Run the focused test; confirm pass.

## Task 3: Comparison logic and page

**Files:** `src/PearlVsBitcoinPage.tsx`, `src/PearlVsBitcoinPage.test.tsx`, `src/styles/pearl-vs-bitcoin.css`, `src/main.tsx`, `src/i18n/catalogue.ts`.

- [x] Add failing pure-function tests for 30D/90D/ALL filtering, time-bucket downsampling, empty series, and latest-observation date handling. Add a rendering test for model caveat and the five comparison sections.
- [x] Run `npm test -- --run src/PearlVsBitcoinPage.test.tsx`; confirm the page/logic is missing.
- [x] Implement finite-point filtering and bounded downsampling, then build the ratio chart with accessible range controls and hover/focus details.
- [x] Implement paired power, machines, capital, and issuance charts with distinct scales, latest-value cards, per-series timestamps, loading/empty states, source links, and responsive styling.
- [x] Run focused tests; confirm pass.

## Task 4: Final verification

**Files:** all task-owned files.

- [x] Run `npm test -- --run` and `npm run build` after the last source edit.
- [x] Inspect the task diff and preserve all pre-existing dirty changes. Do not stage mixed files or secrets in this shared checkout.
- [x] Check the local page with real collected snapshots in the browser, including navigation, language switch, range control, and tooltip.
- [x] Report local completion and clearly state that GitHub upload and server deployment were not performed.
