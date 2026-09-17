begin;

create or replace function public.latest_public_playlists(limit_count integer default 12)
returns table (
  id bigint,
  name text,
  description text,
  cover_url text,
  created_at timestamptz,
  username text,
  track_count bigint,
  sample_cover_urls text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    list.id,
    list.name,
    list.description,
    list.cover_url,
    list.created_at,
    owner.username,
    (select count(*) from public.user_track_list_items item where item.list_id = list.id) as track_count,
    coalesce((
      select array_agg(sample.cover_url order by sample.first_position)
      from (
        select album.id, album.cover_url, min(item.position) as first_position
        from public.user_track_list_items item
        join public.tracks track on track.id = item.track_id
        join public.albums album on album.id = track.album_id
        where item.list_id = list.id and album.cover_url is not null
        group by album.id, album.cover_url
        order by min(item.position)
        limit 4
      ) sample
    ), '{}'::text[]) as sample_cover_urls
  from public.user_lists list
  join public.users owner on owner.id = list.user_id
  where list.is_public and list.kind = 'tracks'
  order by list.created_at desc, list.id desc
  limit least(greatest(limit_count, 1), 30);
$$;

revoke all on function public.latest_public_playlists(integer) from public;
grant execute on function public.latest_public_playlists(integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
