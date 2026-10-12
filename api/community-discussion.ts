import { loadDiscussion } from "../server/communityDiscussion";

type RequestLike = { query?: Record<string, string | string[] | undefined> };
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  try {
    const discussion = firstQueryValue(request.query?.discussion) ?? "";
    const payload = await loadDiscussion(discussion);
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load community discussion";
    const status = message === "Unknown community discussion" ? 404 : 503;
    response.status(status).json({ error: "discussion_unavailable", message });
  }
}
