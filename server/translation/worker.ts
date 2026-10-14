import { createSupabaseClient } from "../discussions/supabaseStore.js";
import { createTranslationQueue } from "./queue.js";
import { createTranslationStore } from "./store.js";
import { createTranslator } from "./translator.js";
import { translationConfiguration } from "./config.js";

try {
  const configuration = translationConfiguration();
  const queue = createTranslationQueue({
    store: createTranslationStore(createSupabaseClient()),
    translate: createTranslator(configuration),
    onResult: (id, ok) => console.log(`${new Date().toISOString()} translation ${id} ${ok ? "progress saved" : "failed; originals retained; retry scheduled"}`),
  });
  queue.start(); console.log("Community translation worker started; originals are preserved");
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { queue.stop(); process.exitCode = 0; });
} catch { console.error("Translation worker could not start. Check server-only translation and Supabase configuration."); process.exitCode = 1; }
