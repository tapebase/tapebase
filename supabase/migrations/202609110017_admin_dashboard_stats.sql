begin;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_catalog_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  with activity_events as (
    select user_id, updated_at as occurred_at from public.ratings
    union all select user_id, updated_at from public.artist_ratings
    union all select user_id, created_at from public.comments
    union all select user_id, created_at from public.comment_likes
    union all select user_id, created_at from public.catalog_submission_supporters
  ),
  days as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as day
  ),
  daily as (
    select d.day,
      (select count(*) from public.users u where u.created_at >= d.day and u.created_at < d.day + 1) as new_users,
      (select count(*) from public.ratings r where r.updated_at >= d.day and r.updated_at < d.day + 1)
        + (select count(*) from public.artist_ratings ar where ar.updated_at >= d.day and ar.updated_at < d.day + 1) as ratings,
      (select count(*) from public.comments c where c.created_at >= d.day and c.created_at < d.day + 1) as comments
    from days d
  ),
  user_activity as (
    select u.id, u.username,
      (select count(*) from public.ratings r where r.user_id = u.id)
        + (select count(*) from public.artist_ratings ar where ar.user_id = u.id) as ratings,
      (select count(*) from public.comments c where c.user_id = u.id) as comments,
      (select count(*) from public.catalog_submission_supporters css where css.user_id = u.id) as submissions
    from public.users u
  ),
  album_activity as (
    select a.id, a.title, a.slug,
      (select count(*) from public.ratings r where r.album_id = a.id) as ratings,
      (select count(*) from public.comments c where c.album_id = a.id and c.hidden_at is null) as comments
    from public.albums a
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from public.users),
      'artists', (select count(*) from public.artists),
      'albums', (select count(*) from public.albums),
      'concerts', (select count(*) from public.concerts where starts_at >= now()),
      'albumRatings', (select count(*) from public.ratings),
      'artistRatings', (select count(*) from public.artist_ratings),
      'comments', (select count(*) from public.comments where hidden_at is null),
      'pendingSubmissions', (select count(*) from public.catalog_submissions where status = 'pending')
    ),
    'users', jsonb_build_object(
      'new7d', (select count(*) from public.users where created_at >= now() - interval '7 days'),
      'new30d', (select count(*) from public.users where created_at >= now() - interval '30 days'),
      'active7d', (select count(distinct user_id) from activity_events where occurred_at >= now() - interval '7 days'),
      'active30d', (select count(distinct user_id) from activity_events where occurred_at >= now() - interval '30 days')
    ),
    'averages', jsonb_build_object(
      'albumRating', (select round(avg(rating), 2) from public.ratings),
      'artistRating', (select round(avg(rating), 2) from public.artist_ratings)
    ),
    'imports', jsonb_build_object(
      'total', (select count(*) from public.catalog_import_jobs),
      'queued', (select count(*) from public.catalog_import_jobs where status = 'queued'),
      'running', (select count(*) from public.catalog_import_jobs where status = 'running'),
      'waiting', (select count(*) from public.catalog_import_jobs where status = 'waiting_quota'),
      'errors', (select count(*) from public.catalog_import_jobs where status in ('failed', 'completed_with_errors'))
    ),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
      'date', day, 'newUsers', new_users, 'ratings', ratings, 'comments', comments
    ) order by day), '[]'::jsonb) from daily),
    'topUsers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select username, ratings, comments, submissions, ratings + comments + submissions as total
      from user_activity where ratings + comments + submissions > 0
      order by total desc, username limit 10
    ) x),
    'topAlbums', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, title, slug, ratings, comments, ratings + comments as total
      from album_activity where ratings + comments > 0
      order by total desc, title limit 10
    ) x)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

notify pgrst, 'reload schema';
commit;
