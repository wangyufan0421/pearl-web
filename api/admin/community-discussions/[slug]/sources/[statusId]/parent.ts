import { createLiveDiscussionHandlers, toDiscussionHttpRequest, writeDiscussionHttpResponse, type VercelLikeRequest, type VercelLikeResponse } from "../../../../../../server/discussions/runtime";

function param(request: VercelLikeRequest, name: string): string | undefined {
  const value = request.query?.[name];
  return typeof value === "string" ? value : undefined;
}

export default async function handler(request: VercelLikeRequest & { method?: string }, response: VercelLikeResponse) {
  const handlers = createLiveDiscussionHandlers();
  const result = request.method === "POST"
    ? await handlers.handleSetSourceParent(toDiscussionHttpRequest(request, { slug: param(request, "slug"), statusId: param(request, "statusId") }))
    : { status: 400, body: { error: "invalid_request" } };
  return writeDiscussionHttpResponse(response, result);
}
