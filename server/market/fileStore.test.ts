// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileSnapshotStore } from "./fileStore.js";
import { createMarketStore } from "./runtime.js";
import { datasets } from "./datasets.js";

let folder: string;
afterEach(async () => { if (folder) await rm(folder, { recursive: true }); });
async function directory() { folder = await mkdtemp(join(tmpdir(), "pearl-file-store-")); return folder; }
describe("persistent local market storage", () => {
  it("supports every production dataset key, including underscore metric names", async () => {
    const store = createFileSnapshotStore(await directory());
    for (const dataset of datasets) {
      await store.save(dataset.key, { value: 1 }, "2026-10-12T00:00:00Z");
      expect(await store.get(dataset.key)).toMatchObject({ payload: { value: 1 } });
    }
  });
  it("starts without Supabase and shares durable data with a new reader", async () => {
    const path = await directory();
    const writer = createMarketStore({ MARKET_DATA_DIR: path });
    await writer.save("network", { height: 42 }, "2026-10-12T00:00:00Z");
    const reader = createFileSnapshotStore(path);
    expect(await reader.get("network")).toMatchObject({ payload: { height: 42 }, fetchedAt: "2026-10-12T00:00:00Z", failed: false });
  });
  it("retains last successful data and time after an upstream failure", async () => {
    const store = createFileSnapshotStore(await directory());
    await store.save("candles:7D", { c: [1] }, "2026-10-12T00:00:00Z");
    await store.fail("candles:7D", "2026-10-12T00:01:00Z");
    expect(await store.get("candles:7D")).toEqual({ payload: { c: [1] }, fetchedAt: "2026-10-12T00:00:00Z", lastAttemptedAt: "2026-10-12T00:01:00Z", failed: true });
    await store.save("candles:7D", { c: [2] }, "2026-10-12T00:02:00Z");
    expect(await store.get("candles:7D")).toMatchObject({ payload: { c: [2] }, failed: false });
  });
  it("returns no fabricated snapshot before the first success and rejects unsafe keys", async () => {
    const store = createFileSnapshotStore(await directory());
    await store.fail("network", "2026-10-12T00:00:00Z");
    expect(await store.get("network")).toBeNull(); expect(await store.get("holders")).toBeNull();
    await expect(store.save("../outside", {}, "2026-10-12T00:00:00Z")).rejects.toThrow();
  });
  it("does not let an older attempt overwrite newer saved data", async () => {
    const store = createFileSnapshotStore(await directory());
    await store.save("network", { height: 43 }, "2026-10-12T00:02:00Z");
    await store.fail("network", "2026-10-12T00:01:00Z");
    expect(await store.get("network")).toMatchObject({ payload: { height: 43 }, failed: false });
  });
});
