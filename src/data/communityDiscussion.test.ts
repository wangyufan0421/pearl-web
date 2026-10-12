import { describe, expect, it, vi } from "vitest";
import { getCommunityDiscussion } from "./communityDiscussion";

describe("getCommunityDiscussion", () => {
  it("requests the cloud discussion endpoint and returns its complete source blocks", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        discussion: "wtf-is-pearl",
        fetchedAt: "2026-10-11T00:00:00.000Z",
        sources: [{ sourceId: "one", href: "https://x.com/example", author: "Example", handle: "@example", avatar: "https://example.com/avatar.jpg", blocks: [{ id: "block-1", kind: "paragraph", text: "Complete source text" }] }],
      }),
    })) as unknown as typeof fetch;

    const result = await getCommunityDiscussion("wtf-is-pearl", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/community-discussion?discussion=wtf-is-pearl", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.sources[0].blocks[0].text).toBe("Complete source text");
  });

  it("rejects an unavailable cloud response instead of silently returning truncated content", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;

    await expect(getCommunityDiscussion("wtf-is-pearl", fetcher)).rejects.toThrow("community discussion request failed: 503");
  });
});
