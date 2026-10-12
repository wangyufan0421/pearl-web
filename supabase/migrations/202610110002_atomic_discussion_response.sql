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
