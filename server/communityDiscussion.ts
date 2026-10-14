import type { FetchedSource, SourceBlock } from "./discussions/types.js";

type RecordValue = Record<string, unknown>;

export type NormalizedDiscussionSource = Pick<FetchedSource, "xStatusId" | "url">;

export type FallbackDiscussionMetadata = Pick<
  FetchedSource,
  "author" | "handle" | "avatarUrl" | "publishedAt"
>;

export type DiscussionClock = () => Date | string;

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
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
  const userResult = readPath(tweet, ["core", "user_results", "result"]);
  const userLegacy = readPath(userResult, ["legacy"]);
  const userCore = readPath(userResult, ["core"]);
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
    author: readString(readPath(userCore, ["name"])) ?? readString(readPath(userLegacy, ["name"])) ?? fallback.author ?? null,
    handle: readString(readPath(userCore, ["screen_name"])) ?? readString(readPath(userLegacy, ["screen_name"])) ?? fallback.handle ?? accountFromUrl(normalized.url),
    avatarUrl:
      readString(readPath(userResult, ["avatar", "image_url"])) ?? readString(readPath(userLegacy, ["profile_image_url_https"])) ?? fallback.avatarUrl ?? null,
    publishedAt: readString(isRecord(legacy) ? legacy.created_at : undefined) ?? fallback.publishedAt ?? null,
    fetchedAt: fetchedAt(clock),
    ...content,
  };
}

function accountFromUrl(value: string): string | null {
  try { const account = new URL(value).pathname.split("/")[1]; return /^[a-zA-Z0-9_]{1,15}$/.test(account) && account.toLowerCase() !== "i" ? account : null; } catch { return null; }
}
