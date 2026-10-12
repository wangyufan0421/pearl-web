import { z } from "zod";

const networkSchema = z.object({
  ts: z.number(),
  height: z.number(),
  difficulty: z.number(),
  hashrate_hs: z.number(),
  avg_block_time_s: z.number(),
  target_block_s: z.number(),
  supply_prl: z.number(),
  supply_pct: z.number(),
  subsidy_prl: z.number(),
  emission_prl_day: z.number(),
});

export type NetworkSnapshot = {
  updatedAt: Date;
  height: number;
  difficulty: number;
  hashrateHs: number;
  avgBlockTimeSeconds: number;
  targetBlockSeconds: number;
  supplyPrl: number;
  supplyPercent: number;
  subsidyPrl: number;
  emissionPrlDay: number;
};

export function parseNetworkSnapshot(input: unknown): NetworkSnapshot {
  const raw = networkSchema.parse(input);
  return {
    updatedAt: new Date(raw.ts * 1000),
    height: raw.height,
    difficulty: raw.difficulty,
    hashrateHs: raw.hashrate_hs,
    avgBlockTimeSeconds: raw.avg_block_time_s,
    targetBlockSeconds: raw.target_block_s,
    supplyPrl: raw.supply_prl,
    supplyPercent: raw.supply_pct,
    subsidyPrl: raw.subsidy_prl,
    emissionPrlDay: raw.emission_prl_day,
  };
}
