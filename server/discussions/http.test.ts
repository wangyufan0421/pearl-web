import { describe, expect, it, vi } from "vitest";
import { createDiscussionHttpHandlers, type DiscussionHttpRequest } from "./http";
import { createTwitter241SourceFetcher, toDiscussionHttpRequest, writeDiscussionHttpResponse } from "./runtime";
import type { DiscussionService } from "./service";
import type { PublicDiscussionDetail } from "./store";

const primary = { url: "https://x.com/a/status/1", xStatusId: "1", author: "Pearl", handle: "pearl", avatarUrl: null, publishedAt: null };

function request(body?: unknown, headers?: Record<string, string | undefined>, params?: Record<string, string | undefined>): DiscussionHttpRequest {
  return { body, headers, params };
}

function detail(slug = "wtf-is-pearl"): PublicDiscussionDetail {
  return { slug, title: "WTF is Pearl?", description: null, sources: [{ ...primary, role: "primary", position: 0, fetchedAt: "2026-10-11T00:00:00.000Z", lastAttemptedAt: "2026-10-11T00:00:00.000Z", blocks: [], sourceType: "tweet", fetchStatus: "success", lastFetchError: null }] };
}

function handlers(overrides: Partial<DiscussionService> = {}, compare?: (left: Uint8Array, right: Uint8Array) => boolean) {
  const service: DiscussionService = {
    createDiscussion: vi.fn().mockResolvedValue({ discussion: { slug: "wtf-is-pearl" }, primary: {} }),
    addSources: vi.fn().mockResolvedValue([{ statusId: "2", outcome: "created" }]),
    refreshSource: vi.fn().mockResolvedValue({}),
    repairSourceParent: vi.fn().mockResolvedValue({ xStatusId: "2", parentStatusId: "1", fetchStatus: "success" }),
    setSourceParent: vi.fn().mockResolvedValue({ xStatusId: "2", parentStatusId: "1", fetchStatus: "success" }),
    listPublishedDiscussions: vi.fn().mockResolvedValue([]),
    getPublishedDiscussion: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as DiscussionService;
  return { service, ...createDiscussionHttpHandlers({ service, adminToken: "test-token", compare }) };
}

describe("community discussion HTTP handlers", () => {
  it("requires authentication for hidden reads and lifecycle actions and matching confirmation for deletion", async () => {
    const manageDiscussion = vi.fn().mockResolvedValue(undefined);
    const api = handlers({ manageDiscussion, listAdminDiscussions: vi.fn().mockResolvedValue([]) });
    expect((await api.handleAdminList(request())).status).toBe(401);
    expect((await api.handleAdminDetail(request(undefined, undefined, { slug: "debate" }))).status).toBe(401);
    expect((await api.handleManageDiscussion(request({ action: "delete", confirmation: "debate" }, undefined, { slug: "debate" }))).status).toBe(401);
    expect((await api.handleManageDiscussion(request({ action: "delete" }, { authorization: "Bearer test-token" }, { slug: "debate" }))).status).toBe(400);
    expect(manageDiscussion).not.toHaveBeenCalled();
    expect((await api.handleManageDiscussion(request({ action: "delete", confirmation: "debate" }, { authorization: "Bearer test-token" }, { slug: "debate" }))).status).toBe(200);
    expect(manageDiscussion).toHaveBeenCalledWith("debate", "delete");
  });
  it("verifies admin credentials without reading cloud data or exposing the token", async () => {
    const { handleVerifyAdmin, service } = handlers();
    expect(await handleVerifyAdmin(request())).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(await handleVerifyAdmin(request(undefined, { authorization: "Bearer test-token" }))).toEqual({ status: 200, body: { authorized: true } });
    expect(service.listPublishedDiscussions).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated create", async () => {
    const { handleCreateDiscussion } = handlers();
    expect(await handleCreateDiscussion(request({ primaryUrl: "https://x.com/a/status/1" }))).toMatchObject({ status: 401, body: { error: "unauthorized" } });
  });

  it("creates only with configured bearer", async () => {
    const created = {
      discussion: { id: "discussion-1", slug: "wtf-is-pearl", title: "WTF is Pearl?", description: null, status: "published", primarySourceId: "source-1", createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z" },
      primary: { id: "source-1", discussionId: "discussion-1", xStatusId: "1", url: primary.url, role: "primary", position: 0, fetchStatus: "success", lastFetchError: null },
    };
    const { handleCreateDiscussion, service } = handlers({ createDiscussion: vi.fn().mockResolvedValue(created) });
    const result = await handleCreateDiscussion(request({ primaryUrl: primary.url }, { authorization: "Bearer test-token" }));
    expect(result).toEqual({ status: 201, body: { discussion: created.discussion, primary: created.primary, detailUrl: "/archive/community-discussion/wtf-is-pearl" } });
    expect(service.createDiscussion).toHaveBeenCalledWith({ primaryUrl: primary.url });
  });

  it("does not expose tokens/stacks from public read", async () => {
    const { handleGetDiscussion } = handlers();
    const result = await handleGetDiscussion(request(undefined, undefined, { slug: "missing" }));
    expect(JSON.stringify(result.body)).not.toContain("TWITTER241_API_KEY");
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "not_found" });
  });

  it("replaces stored upstream errors with a safe public refresh message", async () => {
    const unsafe = detail();
    unsafe.sources[0].fetchStatus = "failed";
    unsafe.sources[0].lastFetchError = "TWITTER241_API_KEY=server-only-key\\nError: stack";
    const { handleGetDiscussion } = handlers({ getPublishedDiscussion: vi.fn().mockResolvedValue(unsafe) });
    const result = await handleGetDiscussion(request(undefined, undefined, { slug: "wtf-is-pearl" }));
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain("TWITTER241_API_KEY");
    expect(result.body).toMatchObject({ sources: [{ lastFetchError: "暂时无法更新，可重试" }] });
  });

  it("returns null rather than a raw error for successfully refreshed public sources", async () => {
    const { handleGetDiscussion } = handlers({ getPublishedDiscussion: vi.fn().mockResolvedValue(detail()) });
    const result = await handleGetDiscussion(request(undefined, undefined, { slug: "wtf-is-pearl" }));
    expect(result.body).toMatchObject({ sources: [{ lastFetchError: null }] });
  });

  it("rejects malformed write bodies and mismatched bearer tokens", async () => {
    const { handleCreateDiscussion, handleAddSources } = handlers();
    await expect(handleCreateDiscussion(request({ primaryUrl: "not a url" }, { authorization: "Bearer test-token" }))).resolves.toEqual({ status: 400, body: { error: "invalid_request" } });
    await expect(handleAddSources(request({ urls: [] }, { authorization: "Bearer wrong-token" }, { slug: "wtf-is-pearl" }))).resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("rejects invalid URLs and accepts a slug beyond the old undocumented limit", async () => {
    const longSlug = `discussion-${"a".repeat(121)}`;
    const { handleCreateDiscussion, handleAddSources, service } = handlers();
    await expect(handleCreateDiscussion(request({ primaryUrl: "https://x .com/a/status/1" }, { authorization: "Bearer test-token" }))).resolves.toEqual({ status: 400, body: { error: "invalid_request" } });
    await expect(handleAddSources(request({ urls: ["https://x .com/a/status/1"] }, { authorization: "Bearer test-token" }, { slug: "published" }))).resolves.toEqual({ status: 400, body: { error: "invalid_request" } });
    await expect(handleCreateDiscussion(request({ primaryUrl: primary.url, slug: longSlug }, { authorization: "Bearer test-token" }))).resolves.toMatchObject({ status: 201 });
    expect(service.createDiscussion).toHaveBeenLastCalledWith({ primaryUrl: primary.url, slug: longSlug });
  });

  it("performs a constant-time comparison for every protected POST shape", async () => {
    const compare = vi.fn().mockReturnValue(false);
    const { handleCreateDiscussion, handleAddSources, handleRefreshSource } = handlers({}, compare);
    await handleCreateDiscussion(request({ primaryUrl: primary.url }));
    await handleAddSources(request({ urls: [primary.url] }, { authorization: "Basic wrong" }, { slug: "published" }));
    await handleRefreshSource(request({}, { authorization: "Bearer wrong-token" }, { slug: "published", statusId: "1" }));
    expect(compare).toHaveBeenCalledTimes(3);
    for (const [left, right] of compare.mock.calls) expect(left).toHaveLength(right.length);
  });

  it("excludes drafts from public lists and accepts the temporary detail query alias", async () => {
    const { handleListDiscussions, handleGetDiscussion, service } = handlers({ listPublishedDiscussions: vi.fn().mockResolvedValue([{ slug: "published" }]), getPublishedDiscussion: vi.fn().mockResolvedValue(detail("published")) });
    expect(await handleListDiscussions(request())).toEqual({ status: 200, body: { discussions: [{ slug: "published" }] } });
    expect(await handleGetDiscussion({ query: { discussion: "published" } })).toMatchObject({ status: 200, body: { slug: "published" } });
    expect(service.getPublishedDiscussion).toHaveBeenCalledWith("published");
  });

  it("maps source, refresh, and upstream failures to safe responses", async () => {
    const { handleAddSources, handleRefreshSource, handleCreateDiscussion } = handlers({ addSources: vi.fn().mockRejectedValue(new Error("Discussion not found: missing")), refreshSource: vi.fn().mockRejectedValue(new Error("Source not found in discussion: 9")), createDiscussion: vi.fn().mockRejectedValue(new Error("TWITTER241_API_KEY missing: secret")) });
    await expect(handleAddSources(request({ urls: [primary.url] }, { authorization: "Bearer test-token" }, { slug: "missing" }))).resolves.toEqual({ status: 404, body: { error: "not_found" } });
    await expect(handleRefreshSource(request({}, { authorization: "Bearer test-token" }, { slug: "published", statusId: "9" }))).resolves.toEqual({ status: 404, body: { error: "not_found" } });
    const unavailable = await handleCreateDiscussion(request({ primaryUrl: primary.url }, { authorization: "Bearer test-token" }));
    expect(unavailable).toEqual({ status: 503, body: { error: "discussion_unavailable" } });
    expect(JSON.stringify(unavailable.body)).not.toContain("TWITTER241_API_KEY");
  });

  it("does not return a stored upstream stack from refresh", async () => {
    const { handleRefreshSource } = handlers({ refreshSource: vi.fn().mockResolvedValue({ xStatusId: "1", fetchStatus: "failed", lastFetchError: "TWITTER241_API_KEY=server-only-key\\nError: stack" }) });
    const result = await handleRefreshSource(request({}, { authorization: "Bearer test-token" }, { slug: "published", statusId: "1" }));
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain("TWITTER241_API_KEY");
    expect(result.body).toMatchObject({ source: { lastFetchError: "暂时无法更新，可重试" } });
  });

  it("requires admin auth and validates parent writes while returning safe sources", async () => {
    const api = handlers();
    const params = { slug: "published", statusId: "2" };
    expect((await api.handleRepairSourceParent(request({}, undefined, params))).status).toBe(401);
    expect((await api.handleSetSourceParent(request({ parentStatusId: "bad" }, { authorization: "Bearer test-token" }, params))).status).toBe(400);
    expect(await api.handleRepairSourceParent(request({}, { authorization: "Bearer test-token" }, params))).toMatchObject({ status: 200, body: { source: { parentStatusId: "1" } } });
    expect(await api.handleSetSourceParent(request({ parentStatusId: "1" }, { authorization: "Bearer test-token" }, params))).toMatchObject({ status: 200, body: { source: { parentStatusId: "1" } } });
    expect(api.service.setSourceParent).toHaveBeenCalledWith("published", "2", "1");
  });
});

describe("Twitter241 runtime", () => {
  it("keeps the RapidAPI credential server-side while passing JSON to the extractor", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: "payload" }) });
    const extract = vi.fn().mockReturnValue({ xStatusId: "1", url: primary.url });
    const fetchSource = createTwitter241SourceFetcher({ apiKey: "server-only-key", fetch: fetcher, extract });

    await expect(fetchSource(primary.url)).resolves.toEqual({ xStatusId: "1", url: primary.url });
    expect(fetcher).toHaveBeenCalledWith("https://twitter241.p.rapidapi.com/tweet?pid=1", {
      headers: { "X-RapidAPI-Key": "server-only-key", "X-RapidAPI-Host": "twitter241.p.rapidapi.com" },
    });
    expect(extract).toHaveBeenCalledWith({ xStatusId: "1", url: primary.url }, { data: "payload" });
  });

  it("does not attempt an upstream call without a configured Twitter key", async () => {
    const fetcher = vi.fn();
    await expect(createTwitter241SourceFetcher({ apiKey: undefined, fetch: fetcher })(primary.url)).rejects.toThrow("Twitter source is unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Vercel-like adapter helpers", () => {
  it("forwards only the request shape needed by handlers and writes the exact response", () => {
    expect(toDiscussionHttpRequest({ body: { primaryUrl: primary.url }, headers: { authorization: "Bearer test-token" }, query: { slug: "wtf-is-pearl" } })).toEqual({
      body: { primaryUrl: primary.url }, headers: { authorization: "Bearer test-token" }, query: { slug: "wtf-is-pearl" },
    });
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    writeDiscussionHttpResponse({ status }, { status: 201, body: { detailUrl: "/archive/community-discussion/wtf-is-pearl" } });
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ detailUrl: "/archive/community-discussion/wtf-is-pearl" });
  });
});
