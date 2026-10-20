export type IdentityJob = { id: string; url: string; authorUserId: string | null; leaseToken: string };
export type IdentityCompletion = {
  id: string;
  leaseToken: string;
  userId: string | null;
  author: string | null;
  handle: string | null;
  avatarUrl: string | null;
};
export type IdentityStore = { claim(): Promise<IdentityJob | null>; finish(input: IdentityCompletion): Promise<string> };

type RpcResult = { data: unknown; error: { message: string } | null };
type Client = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult> };

export function createIdentityStore(client: unknown): IdentityStore {
  const database = client as Client;
  return {
    async claim() {
      const result = await database.rpc("claim_discussion_identity_source");
      if (result.error) throw new Error(result.error.message);
      if (result.data === null) return null;
      const row = result.data as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.url !== "string" || typeof row.leaseToken !== "string") throw new Error("Invalid identity claim response");
      return { id: row.id, url: row.url, authorUserId: typeof row.authorUserId === "string" ? row.authorUserId : null, leaseToken: row.leaseToken };
    },
    async finish(input) {
      const result = await database.rpc("finish_discussion_identity_source", { input });
      if (result.error) throw new Error(result.error.message);
      const row = result.data as Record<string, unknown> | null;
      return typeof row?.outcome === "string" ? row.outcome : "unknown";
    },
  };
}
