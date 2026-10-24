import type { FetchedSource, SourceBlock } from "./discussions/types.js";

type RecordValue = Record<string, unknown>;

export type NormalizedDiscussionSource = Pick<FetchedSource, "xStatusId" | "url">;

export type FallbackDiscussionMetadata = Pick<
  FetchedSource,
  "author" | "handle" | "avatarUrl" | "publishedAt"
>;

export type DiscussionClock = () => Date | string;
export type AuthorIdentity = { userId: string | null; author: string | null; handle: string | null; avatarUrl: string | null };

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function replyStatusId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  const text = readString(value);
  return text && /^[0-9]+$/.test(text) ? text : null;
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function httpsUrl(value: unknown): string | null {
  const text = readString(value);
  if (!text) return null;
  try { return new URL(text).protocol === "https:" ? text : null; } catch { return null; }
}

function identityFromUser(value: unknown): AuthorIdentity {
  const core = readPath(value, ["core"]);
  const legacy = readPath(value, ["legacy"]);
  return {
    userId: readString(readPath(value, ["rest_id"])) ?? readString(readPath(value, ["id_str"])) ?? readString(readPath(legacy, ["id_str"])),
    author: readString(readPath(core, ["name"])) ?? readString(readPath(legacy, ["name"])) ?? readString(readPath(value, ["name"])),
    handle: readString(readPath(core, ["screen_name"])) ?? readString(readPath(legacy, ["screen_name"])) ?? readString(readPath(value, ["screen_name"])),
    avatarUrl: httpsUrl(readPath(value, ["avatar", "image_url"])) ?? httpsUrl(readPath(legacy, ["profile_image_url_https"])) ?? httpsUrl(readPath(value, ["profile_image_url_https"])),
  };
}

function statusIdOf(tweet: RecordValue): string | null {
  return readString(tweet.rest_id) ?? readString(tweet.id_str);
}

function findRootTweet(value: unknown, statusId: string): RecordValue | null {
  const visited = new Set<object>();

  const visit = (candidate: unknown): RecordValue | null => {
    if (!isRecord(candidate) || visited.has(candidate)) return null;
    visited.add(candidate);

    if (statusIdOf(candidate) === statusId) return candidate;

    for (const [key, child] of Object.entries(candidate)) {
      if (key.toLowerCase().includes("quote")) continue;

      if (Array.isArray(child)) {
        for (const entry of child) {
          const found = visit(entry);
          if (found) return found;
        }
      } else {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };

  return visit(value);
}

export function extractCommunityIdentity(normalized: NormalizedDiscussionSource, payload: unknown): AuthorIdentity {
  const tweet = findRootTweet(payload, normalized.xStatusId);
  if (!tweet) return { userId: null, author: null, handle: null, avatarUrl: null };
  const identity = identityFromUser(readPath(tweet, ["core", "user_results", "result"]) ?? readPath(tweet, ["user_results", "result"]) ?? readPath(tweet, ["user"]));
  return { ...identity, userId: identity.userId ?? readString(readPath(tweet, ["legacy", "user_id_str"])) ?? readString(tweet.user_id_str) };
}

export function extractUserIdentity(payload: unknown, userId: string): AuthorIdentity {
  const visited = new Set<object>();
  const visit = (candidate: unknown): AuthorIdentity | null => {
    if (!isRecord(candidate) || visited.has(candidate)) return null;
    visited.add(candidate);
    const identity = identityFromUser(candidate);
    if (identity.userId === userId) return identity;
    for (const child of Object.values(candidate)) {
      if (Array.isArray(child)) {
        for (const item of child) { const found = visit(item); if (found) return found; }
      } else {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(payload) ?? { userId: null, author: null, handle: null, avatarUrl: null };
}

function paragraphs(text: string): SourceBlock[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({ id: `paragraph-${index + 1}`, kind: "paragraph" as const, text: paragraph }));
}

function articleBlocks(tweet: RecordValue): { blocks: SourceBlock[]; title: string | null } | null {
  const article = readPath(tweet, ["article", "article_results", "result"]);
  if (!isRecord(article) || !Array.isArray(readPath(article, ["content_state", "blocks"]))) return null;

  const blocks = (readPath(article, ["content_state", "blocks"]) as unknown[])
    .map((block, index): SourceBlock | null => {
      if (!isRecord(block)) return null;
      const text = readString(block.text) ?? readString(block.content);
      if (!text) return null;
      const rawKind = (readString(block.type) ?? readString(block.block_type) ?? "").toLowerCase();
      const kind = rawKind.includes("head") || rawKind.includes("title")
        ? "heading"
        : rawKind.includes("quote")
          ? "quote"
          : "paragraph";
      return { id: readString(block.id) ?? `${kind}-${index + 1}`, kind, text };
    })
    .filter((block): block is SourceBlock => block !== null);

  return blocks.length ? { blocks, title: readString(article.title) } : null;
}

function fetchedAt(clock: DiscussionClock): string {
  const value = clock();
  return value instanceof Date ? value.toISOString() : value;
}

export function extractCommunityDiscussion(
  normalized: NormalizedDiscussionSource,
  payload: unknown,
  fallback: Partial<FallbackDiscussionMetadata> = {},
  clock: DiscussionClock = () => new Date(),
): FetchedSource {
  const tweet = findRootTweet(payload, normalized.xStatusId);
  if (!tweet) throw new Error(`Could not find X status ${normalized.xStatusId} in the response`);

  const legacy = readPath(tweet, ["legacy"]);
  const identity = extractCommunityIdentity(normalized, payload);
  const article = articleBlocks(tweet);
  const noteText = readString(readPath(tweet, ["note_tweet", "note_tweet_results", "result", "text"]));
  const legacyText = readString(isRecord(legacy) ? legacy.full_text : undefined);

  const content = article
    ? { blocks: article.blocks, sourceType: "article" as const, title: article.title }
    : noteText
      ? { blocks: paragraphs(noteText), sourceType: "noteTweet" as const, title: null }
      : legacyText
        ? { blocks: paragraphs(legacyText), sourceType: "tweet" as const, title: null }
        : null;

  if (!content || !content.blocks.length) {
    throw new Error(`X status ${normalized.xStatusId} has no readable text`);
  }

  return {
    xStatusId: normalized.xStatusId,
    url: normalized.url,
    authorUserId: identity.userId,
    parentStatusId: (() => {
      const id = replyStatusId(readPath(tweet, ["legacy", "in_reply_to_status_id_str"]))
        ?? replyStatusId(tweet.in_reply_to_status_id_str)
        ?? replyStatusId(readPath(tweet, ["legacy", "in_reply_to_status_id"]))
        ?? replyStatusId(tweet.in_reply_to_status_id);
      return id && id !== normalized.xStatusId ? id : null;
    })(),
    author: identity.author ?? fallback.author ?? null,
    handle: identity.handle ?? fallback.handle ?? null,
    avatarUrl: identity.avatarUrl ?? fallback.avatarUrl ?? null,
    publishedAt: readString(isRecord(legacy) ? legacy.created_at : undefined) ?? fallback.publishedAt ?? null,
    fetchedAt: fetchedAt(clock),
    ...content,
  };
}
