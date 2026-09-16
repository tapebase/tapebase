begin;

create table public.user_follows (
  follower_id uuid not null constraint user_follows_follower_id_fkey references public.users(id) on delete cascade,
  followed_id uuid not null constraint user_follows_followed_id_fkey references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index user_follows_followed_created_idx on public.user_follows (followed_id, created_at desc);
create index user_follows_follower_created_idx on public.user_follows (follower_id, created_at desc);

create table public.user_blocks (
  blocker_id uuid not null constraint user_blocks_blocker_id_fkey references public.users(id) on delete cascade,
  blocked_id uuid not null constraint user_blocks_blocked_id_fkey references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;

create policy user_follows_public_read on public.user_follows
for select to anon, authenticated using (true);

create policy user_blocks_participant_read on public.user_blocks
for select to authenticated
using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));

revoke all on public.user_follows from anon, authenticated;
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_follows to anon, authenticated;
grant select on public.user_blocks to authenticated;

create or replace function public.follow_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
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
end;
$$;

create or replace function public.unfollow_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  delete from public.user_follows
  where follower_id = viewer_id and followed_id = target_user_id;
end;
$$;

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  if target_user_id = viewer_id then
    raise exception 'Cannot block yourself';
  end if;
  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'User not found';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (viewer_id, target_user_id)
  on conflict do nothing;

  delete from public.user_follows
  where (follower_id = viewer_id and followed_id = target_user_id)
     or (follower_id = target_user_id and followed_id = viewer_id);
end;
$$;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;
  delete from public.user_blocks
  where blocker_id = viewer_id and blocked_id = target_user_id;
end;
$$;

create or replace function public.user_relationship_state(target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object('following', false, 'follows_you', false, 'blocked_by_you', false, 'blocked_you', false)
    else jsonb_build_object(
      'following', exists(select 1 from public.user_follows where follower_id = (select auth.uid()) and followed_id = target_user_id),
      'follows_you', exists(select 1 from public.user_follows where follower_id = target_user_id and followed_id = (select auth.uid())),
      'blocked_by_you', exists(select 1 from public.user_blocks where blocker_id = (select auth.uid()) and blocked_id = target_user_id),
      'blocked_you', exists(select 1 from public.user_blocks where blocker_id = target_user_id and blocked_id = (select auth.uid()))
    )
  end;
$$;

create or replace function public.following_activity(activity_limit integer default 30)
returns table (
  actor_id uuid,
  username text,
  avatar_url text,
  kind text,
  occurred_at timestamptz,
  rating numeric,
  content text,
  target_title text,
  target_slug text,
  target_image_url text,
  target_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null or not public.is_active_user() then
    raise exception 'Active account required';
  end if;

  return query
  with followed as (
    select relation.followed_id
    from public.user_follows relation
    where relation.follower_id = viewer_id
  ),
  direct_album_additions as (
    select supporter.user_id, album.id as album_id, album.title, album.slug, album.cover_url,
      supporter.created_at
    from public.catalog_submission_supporters supporter
    join followed on followed.followed_id = supporter.user_id
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.albums album on album.spotify_id = submission.spotify_id
    where submission.spotify_type = 'album' and submission.status = 'imported'
  ),
  artist_album_additions as (
    select supporter.user_id, album.id as album_id, album.title, album.slug, album.cover_url,
      supporter.created_at
    from public.catalog_submission_supporters supporter
    join followed on followed.followed_id = supporter.user_id
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.artists artist on artist.spotify_id = submission.spotify_id
    join public.album_artists credit on credit.artist_id = artist.id
    join public.albums album on album.id = credit.album_id
    where submission.spotify_type = 'artist' and submission.status = 'imported'
  ),
  added_albums as (
    select distinct on (addition.user_id, addition.album_id)
      addition.user_id, addition.album_id, addition.title, addition.slug, addition.cover_url, addition.created_at
    from (
      select * from direct_album_additions
      union all
      select * from artist_album_additions
    ) addition
    order by addition.user_id, addition.album_id, addition.created_at
  ),
  activity as (
    select r.user_id, 'album_rating'::text as kind, r.updated_at as occurred_at,
      r.rating, null::text as content, album.title as target_title, album.slug as target_slug,
      album.cover_url as target_image_url, 'album'::text as target_type
    from public.ratings r
    join followed on followed.followed_id = r.user_id
    join public.albums album on album.id = r.album_id

    union all

    select r.user_id, 'artist_rating', r.updated_at, r.rating, null::text,
      artist.name, artist.slug, artist.image_url, 'artist'
    from public.artist_ratings r
    join followed on followed.followed_id = r.user_id
    join public.artists artist on artist.id = r.artist_id

    union all

    select comment.user_id, 'comment', comment.created_at, null::numeric, comment.content,
      coalesce(album.title, artist.name), coalesce(album.slug, artist.slug),
      coalesce(album.cover_url, artist.image_url),
      case when comment.album_id is not null then 'album' else 'artist' end
    from public.comments comment
    join followed on followed.followed_id = comment.user_id
    left join public.albums album on album.id = comment.album_id
    left join public.artists artist on artist.id = comment.artist_id
    where comment.hidden_at is null

    union all

    select added.user_id, 'album_added', added.created_at, null::numeric, null::text,
      added.title, added.slug, added.cover_url, 'album'
    from added_albums added
  )
  select profile.id, profile.username, profile.avatar_url, activity.kind,
    activity.occurred_at, activity.rating, activity.content, activity.target_title,
    activity.target_slug, activity.target_image_url, activity.target_type
  from activity
  join public.users profile on profile.id = activity.user_id and profile.suspended_at is null
  order by activity.occurred_at desc
  limit greatest(1, least(coalesce(activity_limit, 30), 100));
end;
$$;

revoke all on function public.follow_user(uuid) from public, anon;
revoke all on function public.unfollow_user(uuid) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.user_relationship_state(uuid) from public, anon;
revoke all on function public.following_activity(integer) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.user_relationship_state(uuid) to authenticated;
grant execute on function public.following_activity(integer) to authenticated;

notify pgrst, 'reload schema';
commit;
