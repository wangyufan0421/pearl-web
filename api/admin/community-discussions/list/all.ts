import { createLiveDiscussionHandlers, toDiscussionHttpRequest, writeDiscussionHttpResponse, type VercelLikeRequest, type VercelLikeResponse } from "../../../../server/discussions/runtime";
export default async function handler(request: VercelLikeRequest & { method?: string }, response: VercelLikeResponse) {
  const result = request.method === "GET" ? await createLiveDiscussionHandlers().handleAdminList(toDiscussionHttpRequest(request)) : { status: 405, body: { error: "method_not_allowed" } };
  return writeDiscussionHttpResponse(response, result);
}
