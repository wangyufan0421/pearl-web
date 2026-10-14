import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { createTranslationStore } from "./store.js";

it("advances revisions with a fixed or backward clock and retries competing writes", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T00:00:00.000Z"));
  const fetchedAt = "2026-10-12T00:00:00.000Z";
  let row = { fetched_at: fetchedAt, last_attempted_at: "2026-10-13T00:00:00.000Z", blocks: [
    { id: "a", kind: "paragraph", text: "English first" }, { id: "b", kind: "paragraph", text: "English second" },
  ] };
  let writes = 0;
  const client = { from: () => {
    let patch: typeof row | undefined;
    const filters = new Map<string, string>();
    const query = {
      update(value: typeof row) { patch = value; return query; },
      eq(key: string, value: string) { filters.set(key, value); return query; },
      select() { return query; },
      maybeSingle: async () => ({ data: structuredClone(row), error: null }),
      then(resolve: (value: unknown) => unknown) {
        if (++writes === 1) row = { ...row, last_attempted_at: "2026-10-13T00:00:00.001Z", blocks: row.blocks.map(block => block.id === "b" ? { ...block, translationZh: "第二段译文" } : block) };
        const matches = filters.get("last_attempted_at") === row.last_attempted_at && filters.get("fetched_at") === row.fetched_at;
        if (matches) row = { ...row, ...patch! };
        return Promise.resolve(resolve({ data: matches ? [{ id: "source" }] : [], error: null }));
      },
    };
    return query;
  } } as unknown as SupabaseClient;
  try {
    const store = createTranslationStore(client);
    expect(await store.save("source", fetchedAt, [
      { id: "a", kind: "paragraph", text: "English first", translationZh: "第一段译文" },
      { id: "b", kind: "paragraph", text: "English second" },
    ])).toBe(true);
    expect(writes).toBe(2);
    expect(row.last_attempted_at).toBe("2026-10-13T00:00:00.002Z");
    expect(row.blocks).toMatchObject([{ translationZh: "第一段译文" }, { translationZh: "第二段译文" }]);
    expect(await store.save("source", "2026-10-11T00:00:00.000Z", [])).toBe(false);
    expect(row.blocks).toHaveLength(2);
  } finally { clock.mockRestore(); }
});
