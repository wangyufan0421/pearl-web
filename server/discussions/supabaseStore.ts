import { createClient } from "@supabase/supabase-js";
import { chineseSummary } from "../translation/content.js";
import type {
  CreateDiscussionWithPrimaryInput,
  DiscussionRecord,
  DiscussionStore,
  PublicDiscussionCard,
  PublicDiscussionDetail,
  PublicSource,
  ResponseInsertInput,
  StoredSource,
} from "./store.js";

export function createSupabaseClient(environment: Record<string, string | undefined> = process.env) {
  const url = environment.SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not configured on the server");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type QueryResult = { data: unknown; error: { message: string } | null };
type Query = PromiseLike<QueryResult> & {
  select(columns: string): Query;
  insert(values: Record<string, unknown>): Query;
  update(values: Record<string, unknown>): Query;
  delete(): Query;
  eq(column: string, value: unknown): Query;
  is(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  maybeSingle(): Query;
  single(): Query;
};
type SupabaseDiscussionClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<QueryResult>;
  from(table: string): Query;
};

function errorMessage(error: { message: string } | null): never | undefined {
  if (error) throw new Error(error.message);
  return undefined;
}

async function rows<T>(query: PromiseLike<QueryResult>): Promise<T> {
  const result = await query;
  errorMessage(result.error);
  return result.data as T;
}

function mapDatabaseRow(kind: "discussion", row: Record<string, unknown>): DiscussionRecord;
function mapDatabaseRow(kind: "source", row: Record<string, unknown>): StoredSource;
function mapDatabaseRow(kind: "discussion" | "source", row: Record<string, unknown>): DiscussionRecord | StoredSource {
  if (kind === "discussion") {
    return {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: row.description === null ? null : String(row.description),
      status: row.status as DiscussionRecord["status"],
      primarySourceId: String(row.primary_source_id),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
  return {
    id: String(row.id),
    discussionId: String(row.discussion_id),
    xStatusId: String(row.x_status_id),
    url: String(row.url),
    role: row.role as StoredSource["role"],
    authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
    parentStatusId: typeof row.parent_x_status_id === "string" ? row.parent_x_status_id : null,
    author: row.author === null ? null : String(row.author),
    handle: row.handle === null ? null : String(row.handle),
    avatarUrl: row.avatar_url === null ? null : String(row.avatar_url),
    publishedAt: row.published_at === null ? null : String(row.published_at),
    fetchedAt: row.fetched_at === null ? null : String(row.fetched_at),
    lastAttemptedAt: String(row.last_attempted_at),
    blocks: structuredClone(row.blocks as StoredSource["blocks"]),
    sourceType: row.source_type as StoredSource["sourceType"],
    position: Number(row.position),
    fetchStatus: row.fetch_status as StoredSource["fetchStatus"],
    lastFetchError: row.last_fetch_error === null ? null : String(row.last_fetch_error),
  };
}

function sourceToRow(source: Omit<StoredSource, "id"> | StoredSource): Record<string, unknown> {
  return {
    discussion_id: source.discussionId,
    x_status_id: source.xStatusId,
    url: source.url,
    role: source.role,
    author_user_id: source.authorUserId ?? null,
    parent_x_status_id: source.parentStatusId ?? null,
    author: source.author,
    handle: source.handle,
    avatar_url: source.avatarUrl,
    published_at: source.publishedAt,
    fetched_at: source.fetchedAt,
    last_attempted_at: source.lastAttemptedAt,
    blocks: structuredClone(source.blocks),
    source_type: source.sourceType,
    position: source.position,
    fetch_status: source.fetchStatus,
    last_fetch_error: source.lastFetchError,
  };
}

function responseSourceToRpc(source: ResponseInsertInput): Record<string, unknown> {
  return {
    xStatusId: source.xStatusId,
    authorUserId: source.authorUserId ?? null,
    parentStatusId: source.parentStatusId ?? null,
    url: source.url,
    author: source.author,
    handle: source.handle,
    avatarUrl: source.avatarUrl,
    publishedAt: source.publishedAt,
    fetchedAt: source.fetchedAt,
    lastAttemptedAt: source.lastAttemptedAt,
    blocks: structuredClone(source.blocks),
    sourceType: source.sourceType,
    fetchStatus: source.fetchStatus,
    lastFetchError: source.lastFetchError,
  };
}

function publicSource(source: StoredSource): PublicSource {
  const { id: _id, discussionId: _discussionId, ...value } = source;
  return value;
}

function primarySummary(source: StoredSource): string {
  const firstReadableBlock = source.blocks.map((block) => block.text.trim()).find(Boolean) ?? "";
  return firstReadableBlock.replace(/\s+/g, " ").slice(0, 200);
}

function orderedSources(sources: StoredSource[]) {
  return sources.slice().sort((left, right) => {
    if (left.role !== right.role) return left.role === "primary" ? -1 : 1;
    if (left.publishedAt === null && right.publishedAt !== null) return 1;
    if (left.publishedAt !== null && right.publishedAt === null) return -1;
    if (left.publishedAt !== right.publishedAt) return (left.publishedAt ?? "").localeCompare(right.publishedAt ?? "");
    return left.position - right.position;
  });
}

function cardFor(discussion: DiscussionRecord, sources: StoredSource[]): PublicDiscussionCard {
  const primary = sources.find((source) => source.id === discussion.primarySourceId);
  if (!primary) throw new Error(`Discussion has no primary source: ${discussion.slug}`);
  return {
    slug: discussion.slug,
    title: discussion.title,
    summary: primarySummary(primary),
    ...(chineseSummary(primary.blocks) ? { summaryZh: chineseSummary(primary.blocks)! } : {}),
    description: discussion.description,
    primary: {
      xStatusId: primary.xStatusId,
      url: primary.url,
      author: primary.author,
      handle: primary.handle,
      avatarUrl: primary.avatarUrl,
      publishedAt: primary.publishedAt,
    },
    responseCount: sources.filter((source) => source.role === "response").length,
    latestRecordedAt: sources.reduce((latest, source) => source.lastAttemptedAt > latest ? source.lastAttemptedAt : latest, discussion.createdAt),
    detailUrl: `/archive/community-discussion/${discussion.slug}`,
  };
}

/** Keeps all service-role Supabase access inside the server discussion adapter. */
export function createSupabaseDiscussionStore(client: unknown): DiscussionStore {
  const database = client as SupabaseDiscussionClient;

  async function getDiscussionBySlug(slug: string): Promise<DiscussionRecord | undefined> {
    const row = await rows<Record<string, unknown> | null>(database.from("discussions").select("*").eq("slug", slug).maybeSingle());
    return row ? mapDatabaseRow("discussion", row) : undefined;
  }

  async function getSourceByStatusId(statusId: string): Promise<StoredSource | undefined> {
    const row = await rows<Record<string, unknown> | null>(database.from("discussion_sources").select("*").eq("x_status_id", statusId).maybeSingle());
    return row ? mapDatabaseRow("source", row) : undefined;
  }

  async function sourcesForDiscussion(discussionId: string): Promise<StoredSource[]> {
    const sourceRows = await rows<Record<string, unknown>[]>(database.from("discussion_sources").select("*").eq("discussion_id", discussionId));
    return sourceRows.map((row) => mapDatabaseRow("source", row));
  }

  return {
    async listAdminDiscussions() {
      const discussionRows = await rows<Record<string, unknown>[]>(database.from("discussions").select("*"));
      const discussions = discussionRows.map(row => mapDatabaseRow("discussion", row));
      if (!discussions.length) return [];
      const sourceRows = await rows<Record<string, unknown>[]>(database.from("discussion_sources").select("*").in("discussion_id", discussions.map(discussion => discussion.id)));
      const sources = sourceRows.map(row => mapDatabaseRow("source", row));
      return discussions.map(discussion => ({ ...cardFor(discussion, sources.filter(source => source.discussionId === discussion.id)), status: discussion.status }));
    },
    async getAdminDiscussion(slug) {
      const discussion = await getDiscussionBySlug(slug);
      if (!discussion) return undefined;
      return { slug, title: discussion.title, description: discussion.description, status: discussion.status, sources: orderedSources(await sourcesForDiscussion(discussion.id)).map(publicSource) };
    },
    async setDiscussionStatus(slug, status) {
      const changed = await rows<Array<{ id: string }>>(database.from("discussions").update({ status, updated_at: new Date().toISOString() }).eq("slug", slug).select("id"));
      if (!changed.length) throw new Error("Discussion not found");
    },
    async deleteDiscussion(slug) {
      // Existing FK cascade deletes the primary and responses in this SQL transaction.
      const deleted = await rows<Array<{ id: string }>>(database.from("discussions").delete().eq("slug", slug).select("id"));
      if (!deleted.length) throw new Error("Discussion not found");
    },

    async createDiscussionWithPrimary(input: CreateDiscussionWithPrimaryInput) {
      const rpcResult = await rows<string>(database.rpc("create_discussion_with_primary", {
        input: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          status: input.status,
          primarySource: {
            xStatusId: input.primary.xStatusId,
            authorUserId: input.primary.authorUserId ?? null,
            url: input.primary.url,
            author: input.primary.author,
            handle: input.primary.handle,
            avatarUrl: input.primary.avatarUrl,
            publishedAt: input.primary.publishedAt,
            fetchedAt: input.primary.fetchedAt,
            lastAttemptedAt: input.primary.lastAttemptedAt,
            blocks: input.primary.blocks,
            sourceType: input.primary.sourceType,
            lastFetchError: input.primary.lastFetchError,
          },
        },
      }));
      const discussionRow = await rows<Record<string, unknown>>(database.from("discussions").select("*").eq("id", rpcResult).single());
      const primaryRow = await rows<Record<string, unknown>>(database.from("discussion_sources").select("*").eq("discussion_id", rpcResult).eq("role", "primary").single());
      return { discussion: mapDatabaseRow("discussion", discussionRow), primary: mapDatabaseRow("source", primaryRow) };
    },
    getDiscussionBySlug,
    getSourceByStatusId,
    async getSourceForDiscussion(slug, statusId) {
      const [discussion, source] = await Promise.all([getDiscussionBySlug(slug), getSourceByStatusId(statusId)]);
      return discussion && source?.discussionId === discussion.id ? source : undefined;
    },
    async updateSourceParent(slug, statusId, parentStatusId, onlyIfMissing) {
      const discussion = await getDiscussionBySlug(slug);
      if (!discussion) throw new Error(`Discussion not found: ${slug}`);
      let query = database.from("discussion_sources").update({ parent_x_status_id: parentStatusId })
        .eq("discussion_id", discussion.id).eq("x_status_id", statusId);
      if (onlyIfMissing) query = query.is("parent_x_status_id", null);
      const row = await rows<Record<string, unknown> | null>(query.select("*").maybeSingle());
      if (row) return mapDatabaseRow("source", row);
      const latest = await getSourceByStatusId(statusId);
      if (onlyIfMissing && latest?.discussionId === discussion.id) return latest;
      throw new Error(`Source not found in discussion: ${statusId}`);
    },
    async insertSource(source) {
      const row = await rows<Record<string, unknown>>(database.from("discussion_sources").insert(sourceToRow(source)).select("*").single());
      return mapDatabaseRow("source", row);
    },
    async createOrDuplicateResponse(source) {
      const result = await rows<{ outcome: "created" | "duplicate" }>(database.rpc("create_or_duplicate_discussion_response", {
        input: { discussionId: source.discussionId, responseSource: responseSourceToRpc(source) },
      }));
      return { outcome: result.outcome };
    },
    async updateSource(source) {
      const row = await rows<Record<string, unknown>>(database.from("discussion_sources").update(sourceToRow(source)).eq("id", source.id).select("*").single());
      return mapDatabaseRow("source", row);
    },
    async updateSourceIfUnchanged(source, expectedAttemptedAt) {
      const contentOnly = {
        published_at: source.publishedAt,
        fetched_at: source.fetchedAt,
        last_attempted_at: source.lastAttemptedAt,
        blocks: structuredClone(source.blocks),
        source_type: source.sourceType,
        fetch_status: source.fetchStatus,
        last_fetch_error: source.lastFetchError,
      };
      const row = await rows<Record<string, unknown> | null>(database.from("discussion_sources").update(contentOnly).eq("id", source.id).eq("last_attempted_at", expectedAttemptedAt).select("*").maybeSingle());
      return row ? mapDatabaseRow("source", row) : undefined;
    },
    async nextResponsePosition(discussionId) {
      const sourceRows = await rows<Array<{ position: number }>>(database.from("discussion_sources").select("position").eq("discussion_id", discussionId).eq("role", "response"));
      return sourceRows.length === 0 ? 0 : Math.max(...sourceRows.map((source) => Number(source.position))) + 1;
    },
    async listPublishedDiscussions() {
      const discussionRows = await rows<Record<string, unknown>[]>(database.from("discussions").select("*").eq("status", "published"));
      const discussions = discussionRows.map((row) => mapDatabaseRow("discussion", row));
      if (discussions.length === 0) return [];
      const sourceRows = await rows<Record<string, unknown>[]>(database.from("discussion_sources").select("*").in("discussion_id", discussions.map((discussion) => discussion.id)));
      const sources = sourceRows.map((row) => mapDatabaseRow("source", row));
      return discussions.map((discussion) => cardFor(discussion, sources.filter((source) => source.discussionId === discussion.id)));
    },
    async getPublishedDiscussion(slug) {
      const discussion = await getDiscussionBySlug(slug);
      if (!discussion || discussion.status !== "published") return undefined;
      const sources = orderedSources(await sourcesForDiscussion(discussion.id));
      const detail: PublicDiscussionDetail = {
        slug: discussion.slug,
        title: discussion.title,
        description: discussion.description,
        sources: sources.map(publicSource),
      };
      return detail;
    },
  };
}
