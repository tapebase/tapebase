begin;

create or replace function public.imported_album_count(profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.catalog_submission_supporters supporter
  join public.catalog_submissions submission on submission.id = supporter.submission_id
  where supporter.user_id = profile_id
    and submission.spotify_type = 'album'
    and submission.status = 'imported';
$$;

revoke all on function public.imported_album_count(uuid) from public;
grant execute on function public.imported_album_count(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
