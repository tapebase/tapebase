begin;

alter table public.user_lists
  add column cover_url text
  check (cover_url is null or char_length(cover_url) <= 2048);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'playlist-covers',
  'playlist-covers',
  true,
  194560,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists playlist_covers_public_read on storage.objects;
create policy playlist_covers_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'playlist-covers');

drop policy if exists playlist_covers_insert_own on storage.objects;
create policy playlist_covers_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'playlist-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_user()
);

drop policy if exists playlist_covers_update_own on storage.objects;
create policy playlist_covers_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'playlist-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_user()
)
with check (
  bucket_id = 'playlist-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_user()
);

drop policy if exists playlist_covers_delete_own on storage.objects;
create policy playlist_covers_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'playlist-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_user()
);

revoke insert, update on public.user_lists from authenticated;
grant insert (user_id, name, description, is_public, kind, cover_url) on public.user_lists to authenticated;
grant update (name, description, is_public, cover_url) on public.user_lists to authenticated;

notify pgrst, 'reload schema';
commit;
