import { describe, expect, it, vi } from "vitest";
import { startIdentityMaintenance } from "./identityRuntime";

const configured = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test", TWITTER241_API_KEY: "test" };

describe("identity maintenance startup", () => {
  it("does not start without all server-only credentials", () => {
    expect(startIdentityMaintenance({})).toBeNull();
  });

  it("starts a background claim with injected dependencies", async () => {
    const claim = vi.fn(async () => null);
    const queue = startIdentityMaintenance(configured, { store: { claim, finish: async () => "updated" }, resolve: async () => ({ userId: null, author: null, handle: null, avatarUrl: null }) });
    expect(queue).not.toBeNull();
    await vi.waitFor(() => expect(claim).toHaveBeenCalledOnce());
    queue?.stop();
  });
});
