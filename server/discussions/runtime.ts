import { extractCommunityDiscussion, type NormalizedDiscussionSource } from "../communityDiscussion.js";
import { createSupabaseClient, createSupabaseDiscussionStore } from "./supabaseStore.js";
import { createDiscussionService, type DiscussionService } from "./service.js";
import { createDiscussionHttpHandlers, type DiscussionHttpRequest, type DiscussionHttpResponse } from "./http.js";
import { normalizeXStatusUrl } from "./urls.js";
import { createTwitter241IdentityResolver } from "./identityResolver.js";

type FetchResponse = { ok: boolean; json(): Promise<unknown> };
type FetchLike = (input: string, init: { headers: Record<string, string> }) => Promise<FetchResponse>;
type Extractor = (normalized: NormalizedDiscussionSource, payload: unknown) => ReturnType<typeof extractCommunityDiscussion>;

type Twitter241Options = {
  apiKey: string | undefined;
  fetch?: FetchLike;
  extract?: Extractor;
};

const twitter241Endpoint = "https://twitter241.p.rapidapi.com/tweet";
const twitter241Host = "twitter241.p.rapidapi.com";

export function createTwitter241SourceFetcher({ apiKey, fetch = globalThis.fetch as FetchLike, extract = extractCommunityDiscussion }: Twitter241Options) {
  const identityResolver = apiKey ? createTwitter241IdentityResolver({ apiKey, fetch }) : null;
  return async (url: string) => {
    if (!apiKey) throw new Error("Twitter source is unavailable");
    const normalized = normalizeXStatusUrl(url);
    const source: NormalizedDiscussionSource = { xStatusId: normalized.statusId, url: normalized.url };
    const response = await fetch(`${twitter241Endpoint}?pid=${encodeURIComponent(source.xStatusId)}`, {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": twitter241Host },
    });
    if (!response.ok) throw new Error("Twitter source is unavailable");
    const payload = await response.json();
    const extracted = extract(source, payload);
    if (extracted.author && extracted.handle && extracted.avatarUrl) return extracted;
    try {
      const identity = await identityResolver!.resolve(source.url, null, payload);
      return identity.userId ? {
        ...extracted,
        authorUserId: identity.userId,
        author: identity.author ?? extracted.author,
        handle: identity.handle ?? extracted.handle,
        avatarUrl: identity.avatarUrl ?? extracted.avatarUrl,
      } : extracted;
    } catch { return extracted; }
  };
}

export function createLiveDiscussionService(environment: Record<string, string | undefined> = process.env): DiscussionService {
  const store = createSupabaseDiscussionStore(createSupabaseClient(environment));
  return createDiscussionService({ store, fetchSource: createTwitter241SourceFetcher({ apiKey: environment.TWITTER241_API_KEY }) });
}

export function createLiveDiscussionHandlers(environment: Record<string, string | undefined> = process.env) {
  let service: DiscussionService | undefined;
  const live = () => service ??= createLiveDiscussionService(environment);
  const deferred: DiscussionService = {
    listAdminDiscussions: () => live().listAdminDiscussions(),
    getAdminDiscussion: slug => live().getAdminDiscussion(slug),
    manageDiscussion: (slug, action) => live().manageDiscussion(slug, action),
    createDiscussion: (input) => live().createDiscussion(input),
    addSources: (slug, urls) => live().addSources(slug, urls),
    refreshSource: (slug, statusId) => live().refreshSource(slug, statusId),
    repairSourceParent: (slug, statusId) => live().repairSourceParent(slug, statusId),
    setSourceParent: (slug, statusId, parentStatusId) => live().setSourceParent(slug, statusId, parentStatusId),
    listPublishedDiscussions: () => live().listPublishedDiscussions(),
    getPublishedDiscussion: (slug) => live().getPublishedDiscussion(slug),
  };
  return createDiscussionHttpHandlers({ service: deferred, adminToken: environment.COMMUNITY_ADMIN_TOKEN });
}

export type VercelLikeRequest = {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

export type VercelLikeResponse = { status(status: number): { json(body: unknown): unknown } };

export function toDiscussionHttpRequest(request: VercelLikeRequest, params?: Record<string, string | undefined>): DiscussionHttpRequest {
  const headers = Object.fromEntries(
    Object.entries(request.headers ?? {}).map(([name, header]) => [name, typeof header === "string" ? header : undefined]),
  );
  return { body: request.body, headers, query: request.query, params };
}

export function writeDiscussionHttpResponse(response: VercelLikeResponse, result: DiscussionHttpResponse): unknown {
  return response.status(result.status).json(result.body);
}
