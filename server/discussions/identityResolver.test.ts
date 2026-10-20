import { describe, expect, it } from "vitest";
import { createTwitter241IdentityResolver } from "./identityResolver";
import { createTwitter241SourceFetcher } from "./runtime";

const statusId = "2109730757753094439";
const url = `https://x.com/root/status/${statusId}`;
const tweet = (user?: Record<string, unknown>) => ({ data: { tweetResult: { result: { rest_id: statusId, legacy: { full_text: "Saved text" }, ...(user ? { core: { user_results: { result: user } } } : {}) } } } });
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });

describe("Twitter241 author identity resolver", () => {
  it("reads verified author identity from the requested tweet", async () => {
    const calls: string[] = [];
    const fetch = async (input: string) => { calls.push(input); return response(tweet({ rest_id: "42", core: { name: "Root", screen_name: "root" }, avatar: { image_url: "https://pbs.twimg.com/root.jpg" } })); };
    const identity = await createTwitter241IdentityResolver({ apiKey: "test", fetch }).resolve(url);
    expect(identity).toEqual({ userId: "42", author: "Root", handle: "root", avatarUrl: "https://pbs.twimg.com/root.jpg" });
    expect(calls).toHaveLength(1);
  });

  it("tries tweet-v2 when the first tweet response has no author", async () => {
    const calls: string[] = [];
    const fetch = async (input: string) => { calls.push(input); return response(input.includes("tweet-v2") ? tweet({ rest_id: "42", legacy: { name: "V2 Root", screen_name: "root", profile_image_url_https: "https://pbs.twimg.com/v2.jpg" } }) : tweet()); };
    const identity = await createTwitter241IdentityResolver({ apiKey: "test", fetch }).resolve(url);
    expect(identity).toMatchObject({ userId: "42", author: "V2 Root", avatarUrl: "https://pbs.twimg.com/v2.jpg" });
    expect(calls.map(value => new URL(value).pathname)).toEqual(["/tweet", "/tweet-v2"]);
  });

  it("refreshes a known stable user ID through the profile endpoint", async () => {
    const fetch = async () => response({ users: [{ rest_id: "42", core: { name: "Updated Root", screen_name: "root" }, avatar: { image_url: "https://pbs.twimg.com/new.jpg" } }] });
    await expect(createTwitter241IdentityResolver({ apiKey: "test", fetch }).resolve(url, "42")).resolves.toEqual({ userId: "42", author: "Updated Root", handle: "root", avatarUrl: "https://pbs.twimg.com/new.jpg" });
  });

  it("rejects a lookup response whose user ID does not match the stored author", async () => {
    const fetch = async (input: string) => response(input.includes("get-users") ? { users: [{ rest_id: "77", core: { name: "Wrong" } }] } : tweet({ rest_id: "77", core: { name: "Wrong" } }));
    const identity = await createTwitter241IdentityResolver({ apiKey: "test", fetch }).resolve(url, "42");
    expect(identity).toEqual({ userId: null, author: null, handle: null, avatarUrl: null });
  });

  it("keeps readable new-source text when optional identity enrichment fails", async () => {
    const fetch = async (input: string) => input.includes("tweet-v2") ? response({}, false) : response(tweet());
    const source = await createTwitter241SourceFetcher({ apiKey: "test", fetch })(url);
    expect(source.blocks[0].text).toBe("Saved text");
    expect(source.author).toBeNull();
  });

  it("enriches a new source with the verified author from tweet-v2", async () => {
    const fetch = async (input: string) => response(input.includes("tweet-v2") ? tweet({ rest_id: "42", core: { name: "Root", screen_name: "root" }, avatar: { image_url: "https://pbs.twimg.com/root.jpg" } }) : tweet());
    const source = await createTwitter241SourceFetcher({ apiKey: "test", fetch })(url);
    expect(source).toMatchObject({ author: "Root", handle: "root", avatarUrl: "https://pbs.twimg.com/root.jpg" });
  });
});
