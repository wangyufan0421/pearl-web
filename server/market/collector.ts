import { datasets, type Dataset } from "./datasets.js";
import type { WriteStore } from "./store.js";

type Options = { store: WriteStore; jobs?: Dataset[]; fetcher?: typeof fetch; now?: () => number; onResult?: (key: string, ok: boolean) => void };
export function createCollector({ store, jobs = datasets, fetcher = fetch, now = Date.now, onResult }: Options) {
  const running = new Map<string, Promise<void>>();
  const queue: Array<() => void> = [];
  let slots = 0; let stopped = false;
  const timers: ReturnType<typeof setInterval>[] = [];
  const controllers = new Set<AbortController>();
  async function acquire() {
    if (slots < 4) { slots++; return; }
    await new Promise<void>(resolve => queue.push(resolve));
  }
  function release() { const next = queue.shift(); if (next) next(); else slots--; }
  function run(job: Dataset): Promise<void> {
    if (stopped) return Promise.resolve();
    const existing = running.get(job.key); if (existing) return existing;
    const work = (async () => {
      await acquire();
      if (stopped) { release(); return; }
      const controller = new AbortController(); controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetcher(job.url(now()), { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error("Upstream unavailable");
        const payload: unknown = await response.json(); job.validate(payload);
        if (!stopped) { await store.save(job.key, payload, new Date(now()).toISOString()); onResult?.(job.key, true); }
      } catch {
        if (!stopped) {
          try { await store.fail(job.key, new Date(now()).toISOString()); } catch { /* A storage failure must not stop other datasets. */ }
          onResult?.(job.key, false);
        }
      } finally { clearTimeout(timeout); controllers.delete(controller); release(); }
    })();
    running.set(job.key, work);
    void work.finally(() => running.delete(job.key));
    return work;
  }
  return {
    run,
    start() {
      if (timers.length || stopped) return;
      for (const job of jobs) { void run(job); timers.push(setInterval(() => { void run(job); }, job.interval)); }
    },
    stop() { stopped = true; timers.forEach(clearInterval); timers.length = 0; controllers.forEach(controller => controller.abort()); },
  };
}
