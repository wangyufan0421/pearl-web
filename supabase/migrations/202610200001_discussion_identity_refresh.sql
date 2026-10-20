-- Author identity maintenance is deliberately independent of archived text and translations.
alter table public.discussion_sources
  add column if not exists author_user_id text,
  add column if not exists identity_checked_at timestamptz,
  add column if not exists identity_next_check_at timestamptz not null default now(),
  add column if not exists identity_failure_count integer not null default 0,
  add column if not exists identity_lease_token uuid,
  add column if not exists identity_lease_until timestamptz;

create index if not exists discussion_sources_identity_due_idx
  on public.discussion_sources (identity_next_check_at, identity_lease_until);

-- Identity-only and queue-maintenance writes must not change discussion content timestamps.
drop trigger if exists touch_discussion_updated_at on public.discussion_sources;
create trigger touch_discussion_updated_at
after insert or update of url, x_status_id, role, published_at, fetched_at,
  last_attempted_at, blocks, source_type, position, fetch_status, last_fetch_error
on public.discussion_sources
for each row execute function public.touch_discussion_updated_at();

create or replace function public.claim_discussion_identity_source()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed public.discussion_sources%rowtype;
  token uuid := gen_random_uuid();
begin
  select * into claimed
  from public.discussion_sources
  where identity_next_check_at <= now()
    and (identity_lease_until is null or identity_lease_until <= now())
  order by case when author is null or handle is null or avatar_url is null then 0 else 1 end,
    identity_next_check_at, id
  limit 1
  for update skip locked;

  if not found then return null; end if;

  update public.discussion_sources
  set identity_lease_token = token,
      identity_lease_until = now() + interval '2 minutes'
  where id = claimed.id;

  return jsonb_build_object(
    'id', claimed.id,
    'url', claimed.url,
    'authorUserId', claimed.author_user_id,
    'leaseToken', token
  );
end;
$$;

revoke execute on function public.claim_discussion_identity_source() from public;
grant execute on function public.claim_discussion_identity_source() to service_role;

create or replace function public.finish_discussion_identity_source(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_source public.discussion_sources%rowtype;
  supplied_user_id text := nullif(btrim(input ->> 'userId'), '');
  supplied_author text := nullif(btrim(input ->> 'author'), '');
  supplied_handle text := nullif(btrim(input ->> 'handle'), '');
  supplied_avatar text := nullif(btrim(input ->> 'avatarUrl'), '');
  valid_avatar text;
  verified_identity boolean;
  complete_identity boolean;
  delay_seconds integer;
begin
  select * into current_source
  from public.discussion_sources
  where id = (input ->> 'id')::uuid
    and identity_lease_token = (input ->> 'leaseToken')::uuid
  for update;

  if not found then return jsonb_build_object('outcome', 'stale'); end if;

  verified_identity := supplied_user_id is not null
    and supplied_user_id ~ '^[0-9]+$'
    and (current_source.author_user_id is null or current_source.author_user_id = supplied_user_id);
  complete_identity := verified_identity
    and supplied_author is not null
    and supplied_handle is not null
    and supplied_avatar like 'https://%';
  valid_avatar := case when supplied_avatar like 'https://%' then supplied_avatar else null end;
  delay_seconds := least(86400, (300 * power(2, least(current_source.identity_failure_count, 8)))::integer);

  if verified_identity then
    update public.discussion_sources
    set author_user_id = coalesce(author_user_id, supplied_user_id),
        author = case when current_source.author_user_id is null then coalesce(author, supplied_author) else coalesce(supplied_author, author) end,
        handle = case when current_source.author_user_id is null then coalesce(handle, supplied_handle) else coalesce(supplied_handle, handle) end,
        avatar_url = case when current_source.author_user_id is null then coalesce(avatar_url, valid_avatar) else coalesce(valid_avatar, avatar_url) end,
        identity_checked_at = now(),
        identity_next_check_at = case
          when not complete_identity then now() + make_interval(secs => delay_seconds)
          when current_source.author_user_id is null then now() + interval '5 minutes'
          else now() + interval '24 hours'
        end,
        identity_failure_count = case when complete_identity then 0 else identity_failure_count + 1 end,
        identity_lease_token = null,
        identity_lease_until = null
    where id = current_source.id;
    if complete_identity then
      return jsonb_build_object('outcome', case when current_source.author_user_id is null then 'identity_bound' else 'updated' end);
    end if;
    return jsonb_build_object('outcome', 'partial_retry_scheduled');
  end if;

  if supplied_user_id is not null and current_source.author_user_id is distinct from supplied_user_id then
    delay_seconds := 86400;
  end if;
  update public.discussion_sources
  set identity_checked_at = now(),
      identity_next_check_at = now() + make_interval(secs => delay_seconds),
      identity_failure_count = identity_failure_count + 1,
      identity_lease_token = null,
      identity_lease_until = null
  where id = current_source.id;
  return jsonb_build_object('outcome', 'retry_scheduled');
end;
$$;

revoke execute on function public.finish_discussion_identity_source(jsonb) from public;
grant execute on function public.finish_discussion_identity_source(jsonb) to service_role;
