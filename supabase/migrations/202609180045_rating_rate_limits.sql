begin;

create table public.rating_rate_limits (
  user_id uuid primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  action_count integer not null default 1 check (action_count >= 1)
);

alter table public.rating_rate_limits enable row level security;
revoke all on public.rating_rate_limits from public, anon, authenticated;

create or replace function public.enforce_rating_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  current_count integer;
begin
  -- Service operations do not carry a user JWT and are not part of community voting.
  if viewer_id is null then
    return new;
  end if;
  if new.user_id <> viewer_id then
    raise exception 'rating_user_mismatch';
  end if;

  insert into public.rating_rate_limits (user_id, window_started_at, action_count)
  values (viewer_id, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when public.rating_rate_limits.window_started_at <= now() - interval '10 minutes' then now()
      else public.rating_rate_limits.window_started_at
    end,
    action_count = case
      when public.rating_rate_limits.window_started_at <= now() - interval '10 minutes' then 1
      else public.rating_rate_limits.action_count + 1
    end
  returning action_count into current_count;

  if current_count > 30 then
    raise exception 'rating_rate_limit_exceeded';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_rating_rate_limit() from public, anon, authenticated;

create trigger ratings_enforce_rate_limit
before insert or update of rating on public.ratings
for each row execute function public.enforce_rating_rate_limit();

create trigger artist_ratings_enforce_rate_limit
before insert or update of rating on public.artist_ratings
for each row execute function public.enforce_rating_rate_limit();

create trigger album_cover_ratings_enforce_rate_limit
before insert or update of rating on public.album_cover_ratings
for each row execute function public.enforce_rating_rate_limit();

create trigger user_list_ratings_enforce_rate_limit
before insert or update of rating on public.user_list_ratings
for each row execute function public.enforce_rating_rate_limit();

notify pgrst, 'reload schema';
commit;
