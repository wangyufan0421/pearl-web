import { describe, expect, it } from "vitest";
import { authorSide, buildDiscussionTree } from "./discussionTree";
import type { CommunitySource } from "./communityDiscussion";

function source(id: string, role: "primary" | "response" = "response", parentStatusId: string | null = null, authorUserId: string | null = "2"): CommunitySource {
  return { xStatusId: id, url: `https://x.com/u/status/${id}`, role, parentStatusId, authorUserId,
    author: "User", handle: `user-${authorUserId}`, avatarUrl: null, publishedAt: null,
    fetchedAt: null, lastAttemptedAt: "2026-10-21T00:00:00Z", blocks: [], sourceType: "tweet", position: Number(id), fetchStatus: "success", lastFetchError: null };
}

describe("manual discussion tree", () => {
  it("nests only explicitly saved direct replies in their saved order", () => {
    const [primary, a, b, child, grandchild] = [source("100", "primary", null, "1"), source("200", "response", "100"), source("300", "response", "100"), source("400", "response", "200"), source("500", "response", "400")];
    const tree = buildDiscussionTree([primary, a, b, child, grandchild]);
    expect(tree.primary?.xStatusId).toBe("100");
    expect(tree.roots.map(node => node.source.xStatusId)).toEqual(["200", "300"]);
    expect(tree.roots[0].children[0].source.xStatusId).toBe("400");
    expect(tree.roots[0].children[0].children[0].source.xStatusId).toBe("500");
  });
  it("keeps missing-parent, self-linked, and cyclic replies visible as roots", () => {
    const tree = buildDiscussionTree([source("100", "primary"), source("200", "response", "999"), source("300", "response", "300"), source("400", "response", "500"), source("500", "response", "400")]);
    expect(tree.roots.map(node => node.source.xStatusId)).toEqual(["200", "300", "400", "500"]);
  });
  it("puts the primary author on the left by user ID, with a handle fallback", () => {
    const primary = source("100", "primary", null, "1");
    expect(authorSide(source("200", "response", "100", "1"), primary)).toBe("left");
    expect(authorSide(source("300", "response", "100", "2"), primary)).toBe("right");
    expect(authorSide({ ...source("400"), authorUserId: null, handle: "AUTHOR" }, { ...primary, authorUserId: null, handle: "author" })).toBe("left");
    expect(authorSide({ ...source("500"), authorUserId: null, handle: null }, primary)).toBe("right");
  });
});
