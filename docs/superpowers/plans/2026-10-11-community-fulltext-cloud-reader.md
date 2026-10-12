# Community Full-text Cloud Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the complete source text for the two curated `WTF Is Pearl?` posts through a secure cloud API instead of truncated X embeds.

**Architecture:** A shared server module normalizes Twitter241 GraphQL payloads. Both the Vercel API function and Vite development middleware call that module; React fetches its normalized response and renders it inside the existing fixed-height dialogue cards.

**Tech Stack:** React, TypeScript, Vite middleware, Vercel serverless function shape, Vitest.

---

### Task 1: Define and test server-side post normalization

**Files:**
- Create: `server/communityDiscussion.ts`
- Create: `server/communityDiscussion.test.ts`

- [ ] **Step 1: Write failing extraction tests**

```ts
expect(extractDiscussionPost(articlePayload, source)).toMatchObject({
  sourceId: "2108519545514410023",
  blocks: [{ kind: "paragraph", text: "First paragraph" }],
});
expect(extractDiscussionPost(notePayload, source).blocks.at(-1)).toEqual({
  kind: "paragraph", text: "Text after Show more" });
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run server/communityDiscussion.test.ts`

Expected: FAIL because `server/communityDiscussion.ts` does not exist.

- [ ] **Step 3: Implement root-tweet selection, Article blocks and note-tweet text extraction**

```ts
export function extractDiscussionPost(payload: unknown, source: DiscussionSource): DiscussionPost {
  const tweet = findTweetResult(payload, source.sourceId);
  const articleBlocks = readArticleBlocks(tweet);
  return { ...readIdentity(tweet, source), blocks: articleBlocks.length ? articleBlocks : readNoteTweetBlocks(tweet) };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- --run server/communityDiscussion.test.ts`

Expected: PASS.

### Task 2: Expose secure cloud and development API routes

**Files:**
- Create: `api/community-discussion.ts`
- Modify: `vite.config.ts`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Write a failing server loader test**

```ts
const posts = await loadDiscussion("wtf-is-pearl", fetcher);
expect(posts.sources).toHaveLength(2);
expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("pid=2108519545514410023"), expect.any(Object));
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run server/communityDiscussion.test.ts`

Expected: FAIL because `loadDiscussion` is not exported.

- [ ] **Step 3: Add the API adapter and development middleware**

```ts
export default async function handler(request: { query?: { discussion?: string } }, response: { status: (code: number) => typeof response; json: (body: unknown) => void }) {
  const body = await loadDiscussion(request.query?.discussion ?? "");
  response.status(200).json(body);
}
```

- [ ] **Step 4: Run loader tests and verify GREEN**

Run: `npm test -- --run server/communityDiscussion.test.ts`

Expected: PASS.

### Task 3: Fetch and display complete source text in React

**Files:**
- Create: `src/data/communityDiscussion.ts`
- Create: `src/data/communityDiscussion.test.ts`
- Modify: `src/CommunityArticlePage.tsx`
- Modify: `src/CommunityArticlePage.test.tsx`
- Modify: `src/styles/community.css`

- [ ] **Step 1: Write failing page tests**

```tsx
expect(await screen.findByText("Text after Show more")).not.toBeNull();
expect(screen.queryByTitle("blocmates 原帖全文")).toBeNull();
expect(screen.getAllByRole("link", { name: "在 X 查看原文" })).toHaveLength(2);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/CommunityArticlePage.test.tsx`

Expected: FAIL because the page still contains iframe embeds.

- [ ] **Step 3: Implement typed client loading and source block rendering**

```tsx
const { state, sources } = useCommunityDiscussion("wtf-is-pearl");
return <div className="community-dialogue-scroll">{source.blocks.map((block) => <p key={block.id}>{block.text}</p>)}</div>;
```

- [ ] **Step 4: Run page tests and verify GREEN**

Run: `npm test -- --run src/CommunityArticlePage.test.tsx src/data/communityDiscussion.test.ts`

Expected: PASS.

### Task 4: Verify production readiness

**Files:**
- Verify: `README.md` if environment variable setup is documented there

- [ ] **Step 1: Verify no secret is tracked**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; `.env.local` is ignored.

- [ ] **Step 2: Run the full suite and production build**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite production build succeeds.
