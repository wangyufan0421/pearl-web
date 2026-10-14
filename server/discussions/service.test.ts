import { describe, expect, it, vi } from "vitest";
import type { FetchedSource } from "./types";
import { InMemoryDiscussionStore } from "./store";
import { createDiscussionService } from "./service";

function source(id: string, overrides: Partial<FetchedSource> = {}): FetchedSource {
  return {
    xStatusId: id,
    url: `https://x.com/blocmates/status/${id}`,
    author: "Blocmates",
    handle: "blocmates",
    avatarUrl: "https://example.com/avatar.png",
    publishedAt: "2026-01-01T00:00:00.000Z",
    fetchedAt: "2026-01-02T00:00:00.000Z",
    blocks: [{ id: `${id}-block`, kind: "paragraph", text: "Complete primary text" }],
    sourceType: "article",
    title: "WTF is Pearl?",
    ...overrides,
  };
}

class SourceFetcher {
  readonly items = new Map<string, FetchedSource>();
  readonly failures = new Map<string, Error>();

  async fetch(url: string): Promise<FetchedSource> {
    const id = url.split("/").at(-1)!;
    const failure = this.failures.get(id);
    if (failure) throw failure;
    const value = this.items.get(id);
    if (!value) throw new Error(`Missing ${id}`);
    return structuredClone(value);
  }

  failFor(id: string, error: Error) {
    this.failures.set(id, error);
  }
}

function setup() {
  const fetcher = new SourceFetcher();
  const store = new InMemoryDiscussionStore();
  let tick = 0;
  const service = createDiscussionService({
    store,
    fetchSource: (url) => fetcher.fetch(url),
    now: () => `2026-01-03T00:00:0${tick++}.000Z`,
  });
  return { fetcher, service, store };
}

describe("discussion service", () => {
  it("retries the merge when translation is saved between reading and committing a refresh", async () => {
    const { fetcher, service, store } = setup();
    const primary = source("100"); fetcher.items.set("100", primary);
    const created = await service.createDiscussion({ primaryUrl: primary.url });
    const commit = store.updateSourceIfUnchanged.bind(store);
    vi.spyOn(store, "updateSourceIfUnchanged").mockImplementationOnce(async (replacement, expected) => {
      const latest = (await store.getSourceByStatusId("100"))!;
      await store.updateSource({ ...latest, lastAttemptedAt: "2026-01-03T00:00:00.002Z", blocks: latest.blocks.map(block => ({ ...block, translationZh: "提交期间保存的译文。" })) });
      return commit(replacement, expected);
    });
    expect((await service.refreshSource(created.discussion.slug, "100")).blocks[0].translationZh).toBe("提交期间保存的译文。");
    expect(store.updateSourceIfUnchanged).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])("preserves translations saved during an upstream refresh (success=%s)", async success => {
    const { fetcher, service, store } = setup();
    const primary = source("100"); fetcher.items.set("100", primary);
    const created = await service.createDiscussion({ primaryUrl: primary.url });
    vi.spyOn(fetcher, "fetch").mockImplementation(async () => {
      const latest = (await store.getSourceByStatusId("100"))!;
      await store.updateSource({ ...latest, lastAttemptedAt: "2026-01-03T00:00:00.001Z", blocks: latest.blocks.map(block => ({ ...block, translationZh: "并发保存的译文。" })) });
      if (!success) throw new Error("offline"); return primary;
    });
    expect((await service.refreshSource(created.discussion.slug, "100")).blocks[0].translationZh).toBe("并发保存的译文。");
  });
  it("retains translations of unchanged blocks when refreshing a source", async () => {
    const { fetcher, service } = setup();
    const primary = source("100", { blocks: [{ id: "a", kind: "paragraph", text: "English original", translationZh: "中文译文" }] });
    fetcher.items.set("100", primary);
    const created = await service.createDiscussion({ primaryUrl: primary.url });
    fetcher.items.set("100", { ...primary, blocks: [{ id: "a", kind: "paragraph", text: "English original" }] });
    expect((await service.refreshSource(created.discussion.slug, "100")).blocks[0].translationZh).toBe("中文译文");
    fetcher.items.set("100", { ...primary, blocks: [{ id: "a", kind: "paragraph", text: "Changed English original" }] });
    expect((await service.refreshSource(created.discussion.slug, "100")).blocks[0].translationZh).toBeUndefined();
  });
  it("creates a published discussion with its complete primary snapshot", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    fetcher.items.set(primary.xStatusId, primary);

    const result = await service.createDiscussion({
      primaryUrl: primary.url,
      title: undefined,
      description: undefined,
      slug: undefined,
      status: undefined,
    });

    expect(result.discussion.slug).toBe("wtf-is-pearl");
    expect(result.primary.blocks[0].text).toBe("Complete primary text");
    expect(result.discussion.status).toBe("published");
    expect(result.discussion).not.toHaveProperty("primary");
  });

  it("adds responses once and reads them in original publication order", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    const late = source("300", { publishedAt: "2026-01-04T00:00:00.000Z" });
    const early = source("200", { publishedAt: "2026-01-02T00:00:00.000Z" });
    for (const item of [primary, late, early]) fetcher.items.set(item.xStatusId, item);
    await service.createDiscussion({ primaryUrl: primary.url });

    const results = await service.addSources("wtf-is-pearl", [late.url, early.url, early.url]);
    const discussion = await service.getPublishedDiscussion("wtf-is-pearl");

    expect(results.map((result) => result.outcome)).toEqual(["created", "created", "duplicate"]);
    expect(discussion!.sources.map((item) => item.xStatusId)).toEqual([primary.xStatusId, early.xStatusId, late.xStatusId]);
  });

  it("records a refresh failure without erasing an older successful snapshot", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    fetcher.items.set(primary.xStatusId, primary);
    await service.createDiscussion({ primaryUrl: primary.url });

    fetcher.failFor(primary.xStatusId, new Error("upstream unavailable"));
    await service.refreshSource("wtf-is-pearl", primary.xStatusId);
    const result = await service.getPublishedDiscussion("wtf-is-pearl");
    const stored = result!.sources[0];

    expect(stored.blocks[0].text).toBe("Complete primary text");
    expect(stored.fetchStatus).toBe("failed");
    expect(stored.lastFetchError).toBe("upstream unavailable");
  });

  it("excludes drafts from public reads", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    fetcher.items.set(primary.xStatusId, primary);
    await service.createDiscussion({ primaryUrl: primary.url, status: "draft" });

    expect(await service.listPublishedDiscussions()).toEqual([]);
    expect(await service.getPublishedDiscussion("wtf-is-pearl")).toBeUndefined();
  });

  it("suffixes an occupied derived slug", async () => {
    const { fetcher, service } = setup();
    const first = source("100");
    const second = source("200");
    fetcher.items.set(first.xStatusId, first);
    fetcher.items.set(second.xStatusId, second);
    await service.createDiscussion({ primaryUrl: first.url });

    const result = await service.createDiscussion({ primaryUrl: second.url });

    expect(result.discussion.slug).toBe("wtf-is-pearl-2");
  });

  it("persists a failed response without rolling back a successful one", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    const successful = source("200");
    const failedUrl = "https://x.com/blocmates/status/300";
    fetcher.items.set(primary.xStatusId, primary);
    fetcher.items.set(successful.xStatusId, successful);
    fetcher.failFor("300", new Error("rate limited"));
    await service.createDiscussion({ primaryUrl: primary.url });

    const results = await service.addSources("wtf-is-pearl", [successful.url, failedUrl]);
    const detail = await service.getPublishedDiscussion("wtf-is-pearl");
    const failed = detail!.sources.find((item) => item.xStatusId === "300")!;

    expect(results.map((result) => result.outcome)).toEqual(["created", "failed"]);
    expect(failed).toMatchObject({
      url: "https://x.com/blocmates/status/300",
      fetchStatus: "failed",
      blocks: [],
      lastFetchError: "rate limited",
    });
  });

  it("uses the first content block as a title fallback and returns a public summary", async () => {
    const { fetcher, service } = setup();
    const primary = source("100", {
      title: null,
      blocks: [{ id: "block", kind: "paragraph", text: "  The first useful block  " }],
    });
    fetcher.items.set(primary.xStatusId, primary);

    await service.createDiscussion({ primaryUrl: primary.url, description: "A concise description" });
    const [card] = await service.listPublishedDiscussions();

    expect(card).toMatchObject({
      slug: "the-first-useful-block",
      title: "The first useful block",
      description: "A concise description",
      summary: "The first useful block",
      responseCount: 0,
      detailUrl: "/archive/community-discussion/the-first-useful-block",
      primary: { xStatusId: primary.xStatusId, url: primary.url },
    });
  });

  it("persists a bounded primary-block preface when the description is blank", async () => {
    const { fetcher, service } = setup();
    const preface = "x".repeat(240);
    const primary = source("100", { blocks: [{ id: "block", kind: "paragraph", text: preface }] });
    fetcher.items.set(primary.xStatusId, primary);

    await service.createDiscussion({ primaryUrl: primary.url, description: "   " });
    const detail = await service.getPublishedDiscussion("wtf-is-pearl");

    expect(detail!.description).toBe(preface.slice(0, 200));
  });

  it("makes concurrent duplicate response writes idempotent", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    const response = source("200");
    fetcher.items.set(primary.xStatusId, primary);
    fetcher.items.set(response.xStatusId, response);
    await service.createDiscussion({ primaryUrl: primary.url });

    const results = await Promise.all([
      service.addSources("wtf-is-pearl", [response.url]),
      service.addSources("wtf-is-pearl", [response.url]),
    ]);
    const detail = await service.getPublishedDiscussion("wtf-is-pearl");

    expect(results.flat().map((result) => result.outcome).sort()).toEqual(["created", "duplicate"]);
    expect(detail!.sources.filter((item) => item.xStatusId === response.xStatusId)).toHaveLength(1);
  });

  it("allocates distinct response positions for concurrent new sources", async () => {
    const { fetcher, service } = setup();
    const primary = source("100");
    const first = source("200");
    const second = source("300");
    for (const item of [primary, first, second]) fetcher.items.set(item.xStatusId, item);
    await service.createDiscussion({ primaryUrl: primary.url });

    await Promise.all([
      service.addSources("wtf-is-pearl", [first.url]),
      service.addSources("wtf-is-pearl", [second.url]),
    ]);
    const detail = await service.getPublishedDiscussion("wtf-is-pearl");

    expect(detail!.sources.filter((item) => item.role === "response").map((item) => item.position).sort()).toEqual([0, 1]);
  });

  it("does not let a tweet title override an administrator supplied discussion title", async () => {
    const { fetcher, service } = setup();
    const primary = source("100", {
      sourceType: "tweet",
      title: "A tweet metadata title",
      blocks: [{ id: "block", kind: "paragraph", text: "Tweet body fallback" }],
    });
    fetcher.items.set(primary.xStatusId, primary);

    const result = await service.createDiscussion({ primaryUrl: primary.url, title: "Administrator title" });

    expect(result.discussion.title).toBe("Administrator title");
    expect(result.discussion.slug).toBe("administrator-title");
  });
});
