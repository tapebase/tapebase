begin;

alter table public.artist_biography_submissions
  drop constraint artist_biography_submissions_status_check,
  add constraint artist_biography_submissions_status_check
    check (status in ('pending', 'approved', 'rejected', 'superseded', 'removed')),
  add column removal_reason text
    check (removal_reason is null or char_length(btrim(removal_reason)) between 1 and 1000);

create or replace function public.remove_artist_biography(
  target_artist_id bigint,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := (select auth.uid());
  normalized_reason text := nullif(btrim(reason), '');
begin
  if admin_id is null or not public.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception 'Removal reason is too long';
  end if;
  if not exists (
    select 1 from public.artists
    where id = target_artist_id and description is not null
    for update
  ) then
    raise exception 'Published biography not found';
  end if;

  update public.artist_biography_submissions
  set status = 'removed', removal_reason = normalized_reason,
    moderator_id = admin_id, moderated_at = now()
  where artist_id = target_artist_id and status = 'approved';

  update public.artists
  set description = null,
    biography_author_id = null,
    biography_updated_at = now(),
    enrichment_field_sources = coalesce(enrichment_field_sources, '{}'::jsonb) - 'description',
    updated_at = now()
  where id = target_artist_id;
end;
$$;

revoke all on function public.remove_artist_biography(bigint,text) from public, anon;
grant execute on function public.remove_artist_biography(bigint,text) to authenticated;

notify pgrst, 'reload schema';
commit;
