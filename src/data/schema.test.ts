import { describe, expect, it } from "vitest";
import { parseNetworkSnapshot } from "./schema";

describe("parseNetworkSnapshot", () => {
  it("normalizes a valid prlstats network response", () => {
    const result = parseNetworkSnapshot({
      ts: 1791423735,
      height: 124752,
      difficulty: 34714717.88,
      hashrate_hs: 4.78e19,
      avg_block_time_s: 204.2,
      target_block_s: 194,
      supply_prl: 338047273.6,
      supply_pct: 16.09,
      subsidy_prl: 2273.55,
      emission_prl_day: 1011969,
    });

    expect(result.hashrateHs).toBe(4.78e19);
    expect(result.updatedAt).toEqual(new Date(1791423735 * 1000));
  });

  it("rejects a non-numeric hashrate", () => {
    expect(() => parseNetworkSnapshot({ hashrate_hs: "unknown" })).toThrow();
  });
});
