# Persistent Community Discussions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated administrator create persistent, fully sourced X discussions and add de-duplicated responses without changing or redeploying the website.

**Architecture:** Keep X extraction, domain orchestration, persistence, HTTP adaptation, and React rendering as separate units. Supabase Postgres stores immutable successful content snapshots; Vercel-style server routes and Vite development middleware call the same domain handlers. Public React pages consume only sanitized database snapshots and revalidate periodically.

**Tech Stack:** React, TypeScript, Vite, Vitest, Zod, Supabase Postgres and `@supabase/supabase-js`.

---

## File structure

- `supabase/migrations/202610110001_persistent_community_discussions.sql`: enum types, tables, indexes, RLS policy, and transactional RPC for a discussion plus its primary source.
- `server/communityDiscussion.ts`: retain and extend X payload extraction only; no static source list, no database calls.
- `server/discussions/types.ts`: shared server domain records and public DTOs.
- `server/discussions/urls.ts`: validate and normalize supported X status URLs.
- `server/discussions/store.ts`: `DiscussionStore` contract and in-memory test implementation.
- `server/discussions/supabaseStore.ts`: service-role Supabase adapter.
- `server/discussions/service.ts`: create, add, refresh, list, and load orchestration.
- `server/discussions/http.ts`: Zod input parsing, Bearer-token authorization, and HTTP-neutral endpoint handlers.
- `api/community-discussion.ts`, `api/community-discussions.ts`, `api/admin/community-discussions/index.ts`, `api/admin/community-discussions/[slug]/sources.ts`, `api/admin/community-discussions/[slug]/sources/[statusId]/refresh.ts`: production route adapters.
- `vite.config.ts`: one development-only route adapter that dispatches the same HTTP handlers.
- `src/data/communityDiscussion.ts`: typed public API client and periodic revalidation hook.
- `src/CommunityDiscussionPage.tsx`, `src/CommunityArticlePage.tsx`, `src/App.tsx`, `src/styles/community.css`: dynamic discussion list, parameterized reading page, route matching, and status styling.
- `server/discussions/*.test.ts`, `src/data/communityDiscussion.test.ts`, `src/CommunityDiscussionPage.test.tsx`, `src/CommunityArticlePage.test.tsx`, `src/App.test.tsx`: regression coverage.
- `.env.example`, `README.md`, `package.json`, `package-lock.json`: dependency and configuration documentation.

### Task 1: Add the persistent schema and server configuration

**Files:**
- Create: `supabase/migrations/202610110001_persistent_community_discussions.sql`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write the failing configuration contract test**

Create `server/discussions/supabaseStore.test.ts` with an empty environment assertion:

```ts
import { describe, expect, it } from "vitest";
import { createSupabaseClient } from "./supabaseStore";

describe("Supabase discussion store configuration", () => {
  it("rejects missing server-only Supabase configuration", () => {
    expect(() => createSupabaseClient({})).toThrow("SUPABASE_URL is not configured on the server");
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm test -- --run server/discussions/supabaseStore.test.ts`

Expected: FAIL because `supabaseStore.ts` does not exist.

- [ ] **Step 3: Add the dependency, schema, and environment contract**

Run: `npm install @supabase/supabase-js`

Create the migration with these invariant-bearing definitions:

```sql
create type public.discussion_status as enum ('draft', 'published');
create type public.discussion_source_role as enum ('primary', 'response');
create type public.discussion_source_type as enum ('tweet', 'noteTweet', 'article');
create type public.discussion_fetch_status as enum ('success', 'failed');

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  primary_source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.discussion_status not null default 'published'
);

create table public.discussion_sources (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  x_status_id text not null unique check (x_status_id ~ '^[0-9]+$'),
  url text not null,
  role public.discussion_source_role not null,
  author text,
  handle text,
  avatar_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  last_attempted_at timestamptz not null default now(),
  blocks jsonb not null default '[]'::jsonb,
  source_type public.discussion_source_type,
  position integer not null default 0,
  fetch_status public.discussion_fetch_status not null default 'failed',
  last_fetch_error text,
  unique (discussion_id, role, position)
);

alter table public.discussions
  add constraint discussions_primary_source_fk
  foreign key (primary_source_id) references public.discussion_sources(id)
  deferrable initially deferred;

create index discussion_sources_read_order on public.discussion_sources (discussion_id, role, published_at, position);

create or replace function public.touch_discussion_updated_at()
returns trigger language plpgsql as $$
begin
  update public.discussions set updated_at = now() where id = new.discussion_id;
  return new;
end;
$$;

create trigger discussion_source_touch_discussion
after insert or update on public.discussion_sources
for each row execute function public.touch_discussion_updated_at();

create or replace function public.create_discussion_with_primary(input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  discussion_id uuid;
  source_id uuid;
  primary_source jsonb := input->'primarySource';
begin
  insert into public.discussions (slug, title, description, status)
  values (
    input->>'slug',
    input->>'title',
    nullif(input->>'description', ''),
    coalesce((input->>'status')::public.discussion_status, 'published')
  ) returning id into discussion_id;

  insert into public.discussion_sources (
    discussion_id, x_status_id, url, role, author, handle, avatar_url,
    published_at, fetched_at, last_attempted_at, blocks, source_type,
    position, fetch_status, last_fetch_error
  ) values (
    discussion_id, primary_source->>'xStatusId', primary_source->>'url', 'primary',
    primary_source->>'author', primary_source->>'handle', primary_source->>'avatarUrl',
    nullif(primary_source->>'publishedAt', '')::timestamptz,
    (primary_source->>'fetchedAt')::timestamptz,
    (primary_source->>'fetchedAt')::timestamptz,
    coalesce(primary_source->'blocks', '[]'::jsonb),
    (primary_source->>'sourceType')::public.discussion_source_type,
    0, 'success', null
  ) returning id into source_id;

  update public.discussions set primary_source_id = source_id where id = discussion_id;
  return discussion_id;
end;
$$;
```

Enable RLS on both tables with no `anon` policies; the service role used by the server bypasses these policies. Set `.env.example` to exactly:

```dotenv
# Server-side only. Never prefix these variables with VITE_.
TWITTER241_API_KEY=replace-with-your-RapidAPI-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-server-only-service-role-key
COMMUNITY_ADMIN_TOKEN=replace-with-a-long-random-admin-token
```

Document running the migration in Supabase SQL Editor and configuring the same four server-only variables at the eventual host.

- [ ] **Step 4: Implement the configuration constructor**

Create `server/discussions/supabaseStore.ts` with this server-only constructor:

```ts
import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient(environment: Record<string, string | undefined> = process.env) {
  const url = environment.SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not configured on the server");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

- [ ] **Step 5: Run the configuration test to verify GREEN**

Run: `npm test -- --run server/discussions/supabaseStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the isolated infrastructure change**

```powershell
git add package.json package-lock.json .env.example README.md supabase/migrations/202610110001_persistent_community_discussions.sql server/discussions/supabaseStore.ts server/discussions/supabaseStore.test.ts
git commit -m "feat: add community discussion persistence schema"
```

### Task 2: Define discussion records and safely normalize X URLs/content

**Files:**
- Create: `server/discussions/types.ts`
- Create: `server/discussions/urls.ts`
- Create: `server/discussions/urls.test.ts`
- Modify: `server/communityDiscussion.ts`
- Modify: `server/communityDiscussion.test.ts`

- [ ] **Step 1: Write failing URL and extractor tests**

Add to `server/discussions/urls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeXStatusUrl } from "./urls";

describe("normalizeXStatusUrl", () => {
  it("normalizes an X status URL and extracts the immutable status ID", () => {
    expect(normalizeXStatusUrl("https://x.com/blocmates/status/2108519545514410023?s=20")).toEqual({
      statusId: "2108519545514410023",
      url: "https://x.com/blocmates/status/2108519545514410023",
    });
  });

  it("rejects links that are not X status URLs", () => {
    expect(() => normalizeXStatusUrl("https://example.com/status/1")).toThrow("Expected an X status URL");
  });
});
```

Extend `server/communityDiscussion.test.ts` with an Article title and normal tweet payload assertion:

```ts
expect(extractDiscussionPost(articlePayload, source)).toMatchObject({
  sourceType: "article",
  title: "WTF Is Pearl?",
  blocks: expect.arrayContaining([{ text: "First paragraph" }]),
});
expect(extractDiscussionPost(tweetPayload, source)).toMatchObject({ sourceType: "tweet", blocks: [{ text: "Ordinary full text" }] });
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --run server/discussions/urls.test.ts server/communityDiscussion.test.ts`

Expected: FAIL because the normalizer and the source metadata do not exist.

- [ ] **Step 3: Add explicit domain types and pure parsing**

Define the shared records in `server/discussions/types.ts`:

```ts
export type SourceBlock = { id: string; kind: "heading" | "quote" | "paragraph"; text: string };
export type SourceType = "tweet" | "noteTweet" | "article";
export type SourceRole = "primary" | "response";
export type FetchStatus = "success" | "failed";
export type FetchedSource = {
  xStatusId: string; url: string; author: string; handle: string; avatarUrl: string;
  publishedAt: string | null; fetchedAt: string; blocks: SourceBlock[]; sourceType: SourceType; title: string | null;
};
```

Implement `normalizeXStatusUrl` with `new URL`, host allowlist `x.com`, `www.x.com`, `mobile.x.com`, `twitter.com`, `www.twitter.com`, `mobile.twitter.com`, and pathname match `^/[^/]+/status/([0-9]+)(?:/)?$`. Return the canonical `https://x.com/{handle}/status/{id}` form and do not preserve query parameters.

Refactor the extractor to receive `{ xStatusId, url }`, detect Article title from its matched root payload, return `sourceType`, and split normal `legacy.full_text` into non-empty paragraphs after checking Article and note-tweet content. It must throw when the matched root has no readable text; it must never select a quote-tweet child with another status ID.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- --run server/discussions/urls.test.ts server/communityDiscussion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the pure-domain change**

```powershell
git add server/communityDiscussion.ts server/communityDiscussion.test.ts server/discussions/types.ts server/discussions/urls.ts server/discussions/urls.test.ts
git commit -m "feat: normalize persistent discussion sources"
```

### Task 3: Build testable persistence and source-loading services

**Files:**
- Create: `server/discussions/store.ts`
- Create: `server/discussions/service.ts`
- Create: `server/discussions/service.test.ts`
- Modify: `server/discussions/supabaseStore.ts`
- Modify: `server/discussions/supabaseStore.test.ts`

- [ ] **Step 1: Write failing service behavior tests**

Use an in-memory `DiscussionStore` and injected `fetchSource` fake in `server/discussions/service.test.ts`:

```ts
it("creates a published discussion with its complete primary snapshot", async () => {
  const result = await service.createDiscussion({ primaryUrl: primary.url, title: undefined, description: undefined, slug: undefined, status: undefined });
  expect(result.discussion.slug).toBe("wtf-is-pearl");
  expect(result.primary.blocks[0].text).toBe("Complete primary text");
});

it("adds responses once and reads them in original publication order", async () => {
  await service.addSources("wtf-is-pearl", [late.url, early.url, early.url]);
  const discussion = await service.getPublishedDiscussion("wtf-is-pearl");
  expect(discussion.sources.map((source) => source.xStatusId)).toEqual([primary.id, early.id, late.id]);
});

it("records a refresh failure without erasing an older successful snapshot", async () => {
  fetcher.failFor(primary.id, new Error("upstream unavailable"));
  await service.refreshSource("wtf-is-pearl", primary.id);
  const source = (await service.getPublishedDiscussion("wtf-is-pearl")).sources[0];
  expect(source.blocks[0].text).toBe("Complete primary text");
  expect(source.fetchStatus).toBe("failed");
});
```

- [ ] **Step 2: Run service tests to verify RED**

Run: `npm test -- --run server/discussions/service.test.ts`

Expected: FAIL because the store contract and service do not exist.

- [ ] **Step 3: Implement the store boundary and orchestration**

`store.ts` must define operations for atomic primary creation, source lookup by status ID, insert/update source, loading public list/detail DTOs, and keeping a monotonic `position` per discussion. The in-memory implementation must use `Map` values and clone `blocks` on reads so tests cannot mutate stored snapshots.

`service.ts` must expose these exact methods:

```ts
createDiscussion(input: CreateDiscussionInput): Promise<{ discussion: AdminDiscussion; primary: DiscussionSource }>;
addSources(slug: string, urls: string[]): Promise<AddSourceResult[]>;
refreshSource(slug: string, statusId: string): Promise<DiscussionSource>;
listPublishedDiscussions(): Promise<DiscussionCard[]>;
getPublishedDiscussion(slug: string): Promise<PublicDiscussion>;
```

It must call the injected `fetchSource` only after URL normalization. `addSources` processes each normalized URL independently: existing global status IDs produce `{ statusId, outcome: "duplicate" }`; a success writes a response; a new fetch failure writes one failed response with an empty `blocks` array and error text; a failure for an existing success only changes attempt/status/error. A slug collision appends `-2`, `-3`, and so on. `createDiscussion` uses an Article title first, then supplied title, then a 72-character first-block title, and creates `published` unless caller requests `draft`.

Implement the Supabase adapter with `create_discussion_with_primary` RPC for creation and parameterized `.from(...).insert/update/select` calls for the remaining methods. Map database `snake_case` records to camelCase types in exactly one adapter function; never leak service-role client objects to the browser.

- [ ] **Step 4: Run service and adapter tests to verify GREEN**

Run: `npm test -- --run server/discussions/service.test.ts server/discussions/supabaseStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit persistence behavior**

```powershell
git add server/discussions/store.ts server/discussions/service.ts server/discussions/service.test.ts server/discussions/supabaseStore.ts server/discussions/supabaseStore.test.ts
git commit -m "feat: persist community discussion snapshots"
```

### Task 4: Expose authenticated write routes and safe public read routes

**Files:**
- Create: `server/discussions/http.ts`
- Create: `server/discussions/http.test.ts`
- Create: `api/community-discussions.ts`
- Modify: `api/community-discussion.ts`
- Create: `api/admin/community-discussions/index.ts`
- Create: `api/admin/community-discussions/[slug]/sources.ts`
- Create: `api/admin/community-discussions/[slug]/sources/[statusId]/refresh.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Write failing HTTP tests**

```ts
it("rejects an unauthenticated create request", async () => {
  const response = await handleCreateDiscussion(request({ primaryUrl: "https://x.com/a/status/1" }));
  expect(response).toMatchObject({ status: 401, body: { error: "unauthorized" } });
});

it("creates a discussion only with the configured bearer token", async () => {
  const response = await handleCreateDiscussion(request({ primaryUrl: primary.url }, { authorization: "Bearer test-token" }));
  expect(response).toMatchObject({ status: 201, body: { detailUrl: "/archive/community-discussion/wtf-is-pearl" } });
});

it("does not expose error stacks, service tokens, or Twitter keys from public reads", async () => {
  const response = await handleGetDiscussion(request(undefined, undefined, { slug: "missing" }));
  expect(JSON.stringify(response.body)).not.toContain("TWITTER241_API_KEY");
  expect(response.status).toBe(404);
});
```

- [ ] **Step 2: Run HTTP tests to verify RED**

Run: `npm test -- --run server/discussions/http.test.ts`

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement request validation and route adapters**

Use Zod schemas:

```ts
const createSchema = z.object({ primaryUrl: z.string().url(), title: z.string().trim().min(1).max(160).optional(), description: z.string().trim().max(600).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), status: z.enum(["draft", "published"]).optional() });
const addSourcesSchema = z.object({ urls: z.array(z.string().url()).min(1).max(50) });
```

`http.ts` must return `{ status, body }` values rather than framework `Response` objects. It must use constant-time comparison for the expected admin token and return only these public error codes: `unauthorized`, `invalid_request`, `not_found`, and `discussion_unavailable`. A successful public list sends 200; a successful creation sends 201; response addition sends 200 with per-URL outcomes; refresh sends 200.

Each production adapter reads route parameters/query values, reads a JSON body only for POST, forwards only request headers/body/params to the shared handler, and serializes its returned status/body. Change the existing public route from `discussion` query to `slug`, with a temporary `discussion` alias that maps to the same slug during this release. The Vite plugin must mount one `/api` dispatcher that recognizes the identical five route forms and never injects `TWITTER241_API_KEY` into client code.

- [ ] **Step 4: Run HTTP tests to verify GREEN**

Run: `npm test -- --run server/discussions/http.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit API behavior**

```powershell
git add server/discussions/http.ts server/discussions/http.test.ts api vite.config.ts
git commit -m "feat: add managed community discussion API"
```

### Task 5: Replace the browser's fixed data contract with public dynamic APIs

**Files:**
- Modify: `src/data/communityDiscussion.ts`
- Modify: `src/data/communityDiscussion.test.ts`

- [ ] **Step 1: Write failing browser-client tests**

```ts
it("loads dynamic cards from the public list API", async () => {
  await expect(getCommunityDiscussionCards(fetcher)).resolves.toMatchObject([{ slug: "wtf-is-pearl", responseCount: 4 }]);
  expect(fetcher).toHaveBeenCalledWith("/api/community-discussions", expect.any(Object));
});

it("loads a discussion by slug and rejects malformed public payloads", async () => {
  await expect(getCommunityDiscussion("wtf-is-pearl", fetcher)).resolves.toMatchObject({ slug: "wtf-is-pearl" });
  await expect(getCommunityDiscussion("wtf-is-pearl", malformedFetcher)).rejects.toThrow("community discussion response is invalid");
});
```

- [ ] **Step 2: Run browser-client tests to verify RED**

Run: `npm test -- --run src/data/communityDiscussion.test.ts`

Expected: FAIL because cards and slug-based payload validation do not exist.

- [ ] **Step 3: Implement public DTO validation and revalidation hook**

Define browser-only types `CommunityDiscussionCard`, `CommunityDiscussion`, and `CommunitySource` with `role`, `fetchStatus`, `fetchedAt`, `publishedAt`, `blocks`, and source identity fields. Add `getCommunityDiscussionCards(fetcher)` for `/api/community-discussions` and change detail requests to `/api/community-discussion?slug=${encodeURIComponent(slug)}`. Validate the nested response shape before returning it.

Implement `useCommunityDiscussionResource(loader)` to load immediately, reload after `window.focus`, and start a 60,000ms interval; cancel interval, listener, and outstanding state updates on unmount. The hook must retain a previously successful result while indicating a subsequent refresh failure, so the page does not disappear when the network briefly fails.

- [ ] **Step 4: Run browser-client tests to verify GREEN**

Run: `npm test -- --run src/data/communityDiscussion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the public client**

```powershell
git add src/data/communityDiscussion.ts src/data/communityDiscussion.test.ts
git commit -m "feat: load community discussions from public API"
```

### Task 6: Render a dynamic list and parameterized discussion reader

**Files:**
- Modify: `src/CommunityDiscussionPage.tsx`
- Modify: `src/CommunityDiscussionPage.test.tsx`
- Modify: `src/CommunityArticlePage.tsx`
- Modify: `src/CommunityArticlePage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/community.css`

- [ ] **Step 1: Write failing page and route tests**

```tsx
it("renders all loaded discussion cards with counts and detail routes", async () => {
  render(<CommunityDiscussionPage />);
  expect(await screen.findByRole("link", { name: "进入讨论：WTF Is Pearl?" })).toHaveAttribute("href", "/archive/community-discussion/wtf-is-pearl");
  expect(screen.getByText("4 条回应")).not.toBeNull();
});

it("renders primary first and time-sorted responses in alternating positions", async () => {
  render(<CommunityArticlePage slug="wtf-is-pearl" />);
  expect((await screen.findAllByTestId("community-dialogue-message")).map((node) => node.getAttribute("data-side"))).toEqual(["left", "right", "left"]);
  expect(screen.getByText("暂时无法更新，可重试")).not.toBeNull();
});

it("routes any one-segment discussion slug to the dynamic reader", () => {
  window.history.replaceState({}, "", "/archive/community-discussion/new-pearl-debate");
  render(<App />);
  expect(screen.getByTestId("community-article-page")).not.toBeNull();
});
```

- [ ] **Step 2: Run page tests to verify RED**

Run: `npm test -- --run src/CommunityDiscussionPage.test.tsx src/CommunityArticlePage.test.tsx src/App.test.tsx`

Expected: FAIL because the list and detail page still contain fixed source cards and a fixed slug.

- [ ] **Step 3: Replace static rendering with API-backed components**

Remove `sourceCards`, `dialogueEntries`, all source metadata constants, and the fixed `wtf-is-pearl` reader hook. `CommunityDiscussionPage` must render loading, retained-data error, empty, and card states from `getCommunityDiscussionCards`; card summary and timestamps come from the server payload, not handcrafted Chinese copy.

Change `CommunityArticlePage` to accept `{ slug: string }`, load that slug, and map returned sources in API order. Assign `data-testid="community-dialogue-message"` and `data-side={index % 2 === 0 ? "left" : "right"}`; render the primary card at the larger CSS width. For `fetchStatus === "failed"`, show `暂时无法更新，可重试` above retained blocks or in the empty card, but preserve the original X link. Render `publishedAt` using `Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" })` when non-null.

In `App.tsx`, match `/archive/community-discussion` before `pathname.startsWith("/archive/community-discussion/")`; derive exactly one decoded non-empty slug from the suffix and pass it into `<CommunityArticlePage slug={slug} />`. Preserve all unrelated routes.

Update CSS only for dynamic status/empty cards, primary-card sizing, metadata wrapping, and mobile alternating-avatar layout; retain the current fixed-height `overflow-y: auto` source-body container.

- [ ] **Step 4: Run page tests to verify GREEN**

Run: `npm test -- --run src/CommunityDiscussionPage.test.tsx src/CommunityArticlePage.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the dynamic UI**

```powershell
git add src/CommunityDiscussionPage.tsx src/CommunityDiscussionPage.test.tsx src/CommunityArticlePage.tsx src/CommunityArticlePage.test.tsx src/App.tsx src/App.test.tsx src/styles/community.css
git commit -m "feat: render persistent community discussions"
```

### Task 7: Migrate the existing discussion and verify the deployment workflow

**Files:**
- Modify: `README.md`
- Verify: `.gitignore`
- Verify: all files above

- [ ] **Step 1: Write a failing regression assertion for no fixed source registry**

Add to `server/communityDiscussion.test.ts`:

```ts
it("does not carry a static discussion registry", async () => {
  await expect(import("./communityDiscussion")).resolves.not.toHaveProperty("DISCUSSION_SOURCES");
});
```

- [ ] **Step 2: Run the assertion to verify RED**

Run: `npm test -- --run server/communityDiscussion.test.ts`

Expected: FAIL until the static source export is removed and all callers use the persistent service.

- [ ] **Step 3: Remove the old hardcoded path and document exact administrator calls**

Remove `DISCUSSION_SOURCES`, `loadDiscussion`, and every static `wtf-is-pearl` business branch. Keep only the pure content extraction function, now called by the service fetch adapter.

Add this PowerShell example to `README.md`, with placeholders rather than real secrets:

```powershell
$headers = @{ Authorization = "Bearer $env:COMMUNITY_ADMIN_TOKEN"; "Content-Type" = "application/json" }
$primary = @{ primaryUrl = "https://x.com/blocmates/status/2108519545514410023"; title = "WTF Is Pearl?" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://YOUR_HOST/api/admin/community-discussions" -Headers $headers -Body $primary

$responses = @{ urls = @(
  "https://x.com/theoristalgo/status/2108528311735607793",
  "https://x.com/tokugawasuprema/status/2108568857317118362",
  "https://x.com/tulipking/status/2108579196268077447",
  "https://x.com/KiwiCryptoBig/status/2108928836780065031"
) } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://YOUR_HOST/api/admin/community-discussions/wtf-is-pearl/sources" -Headers $headers -Body $responses
```

State that the first call is the one-time import of the currently shown discussion, and that subsequent primary and response URLs use the identical endpoints.

- [ ] **Step 4: Run the full automated verification**

Run: `npm test -- --run`

Expected: every Vitest suite passes.

Run: `npm run build`

Expected: TypeScript checking and Vite production build succeed.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Perform manual server verification after Supabase variables are configured**

1. Apply the migration in the target Supabase project.
2. Set the four server-only variables locally or at the host.
3. Create the primary discussion with the first README command and record its `detailUrl`.
4. Add the four listed responses; repeat one URL and verify its result is `duplicate`.
5. Open the list and detail URLs; verify the original appears first, responses order by X timestamp, complete content scrolls in cards, and no browser request targets Twitter241.
6. Retry one intentionally unavailable status ID; verify the response is marked failed and a previously successful snapshot remains visible.

- [ ] **Step 6: Commit final migration readiness**

```powershell
git add README.md server/communityDiscussion.ts server/communityDiscussion.test.ts
git commit -m "docs: document community discussion administration"
```
