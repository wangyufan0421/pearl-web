import { createLiveDiscussionHandlers, toDiscussionHttpRequest, writeDiscussionHttpResponse, type VercelLikeRequest, type VercelLikeResponse } from "../../../server/discussions/runtime";

export default async function handler(request: VercelLikeRequest & { method?: string }, response: VercelLikeResponse) {
  const handlers = createLiveDiscussionHandlers();
  const result = request.method === "GET"
    ? await handlers.handleVerifyAdmin(toDiscussionHttpRequest(request))
    : request.method === "POST"
    ? await handlers.handleCreateDiscussion(toDiscussionHttpRequest(request))
    : { status: 400, body: { error: "invalid_request" } };
  return writeDiscussionHttpResponse(response, result);
}
