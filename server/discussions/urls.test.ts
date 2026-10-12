import { describe, expect, it } from "vitest";
import { normalizeXStatusUrl } from "./urls";

describe("normalizeXStatusUrl", () => {
  it("normalizes an X status URL and extracts the immutable status ID", () => {
    expect(normalizeXStatusUrl("https://x.com/blocmates/status/2108519545514410023?s=20")).toEqual({
      statusId: "2108519545514410023",
      url: "https://x.com/blocmates/status/2108519545514410023",
    });
  });

  it("rejects links that are not X status URLs", () => {
    expect(() => normalizeXStatusUrl("https://example.com/status/1")).toThrow("Expected an X status URL");
  });

  it("does not coerce a large status ID to a number", () => {
    const statusId = "2108519545514410023";

    expect(normalizeXStatusUrl(`https://mobile.twitter.com/blocmates/status/${statusId}`)).toEqual({
      statusId,
      url: `https://x.com/blocmates/status/${statusId}`,
    });
  });
});
