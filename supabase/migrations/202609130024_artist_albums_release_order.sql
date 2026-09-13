begin;

create or replace function public.artist_album_ids(
  requested_artist_id bigint,
  result_offset integer default 0,
  result_limit integer default 20
)
returns table(album_id bigint, total_count bigint)
language sql
stable
set search_path = ''
as $$
  select album.id, count(*) over()::bigint
  from public.albums album
  where exists (
    select 1 from public.album_artists credit
    where credit.album_id = album.id
      and credit.artist_id = requested_artist_id
  )
  order by album.release_date_raw desc nulls last, album.id desc
  offset greatest(coalesce(result_offset, 0), 0)
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

revoke all on function public.artist_album_ids(bigint, integer, integer) from public;
grant execute on function public.artist_album_ids(bigint, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
