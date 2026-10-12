import { describe, expect, it } from "vitest";
import type { CreateDiscussionWithPrimaryInput, StoredSource } from "./store";
import { createSupabaseClient, createSupabaseDiscussionStore } from "./supabaseStore";

type Result = { data: unknown; error: { message: string } | null };

class FakeQuery implements PromiseLike<Result> {
  readonly calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: Result) {}

  select(...args: unknown[]) { this.calls.push({ method: "select", args }); return this; }
  insert(...args: unknown[]) { this.calls.push({ method: "insert", args }); return this; }
  update(...args: unknown[]) { this.calls.push({ method: "update", args }); return this; }
  eq(...args: unknown[]) { this.calls.push({ method: "eq", args }); return this; }
  in(...args: unknown[]) { this.calls.push({ method: "in", args }); return this; }
  maybeSingle() { this.calls.push({ method: "maybeSingle", args: [] }); return this; }
  single() { this.calls.push({ method: "single", args: [] }); return this; }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  readonly tableCalls: Array<{ table: string; query: FakeQuery }> = [];

  constructor(private readonly rpcResult: Result, private readonly tableResults: Result[]) {}

  rpc(name: string, args?: Record<string, unknown>) {
    this.rpcCalls.push({ name, args });
    return Promise.resolve(this.rpcResult);
  }

  from(table: string) {
    const query = new FakeQuery(this.tableResults.shift() ?? { data: [], error: null });
    this.tableCalls.push({ table, query });
    return query;
  }
}

const discussionRow = {
  id: "discussion-1", slug: "wtf-is-pearl", title: "WTF is Pearl?", description: null,
  status: "published", primary_source_id: "source-1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
};
const primaryRow = {
  id: "source-1", discussion_id: "discussion-1", x_status_id: "100", url: "https://x.com/blocmates/status/100",
  role: "primary", author: "Blocmates", handle: "blocmates", avatar_url: null, published_at: "2026-01-01T00:00:00.000Z",
  fetched_at: "2026-01-01T01:00:00.000Z", last_attempted_at: "2026-01-01T01:00:00.000Z", blocks: [], source_type: "article",
  position: 0, fetch_status: "success", last_fetch_error: null,
};

function createInput(): CreateDiscussionWithPrimaryInput {
  return {
    ...{ slug: "wtf-is-pearl", title: "WTF is Pearl?", description: null, status: "published" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    primary: {
      xStatusId: "100", url: "https://x.com/blocmates/status/100", author: "Blocmates", handle: "blocmates", avatarUrl: null,
      publishedAt: "2026-01-01T00:00:00.000Z", fetchedAt: "2026-01-01T01:00:00.000Z", lastAttemptedAt: "2026-01-01T01:00:00.000Z",
      blocks: [], sourceType: "article", fetchStatus: "success", lastFetchError: null,
    },
  };
}

describe("Supabase discussion store configuration", () => {
  it("rejects missing server-only Supabase configuration", () => {
    expect(() => createSupabaseClient({})).toThrow("SUPABASE_URL is not configured on the server");
  });

  it("rejects a missing server-only Supabase service role key", () => {
    expect(() => createSupabaseClient({ SUPABASE_URL: "https://example.supabase.co" })).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not configured on the server",
    );
  });

  it("creates a configured client without exposing the service role key through a public DTO", () => {
    const serviceRoleKey = "super-secret-service-role-key";
    const client = createSupabaseClient({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    });

    expect(client).toBeDefined();
    expect(client).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses the atomic RPC for a primary snapshot and maps its snake case rows", async () => {
    const fake = new FakeSupabase(
      { data: "discussion-1", error: null },
      [{ data: discussionRow, error: null }, { data: primaryRow, error: null }],
    );
    const store = createSupabaseDiscussionStore(fake);

    const result = await store.createDiscussionWithPrimary(createInput());

    expect(fake.rpcCalls).toEqual([{ name: "create_discussion_with_primary", args: { input: expect.any(Object) } }]);
    expect(fake.rpcCalls[0].args!.input).toMatchObject({ primarySource: { xStatusId: "100", avatarUrl: null } });
    expect(result).toMatchObject({ discussion: { primarySourceId: "source-1" }, primary: { xStatusId: "100", fetchedAt: "2026-01-01T01:00:00.000Z" } });
  });

  it("delegates response idempotency and position allocation to the response RPC", async () => {
    const fake = new FakeSupabase({ data: { outcome: "created" }, error: null }, []);
    const store = createSupabaseDiscussionStore(fake);
    const response: Omit<StoredSource, "id" | "position"> = {
      ...primaryRow,
      discussionId: "discussion-1", xStatusId: "200", role: "response", avatarUrl: null,
      publishedAt: "2026-01-02T00:00:00.000Z", fetchedAt: "2026-01-02T01:00:00.000Z", lastAttemptedAt: "2026-01-02T01:00:00.000Z",
      sourceType: "tweet", fetchStatus: "success", lastFetchError: null,
    } as Omit<StoredSource, "id" | "position">;

    await store.createOrDuplicateResponse(response);

    expect(fake.rpcCalls).toEqual([{
      name: "create_or_duplicate_discussion_response",
      args: { input: expect.objectContaining({ discussionId: "discussion-1", responseSource: expect.objectContaining({ xStatusId: "200" }) }) },
    }]);
  });

  it("writes response inserts in snake case and returns a public published summary", async () => {
    const response: Omit<StoredSource, "id"> = {
      ...primaryRow,
      discussionId: "discussion-1", xStatusId: "200", role: "response", avatarUrl: null,
      publishedAt: "2026-01-02T00:00:00.000Z", fetchedAt: "2026-01-02T01:00:00.000Z", lastAttemptedAt: "2026-01-02T01:00:00.000Z",
      sourceType: "tweet", fetchStatus: "success", lastFetchError: null, position: 0,
    } as Omit<StoredSource, "id">;
    const responseRow = { ...primaryRow, id: "source-2", discussion_id: "discussion-1", x_status_id: "200", role: "response", position: 0 };
    const fake = new FakeSupabase(
      { data: null, error: null },
      [{ data: responseRow, error: null }, { data: [discussionRow], error: null }, { data: [primaryRow, responseRow], error: null }],
    );
    const store = createSupabaseDiscussionStore(fake);

    await store.insertSource(response);
    const [card] = await store.listPublishedDiscussions();

    expect(fake.tableCalls[0].query.calls.find((call) => call.method === "insert")!.args[0]).toMatchObject({
      discussion_id: "discussion-1", x_status_id: "200", fetch_status: "success",
    });
    expect(fake.tableCalls[2].query.calls).toContainEqual({ method: "in", args: ["discussion_id", ["discussion-1"]] });
    expect(card).toMatchObject({ slug: "wtf-is-pearl", responseCount: 1, detailUrl: "/archive/community-discussion/wtf-is-pearl", primary: { xStatusId: "100" } });
  });
});
