import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DiscussionService } from "./service.js";
import type { PublicDiscussionDetail } from "./store.js";

export type DiscussionHttpRequest = {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
};

export type DiscussionHttpResponse = { status: number; body: unknown };

type Dependencies = {
  service: DiscussionService;
  adminToken: string | undefined;
  compare?: (left: Uint8Array, right: Uint8Array) => boolean;
};

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const createBody = z.object({
  primaryUrl: z.string().url(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(600).optional(),
  slug: slug.optional(),
  status: z.enum(["draft", "published"]).optional(),
}).strict();
const sourceBody = z.object({ urls: z.array(z.string().url()).min(1).max(50) }).strict();

function value(input: string | string[] | undefined): string | undefined {
  return typeof input === "string" ? input : undefined;
}

function header(request: DiscussionHttpRequest, name: string): string | undefined {
  const entry = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

function authorized(
  request: DiscussionHttpRequest,
  expected: string | undefined,
  compare: (left: Uint8Array, right: Uint8Array) => boolean,
): boolean {
  const matched = /^Bearer ([^\s]+)$/.exec(header(request, "authorization") ?? "");
  const provided = matched?.[1] ?? "<invalid-bearer-token>";
  const digest = (token: string) => createHash("sha256").update(token).digest();
  const equal = compare(digest(provided), digest(expected ?? "<missing-community-admin-token>"));
  return equal && Boolean(expected) && Boolean(matched);
}

function error(error: "unauthorized" | "invalid_request" | "not_found" | "discussion_unavailable", status: number): DiscussionHttpResponse {
  return { status, body: { error } };
}

function mapFailure(cause: unknown): DiscussionHttpResponse {
  const message = cause instanceof Error ? cause.message : "";
  if (/not found/i.test(message)) return error("not_found", 404);
  if (/expected an x status url/i.test(message)) return error("invalid_request", 400);
  return error("discussion_unavailable", 503);
}

function protectedRoute(
  request: DiscussionHttpRequest,
  adminToken: string | undefined,
  compare: (left: Uint8Array, right: Uint8Array) => boolean,
): DiscussionHttpResponse | undefined {
  return authorized(request, adminToken, compare) ? undefined : error("unauthorized", 401);
}

function safeSource<T extends { lastFetchError?: unknown; fetchStatus?: unknown }>(source: T) {
  const { lastFetchError: _lastFetchError, ...safe } = source;
  return { ...safe, lastFetchError: source.fetchStatus === "failed" ? "暂时无法更新，可重试" : null };
}

function publicDetail(detail: PublicDiscussionDetail) {
  return {
    ...detail,
    sources: detail.sources.map(safeSource),
  };
}

export function createDiscussionHttpHandlers({ service, adminToken, compare = timingSafeEqual }: Dependencies) {
  return {
    async handleVerifyAdmin(request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      const failure = protectedRoute(request, adminToken, compare);
      return failure ?? { status: 200, body: { authorized: true } };
    },
    async handleListDiscussions(_request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      try {
        return { status: 200, body: { discussions: await service.listPublishedDiscussions() } };
      } catch (cause) {
        return mapFailure(cause);
      }
    },

    async handleGetDiscussion(request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      const discussionSlug = request.params?.slug ?? value(request.query?.slug) ?? value(request.query?.discussion);
      if (!discussionSlug) return error("not_found", 404);
      try {
        const discussion = await service.getPublishedDiscussion(discussionSlug);
        return discussion ? { status: 200, body: publicDetail(discussion) } : error("not_found", 404);
      } catch (cause) {
        return mapFailure(cause);
      }
    },

    async handleCreateDiscussion(request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      const authenticationFailure = protectedRoute(request, adminToken, compare);
      if (authenticationFailure) return authenticationFailure;
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) return error("invalid_request", 400);
      try {
        const { discussion, primary } = await service.createDiscussion(parsed.data);
        return { status: 201, body: { discussion, primary, detailUrl: `/archive/community-discussion/${discussion.slug}` } };
      } catch (cause) {
        return mapFailure(cause);
      }
    },

    async handleAddSources(request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      const authenticationFailure = protectedRoute(request, adminToken, compare);
      if (authenticationFailure) return authenticationFailure;
      const discussionSlug = request.params?.slug;
      const parsed = sourceBody.safeParse(request.body);
      if (!discussionSlug || !parsed.success) return error("invalid_request", 400);
      try {
        return { status: 200, body: { outcomes: await service.addSources(discussionSlug, parsed.data.urls) } };
      } catch (cause) {
        return mapFailure(cause);
      }
    },

    async handleRefreshSource(request: DiscussionHttpRequest): Promise<DiscussionHttpResponse> {
      const authenticationFailure = protectedRoute(request, adminToken, compare);
      if (authenticationFailure) return authenticationFailure;
      const discussionSlug = request.params?.slug;
      const statusId = request.params?.statusId;
      if (!discussionSlug || !statusId) return error("invalid_request", 400);
      try {
        const source = await service.refreshSource(discussionSlug, statusId);
        return { status: 200, body: { source: safeSource(source) } };
      } catch (cause) {
        return mapFailure(cause);
      }
    },
  };
}
