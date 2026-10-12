# Pearl Bilingual Site Implementation Plan

**Goal:** Deliver the approved EN / ZH website using existing pages and shared data.

**Architecture:** A language context supplies translation and localized URLs. An English catalogue covers source copy. A shared header owns navigation and language switching; browser history updates preserve component state. Documents use language-specific static resources.

**Tech Stack:** React, TypeScript, Vite, existing Vitest and Testing Library.

### Task 1: Define bilingual behavior
- [x] Add tests covering English introduction, document selection, language switching, internal links and chart-state retention.
- [x] Run these tests before implementation and confirm missing English behavior.

### Task 2: Language infrastructure and navigation
- [x] Create `src/i18n/catalogue.ts`, `src/i18n/Language.tsx`, and `src/SiteHeader.tsx`.
- [x] Implement `/en` normalization, language-specific links, history and storage handling, localized metadata, and translation lookup.
- [x] Replace duplicated topbars in all eight existing pages with the shared header; adapt route resolution in `src/App.tsx`.

### Task 3: Content and formatting
- [x] Translate every user-facing static string in page components and their data, including labels, prose, accessibility and failure states.
- [x] Localize numeric/date formatting; retain IDs, source URLs, units and fetched values.
- [x] Add responsive language-switch styles without changing the visual system.

### Task 4: Documents and verification
- [x] Inspect local English source PDF and compare its protocol edition with the INT translation; obtain corresponding original if needed.
- [x] Add original English PDF and select it on English routes.
- [x] Run bilingual tests, all regression tests and production build with Node 24; verify catalogue coverage and rendered English pages.
- [x] Document usage, formatting and how to maintain translations in README.

Work continues in the user-selected main directory. Preserve the existing worktree and auxiliary documents. Do not publish or change cloud data.

