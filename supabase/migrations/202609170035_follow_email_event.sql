begin;

drop function if exists public.follow_user(uuid);

create function public.follow_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  inserted_rows integer := 0;
begin
  if viewer_id is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if target_user_id = viewer_id then
    raise exception 'Cannot follow yourself';
  end if;
  if not exists (select 1 from public.users where id = target_user_id and suspended_at is null) then
    raise exception 'User not found';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = viewer_id and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = viewer_id)
  ) then
    raise exception 'Following is blocked';
  end if;

  insert into public.user_follows (follower_id, followed_id)
  values (viewer_id, target_user_id)
  on conflict do nothing;

  get diagnostics inserted_rows = row_count;
  return inserted_rows = 1;
end;
$$;

revoke all on function public.follow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
