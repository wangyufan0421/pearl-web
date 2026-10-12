import { describe, expect, it, vi } from "vitest";
import { DISCUSSION_SOURCES, extractDiscussionPost, loadDiscussion } from "./communityDiscussion";

const articleTweet = {
  rest_id: "2108519545514410023",
  core: { user_results: { result: { legacy: { name: "blocmates.", screen_name: "blocmates", profile_image_url_https: "https://example.com/blocmates.jpg" } } } },
  legacy: { created_at: "Thu Oct 09 11:26:00 +0000 2026" },
  article: {
    article_results: {
      result: {
        content_state: {
          blocks: [
            { key: "one", type: "unstyled", text: "First paragraph" },
            { key: "two", type: "header-one", text: "Article heading" },
          ],
        },
      },
    },
  },
};

const noteTweet = {
  rest_id: "2108579196268077447",
  core: { user_results: { result: { legacy: { name: "Tulip King 🌷", screen_name: "tulipking", profile_image_url_https: "https://example.com/tulip.jpg" } } } },
  legacy: { created_at: "Thu Oct 09 15:23:00 +0000 2026" },
  note_tweet: { note_tweet_results: { result: { text: "Opening thought\n\nText after Show more" } } },
};

describe("community discussion source extraction", () => {
  it("extracts every Article content block from the matched root tweet", () => {
    const post = extractDiscussionPost({ data: { tweet_results: { result: articleTweet } } }, DISCUSSION_SOURCES[0]);

    expect(post).toMatchObject({
      sourceId: "2108519545514410023",
      author: "blocmates.",
      blocks: [
        { kind: "paragraph", text: "First paragraph" },
        { kind: "heading", text: "Article heading" },
      ],
    });
  });

  it("extracts the complete note text behind X's Show more truncation", () => {
    const tulipSource = DISCUSSION_SOURCES.find((source) => source.sourceId === "2108579196268077447");
    if (!tulipSource) throw new Error("Tulip source is required for this test");
    const post = extractDiscussionPost({ data: { quoted: articleTweet, tweet_results: { result: noteTweet } } }, tulipSource);

    expect(post.blocks.at(-1)).toEqual({ id: "paragraph-1", kind: "paragraph", text: "Text after Show more" });
  });

  it("loads the two configured sources without exposing the service key to callers", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes("2108519545514410023")
        ? { data: { tweet_results: { result: articleTweet } } }
        : { data: { tweet_results: { result: { ...noteTweet, rest_id: new URL(url).searchParams.get("pid") } } } },
    })) as unknown as typeof fetch;

    const discussion = await loadDiscussion("wtf-is-pearl", fetcher, "server-only-key");

    expect(discussion.sources).toHaveLength(5);
    expect(DISCUSSION_SOURCES.map((source) => source.sourceId)).toEqual([
      "2108519545514410023",
      "2108528311735607793",
      "2108568857317118362",
      "2108579196268077447",
      "2108928836780065031",
    ]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("pid=2108519545514410023"), expect.objectContaining({ headers: expect.any(Object) }));
    expect(JSON.stringify(discussion)).not.toContain("server-only-key");
  });
});
