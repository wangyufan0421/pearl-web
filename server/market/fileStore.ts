import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Snapshot, ReadStore, WriteStore } from "./store.js";

const savedSchema = z.object({ payload: z.unknown(), fetchedAt: z.string().datetime().nullable(), lastAttemptedAt: z.string().datetime(), failed: z.boolean() });
type Saved = z.infer<typeof savedSchema>;
export function createFileSnapshotStore(directory: string): ReadStore & WriteStore {
  const root = resolve(directory);
  const pending = new Map<string, Promise<void>>();
  function path(key: string) {
    if (!/^[a-zA-Z0-9]+(?:[:_-][a-zA-Z0-9]+)*$/.test(key)) throw new Error("Invalid snapshot key");
    return resolve(root, `${encodeURIComponent(key)}.json`);
  }
  async function read(key: string): Promise<Saved | null> {
    try { return savedSchema.parse(JSON.parse(await readFile(path(key), "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  function update(key: string, at: string, payload?: unknown, success = false): Promise<void> {
    const previousWork = pending.get(key) ?? Promise.resolve();
    const work = previousWork.catch(() => {}).then(async () => {
      const file = path(key); const previous = await read(key);
      if (previous && Date.parse(previous.lastAttemptedAt) > Date.parse(at)) return;
      const saved: Saved = success ? { payload, fetchedAt: at, lastAttemptedAt: at, failed: false }
        : { payload: previous?.payload ?? null, fetchedAt: previous?.fetchedAt ?? null, lastAttemptedAt: at, failed: true };
      savedSchema.parse(saved);
      await mkdir(root, { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try { await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 }); await rename(temporary, file); }
      finally { await unlink(temporary).catch(() => {}); }
    });
    pending.set(key, work);
    void work.then(() => { if (pending.get(key) === work) pending.delete(key); }, () => { if (pending.get(key) === work) pending.delete(key); });
    return work;
  }
  return {
    async get(key): Promise<Snapshot | null> {
      const saved = await read(key);
      if (!saved?.fetchedAt || saved.payload === null) return null;
      return { ...saved, fetchedAt: saved.fetchedAt };
    },
    save: (key, payload, at) => update(key, at, payload, true),
    fail: (key, at) => update(key, at),
  };
}
