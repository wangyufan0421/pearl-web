# Community Admin Page Implementation Plan

**Goal:** Let an administrator verify a token, paste X links, publish discussions, add responses and retry failed sources through the website.

**Architecture:** Reuse the existing authenticated write handlers and public discussion APIs. Add a credential-verification GET at the admin collection endpoint. A typed browser client validates write responses and maps safe errors. The bilingual page holds its token in memory, tracks request/session generations and renders create, response and source-refresh forms.

**Tech Stack:** React, TypeScript, Zod, Vite, Vitest and existing serverless handlers.

- [x] Write failing tests for protected token verification, admin routes, token privacy, creation, batch outcomes, refresh and invalid authorization.
- [x] Add server-side verification GET to the Vite dispatcher and serverless adapter, keeping existing POST behavior.
- [x] Add browser admin client and page using in-memory credentials and existing URL validation; guard late responses after logout.
- [x] Add bilingual copy, responsive styles, administrator link, route metadata and noindex behavior.
- [x] Run targeted and full tests, type checks and production build; inspect the actual page and review code.
- [x] Document deployment variables and operating workflow. Live cloud configuration and publishing remain outside this local implementation.

Work in the user-selected main directory and retain existing documents and the other worktree.
