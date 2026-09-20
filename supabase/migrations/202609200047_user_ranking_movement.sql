begin;

create table public.community_user_rank_snapshots (
  snapshot_date date not null,
  period_days integer not null check (period_days in (0, 7, 30)),
  user_id uuid not null references public.users(id) on delete cascade,
  rank_position integer not null check (rank_position between 1 and 100),
  activity_score bigint not null check (activity_score >= 0),
  captured_at timestamptz not null default now(),
  primary key (snapshot_date, period_days, user_id),
  unique (snapshot_date, period_days, rank_position)
);

create index community_user_rank_snapshots_lookup_idx
  on public.community_user_rank_snapshots (period_days, snapshot_date desc, rank_position);

alter table public.community_user_rank_snapshots enable row level security;
revoke all on public.community_user_rank_snapshots from public, anon, authenticated;

insert into public.community_user_rank_snapshots
  (snapshot_date, period_days, user_id, rank_position, activity_score)
select current_date - 1, periods.period_days, leaderboard.user_id,
  row_number() over (
    partition by periods.period_days
    order by leaderboard.activity_score desc, leaderboard.added_albums desc,
      leaderboard.biographies desc, leaderboard.reviews desc, leaderboard.ratings desc,
      lower(leaderboard.username), leaderboard.user_id
  )::integer,
  leaderboard.activity_score
from (values (7), (30), (0)) periods(period_days)
cross join lateral public.community_user_leaderboard(periods.period_days, 100) leaderboard;

create function public.community_user_leaderboard_with_movement(
  requested_period_days integer default 30,
  result_limit integer default 100
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  added_albums bigint,
  biographies bigint,
  reviews bigint,
  ratings bigint,
  activity_score bigint,
  rank_position integer,
  position_change integer,
  is_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_period integer := case when requested_period_days in (0, 7, 30) then requested_period_days else 30 end;
  previous_date date;
begin
  delete from public.community_user_rank_snapshots snapshot
  where snapshot.snapshot_date = current_date
    and snapshot.period_days = normalized_period;

  insert into public.community_user_rank_snapshots
    (snapshot_date, period_days, user_id, rank_position, activity_score)
  select current_date, normalized_period, leaderboard.user_id,
    row_number() over (
      order by leaderboard.activity_score desc, leaderboard.added_albums desc,
        leaderboard.biographies desc, leaderboard.reviews desc, leaderboard.ratings desc,
        lower(leaderboard.username), leaderboard.user_id
    )::integer,
    leaderboard.activity_score
  from public.community_user_leaderboard(normalized_period, 100) leaderboard;

  delete from public.community_user_rank_snapshots snapshot
  where snapshot.snapshot_date < current_date - 400;

  select max(snapshot.snapshot_date) into previous_date
  from public.community_user_rank_snapshots snapshot
  where snapshot.period_days = normalized_period
    and snapshot.snapshot_date < current_date;

  return query
  select leaderboard.user_id, leaderboard.username, leaderboard.avatar_url,
    leaderboard.added_albums, leaderboard.biographies, leaderboard.reviews,
    leaderboard.ratings, leaderboard.activity_score, current_snapshot.rank_position,
    case when previous_snapshot.user_id is null then null
      else previous_snapshot.rank_position - current_snapshot.rank_position end,
    previous_snapshot.user_id is null
  from public.community_user_leaderboard(
    normalized_period,
    least(greatest(coalesce(result_limit, 100), 1), 100)
  ) leaderboard
  join public.community_user_rank_snapshots current_snapshot
    on current_snapshot.snapshot_date = current_date
    and current_snapshot.period_days = normalized_period
    and current_snapshot.user_id = leaderboard.user_id
  left join public.community_user_rank_snapshots previous_snapshot
    on previous_snapshot.snapshot_date = previous_date
    and previous_snapshot.period_days = normalized_period
    and previous_snapshot.user_id = leaderboard.user_id
  order by current_snapshot.rank_position;
end;
$$;

revoke all on function public.community_user_leaderboard_with_movement(integer, integer) from public;
grant execute on function public.community_user_leaderboard_with_movement(integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
