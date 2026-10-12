import { z } from "zod";
import { normalizeXStatusUrl } from "../../server/discussions/urls";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const createdSchema = z.object({ discussion: z.object({ slug: slugSchema, title: z.string(), status: z.literal("published") }), detailUrl: z.string() });
const outcomeSchema = z.object({ statusId: z.string().regex(/^[0-9]+$/), outcome: z.enum(["created", "duplicate", "failed"]) });
const refreshedSchema = z.object({ source: z.object({ xStatusId: z.string().regex(/^[0-9]+$/), fetchStatus: z.enum(["success", "failed"]) }) });
export type WriteOutcome = z.infer<typeof outcomeSchema>;
export type CreatedDiscussion = z.infer<typeof createdSchema>["discussion"];
export type CreateArticleInput = { primaryUrl: string; title?: string; description?: string; slug?: string; status: "published" };
export class AdminRequestError extends Error {
  constructor(public readonly kind: "unauthorized" | "invalid_links" | "invalid_input" | "missing" | "unavailable" | "uncertain") { super(kind); }
}

export function normalizeArticleLink(input: string) {
  try { return normalizeXStatusUrl(input.trim()).url; } catch { throw new AdminRequestError("invalid_links"); }
}
export function responseLinks(input: string) {
  const links = input.trim().split(/\s+/).filter(Boolean);
  if (links.length === 0 || links.length > 50) throw new AdminRequestError("invalid_input");
  return links.map(normalizeArticleLink);
}

async function request<T>(path: string, token: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), body === undefined ? 12_000 : 60_000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal, cache: "no-store",
    });
    if (!response.ok) throw new AdminRequestError(response.status === 401 ? "unauthorized" : response.status === 400 ? "invalid_input" : response.status === 404 ? "missing" : "unavailable");
    const result = schema.safeParse(await response.json());
    if (!result.success) throw new AdminRequestError("uncertain");
    return result.data;
  } catch (error) {
    if (error instanceof AdminRequestError) throw error;
    throw new AdminRequestError("uncertain");
  } finally { window.clearTimeout(timeout); }
}

export function verifyAdminToken(token: string) {
  return request("/api/admin/community-discussions", token, z.object({ authorized: z.literal(true) }));
}
export function createArticle(token: string, input: CreateArticleInput) {
  return request("/api/admin/community-discussions", token, createdSchema, input);
}
export async function addArticleResponses(token: string, slug: string, urls: string[]) {
  return (await request(`/api/admin/community-discussions/${encodeURIComponent(slug)}/sources`, token, z.object({ outcomes: z.array(outcomeSchema) }), { urls })).outcomes;
}
export async function refreshArticleSource(token: string, slug: string, statusId: string) {
  return (await request(`/api/admin/community-discussions/${encodeURIComponent(slug)}/sources/${encodeURIComponent(statusId)}/refresh`, token, refreshedSchema, {})).source;
}
