import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollector } from "./collector.js";
import { datasets } from "./datasets.js";

afterEach(() => vi.useRealTimers());
const job = datasets.find(item => item.key === "metric:price")!;
const valid = [{ meta: { id: "price", label: "Price", unit: "USD" }, points: [{ t: 100, v: 2 }] }];
function store() {
  const snapshots = new Map<string, unknown>();
  return { snapshots, save: vi.fn(async (key: string, payload: unknown) => { snapshots.set(key, payload); }), fail: vi.fn(async () => {}) };
}
describe("independent market collector", () => {
  it("collects on startup without any visitor and repeats at its cadence", async () => {
    vi.useFakeTimers();
    const saved = store();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(valid)));
    const collector = createCollector({ store: saved, jobs: [job], fetcher });
    collector.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.snapshots.get(job.key)).toEqual(valid);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    collector.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retains the last good snapshot on network failure or invalid payload", async () => {
    const saved = store();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(valid))).mockRejectedValueOnce(new Error("private upstream detail")).mockResolvedValueOnce(new Response("[]"));
    const collector = createCollector({ store: saved, jobs: [job], fetcher });
    await collector.run(job); await collector.run(job); await collector.run(job);
    expect(saved.save).toHaveBeenCalledTimes(1);
    expect(saved.fail).toHaveBeenCalledTimes(2);
    expect(saved.snapshots.get(job.key)).toEqual(valid);
    expect(JSON.stringify(saved.fail.mock.calls)).not.toContain("private upstream");
  });
  it("coalesces overlapping executions of one job", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    const collector = createCollector({ store: store(), jobs: [job], fetcher });
    const first = collector.run(job); const second = collector.run(job);
    await Promise.resolve(); await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify(valid)));
    await Promise.all([first, second]);
  });
  it("rejects a series belonging to another metric and corrupt transaction statistics", async () => {
    const saved = store();
    const wrong = [{ ...valid[0], meta: { ...valid[0].meta, id: "volume" } }];
    const tx = datasets.find(item => item.key === "txsizes")!;
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(wrong))).mockResolvedValueOnce(new Response(JSON.stringify({ range: "30d", unit: "PRL", basis: "gross", stats: { count: "corrupt", median: "corrupt", max: "corrupt", top_share: "corrupt" }, whales: [], daily: [] })));
    const collector = createCollector({ store: saved, jobs: [job, tx], fetcher });
    await collector.run(job); await collector.run(tx);
    expect(saved.save).not.toHaveBeenCalled(); expect(saved.fail).toHaveBeenCalledTimes(2);
  });
  it("accepts the actual upstream top-share percentile pairs", () => {
    const tx = datasets.find(item => item.key === "txsizes")!;
    expect(() => tx.validate({ range: "30d", unit: "PRL", basis: "gross", stats: { count: 42, median: 10, max: 1000, top_share: [[0.1, 0.2], [1, 0.7], [10, 0.9]] }, whales: [], daily: [{ t: 100, n: 2, p50: 10, p90: 50, p99: 90 }] })).not.toThrow();
  });
  it("limits simultaneous upstream requests to four", async () => {
    let active = 0; let peak = 0;
    const releases: Array<() => void> = [];
    const fetcher = vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>(resolve => releases.push(resolve)); active--;
      return new Response(JSON.stringify(valid));
    });
    const jobs = Array.from({ length: 8 }, (_, index) => ({ ...job, key: `metric:test${index}` }));
    const collector = createCollector({ store: store(), jobs, fetcher });
    const work = Promise.all(jobs.map(item => collector.run(item)));
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(4);
    while (fetcher.mock.calls.length < 8 || active) {
      releases.splice(0).forEach(release => release());
      for (let i = 0; i < 20; i++) await Promise.resolve();
    }
    await work; expect(peak).toBe(4);
  });
});
