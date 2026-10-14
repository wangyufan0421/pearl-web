# Community identity and translation implementation

**Goal:** Display source author accounts/avatars and attach saved Chinese translations without changing originals.
**Architecture:** Modern/legacy author extractor + shared identity UI; translations extend existing JSON source blocks. Independent server translation worker uses the supplied service, bounded batches and revision checks.
**Tech Stack:** React, TypeScript, Supabase, native fetch, Vitest.

- [x] RED/GREEN author extraction and URL fallback, shared handle/avatar UI with broken-image fallback.
- [x] RED/GREEN translator: bounded input, JSON validation, original-text preservation, safe errors; worker coalescing, retries and revision-safe saves.
- [x] Wire blocks types/DTOs, refresh preservation and translated summaries; add bilingual source-view tests and UI copy.
- [x] Add translation process to development/production launch, systemd and deployment docs; store supplied key/model only in ignored local configuration.
- [x] Build/test/review. Repair actual archived authors and start live translation backfill, then verify displayed and persisted results without publishing test discussions.

Verification: 35 test files / 169 tests passed; production build passed. Independent review cleared refresh/translation CAS races. Live Supabase verified all 10 archived sources have handles and avatars and all English blocks have saved Chinese translations. Browser verified Chinese default and original switch; screenshot saved in output/community-translation-detail.png. Supplied credentials remain only in ignored server-local configuration.
