import { describe, expect, it, vi } from "vitest";
import { createIdentityStore } from "./identityStore";

describe("identity store RPC adapter", () => {
  it("claims a due source without reading content fields", async () => {
    const rpc = vi.fn(async () => ({ data: { id: "source-1", url: "https://x.com/root/status/123", authorUserId: null, leaseToken: "lease-1" }, error: null }));
    const job = await createIdentityStore({ rpc }).claim();
    expect(rpc).toHaveBeenCalledWith("claim_discussion_identity_source");
    expect(job).toEqual({ id: "source-1", url: "https://x.com/root/status/123", authorUserId: null, leaseToken: "lease-1" });
  });

  it("finishes with identity values only", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "updated" }, error: null }));
    const store = createIdentityStore({ rpc });
    await store.finish({ id: "source-1", leaseToken: "lease-1", userId: "42", author: "Updated", handle: "root", avatarUrl: "https://pbs.twimg.com/new.jpg" });
    expect(rpc).toHaveBeenCalledWith("finish_discussion_identity_source", { input: { id: "source-1", leaseToken: "lease-1", userId: "42", author: "Updated", handle: "root", avatarUrl: "https://pbs.twimg.com/new.jpg" } });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/blocks|translation|fetchedAt|lastAttemptedAt/);
  });

  it("raises a database error so the queue can report it", async () => {
    const store = createIdentityStore({ rpc: async () => ({ data: null, error: { message: "database unavailable" } }) });
    await expect(store.claim()).rejects.toThrow("database unavailable");
  });
});
