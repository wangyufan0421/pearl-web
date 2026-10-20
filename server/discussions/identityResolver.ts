import { extractCommunityIdentity, extractUserIdentity, type AuthorIdentity } from "../communityDiscussion.js";
import { normalizeXStatusUrl } from "./urls.js";

type ResponseLike = { ok: boolean; json(): Promise<unknown> };
type FetchLike = (input: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<ResponseLike>;
type Options = { apiKey: string; fetch?: FetchLike };

const endpoint = "https://twitter241.p.rapidapi.com";
const emptyIdentity = (): AuthorIdentity => ({ userId: null, author: null, handle: null, avatarUrl: null });
const complete = (identity: AuthorIdentity) => Boolean(identity.userId && identity.author && identity.handle && identity.avatarUrl);

function mergeIdentity(first: AuthorIdentity, second: AuthorIdentity): AuthorIdentity {
  if (!first.userId) return second;
  if (second.userId !== first.userId) return first;
  return {
    userId: first.userId,
    author: second.author ?? first.author,
    handle: second.handle ?? first.handle,
    avatarUrl: second.avatarUrl ?? first.avatarUrl,
  };
}

export function createTwitter241IdentityResolver({ apiKey, fetch = globalThis.fetch as FetchLike }: Options) {
  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, endpoint);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url.toString(), {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "twitter241.p.rapidapi.com" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Twitter241 identity lookup unavailable");
    return response.json();
  }

  async function userById(userId: string): Promise<AuthorIdentity> {
    const payload = await request("/get-users", { users: userId });
    return extractUserIdentity(payload, userId);
  }

  return {
    async resolve(url: string, knownUserId?: string | null, initialTweetPayload?: unknown): Promise<AuthorIdentity> {
      const normalized = normalizeXStatusUrl(url);
      const target = { xStatusId: normalized.statusId, url: normalized.url };
      if (knownUserId) {
        try {
          return await userById(knownUserId);
        } catch { return emptyIdentity(); }
      }

      const primaryPayload = initialTweetPayload ?? await request("/tweet", { pid: normalized.statusId });
      let identity = extractCommunityIdentity(target, primaryPayload);
      if (complete(identity)) return identity;

      try {
        const alternate = extractCommunityIdentity(target, await request("/tweet-v2", { pid: normalized.statusId }));
        identity = mergeIdentity(identity, alternate);
      } catch { /* Preserve the first successful tweet response. */ }
      if (!identity.userId) return emptyIdentity();
      if (complete(identity)) return identity;

      try { identity = mergeIdentity(identity, await userById(identity.userId)); } catch { /* Incomplete verified identity may still be useful. */ }
      return identity;
    },
  };
}

export type Twitter241IdentityResolver = ReturnType<typeof createTwitter241IdentityResolver>;
