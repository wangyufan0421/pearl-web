import { describe, expect, it, vi } from "vitest";
import { createTranslator, needsChineseTranslation } from "./translator.js";
const blocks = [{ id: "a", kind: "paragraph" as const, text: "Original English discussion." }, { id: "b", kind: "quote" as const, text: "已有中文原帖。" }];
describe("Chinese source translation", () => {
  it("adds Chinese alongside immutable originals and skips Chinese content", async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); const input = JSON.parse(body.messages[1].content);
      expect(input.blocks).toHaveLength(1);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: input.blocks.map((block: { id: string }) => ({ id: block.id, text: "中文讨论译文。" })) }) } }] }));
    });
    const translate = createTranslator({ baseUrl: "https://example.com/v1", apiKey: "test-only", model: "test-model", fetcher });
    const result = await translate(blocks);
    expect(result[0]).toEqual({ ...blocks[0], translationZh: "中文讨论译文。" });
    expect(result[1]).toEqual(blocks[1]); expect(blocks[0]).not.toHaveProperty("translationZh");
    expect(needsChineseTranslation(result)).toBe(false);
  });
  it("rejects incomplete or mismatched model output without changing source data", async () => {
    const translate = createTranslator({ baseUrl: "https://example.com/v1", apiKey: "test-only", model: "test-model", fetcher: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"translations":[{"id":"wrong","text":"译文"}]}' } }] })) });
    await expect(translate(blocks)).rejects.toThrow("Translation unavailable");
    expect(blocks[0].text).toBe("Original English discussion.");
  });
  it("bounds provider input and rejoins translations of a long source block", async () => {
    const long = [{ ...blocks[0], text: "English text. ".repeat(1000) }]; let calls = 0;
    const translate = createTranslator({ baseUrl: "https://example.com/v1", apiKey: "test-only", model: "test-model", fetcher: async (_url, init) => {
      calls++; const input = JSON.parse(JSON.parse(init!.body as string).messages[1].content);
      expect(input.blocks.reduce((sum: number, block: { text: string }) => sum + block.text.length, 0)).toBeLessThanOrEqual(6000);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: input.blocks.map((block: { id: string }) => ({ id: block.id, text: "分段中文。" })) }) } }] }));
    } });
    const result = await translate(long); expect(calls).toBeGreaterThan(1); expect(result[0].text).toBe(long[0].text); expect(result[0].translationZh).toContain("分段中文。");
  });
});
