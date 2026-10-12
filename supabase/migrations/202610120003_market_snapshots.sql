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
