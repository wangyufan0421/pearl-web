import { describe, expect, it } from "vitest";
import { extractCommunityDiscussion } from "./communityDiscussion";

const normalized = {
  xStatusId: "2108519545514410023",
  url: "https://x.com/blocmates/status/2108519545514410023",
};

const rootTweet = (result: Record<string, unknown>) => ({
  data: { tweetResult: { result } },
});

const author = {
  core: {
    user_results: {
      result: {
        legacy: {
          name: "Blocmates",
          screen_name: "blocmates",
          profile_image_url_https: "https://images.example/avatar.jpg",
        },
      },
    },
  },
  legacy: { created_at: "Sat Oct 11 10:30:00 +0000 2026" },
};

describe("extractCommunityDiscussion", () => {
  it("uses the complete Article blocks and title", () => {
    const payload = rootTweet({
      rest_id: normalized.xStatusId,
      ...author,
      article: {
        article_results: {
          result: {
            title: "A durable discussion",
            content_state: {
              blocks: [
                { id: "heading-1", type: "heading", text: "Opening" },
                { id: "quote-1", type: "quote", text: "The full quote." },
              ],
            },
          },
        },
      },
    });

    expect(extractCommunityDiscussion(normalized, payload, undefined, () => "2026-10-11T12:00:00.000Z")).toEqual({
      xStatusId: normalized.xStatusId,
      url: normalized.url,
      author: "Blocmates",
      handle: "blocmates",
      avatarUrl: "https://images.example/avatar.jpg",
      publishedAt: "Sat Oct 11 10:30:00 +0000 2026",
      fetchedAt: "2026-10-11T12:00:00.000Z",
      blocks: [
        { id: "heading-1", kind: "heading", text: "Opening" },
        { id: "quote-1", kind: "quote", text: "The full quote." },
      ],
      sourceType: "article",
      title: "A durable discussion",
    });
  });

  it("uses note tweet text that remains available behind Show more", () => {
    const completeText = "This is the complete note, including the text behind Show more.";
    const payload = rootTweet({
      rest_id: normalized.xStatusId,
      ...author,
      legacy: { ...author.legacy, full_text: "This is the truncated preview…" },
      note_tweet: { note_tweet_results: { result: { text: completeText } } },
    });

    expect(extractCommunityDiscussion(normalized, payload, undefined, () => "2026-10-11T12:00:00.000Z")).toMatchObject({
      sourceType: "noteTweet",
      blocks: [{ id: "paragraph-1", kind: "paragraph", text: completeText }],
      title: null,
    });
  });

  it("uses legacy full_text for an ordinary tweet", () => {
    const payload = rootTweet({
      rest_id: normalized.xStatusId,
      ...author,
      legacy: { ...author.legacy, full_text: "First paragraph\n\nSecond paragraph" },
    });

    expect(extractCommunityDiscussion(normalized, payload, undefined, () => "2026-10-11T12:00:00.000Z")).toMatchObject({
      sourceType: "tweet",
      blocks: [
        { id: "paragraph-1", kind: "paragraph", text: "First paragraph" },
        { id: "paragraph-2", kind: "paragraph", text: "Second paragraph" },
      ],
      title: null,
    });
  });

  it("matches the requested root status rather than a quoted child", () => {
    const payload = rootTweet({
      rest_id: normalized.xStatusId,
      ...author,
      legacy: {
        ...author.legacy,
        full_text: "The target root text.",
        quoted_status_result: {
          result: {
            rest_id: "9999999999999999999",
            legacy: { full_text: "Quoted child text that must not be selected." },
          },
        },
      },
    });

    expect(extractCommunityDiscussion(normalized, payload, undefined, () => "2026-10-11T12:00:00.000Z")).toMatchObject({
      xStatusId: normalized.xStatusId,
      blocks: [{ id: "paragraph-1", kind: "paragraph", text: "The target root text." }],
    });
  });
});
