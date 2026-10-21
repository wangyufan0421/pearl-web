# Manual Discussion Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly in the existing `D:\pearl web` checkout; do not deploy.

**Goal:** Organize only administrator-saved X links into expandable reply trees with main-author messages on the left.

**Architecture:** Extend saved source records with a numeric parent status ID, extract it from the exact X tweet, and expose it through the existing public API. An authenticated metadata repair/manual-parent path updates old records. A pure tree builder feeds the existing detail page.

**Tech Stack:** TypeScript, React, Vitest, Supabase SQL/RPC.

---

## Task 1: Parent metadata contract

- [ ] Add a failing extractor test for root-tweet reply metadata and an embedded-quote decoy, then implement `parentStatusId` in `FetchedSource`.
- [ ] Add failing store/API tests for nullable `parentStatusId` and `authorUserId`; implement mappings and a new additive SQL migration.
- [ ] Run focused extractor, store, and HTTP tests.

## Task 2: Existing and new records

- [ ] Add failing service tests for new reply parent persistence, metadata-only repair of old links, and manual override validation.
- [ ] Implement authenticated repair and override handlers plus store methods without changing body, translations, or author identity.
- [ ] Add corresponding admin client controls to scan saved links and correct parent when needed.
- [ ] Run focused service, HTTP, and admin tests.

## Task 3: Expandable detail view

- [ ] Add failing pure tests for nesting, missing-parent fallback, cycle handling, and same-author detection.
- [ ] Implement the tree builder and recursive detail rendering with accessible expand/collapse controls.
- [ ] Add focused UI tests for left/right identity and child expansion, then style the nested view.
- [ ] Run focused UI and bilingual tests.

## Task 4: Verify and hand off

- [ ] Run all tests, server build, production build, and task-owned diff check.
- [ ] Inspect local page if feasible; preserve unrelated dirty changes.
- [ ] Report the exact migration and collector/admin repair steps required after a future deployment, without performing deployment.
