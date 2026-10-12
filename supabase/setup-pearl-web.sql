-- Pearl web: run ONCE in the Supabase SQL Editor on a fresh project.

-- Generated from the three migrations below; contains no credentials.

begin;

-- Migration: 202610110001_persistent_community_discussions.sql
create type public.discussion_status as enum ('draft', 'published');
create type public.discussion_source_role as enum ('primary', 'response');
create type public.discussion_source_type as enum ('tweet', 'noteTweet', 'article');
create type public.discussion_fetch_status as enum ('success', 'failed');

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  primary_source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.discussion_status not null default 'published'
);

create table public.discussion_sources (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  x_status_id text not null unique check (x_status_id ~ '^[0-9]+$'),
  url text not null,
  role public.discussion_source_role not null,
  author text,
  handle text,
  avatar_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  last_attempted_at timestamptz not null default now(),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  source_type public.discussion_source_type,
  position integer not null default 0 check (position >= 0),
  fetch_status public.discussion_fetch_status not null default 'failed',
  last_fetch_error text,
  unique (discussion_id, role, position)
);

alter table public.discussions
  add constraint discussions_primary_source_id_fkey
  foreign key (primary_source_id)
  references public.discussion_sources(id)
  deferrable initially deferred;

create index discussion_sources_read_order_idx
  on public.discussion_sources (discussion_id, role, published_at, position);

create or replace function public.touch_discussion_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.discussions
  set updated_at = now()
  where id = new.discussion_id;

  return new;
end;
$$;

create trigger touch_discussion_updated_at
after insert or update on public.discussion_sources
for each row execute function public.touch_discussion_updated_at();

create or replace function public.create_discussion_with_primary(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  discussion_id uuid;
  new_primary_source_id uuid;
  primary_source jsonb := input -> 'primarySource';
begin
  insert into public.discussions (slug, title, description, status)
  values (
    input ->> 'slug',
    input ->> 'title',
    nullif(input ->> 'description', ''),
    coalesce(nullif(input ->> 'status', '')::public.discussion_status, 'published')
  )
  returning id into discussion_id;

  insert into public.discussion_sources (
    discussion_id,
    x_status_id,
    url,
    role,
    author,
    handle,
    avatar_url,
    published_at,
    fetched_at,
    last_attempted_at,
    blocks,
    source_type,
    position,
    fetch_status,
    last_fetch_error
  )
  values (
    discussion_id,
    primary_source ->> 'xStatusId',
    primary_source ->> 'url',
    'primary',
    primary_source ->> 'author',
    primary_source ->> 'handle',
    primary_source ->> 'avatarUrl',
    nullif(primary_source ->> 'publishedAt', '')::timestamptz,
    nullif(primary_source ->> 'fetchedAt', '')::timestamptz,
    coalesce(nullif(primary_source ->> 'lastAttemptedAt', '')::timestamptz, now()),
    coalesce(primary_source -> 'blocks', '[]'::jsonb),
    (primary_source ->> 'sourceType')::public.discussion_source_type,
    0,
    'success',
    primary_source ->> 'lastFetchError'
  )
  returning id into new_primary_source_id;

  update public.discussions
  set primary_source_id = new_primary_source_id
  where id = discussion_id;

  return discussion_id;
end;
$$;

revoke execute on function public.create_discussion_with_primary(jsonb) from public;
grant execute on function public.create_discussion_with_primary(jsonb) to service_role;

alter table public.discussions enable row level security;
alter table public.discussion_sources enable row level security;


-- Migration: 202610110002_atomic_discussion_response.sql
create or replace function public.create_or_duplicate_discussion_response(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_discussion_id uuid := (input ->> 'discussionId')::uuid;
  response_source jsonb := input -> 'responseSource';
  existing_source_id uuid;
  next_position integer;
begin
  perform id
  from public.discussions
  where id = target_discussion_id
  for update;

  if not found then
    raise exception 'Discussion not found: %', target_discussion_id;
  end if;

  select id into existing_source_id
  from public.discussion_sources
  where x_status_id = response_source ->> 'xStatusId';

  if existing_source_id is not null then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  select coalesce(max(position), -1) + 1 into next_position
  from public.discussion_sources
  where discussion_id = target_discussion_id
    and role = 'response';

  begin
    insert into public.discussion_sources (
      discussion_id, x_status_id, url, role, author, handle, avatar_url,
      published_at, fetched_at, last_attempted_at, blocks, source_type,
      position, fetch_status, last_fetch_error
    ) values (
      target_discussion_id,
      response_source ->> 'xStatusId',
      response_source ->> 'url',
      'response',
      response_source ->> 'author',
      response_source ->> 'handle',
      response_source ->> 'avatarUrl',
      nullif(response_source ->> 'publishedAt', '')::timestamptz,
      nullif(response_source ->> 'fetchedAt', '')::timestamptz,
      coalesce(nullif(response_source ->> 'lastAttemptedAt', '')::timestamptz, now()),
      coalesce(response_source -> 'blocks', '[]'::jsonb),
      (response_source ->> 'sourceType')::public.discussion_source_type,
      next_position,
      coalesce(nullif(response_source ->> 'fetchStatus', '')::public.discussion_fetch_status, 'failed'),
      response_source ->> 'lastFetchError'
    );
  exception when unique_violation then
    return jsonb_build_object('outcome', 'duplicate');
  end;

  return jsonb_build_object('outcome', 'created');
end;
$$;

revoke execute on function public.create_or_duplicate_discussion_response(jsonb) from public;
grant execute on function public.create_or_duplicate_discussion_response(jsonb) to service_role;


-- Migration: 202610120003_market_snapshots.sql
-- Server-only durable last-successful data. Public visitors read via the Node API.
create table if not exists public.market_snapshots (
  dataset_key text primary key,
  payload jsonb,
  fetched_at timestamptz,
  last_attempted_at timestamptz not null,
  last_attempt_failed boolean not null default false
);
alter table public.market_snapshots enable row level security;
revoke all on public.market_snapshots from anon, authenticated;
grant all on public.market_snapshots to service_role;

create or replace function public.save_market_snapshot(p_key text, p_payload jsonb, p_at timestamptz)
returns void language sql security invoker set search_path = public as $$
  insert into public.market_snapshots(dataset_key, payload, fetched_at, last_attempted_at, last_attempt_failed)
  values(p_key, p_payload, p_at, p_at, false)
  on conflict(dataset_key) do update set payload = excluded.payload, fetched_at = excluded.fetched_at,
    last_attempted_at = excluded.last_attempted_at, last_attempt_failed = false
  where market_snapshots.last_attempted_at <= excluded.last_attempted_at;
$$;

create or replace function public.record_market_failure(p_key text, p_at timestamptz)
returns void language sql security invoker set search_path = public as $$
  insert into public.market_snapshots(dataset_key, last_attempted_at, last_attempt_failed)
  values(p_key, p_at, true)
  on conflict(dataset_key) do update set last_attempted_at = excluded.last_attempted_at, last_attempt_failed = true
  where market_snapshots.last_attempted_at <= excluded.last_attempted_at;
$$;
revoke all on function public.save_market_snapshot(text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.record_market_failure(text, timestamptz) from public, anon, authenticated;
grant execute on function public.save_market_snapshot(text, jsonb, timestamptz) to service_role;
grant execute on function public.record_market_failure(text, timestamptz) to service_role;


commit;

