begin;

-- An accepted artist whose catalog and albums already exist has completed import.
-- This also repairs submissions imported before status synchronization was added.
update public.catalog_submissions submission
set status = 'imported', moderated_at = coalesce(moderated_at, now())
where submission.spotify_type = 'artist'
  and submission.status = 'approved'
  and exists (
    select 1
    from public.artists artist
    join public.album_artists credit on credit.artist_id = artist.id
    where artist.spotify_id = submission.spotify_id
  );

create or replace function public.imported_album_count(profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct credited.album_id)
  from (
    select album.id as album_id
    from public.catalog_submission_supporters supporter
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.albums album on album.spotify_id = submission.spotify_id
    where supporter.user_id = profile_id
      and submission.spotify_type = 'album'
      and submission.status = 'imported'

    union

    select credit.album_id
    from public.catalog_submission_supporters supporter
    join public.catalog_submissions submission on submission.id = supporter.submission_id
    join public.artists artist on artist.spotify_id = submission.spotify_id
    join public.album_artists credit on credit.artist_id = artist.id
    where supporter.user_id = profile_id
      and submission.spotify_type = 'artist'
      and submission.status = 'imported'
  ) credited;
$$;

revoke all on function public.imported_album_count(uuid) from public;
grant execute on function public.imported_album_count(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
