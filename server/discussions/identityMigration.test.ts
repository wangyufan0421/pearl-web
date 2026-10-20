import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = () => readFileSync(resolve(process.cwd(), "supabase/migrations/202610200001_discussion_identity_refresh.sql"), "utf8");

describe("community identity migration contract", () => {
  it("claims due work atomically and limits database functions to service role", () => {
    const sql = migration();
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toMatch(/identity_lease_token/i);
    expect(sql).toMatch(/grant execute on function public\.claim_discussion_identity_source\(\) to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.finish_discussion_identity_source\(jsonb\) to service_role/i);
  });

  it("checks successful identities again after a day without updating content fields", () => {
    const sql = migration();
    expect(sql).toMatch(/identity_next_check_at\s*=\s*now\(\)\s*\+\s*interval '24 hours'/i);
    const finish = sql.split("create or replace function public.finish_discussion_identity_source")[1];
    expect(finish).toBeTruthy();
    expect(finish).not.toMatch(/\bblocks\s*=/i);
    expect(finish).not.toMatch(/\bfetched_at\s*=/i);
    expect(finish).not.toMatch(/\blast_attempted_at\s*=/i);
  });

  it("does not touch discussion timestamps for identity-only updates", () => {
    const sql = migration();
    expect(sql).toMatch(/drop trigger if exists touch_discussion_updated_at on public\.discussion_sources/i);
    expect(sql).toMatch(/after insert or update of [^;]+\s+on public\.discussion_sources/i);
  });
});
