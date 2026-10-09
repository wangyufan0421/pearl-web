import { describe, expect, it, vi } from "vitest";
import { createRequestCache } from "./runtime";

describe("createRequestCache", () => {
  it("shares an in-flight request and reuses it until its TTL expires", async () => {
    let now = 0;
    const cache = createRequestCache(() => now);
    const loader = vi.fn(async () => ({ value: 1 }));

    const [first, second] = await Promise.all([
      cache.get("network", 30_000, loader),
      cache.get("network", 30_000, loader),
    ]);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);

    now = 29_999;
    await cache.get("network", 30_000, loader);
    expect(loader).toHaveBeenCalledTimes(1);

    now = 30_000;
    await cache.get("network", 30_000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
