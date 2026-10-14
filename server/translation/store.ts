import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { TranslationStore } from "./queue.js";
const blocksSchema = z.array(z.object({ id: z.string(), kind: z.enum(["heading", "quote", "paragraph"]), text: z.string(), translationZh: z.string().optional() }));
export function createTranslationStore(client: SupabaseClient): TranslationStore {
  return {
    async list() {
      const sources = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from("discussion_sources").select("id,blocks,fetched_at").not("fetched_at", "is", null).order("id").range(offset, offset + 99);
        if (error) throw new Error("Translation storage unavailable");
        for (const row of data ?? []) { const parsed = blocksSchema.safeParse(row.blocks); if (parsed.success) sources.push({ id: row.id as string, fetchedAt: row.fetched_at as string, blocks: parsed.data }); }
        if (!data || data.length < 100) break;
      }
      return sources;
    },
    async save(id, fetchedAt, blocks) {
      for (let retry = 0; retry < 5; retry++) {
        const { data: latest, error: readError } = await client.from("discussion_sources").select("blocks,fetched_at,last_attempted_at").eq("id", id).maybeSingle();
        if (readError) throw new Error("Translation storage unavailable");
        if (!latest || Date.parse(latest.fetched_at) !== Date.parse(fetchedAt)) return false;
        const parsed = blocksSchema.safeParse(latest.blocks);
        if (!parsed.success) throw new Error("Translation storage unavailable");
        const merged = blocks.map(block => {
          const saved = parsed.data.find(item => item.id === block.id && item.kind === block.kind && item.text === block.text);
          return saved?.translationZh ? { ...block, translationZh: saved.translationZh } : block;
        });
        // The revision must change even within one millisecond or after a clock adjustment.
        const revision = new Date(Math.max(Date.now(), Date.parse(latest.last_attempted_at) + 1)).toISOString();
        const { data, error } = await client.from("discussion_sources").update({ blocks: merged, last_attempted_at: revision }).eq("id", id).eq("fetched_at", fetchedAt).eq("last_attempted_at", latest.last_attempted_at).select("id");
        if (error) throw new Error("Translation storage unavailable");
        if (data?.length) return true;
      }
      return false;
    },
  };
}
