# Community Discussion Route Repair

**Goal:** Restore the intended community list and discussion reader in both languages, using the persistent public APIs already implemented.

**Cause:** The synced worktree removed the old frontend and changed its menu to `/archive#community-discussion`. App falls through to the archive introduction. Bilingual navigation preserved this unfinished entry.

- [x] Add failing tests for navigation, legacy URL compatibility, dynamic list/detail data and preserving original source text in English mode.
- [x] Implement validated public list/detail client and immediate/focus/60-second revalidation with cleanup and retained snapshots after refresh failures.
- [x] Restore independently routed list and parameterized reader, with bilingual UI, source metadata, original links and scrollable full text.
- [x] Point navigation to `/archive/community-discussion`; redirect legacy archive anchors to the real list. Extend route metadata.
- [x] Verify service-unavailable, empty, not-found, refresh and original-text states; run full tests and build; verify the user's open page.

Cloud credentials are absent locally. Do not fabricate or hardcode archived posts, create cloud resources, or import data without configuration. Public browsing reads snapshots only and does not call Twitter241.

