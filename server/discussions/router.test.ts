import { describe, expect, it } from "vitest";
import { createDiscussionRouter } from "./router";

describe("manual discussion parent routes", () => {
  it("routes repair and override requests through admin authorization", async () => {
    const route = createDiscussionRouter({ COMMUNITY_ADMIN_TOKEN: "test" });
    const parent = new URL("http://local/api/admin/community-discussions/topic/sources/200/parent");
    const repair = new URL("http://local/api/admin/community-discussions/topic/sources/200/parent/repair");
    expect((await route(parent, "POST", {}, { parentStatusId: "100" })).status).toBe(401);
    expect((await route(repair, "POST", {}, {})).status).toBe(401);
  });
});
