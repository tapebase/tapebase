begin;

create or replace function public.community_user_leaderboard(
  period_days integer default 30,
  result_limit integer default 5
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  added_albums bigint,
  reviews bigint,
  ratings bigint,
  activity_score bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select now() - make_interval(days => least(greatest(period_days, 1), 365)) as since,
      least(greatest(result_limit, 1), 20) as row_limit
  ),
  contributed_albums as (
    select supporter.user_id, album.id as album_id
    from public.catalog_submission_supporters supporter
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.albums album on album.spotify_id = submission.spotify_id
    cross join settings
    where submission.spotify_type = 'album' and submission.status = 'imported'
      and submission.updated_at >= settings.since
    union
    select supporter.user_id, credit.album_id
    from public.catalog_submission_supporters supporter
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.artists artist on artist.spotify_id = submission.spotify_id
    join public.album_artists credit on credit.artist_id = artist.id
    join public.albums album on album.id = credit.album_id
    cross join settings
    where submission.spotify_type = 'artist' and submission.status = 'imported'
      and submission.updated_at >= settings.since
  ),
  album_counts as (
    select user_id, count(distinct album_id)::bigint as added_albums
    from contributed_albums group by user_id
  ),
  review_counts as (
    select comment.user_id, count(*)::bigint as reviews
    from public.comments comment cross join settings
    where comment.parent_comment_id is null and comment.hidden_at is null
      and comment.created_at >= settings.since
    group by comment.user_id
  ),
  rating_counts as (
    select rating.user_id, count(*)::bigint as ratings
    from public.ratings rating cross join settings
    where rating.updated_at >= settings.since
    group by rating.user_id
  ),
  scored as (
    select member.id as user_id, member.username, member.avatar_url,
      coalesce(album_counts.added_albums, 0)::bigint as added_albums,
      coalesce(review_counts.reviews, 0)::bigint as reviews,
      coalesce(rating_counts.ratings, 0)::bigint as ratings,
      (coalesce(album_counts.added_albums, 0) * 5
        + coalesce(review_counts.reviews, 0) * 3
        + coalesce(rating_counts.ratings, 0))::bigint as activity_score
    from public.users member
    left join album_counts on album_counts.user_id = member.id
    left join review_counts on review_counts.user_id = member.id
    left join rating_counts on rating_counts.user_id = member.id
    where member.suspended_at is null
  )
  select scored.* from scored cross join settings
  where scored.activity_score > 0
  order by scored.activity_score desc, scored.added_albums desc,
    scored.reviews desc, scored.ratings desc, lower(scored.username), scored.user_id
  limit (select row_limit from settings);
$$;

revoke all on function public.community_user_leaderboard(integer, integer) from public;
grant execute on function public.community_user_leaderboard(integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
