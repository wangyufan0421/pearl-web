import { createSupabaseClient } from "../discussions/supabaseStore.js";
import { createTranslationQueue } from "./queue.js";
import { createTranslationStore } from "./store.js";
import { createTranslator } from "./translator.js";

try {
  const baseUrl = process.env.COMMUNITY_TRANSLATION_BASE_URL; const apiKey = process.env.COMMUNITY_TRANSLATION_API_KEY;
  if (!baseUrl || !apiKey) throw new Error();
  const queue = createTranslationQueue({
    store: createTranslationStore(createSupabaseClient()),
    translate: createTranslator({ baseUrl, apiKey, model: process.env.COMMUNITY_TRANSLATION_MODEL ?? "gpt-6-luna" }),
    onResult: (id, ok) => console.log(`${new Date().toISOString()} translation ${id} ${ok ? "progress saved" : "failed; originals retained; retry scheduled"}`),
  });
  queue.start(); console.log("Community translation worker started; originals are preserved");
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { queue.stop(); process.exitCode = 0; });
} catch { console.error("Translation worker could not start. Check server-only translation and Supabase configuration."); process.exitCode = 1; }
