import type { AuthorIdentity } from "../communityDiscussion.js";
import { createIdentityQueue } from "./identityQueue.js";
import { createTwitter241IdentityResolver } from "./identityResolver.js";
import { createIdentityStore, type IdentityStore } from "./identityStore.js";
import { createSupabaseClient } from "./supabaseStore.js";

type Dependencies = {
  store?: IdentityStore;
  resolve?: (url: string, knownUserId?: string | null) => Promise<AuthorIdentity>;
};

export function startIdentityMaintenance(environment: Record<string, string | undefined> = process.env, dependencies: Dependencies = {}) {
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY || !environment.TWITTER241_API_KEY) return null;
  const store = dependencies.store ?? createIdentityStore(createSupabaseClient(environment));
  const resolve = dependencies.resolve ?? createTwitter241IdentityResolver({ apiKey: environment.TWITTER241_API_KEY }).resolve;
  const queue = createIdentityQueue({
    store,
    resolve,
    onResult: (id, outcome) => console.log(`${new Date().toISOString()} identity ${id} ${outcome}`),
  });
  queue.start();
  return queue;
}
