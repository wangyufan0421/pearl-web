import { createLiveDiscussionHandlers, toDiscussionHttpRequest, writeDiscussionHttpResponse, type VercelLikeRequest, type VercelLikeResponse } from "../../../../server/discussions/runtime";
export default async function handler(request: VercelLikeRequest & { method?: string }, response: VercelLikeResponse) {
  const slug = typeof request.query?.slug === "string" ? request.query.slug : undefined;
  const result = request.method === "GET" ? await createLiveDiscussionHandlers().handleAdminDetail(toDiscussionHttpRequest(request, { slug })) : { status: 405, body: { error: "method_not_allowed" } };
  return writeDiscussionHttpResponse(response, result);
}
