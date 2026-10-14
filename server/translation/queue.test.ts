import { expect, it, vi } from "vitest";
import { createTranslationQueue } from "./queue.js";
it("coalesces background work, persists progress and never requests already translated data", async () => {
  let blocks = [{ id: "a", kind: "paragraph" as const, text: "English source text." }];
  const list = vi.fn(async () => [{ id: "source", fetchedAt: "2026-10-13T00:00:00Z", blocks }]);
  const save = vi.fn(async (_id, _at, next) => { blocks = next; return true; });
  const translate = vi.fn(async items => items.map((block: object) => ({ ...block, translationZh: "中文原文译文。" })));
  const queue = createTranslationQueue({ store: { list, save }, translate });
  await Promise.all([queue.tick(), queue.tick()]);
  expect(translate).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  await queue.tick(); expect(translate).toHaveBeenCalledTimes(1);
});
it("retries failed translation later without erasing originals", async () => {
  let now = 0; const row = { id: "source", fetchedAt: "2026-10-13T00:00:00Z", blocks: [{ id: "a", kind: "paragraph" as const, text: "English original." }] };
  const save = vi.fn(); const translate = vi.fn().mockRejectedValue(new Error("provider key must not escape"));
  const queue = createTranslationQueue({ store: { list: async () => [row], save }, translate, now: () => now });
  await queue.tick(); await queue.tick(); expect(translate).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
  now = 61_000; await queue.tick(); expect(translate).toHaveBeenCalledTimes(2); expect(row.blocks[0].text).toBe("English original.");
});
