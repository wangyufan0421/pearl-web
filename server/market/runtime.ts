import { createClient } from "@supabase/supabase-js";
import { createSnapshotStore } from "./store.js";
import { createFileSnapshotStore } from "./fileStore.js";
import { resolve } from "node:path";

export function marketStorageMode(environment: Record<string, string | undefined> = process.env): "file" | "supabase" {
  const mode = environment.MARKET_STORAGE;
  if (mode === "file" || mode === "supabase") return mode;
  if (mode) throw new Error("MARKET_STORAGE must be file or supabase");
  if (environment.SUPABASE_URL || environment.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "file";
}

export function createMarketStore(environment: Record<string, string | undefined> = process.env) {
  if (marketStorageMode(environment) === "file") return createFileSnapshotStore(resolve(environment.MARKET_DATA_DIR ?? ".data/market"));
  const url = environment.SUPABASE_URL; const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before starting market services");
  return createSnapshotStore(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }) },
  }));
}
