# Community Author Identity Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user has explicitly selected inline execution in `D:\pearl web` on `main`; do not create a worktree or delegate.

**Goal:** Persist accurate X author identity for new community sources, repair existing sources automatically, and refresh verified names and avatars every 24 hours without changing discussion content.

**Architecture:** A pure extractor identifies the requested tweet's own author and stable user ID. A server-only Twitter241 resolver uses `/tweet`, `/tweet-v2`, and verified user-ID lookup where necessary. A bounded queue in the existing `pearl-web` process atomically claims due rows through Supabase functions and updates identity columns only; retries are persisted and the lease expires after restart. This plan records the initial steps; local implementation and tests are complete, while live Supabase migration and Twitter241 verification remain deployment checks.

**Tech Stack:** Node 24, TypeScript, Vitest, Supabase PostgreSQL functions, existing systemd `pearl-web` service.

---

## File map

- `server/communityDiscussion.ts`: pure author evidence extraction; existing content extraction consumes the same parser.
- `server/discussions/identityResolver.ts`: Twitter241 identity HTTP requests and response validation, no database calls.
- `server/discussions/identityQueue.ts`: bounded periodic scheduling, no HTTP or database internals.
- `server/discussions/identityStore.ts`: typed Supabase RPC adapter for claim/finish.
- `server/main.ts`: start and stop the queue without blocking HTTP service.
- `supabase/migrations/202610200001_discussion_identity_refresh.sql`: identity-only fields, atomic claim/finish functions, trigger scope.
- `deploy/README.md`: migration order, 24-hour identity refresh, and verification commands.
- Corresponding `*.test.ts` files: red-green regression tests for each behavior.

## Task 1: Verify tweet author evidence independently of content

**Files:** `server/communityDiscussion.test.ts`, `server/communityDiscussion.ts`

- [ ] Add a failing test with a requested tweet containing a quoted user, and assert the requested author's `userId`, `author`, `handle`, and `avatarUrl` are returned while the quoted author is ignored:

```ts
const identity = extractCommunityIdentity(normalized, rootTweet({
  rest_id: normalized.xStatusId,
  core: { user_results: { result: { rest_id: "42", core: { name: "Root", screen_name: "root" }, avatar: { image_url: "https://pbs.twimg.com/root.jpg" } } } },
  legacy: { full_text: "Root text", quoted_status_result: { result: { rest_id: "99", core: { user_results: { result: { rest_id: "77", core: { name: "Wrong" } } } } } } },
}));
expect(identity).toEqual({ userId: "42", author: "Root", handle: "root", avatarUrl: "https://pbs.twimg.com/root.jpg" });
```

- [ ] Run `npx vitest run server/communityDiscussion.test.ts`; expect a failure because `extractCommunityIdentity` does not exist.
- [ ] Export `AuthorIdentity` and `extractCommunityIdentity`; reuse `findRootTweet` and the existing `core`/`legacy` field paths; reject non-HTTPS avatar URLs; make `extractCommunityDiscussion` consume this parser while leaving URL-handle fallback in the UI only.
- [ ] Run the focused test again; expect pass. Add cases for legacy user fields, no author, and quote-only user. Run again.
- [ ] Commit only the task's two files after focused tests pass.

## Task 2: Resolve incomplete identity via Twitter241 without guesswork

**Files:** `server/discussions/identityResolver.test.ts`, `server/discussions/identityResolver.ts`, `server/discussions/runtime.ts`

- [ ] Add failing injected-fetch tests for: `/tweet` embedded identity; `/tweet-v2` fallback when requested tweet lacks a user; `/get-users?users=42` returning a matching stable ID; mismatched user ID rejected; and new-source fetch retaining text if optional identity enrichment fails.

```ts
const resolver = createTwitter241IdentityResolver({ apiKey: "test", fetch: fakeFetch });
await expect(resolver.resolve("https://x.com/root/status/123", "42")).resolves.toEqual({
  userId: "42", author: "Updated Root", handle: "root", avatarUrl: "https://pbs.twimg.com/new.jpg",
});
```

- [ ] Run `npx vitest run server/discussions/identityResolver.test.ts`; expect missing-module failure.
- [ ] Implement `resolve(url, knownUserId?, initialTweetPayload?)`, with a request timeout and fixed Twitter241 host. For known IDs, query users by ID and require exact ID match; otherwise parse the requested tweet from `/tweet`, then `/tweet-v2` if needed. Never use the URL handle alone to persist name/avatar. Reuse the same resolver for a newly added source only when its first tweet payload has incomplete identity; catch enrichment failure so readable text still saves.
- [ ] Run focused tests and current discussion runtime tests; expect pass. Commit only these files.

## Task 3: Persist scheduling without mutating discussion content

**Files:** `supabase/migrations/202610200001_discussion_identity_refresh.sql`, `server/discussions/identityStore.test.ts`, `server/discussions/identityStore.ts`

- [ ] Write adapter tests first. The claim response must contain only `id`, `url`, `authorUserId`, `leaseToken`; completion must send only `id`, `leaseToken`, `userId`, `author`, `handle`, `avatarUrl`. Assert no `blocks`, `fetchedAt`, or translation data is sent.
- [ ] Run `npx vitest run server/discussions/identityStore.test.ts`; expect missing-module failure.
- [ ] Add the typed adapter with `claim()` calling `claim_discussion_identity_source` and `finish()` calling `finish_discussion_identity_source`.
- [ ] Create migration with nullable `author_user_id`, due time, checked time, failure count, lease token and expiry. Existing rows become due immediately; new rows default due immediately. `claim` uses `FOR UPDATE SKIP LOCKED`, prioritizes missing identity, gives a two-minute lease, and returns one row. `finish` requires the matching lease, verifies stable user ID, updates only non-empty identity values, schedules next successful check at 24 hours, or backs off a failed check from five minutes to 24 hours. It never sets a non-empty identity field to null. Functions are service-role-only. Replace the broad discussion-touch trigger with a trigger limited to content/status columns so identity-only and lease updates do not change `discussions.updated_at`.
- [ ] Run focused tests; inspect SQL for idempotent `CREATE OR REPLACE`, authorization, valid types, and content-only updates. Commit migration and adapter files.

## Task 4: Run a bounded queue inside `pearl-web`

**Files:** `server/discussions/identityQueue.test.ts`, `server/discussions/identityQueue.ts`, `server/main.ts`

- [ ] Add failing queue tests: no overlap, no job, successful job, resolver failure followed by `finish` with no identity, and stop before next poll.

```ts
const queue = createIdentityQueue({ store, resolve, pollMs: 60_000, maxJobsPerTick: 10 });
await queue.tick();
expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({ userId: "42" }));
```

- [ ] Run `npx vitest run server/discussions/identityQueue.test.ts`; expect missing-module failure.
- [ ] Implement `tick/start/stop` with one in-flight pass, at most ten serial jobs per pass, safe result logging, and a sixty-second polling interval. `main.ts` starts it only if Supabase and Twitter241 server-only variables are present, after HTTP listening; shutdown stops queue before closing the server. Queue errors do not stop the website.
- [ ] Run focused tests and `npm run build:server`; expect pass. Commit only queue and `main.ts` files.

## Task 5: Document deployment and verify all requirements

**Files:** `deploy/README.md`, `docs/superpowers/specs/2026-10-20-community-author-identity-backfill-design.md`

- [ ] Document the added migration after existing migrations, `npm ci`, `npm run build`, restart `pearl-web`, keep existing server env keys, and monitor service logs/public API. Explain that the queue updates identity only and checks confirmed profiles every 24 hours; upstream unavailable identities retain existing values.
- [ ] Update the approved design's periodic-refresh language and ensure no sentence still says complete identities are never scanned.
- [ ] Run `npm test -- --run`, `npm run build`, and `git diff --check`; inspect changed files and confirm no secrets or unrelated changes were staged.
- [ ] Verify a synthetic old source with missing identity is claimed and completed, an existing complete source is due again after 24 hours, and unrelated fields are absent from the finish payload. Without local Twitter241 credentials, report live backfill as pending deployment verification rather than complete.
- [ ] Commit only task-owned documentation and any remaining task files. Do not push or deploy without the user's instruction.
