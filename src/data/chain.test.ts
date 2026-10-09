import { describe, expect, it } from "vitest";
import { getActivity, getHolders, getPools } from "./chain";

function response(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe("prlstats Chain API adapters", () => {
  it("reads a current pool row from the public endpoint", async () => {
    const fetcher = async () => response([{ id: "kryptex", name: "Kryptex Pool", fee_pct: 2, payout_scheme: "PPS+", blocks_24h: 221, share_24h: 53.3 }]);

    const result = await getPools(fetcher as typeof fetch);

    expect(result.sourceKind).toBe("live");
    expect(result.data[0]).toEqual({ id: "kryptex", name: "Kryptex Pool", feePct: 2, payoutScheme: "PPS+", blocks24h: 221, share24h: 53.3 });
  });

  it("keeps activity metric metadata and dated points", async () => {
    const fetcher = async () => response([{ meta: { id: "txs", label: "Transactions per day", unit: "tx/day" }, points: [{ t: 1760000000, v: 42 }] }]);

    const result = await getActivity(fetcher as typeof fetch);

    expect(result.data[0]).toMatchObject({ id: "txs", label: "Transactions per day", unit: "tx/day" });
    expect(result.data[0].points[0]).toMatchObject({ value: 42 });
  });

  it("reads the holder summary and public top-address rows", async () => {
    const fetcher = async () => response({ funded: 62023, held_prl: 338458596, mined_prl: 400000000, gini: .959, top1_pct: 4, top10_pct: 14.5, top100_pct: 31, top1pct_pct: 62, dust_prl: .01, rows: [{ rank: 1, address: "prl1example", balance_prl: 9_000_000, share_pct: 2.7, first_day: "2026-01-01", pool: "Kryptex" }] });

    const result = await getHolders(fetcher as typeof fetch);

    expect(result.data).toMatchObject({ funded: 62023, gini: .959, top10Pct: 14.5 });
    expect(result.data.rows[0]).toMatchObject({ address: "prl1example", balancePrl: 9_000_000, pool: "Kryptex" });
  });
});
