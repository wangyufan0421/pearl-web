import { describe, expect, it, vi } from "vitest";
import { createIdentityQueue } from "./identityQueue";

const job = { id: "source-1", url: "https://x.com/root/status/123", authorUserId: null, leaseToken: "lease-1" };
const identity = { userId: "42", author: "Root", handle: "root", avatarUrl: "https://pbs.twimg.com/root.jpg" };

describe("community identity queue", () => {
  it("does nothing when no source is due", async () => {
    const claim = vi.fn(async () => null);
    const finish = vi.fn(async () => "updated");
    const resolve = vi.fn(async () => identity);
    await createIdentityQueue({ store: { claim, finish }, resolve }).tick();
    expect(claim).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("saves a verified author without sending content fields", async () => {
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null);
    const finish = vi.fn(async () => "updated");
    await createIdentityQueue({ store: { claim, finish }, resolve: async () => identity }).tick();
    expect(finish).toHaveBeenCalledWith({ id: job.id, leaseToken: job.leaseToken, ...identity });
    expect(JSON.stringify(finish.mock.calls)).not.toMatch(/blocks|translation|fetchedAt/);
  });

  it("schedules a retry when the provider fails", async () => {
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null);
    const finish = vi.fn(async () => "retry_scheduled");
    await createIdentityQueue({ store: { claim, finish }, resolve: async () => { throw new Error("secret upstream details"); } }).tick();
    expect(finish).toHaveBeenCalledWith({ id: job.id, leaseToken: job.leaseToken, userId: null, author: null, handle: null, avatarUrl: null });
  });

  it("spaces consecutive jobs to avoid a burst of paid requests", async () => {
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValueOnce({ ...job, id: "source-2", leaseToken: "lease-2" }).mockResolvedValue(null);
    const wait = vi.fn(async () => {});
    const queue = createIdentityQueue({ store: { claim, finish: async () => "updated" }, resolve: async () => identity, wait, throttleMs: 1_000 });
    await queue.tick();
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it("does not overlap scans and stops polling", async () => {
    let release: ((value: typeof identity) => void) | undefined;
    const claim = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null);
    const finish = vi.fn(async () => "updated");
    const resolve = vi.fn(() => new Promise<typeof identity>(done => { release = done; }));
    const queue = createIdentityQueue({ store: { claim, finish }, resolve });
    const first = queue.tick();
    const second = queue.tick();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release!(identity);
    await Promise.all([first, second]);
    expect(resolve).toHaveBeenCalledOnce();
    queue.stop();
    await queue.tick();
    expect(claim).toHaveBeenCalledTimes(2);
  });
});
