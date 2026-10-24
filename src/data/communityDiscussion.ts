import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const identitySchema = z.object({
  xStatusId: z.string(), url: z.string().url(), author: z.string().nullable(), handle: z.string().nullable(),
  avatarUrl: z.string().nullable(), publishedAt: z.string().nullable(),
});
export const sourceSchema = identitySchema.extend({
  role: z.enum(["primary", "response"]),
  authorUserId: z.string().regex(/^[0-9]+$/).nullable().optional(),
  parentStatusId: z.string().regex(/^[0-9]+$/).nullable().optional(),
  fetchedAt: z.string().nullable(), lastAttemptedAt: z.string(),
  blocks: z.array(z.object({ id: z.string(), kind: z.enum(["heading", "quote", "paragraph"]), text: z.string(), translationZh: z.string().optional() })),
  sourceType: z.enum(["tweet", "noteTweet", "article"]).nullable(),
  position: z.number().int().nonnegative(), fetchStatus: z.enum(["success", "failed"]),
  lastFetchError: z.string().nullable().optional(),
});
export const cardSchema = z.object({
  slug: slugSchema, title: z.string(), summary: z.string(), description: z.string().nullable(),
  summaryZh: z.string().optional(),
  primary: identitySchema, responseCount: z.number().int().nonnegative(),
  latestRecordedAt: z.string(), detailUrl: z.string(),
});
const listSchema = z.object({ discussions: z.array(cardSchema) });
export const discussionSchema = z.object({ slug: slugSchema, title: z.string(), description: z.string().nullable(), sources: z.array(sourceSchema) });

export type CommunityDiscussionCard = z.infer<typeof cardSchema>;
export type CommunityDiscussion = z.infer<typeof discussionSchema>;
export type CommunitySource = z.infer<typeof sourceSchema>;
export class CommunityReadError extends Error {
  constructor(public readonly kind: "missing" | "unavailable") { super(kind); }
}

async function request<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(abort, 12_000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new CommunityReadError(response.status === 404 ? "missing" : "unavailable");
    const result = schema.safeParse(await response.json());
    if (!result.success) throw new CommunityReadError("unavailable");
    return result.data;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getCommunityDiscussionCards(signal?: AbortSignal) {
  return (await request("/api/community-discussions", listSchema, signal)).discussions;
}
export function getCommunityDiscussion(slug: string, signal?: AbortSignal) {
  return request(`/api/community-discussion?slug=${encodeURIComponent(slug)}`, discussionSchema, signal);
}

export function originalXUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^(?:www\.|mobile\.)?(?:x\.com|twitter\.com)$/.test(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}
