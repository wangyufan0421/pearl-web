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
    expect(sql).toMatch(/supplied_author is not null\s+and supplied_handle is not null\s+and supplied_avatar like 'https:\/\/%'/i);
    expect(sql).toMatch(/identity_next_check_at\s*=\s*case[\s\S]*?when current_source\.author_user_id is null then now\(\) \+ interval '5 minutes'[\s\S]*?else now\(\) \+ interval '24 hours'/i);
    const finish = sql.split("create or replace function public.finish_discussion_identity_source")[1];
    expect(finish).toBeTruthy();
    expect(finish).not.toMatch(/\bblocks\s*=/i);
    expect(finish).not.toMatch(/\bfetched_at\s*=/i);
    expect(finish).not.toMatch(/\blast_attempted_at\s*=/i);
  });

  it("backs off and retries when a verified author profile is incomplete", () => {
    const sql = migration();
    expect(sql).toMatch(/verified_identity\s+boolean/i);
    expect(sql).toMatch(/complete_identity\s+boolean/i);
    expect(sql).toMatch(/identity_failure_count\s*=\s*case when complete_identity then 0 else identity_failure_count \+ 1 end/i);
    expect(sql).toMatch(/partial_retry_scheduled/i);
  });

  it("does not overwrite saved details with a historical tweet before binding its stable user ID", () => {
    const sql = migration();
    expect(sql).toMatch(/when current_source\.author_user_id is null then coalesce\(author, supplied_author\)/i);
    expect(sql).toMatch(/when current_source\.author_user_id is null then coalesce\(handle, supplied_handle\)/i);
    expect(sql).toMatch(/when current_source\.author_user_id is null then coalesce\(avatar_url, valid_avatar\)/i);
    expect(sql).toMatch(/when current_source\.author_user_id is null then now\(\) \+ interval '5 minutes'/i);
  });

  it("does not touch discussion timestamps for identity-only updates", () => {
    const sql = migration();
    expect(sql).toMatch(/drop trigger if exists touch_discussion_updated_at on public\.discussion_sources/i);
    expect(sql).toMatch(/after insert or update of [^;]+\s+on public\.discussion_sources/i);
  });
});
