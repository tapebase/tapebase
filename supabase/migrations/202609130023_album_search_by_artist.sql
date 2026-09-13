begin;

create or replace function public.search_album_ids(
  search_query text,
  result_offset integer default 0,
  result_limit integer default 20
)
returns table(album_id bigint, total_count bigint)
language sql
stable
set search_path = ''
as $$
  with input as (
    select '%' || replace(replace(replace(left(btrim(coalesce(search_query, '')), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ), matches as (
    select distinct album.id, album.created_at
    from public.albums album
    cross join input
    left join public.album_artists credit on credit.album_id = album.id
    left join public.artists artist on artist.id = credit.artist_id and artist.catalog_visible = true
    where btrim(coalesce(search_query, '')) <> ''
      and (album.title ilike input.pattern escape '\'
        or artist.name ilike input.pattern escape '\')
  )
  select id, count(*) over()::bigint
  from matches
  order by created_at desc, id desc
  offset greatest(coalesce(result_offset, 0), 0)
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

revoke all on function public.search_album_ids(text, integer, integer) from public;
grant execute on function public.search_album_ids(text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
