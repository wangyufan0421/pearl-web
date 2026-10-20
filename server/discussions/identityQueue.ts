import type { AuthorIdentity } from "../communityDiscussion.js";
import type { IdentityStore } from "./identityStore.js";

type Options = {
  store: IdentityStore;
  resolve(url: string, knownUserId?: string | null): Promise<AuthorIdentity>;
  pollMs?: number;
  maxJobsPerTick?: number;
  throttleMs?: number;
  wait?: (ms: number) => Promise<void>;
  onResult?: (id: string, outcome: string) => void;
};

export function createIdentityQueue({ store, resolve, pollMs = 60_000, maxJobsPerTick = 10, throttleMs = 1_000, wait = ms => new Promise(done => setTimeout(done, ms)), onResult }: Options) {
  let inFlight: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  function tick(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = (async () => {
      for (let count = 0; count < maxJobsPerTick && !stopped; count++) {
        const job = await store.claim();
        if (!job) break;
        if (count > 0) await wait(throttleMs);
        if (stopped) break;
        let identity: AuthorIdentity = { userId: null, author: null, handle: null, avatarUrl: null };
        try { identity = await resolve(job.url, job.authorUserId); } catch { /* Finish schedules a persisted retry. */ }
        const outcome = await store.finish({ id: job.id, leaseToken: job.leaseToken, ...identity });
        onResult?.(job.id, outcome);
      }
    })().catch(() => { onResult?.("storage", "failed"); }).finally(() => { inFlight = undefined; });
    return inFlight;
  }

  return {
    tick,
    start() {
      if (timer || stopped) return;
      void tick();
      timer = setInterval(() => { void tick(); }, pollMs);
    },
    stop() { stopped = true; if (timer) clearInterval(timer); timer = undefined; },
  };
}
