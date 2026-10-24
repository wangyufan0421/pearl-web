import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  handlers: {
    handleListDiscussions: vi.fn(),
    handleGetDiscussion: vi.fn(),
    handleCreateDiscussion: vi.fn(),
    handleAddSources: vi.fn(),
    handleRefreshSource: vi.fn(),
    handleRepairSourceParent: vi.fn(),
    handleSetSourceParent: vi.fn(),
    handleVerifyAdmin: vi.fn(),
  },
}));

vi.mock("./runtime", async () => {
  const actual = await vi.importActual<typeof import("./runtime")>("./runtime");
  return { ...actual, createLiveDiscussionHandlers: () => mocked.handlers };
});

import listHandler from "../../api/community-discussions";
import detailHandler from "../../api/community-discussion";
import createHandler from "../../api/admin/community-discussions/index";
import sourcesHandler from "../../api/admin/community-discussions/[slug]/sources";
import refreshHandler from "../../api/admin/community-discussions/[slug]/sources/[statusId]/refresh";

function response() {
  const json = vi.fn();
  return { response: { status: vi.fn().mockReturnValue({ json }) }, json };
}

describe("community discussion Vercel adapters", () => {
  beforeEach(() => {
    for (const handler of Object.values(mocked.handlers)) handler.mockReset();
  });
  it("routes verification GET through the protected admin handler", async () => {
    mocked.handlers.handleVerifyAdmin.mockResolvedValue({ status: 200, body: { authorized: true } });
    const verified = response();
    await createHandler({ method: "GET", headers: { authorization: "Bearer test-token" } }, verified.response);
    expect(mocked.handlers.handleVerifyAdmin).toHaveBeenCalledWith(expect.objectContaining({ headers: { authorization: "Bearer test-token" } }));
    expect(verified.response.status).toHaveBeenCalledWith(200);
    expect(verified.json).toHaveBeenCalledWith({ authorized: true });
  });

  it("forwards all five routes to their matching HTTP handlers and serializes each result", async () => {
    mocked.handlers.handleListDiscussions.mockResolvedValue({ status: 200, body: { discussions: [] } });
    mocked.handlers.handleGetDiscussion.mockResolvedValue({ status: 200, body: { slug: "published" } });
    mocked.handlers.handleCreateDiscussion.mockResolvedValue({ status: 201, body: { detailUrl: "/archive/community-discussion/published" } });
    mocked.handlers.handleAddSources.mockResolvedValue({ status: 200, body: { outcomes: [] } });
    mocked.handlers.handleRefreshSource.mockResolvedValue({ status: 200, body: { source: { xStatusId: "1" } } });

    const list = response();
    await listHandler({ method: "GET", query: {} }, list.response);
    expect(list.response.status).toHaveBeenCalledWith(200);
    expect(list.json).toHaveBeenCalledWith({ discussions: [] });

    const detail = response();
    await detailHandler({ method: "GET", query: { slug: "published" } }, detail.response);
    expect(mocked.handlers.handleGetDiscussion).toHaveBeenCalledWith(expect.objectContaining({ query: { slug: "published" } }));
    expect(detail.response.status).toHaveBeenCalledWith(200);
    expect(detail.json).toHaveBeenCalledWith({ slug: "published" });

    const create = response();
    await createHandler({ method: "POST", headers: { authorization: "Bearer test-token" }, body: { primaryUrl: "https://x.com/a/status/1" } }, create.response);
    expect(mocked.handlers.handleCreateDiscussion).toHaveBeenCalledWith(expect.objectContaining({ body: { primaryUrl: "https://x.com/a/status/1" } }));
    expect(create.response.status).toHaveBeenCalledWith(201);

    const sources = response();
    await sourcesHandler({ method: "POST", query: { slug: "published" }, body: { urls: ["https://x.com/a/status/1"] } }, sources.response);
    expect(mocked.handlers.handleAddSources).toHaveBeenCalledWith(expect.objectContaining({ params: { slug: "published" } }));
    expect(sources.response.status).toHaveBeenCalledWith(200);
    expect(sources.json).toHaveBeenCalledWith({ outcomes: [] });

    const refresh = response();
    await refreshHandler({ method: "POST", query: { slug: "published", statusId: "1" }, body: {} }, refresh.response);
    expect(mocked.handlers.handleRefreshSource).toHaveBeenCalledWith(expect.objectContaining({ params: { slug: "published", statusId: "1" } }));
    expect(refresh.response.status).toHaveBeenCalledWith(200);
    expect(refresh.json).toHaveBeenCalledWith({ source: { xStatusId: "1" } });
  });
  it("forwards parent repair and override through protected Vercel adapters", async () => {
    const { default: repairHandler } = await import("../../api/admin/community-discussions/[slug]/sources/[statusId]/parent/repair");
    const { default: parentHandler } = await import("../../api/admin/community-discussions/[slug]/sources/[statusId]/parent");
    mocked.handlers.handleRepairSourceParent.mockResolvedValue({ status: 200, body: { source: { parentStatusId: "1" } } });
    mocked.handlers.handleSetSourceParent.mockResolvedValue({ status: 200, body: { source: { parentStatusId: "1" } } });
    await repairHandler({ method: "POST", query: { slug: "topic", statusId: "2" }, body: {} }, response().response);
    await parentHandler({ method: "POST", query: { slug: "topic", statusId: "2" }, body: { parentStatusId: "1" } }, response().response);
    expect(mocked.handlers.handleRepairSourceParent).toHaveBeenCalledWith(expect.objectContaining({ params: { slug: "topic", statusId: "2" } }));
    expect(mocked.handlers.handleSetSourceParent).toHaveBeenCalledWith(expect.objectContaining({ body: { parentStatusId: "1" } }));
  });
});
