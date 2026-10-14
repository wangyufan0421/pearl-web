# Community admin cards implementation plan

**Goal:** Deliver cards home, combined creation, two-column discussion management, hiding/restoring and confirmed permanent deletion.
**Architecture:** Existing draft/published status and source cascade support lifecycle without schema changes. Protected admin reads expose hidden discussions. One mounted admin shell owns memory-only credentials across route transitions; focused page sections own forms and lifecycle confirmation.
**Tech Stack:** React, TypeScript, Supabase, Vitest.

- [x] Add lifecycle regression tests: hide removes public reads but retains admin detail, restore retains original and translation, delete frees source IDs. Add unauthorized/admin confirmation tests; run RED.
- [x] Implement store admin list/detail and visibility/delete methods in memory and Supabase; service and authenticated HTTP/router operations. Delete is one parent-table delete with cascade; require matching slug confirmation. Add runtime deferred methods.
- [x] Add protected admin client schemas/reads/actions. Reuse source display in admin details. Adapt App route matching so shell retains credentials within admin routes.
- [x] Replace admin UI with cards, filters, confirmation dialog, new form and two-column editor; preserve input/outcomes on partial create, credentials only in memory and bilingual labels. Add meaningful route, auth, confirmation and partial-failure UI tests; run RED then GREEN.
- [x] Exclude hidden discussions from translation scans. Document deployment/operation and review lifecycle concurrency/authorization.
- [x] Run full tests and production build, independent review, browser verification with screenshots. Verify live protected reads without deleting existing user discussions.

Commands: Node 24 `node_modules/vitest/vitest.mjs run`; Node24/npm `run build`; `run dev` reloads compiled server workers. Git is unavailable in this workspace; no commit, push or deployment is requested.

Verification: 36 files / 176 tests passed; production TypeScript and Vite build passed. Independent review cleared two corrected regressions (404 stale snapshot and retry results). Actual protected list/detail APIs returned 200; missing credentials returned401. Live translation published-only query succeeded (17 sources). Browser verified three existing discussion cards, new form, retained authentication across admin routes, deletion confirmation (cancelled), editor and 390px single-column layout without horizontal overflow. No existing discussion was hidden or deleted. Screenshots are in output/community-admin-cards.png, community-admin-new.png and community-admin-editor.png.
