import { createLiveDiscussionHandlers, toDiscussionHttpRequest } from "./runtime.js";
import type { DiscussionHttpResponse } from "./http.js";

export function createDiscussionRouter(environment: Record<string, string | undefined>) {
  const handlers = createLiveDiscussionHandlers(environment);
  return async (url: URL, method: string, headers: Record<string, string | string[] | undefined>, body?: unknown): Promise<DiscussionHttpResponse> => {
    const query = Object.fromEntries(url.searchParams.entries());
    if (url.pathname === "/api/admin/community-discussions/list/all" && method === "GET") return handlers.handleAdminList(toDiscussionHttpRequest({ headers }));
    const adminMatch = /^\/api\/admin\/community-discussions\/([a-z0-9-]+)(\/manage)?$/.exec(url.pathname);
    if (adminMatch) {
      const adminRequest = toDiscussionHttpRequest({ headers, body }, { slug: adminMatch[1] });
      if (adminMatch[2] && method === "POST") return handlers.handleManageDiscussion(adminRequest);
      if (!adminMatch[2] && method === "GET") return handlers.handleAdminDetail(adminRequest);
    }
    const match = /^\/api\/admin\/community-discussions\/([a-z0-9-]+)\/sources(?:\/([0-9]+)\/refresh)?$/.exec(url.pathname);
    const request = toDiscussionHttpRequest({ body, headers, query }, match ? { slug: match[1], statusId: match[2] } : undefined);
    if (url.pathname === "/api/community-discussions" && method === "GET") return handlers.handleListDiscussions(request);
    if (url.pathname === "/api/community-discussion" && method === "GET") return handlers.handleGetDiscussion(request);
    if (url.pathname === "/api/admin/community-discussions") {
      if (method === "GET") return handlers.handleVerifyAdmin(request);
      if (method === "POST") return handlers.handleCreateDiscussion(request);
    }
    if (match && method === "POST") return match[2] ? handlers.handleRefreshSource(request) : handlers.handleAddSources(request);
    return { status: 404, body: { error: "not_found" } };
  };
}
