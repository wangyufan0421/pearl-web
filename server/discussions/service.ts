import type { FetchedSource } from "./types.js";
import { normalizeXStatusUrl } from "./urls.js";
import type {
  CreateDiscussionWithPrimaryInput,
  DiscussionStatus,
  DiscussionStore,
  SourceWriteOutcome,
  StoredSource,
} from "./store.js";

export type CreateDiscussionInput = {
  primaryUrl: string;
  title?: string;
  description?: string;
  slug?: string;
  status?: DiscussionStatus;
};

export type DiscussionService = {
  createDiscussion(input: CreateDiscussionInput): Promise<{ discussion: Awaited<ReturnType<DiscussionStore["createDiscussionWithPrimary"]>>["discussion"]; primary: StoredSource }>;
  addSources(slug: string, urls: string[]): Promise<SourceWriteOutcome[]>;
  refreshSource(slug: string, statusId: string): Promise<StoredSource>;
  listPublishedDiscussions: DiscussionStore["listPublishedDiscussions"];
  getPublishedDiscussion: DiscussionStore["getPublishedDiscussion"];
};

type Options = {
  store: DiscussionStore;
  fetchSource: (url: string) => Promise<FetchedSource>;
  now?: () => string;
};

function text(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "discussion";
}

function derivedTitle(source: FetchedSource, supplied?: string): string {
  const fallback = source.blocks.map((block) => text(block.text)).find(Boolean);
  const articleTitle = source.sourceType === "article" ? text(source.title) : undefined;
  return (articleTitle ?? text(supplied) ?? fallback?.slice(0, 72) ?? "Untitled discussion").slice(0, 160);
}

function primaryPreface(source: FetchedSource): string | undefined {
  const firstReadableBlock = source.blocks.map((block) => text(block.text)).find(Boolean);
  return firstReadableBlock?.replace(/\s+/g, " ").slice(0, 200);
}

function toSuccessfulSource(source: FetchedSource, url: string, attemptedAt: string, identity?: Pick<StoredSource, "id" | "discussionId" | "role" | "position">): StoredSource | Omit<StoredSource, "id" | "discussionId" | "role" | "position"> {
  const snapshot = {
    xStatusId: source.xStatusId,
    url,
    author: source.author,
    handle: source.handle,
    avatarUrl: source.avatarUrl,
    publishedAt: source.publishedAt,
    fetchedAt: source.fetchedAt,
    lastAttemptedAt: attemptedAt,
    blocks: structuredClone(source.blocks),
    sourceType: source.sourceType,
    fetchStatus: "success" as const,
    lastFetchError: null,
  };
  return identity ? { ...identity, ...snapshot } : snapshot;
}

export function createDiscussionService({ store, fetchSource, now = () => new Date().toISOString() }: Options): DiscussionService {
  async function availableSlug(seed: string): Promise<string> {
    let candidate = slugify(seed);
    let suffix = 2;
    while (await store.getDiscussionBySlug(candidate)) candidate = `${slugify(seed)}-${suffix++}`;
    return candidate;
  }

  async function createDiscussion(input: CreateDiscussionInput) {
    const normalized = normalizeXStatusUrl(input.primaryUrl);
    const fetched = await fetchSource(normalized.url);
    const title = derivedTitle(fetched, input.title);
    const slug = await availableSlug(input.slug ?? title);
    const attemptedAt = now();
    const primary = toSuccessfulSource({ ...fetched, xStatusId: normalized.statusId, url: normalized.url }, normalized.url, attemptedAt);
    const payload: CreateDiscussionWithPrimaryInput = {
      slug,
      title,
      description: text(input.description) ?? primaryPreface(fetched) ?? null,
      status: input.status ?? "published",
      createdAt: attemptedAt,
      updatedAt: attemptedAt,
      primary: primary as CreateDiscussionWithPrimaryInput["primary"],
    };
    return store.createDiscussionWithPrimary(payload);
  }

  async function addSources(slug: string, urls: string[]): Promise<SourceWriteOutcome[]> {
    const discussion = await store.getDiscussionBySlug(slug);
    if (!discussion) throw new Error(`Discussion not found: ${slug}`);
    const results: SourceWriteOutcome[] = [];
    for (const rawUrl of urls) {
      const normalized = normalizeXStatusUrl(rawUrl);
      if (await store.getSourceByStatusId(normalized.statusId)) {
        results.push({ statusId: normalized.statusId, outcome: "duplicate" });
        continue;
      }
      const attemptedAt = now();
      let fetched: FetchedSource;
      try {
        fetched = await fetchSource(normalized.url);
      } catch (error) {
        const stored = await store.createOrDuplicateResponse({
          discussionId: discussion.id,
          xStatusId: normalized.statusId,
          url: normalized.url,
          role: "response",
          author: null,
          handle: null,
          avatarUrl: null,
          publishedAt: null,
          fetchedAt: null,
          lastAttemptedAt: attemptedAt,
          blocks: [],
          sourceType: null,
          fetchStatus: "failed",
          lastFetchError: error instanceof Error ? error.message : String(error),
        });
        results.push({ statusId: normalized.statusId, outcome: stored.outcome === "duplicate" ? "duplicate" : "failed" });
        continue;
      }
      const stored = await store.createOrDuplicateResponse({
        ...(toSuccessfulSource({ ...fetched, xStatusId: normalized.statusId, url: normalized.url }, normalized.url, attemptedAt) as Omit<StoredSource, "id" | "discussionId" | "role" | "position">),
        discussionId: discussion.id,
        role: "response",
      });
      results.push({ statusId: normalized.statusId, outcome: stored.outcome });
    }
    return results;
  }

  async function refreshSource(slug: string, statusId: string) {
    const source = await store.getSourceForDiscussion(slug, statusId);
    if (!source) throw new Error(`Source not found in discussion: ${statusId}`);
    const attemptedAt = now();
    try {
      const normalized = normalizeXStatusUrl(source.url);
      const fetched = await fetchSource(normalized.url);
      return store.updateSource(toSuccessfulSource({ ...fetched, xStatusId: source.xStatusId, url: normalized.url }, normalized.url, attemptedAt, source) as StoredSource);
    } catch (error) {
      return store.updateSource({
        ...source,
        fetchStatus: "failed",
        lastAttemptedAt: attemptedAt,
        lastFetchError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    createDiscussion,
    addSources,
    refreshSource,
    listPublishedDiscussions: () => store.listPublishedDiscussions(),
    getPublishedDiscussion: (slug) => store.getPublishedDiscussion(slug),
  };
}
