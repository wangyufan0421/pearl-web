import type { SupabaseClient } from "@supabase/supabase-js";

export type Snapshot = { payload: unknown; fetchedAt: string; lastAttemptedAt: string; failed: boolean };
export type ReadStore = { get(key: string): Promise<Snapshot | null> };
export type WriteStore = { save(key: string, payload: unknown, at: string): Promise<void>; fail(key: string, at: string): Promise<void> };
export function createSnapshotStore(client: SupabaseClient): ReadStore & WriteStore {
  return {
    async get(key) {
      const { data, error } = await client.from("market_snapshots").select("payload,fetched_at,last_attempted_at,last_attempt_failed").eq("dataset_key", key).maybeSingle();
      if (error) throw new Error("Snapshot storage unavailable");
      if (!data?.fetched_at || data.payload === null) return null;
      return { payload: data.payload, fetchedAt: data.fetched_at, lastAttemptedAt: data.last_attempted_at, failed: data.last_attempt_failed };
    },
    async save(key, payload, at) {
      const { error } = await client.rpc("save_market_snapshot", { p_key: key, p_payload: payload, p_at: at });
      if (error) throw new Error("Snapshot storage unavailable");
    },
    async fail(key, at) {
      const { error } = await client.rpc("record_market_failure", { p_key: key, p_at: at });
      if (error) throw new Error("Snapshot storage unavailable");
    },
  };
}
