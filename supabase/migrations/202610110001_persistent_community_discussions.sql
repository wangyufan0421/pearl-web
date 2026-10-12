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
