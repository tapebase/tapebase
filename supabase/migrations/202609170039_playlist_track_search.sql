begin;

create or replace function public.search_playlist_track_ids(
  search_query text default '',
  result_offset integer default 0,
  result_limit integer default 20
)
returns table(track_id bigint, total_count bigint)
language sql
stable
set search_path = ''
as $$
  with input as (
    select
      btrim(left(coalesce(search_query, ''), 100)) as query,
      '%' || replace(replace(replace(left(btrim(coalesce(search_query, '')), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ), matches as (
    select distinct
      track.id,
      album.release_date,
      album.id as album_id,
      track.disc_number,
      track.track_number
    from public.tracks track
    join public.albums album on album.id = track.album_id
    cross join input
    left join public.spotify_track_artists credit on credit.track_id = track.id
    left join public.artists artist on artist.id = credit.artist_id
    where input.query = ''
      or track.title ilike input.pattern escape '\'
      or album.title ilike input.pattern escape '\'
      or (artist.catalog_visible = true and artist.name ilike input.pattern escape '\')
  )
  select id, count(*) over()::bigint
  from matches
  order by release_date desc nulls last, album_id desc, disc_number, track_number, id
  offset greatest(coalesce(result_offset, 0), 0)
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

revoke all on function public.search_playlist_track_ids(text, integer, integer) from public;
grant execute on function public.search_playlist_track_ids(text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
