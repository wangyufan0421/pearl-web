# Background Market Data Implementation Plan

**Goal:** Keep collecting market and chain data without any open browser, and serve durable last-successful snapshots.

**Architecture:** Independent Node collector and HTTP server share a Supabase snapshot store. Browser adapters keep their existing data shapes but read same-origin saved snapshots, including collection timestamps. Existing discussion handlers remain authenticated.

**Tech Stack:** Node 24, TypeScript, Zod, Supabase, Vitest, Linux systemd.

Work in the user-selected main directory. Implement inline with test-first verification; keep existing documents/worktree. Git executable is unavailable in this environment.

- [x] Add collector tests: immediate collection without HTTP calls; cadence; four-request concurrency; no overlapping jobs; malformed upstream and failures retain successful snapshots.
- [x] Add dataset definitions, payload validation, scheduler and Supabase store. Add RLS-protected migration with atomic save/failure functions.
- [x] Add saved-data HTTP tests: no upstream reads; missing data returns 503; timestamps and stale status; invalid paths rejected. Implement Node public API, static SPA server, and existing discussion routing.
- [x] Add frontend regression tests for same-origin candles and saved timestamps. Implement snapshot metadata and bilingual stale notices without translating raw values.
- [x] Add server build configuration, two-process development/production launchers and systemd units. Document single collector instance, environment, migrations, startup, recovery, and operational verification.
- [x] Run targeted tests, all tests, frontend/backend build, local HTTP smoke verification and independent code review. Record actual cloud verification limitation.

Verification: 30 test files / 149 tests passed; production frontend/backend build passed; compiled HTTP service and collector smoke passed using an isolated test store and collection before any HTTP visitor. Read-only requests to all 25 real upstream datasets passed current payload validators. Reviewer findings were resolved with regression tests. Supabase persistence, SQL migration execution and Linux systemd runtime require the user's deployment environment; no real cloud writes or deployment were performed here.
