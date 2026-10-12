export type SourceBlockKind = "heading" | "quote" | "paragraph";

export type SourceBlock = {
  id: string;
  kind: SourceBlockKind;
  text: string;
};

export type DiscussionSource = {
  sourceId: string;
  href: string;
  fallbackAuthor: string;
  fallbackHandle: string;
  fallbackAvatar: string;
};

export type DiscussionPost = {
  sourceId: string;
  href: string;
  author: string;
  handle: string;
  avatar: string;
  publishedAt?: string;
  blocks: SourceBlock[];
};

export type DiscussionPayload = {
  discussion: "wtf-is-pearl";
  fetchedAt: string;
  sources: DiscussionPost[];
};

export const DISCUSSION_SOURCES: DiscussionSource[] = [
  {
    sourceId: "2108519545514410023",
    href: "https://x.com/blocmates/status/2108519545514410023?s=20",
    fallbackAuthor: "blocmates.",
    fallbackHandle: "@blocmates",
    fallbackAvatar: "https://pbs.twimg.com/profile_images/2016157466698944513/a7EkPcJa_normal.jpg",
  },
  {
    sourceId: "2108528311735607793",
    href: "https://x.com/theoristalgo/status/2108528311735607793",
    fallbackAuthor: "theoristalgo ™️ | ⓝ",
    fallbackHandle: "@theoristalgo",
    fallbackAvatar: "https://pbs.twimg.com/profile_images/2101042430699036672/LI50ARk1_normal.jpg",
  },
  {
    sourceId: "2108568857317118362",
    href: "https://x.com/tokugawasuprema/status/2108568857317118362",
    fallbackAuthor: "Tokugawa The Gem General",
    fallbackHandle: "@tokugawasuprema",
    fallbackAvatar: "https://pbs.twimg.com/profile_images/2048184515663699968/uHZMFwRb_normal.jpg",
  },
  {
    sourceId: "2108579196268077447",
    href: "https://x.com/tulipking/status/2108579196268077447?s=20",
    fallbackAuthor: "Tulip King 🌷",
    fallbackHandle: "@tulipking",
    fallbackAvatar: "https://pbs.twimg.com/profile_images/2062216238223265793/WY21HCO0_normal.jpg",
  },
  {
    sourceId: "2108928836780065031",
    href: "https://x.com/KiwiCryptoBig/status/2108928836780065031",
    fallbackAuthor: "Kiwibig.eth",
    fallbackHandle: "@KiwiCryptoBig",
    fallbackAvatar: "https://pbs.twimg.com/profile_images/1721392814045667328/9uORlqSW_normal.jpg",
  },
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function readPath(root: UnknownRecord, path: string[]): unknown {
  return path.reduce<unknown>((value, key) => asRecord(value)?.[key], root);
}

function findRootTweet(value: unknown, sourceId: string, visited = new Set<object>()): UnknownRecord | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRootTweet(item, sourceId, visited);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value) || visited.has(value)) return undefined;
  visited.add(value);

  const legacy = asRecord(value.legacy);
  if (value.rest_id === sourceId || legacy?.id_str === sourceId) return value;

  for (const child of Object.values(value)) {
    const found = findRootTweet(child, sourceId, visited);
    if (found) return found;
  }
  return undefined;
}

function normalizeBlockKind(type: unknown): SourceBlockKind {
  if (typeof type === "string" && type.startsWith("header")) return "heading";
  if (type === "blockquote") return "quote";
  return "paragraph";
}

function readArticleBlocks(tweet: UnknownRecord): SourceBlock[] {
  const blocks = readPath(tweet, ["article", "article_results", "result", "content_state", "blocks"]);
  if (!Array.isArray(blocks)) return [];

  return blocks.flatMap((block, index) => {
    const record = asRecord(block);
    const text = typeof record?.text === "string" ? record.text.trim() : "";
    if (!text) return [];
    return [{ id: typeof record.key === "string" ? record.key : `article-${index}`, kind: normalizeBlockKind(record.type), text }];
  });
}

function readNoteTweetBlocks(tweet: UnknownRecord): SourceBlock[] {
  const noteText = readPath(tweet, ["note_tweet", "note_tweet_results", "result", "text"]);
  const legacyText = readPath(tweet, ["legacy", "full_text"]);
  const fullText = typeof noteText === "string" ? noteText : typeof legacyText === "string" ? legacyText : "";

  return fullText.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({
    id: `paragraph-${index}`,
    kind: "paragraph" as const,
    text,
  }));
}

function readIdentity(tweet: UnknownRecord, source: DiscussionSource) {
  const user = asRecord(readPath(tweet, ["core", "user_results", "result"]));
  const userCore = asRecord(user?.core);
  const userLegacy = asRecord(user?.legacy);
  const userAvatar = asRecord(user?.avatar);
  const legacy = asRecord(tweet.legacy);
  const name = typeof userCore?.name === "string" ? userCore.name : typeof userLegacy?.name === "string" ? userLegacy.name : source.fallbackAuthor;
  const screenNameValue = typeof userCore?.screen_name === "string" ? userCore.screen_name : userLegacy?.screen_name;
  const screenName = typeof screenNameValue === "string" ? `@${screenNameValue}` : source.fallbackHandle;
  const avatar = typeof userAvatar?.image_url === "string" ? userAvatar.image_url : typeof userLegacy?.profile_image_url_https === "string" ? userLegacy.profile_image_url_https : source.fallbackAvatar;
  const publishedAt = typeof legacy?.created_at === "string" ? legacy.created_at : undefined;
  return { author: name, handle: screenName, avatar, publishedAt };
}

export function extractDiscussionPost(payload: unknown, source: DiscussionSource): DiscussionPost {
  const tweet = findRootTweet(payload, source.sourceId);
  if (!tweet) throw new Error(`Unable to locate source tweet ${source.sourceId}`);

  const articleBlocks = readArticleBlocks(tweet);
  const blocks = articleBlocks.length > 0 ? articleBlocks : readNoteTweetBlocks(tweet);
  if (blocks.length === 0) throw new Error(`Source tweet ${source.sourceId} contains no readable text`);

  return { sourceId: source.sourceId, href: source.href, ...readIdentity(tweet, source), blocks };
}

export async function loadDiscussion(
  discussion: string,
  fetcher: typeof fetch = fetch,
  apiKey = process.env.TWITTER241_API_KEY,
): Promise<DiscussionPayload> {
  if (discussion !== "wtf-is-pearl") throw new Error("Unknown community discussion");
  if (!apiKey) throw new Error("TWITTER241_API_KEY is not configured on the server");

  const sources = await Promise.all(DISCUSSION_SOURCES.map(async (source) => {
    const response = await fetcher(`https://twitter241.p.rapidapi.com/tweet?pid=${source.sourceId}`, {
      headers: {
        "x-rapidapi-host": "twitter241.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
    });
    if (!response.ok) throw new Error(`Twitter241 request failed for ${source.sourceId}: ${response.status}`);
    return extractDiscussionPost(await response.json(), source);
  }));

  return { discussion: "wtf-is-pearl", fetchedAt: new Date().toISOString(), sources };
}
