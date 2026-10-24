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
  listAdminDiscussions: DiscussionStore["listAdminDiscussions"];
  getAdminDiscussion: DiscussionStore["getAdminDiscussion"];
  manageDiscussion(slug: string, action: "hide" | "restore" | "delete"): Promise<void>;
  createDiscussion(input: CreateDiscussionInput): Promise<{ discussion: Awaited<ReturnType<DiscussionStore["createDiscussionWithPrimary"]>>["discussion"]; primary: StoredSource }>;
  addSources(slug: string, urls: string[]): Promise<SourceWriteOutcome[]>;
  refreshSource(slug: string, statusId: string): Promise<StoredSource>;
  repairSourceParent(slug: string, statusId: string): Promise<StoredSource>;
  setSourceParent(slug: string, statusId: string, parentStatusId: string): Promise<StoredSource>;
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
    authorUserId: source.authorUserId ?? null,
    parentStatusId: source.parentStatusId ?? null,
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
    if (candidate === "new") candidate = "new-discussion";
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
    const primary = toSuccessfulSource({ ...fetched, xStatusId: normalized.statusId, url: normalized.url, parentStatusId: null }, normalized.url, attemptedAt);
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
          authorUserId: null,
          parentStatusId: null,
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
    const normalized = normalizeXStatusUrl(source.url);
    let fetched: FetchedSource | undefined;
    let fetchError: string | null = null;
    try {
      fetched = await fetchSource(normalized.url);
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error);
    }
    for (let retry = 0; retry < 5; retry++) {
      const latest = await store.getSourceForDiscussion(slug, statusId);
      if (!latest) throw new Error(`Source not found in discussion: ${statusId}`);
      const revision = new Date(Math.max(Date.parse(attemptedAt), Date.parse(latest.lastAttemptedAt) + 1)).toISOString();
      let replacement: StoredSource;
      if (fetched) {
        const blocks = fetched.blocks.map(block => {
          const previous = latest.blocks.find(saved => saved.id === block.id && saved.kind === block.kind && saved.text === block.text);
          return previous?.translationZh ? { ...block, translationZh: previous.translationZh } : block;
        });
        replacement = toSuccessfulSource({
          ...fetched,
          blocks,
          xStatusId: source.xStatusId,
          url: normalized.url,
          // The identity queue owns changes to already-saved author metadata.
          author: latest.author ?? fetched.author,
          handle: latest.handle ?? fetched.handle,
          avatarUrl: latest.avatarUrl ?? fetched.avatarUrl,
          authorUserId: latest.authorUserId ?? fetched.authorUserId ?? null,
          // Relationship repair is a separate parent-only operation; content refresh
          // must not race with an administrator's manual parent assignment.
          parentStatusId: latest.parentStatusId ?? null,
        }, normalized.url, revision, latest) as StoredSource;
      } else {
        replacement = { ...latest, fetchStatus: "failed", lastAttemptedAt: revision, lastFetchError: fetchError };
      }
      const saved = await store.updateSourceIfUnchanged(replacement, latest.lastAttemptedAt);
      if (saved) return saved;
    }
    throw new Error("Source changed during refresh; please retry");
  }

  async function repairSourceParent(slug: string, statusId: string) {
    const source = await store.getSourceForDiscussion(slug, statusId);
    if (!source) throw new Error(`Source not found in discussion: ${statusId}`);
    if (source.role === "primary" || source.parentStatusId) return source;
    const fetched = await fetchSource(source.url);
    const parentId = fetched.parentStatusId;
    if (!parentId || !/^[0-9]+$/.test(parentId) || parentId === source.xStatusId) return source;
    return store.updateSourceParent(slug, statusId, parentId, true);
  }

  async function setSourceParent(slug: string, statusId: string, parentStatusId: string) {
    const source = await store.getSourceForDiscussion(slug, statusId);
    if (!source || source.role !== "response") throw new Error(`Source not found in discussion: ${statusId}`);
    if (statusId === parentStatusId) throw new Error("A source cannot reply to itself");
    const parent = await store.getSourceForDiscussion(slug, parentStatusId);
    if (!parent) throw new Error(`Parent not found in discussion: ${parentStatusId}`);
    const seen = new Set<string>([statusId]);
    let cursor: StoredSource | undefined = parent;
    while (cursor) {
      if (seen.has(cursor.xStatusId)) throw new Error("Reply relationship would create a cycle");
      seen.add(cursor.xStatusId);
      cursor = cursor.parentStatusId ? await store.getSourceForDiscussion(slug, cursor.parentStatusId) : undefined;
    }
    return store.updateSourceParent(slug, statusId, parentStatusId, false);
  }
  return {
    listAdminDiscussions: () => store.listAdminDiscussions(),
    getAdminDiscussion: slug => store.getAdminDiscussion(slug),
    manageDiscussion: (slug, action) => action === "delete" ? store.deleteDiscussion(slug) : store.setDiscussionStatus(slug, action === "hide" ? "draft" : "published"),
    createDiscussion,
    addSources,
    refreshSource,
    repairSourceParent,
    setSourceParent,
    listPublishedDiscussions: () => store.listPublishedDiscussions(),
    getPublishedDiscussion: (slug) => store.getPublishedDiscussion(slug),
  };
}
