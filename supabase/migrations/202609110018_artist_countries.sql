begin;

alter table public.artists
  add column country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');
update public.artists set country_code = 'PL' where country_code is null;
create index artists_country_name_idx on public.artists(country_code, name, id);

alter table public.catalog_submissions
  add column country_code text not null default 'PL' check (country_code ~ '^[A-Z]{2}$');

drop function if exists public.submit_spotify_catalog_item(text,text,text,text);
create function public.submit_spotify_catalog_item(
  item_type text,
  item_id text,
  item_title text,
  item_thumbnail_url text,
  item_country_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  v_submission_id bigint;
  already_supported boolean;
  normalized_country text := upper(btrim(item_country_code));
begin
  if viewer_id is null then raise exception 'Authentication required'; end if;
  if item_type not in ('artist', 'album') or item_id !~ '^[A-Za-z0-9]{22}$'
    or char_length(btrim(item_title)) not between 1 and 300
    or normalized_country !~ '^[A-Z]{2}$'
    or (item_thumbnail_url is not null and item_thumbnail_url !~ '^https://i\.scdn\.co/') then
    raise exception 'Invalid Spotify submission';
  end if;
  if exists (
    select 1 from public.catalog_submissions
    where spotify_type=item_type and spotify_id=item_id and status='imported'
  ) then
    raise exception 'Catalog item already exists';
  end if;

  insert into public.catalog_submissions (spotify_type, spotify_id, spotify_url, title, thumbnail_url, country_code)
  values (item_type, item_id, 'https://open.spotify.com/' || item_type || '/' || item_id,
    btrim(item_title), item_thumbnail_url, normalized_country)
  on conflict (spotify_type, spotify_id) do update set
    title = excluded.title,
    thumbnail_url = coalesce(excluded.thumbnail_url, public.catalog_submissions.thumbnail_url),
    country_code = case when public.catalog_submissions.status in ('pending','rejected')
      then excluded.country_code else public.catalog_submissions.country_code end,
    status = case when public.catalog_submissions.status='rejected' then 'pending'
      else public.catalog_submissions.status end,
    moderator_id = case when public.catalog_submissions.status='rejected' then null
      else public.catalog_submissions.moderator_id end,
    moderator_note = case when public.catalog_submissions.status='rejected' then null
      else public.catalog_submissions.moderator_note end,
    rejection_reason = case when public.catalog_submissions.status='rejected' then null
      else public.catalog_submissions.rejection_reason end,
    moderated_at = case when public.catalog_submissions.status='rejected' then null
      else public.catalog_submissions.moderated_at end
  returning id into v_submission_id;

  select exists (
    select 1 from public.catalog_submission_supporters
    where catalog_submission_supporters.submission_id = v_submission_id and user_id = viewer_id
  ) into already_supported;
  if not already_supported and (
    select count(*) from public.catalog_submission_supporters
    where user_id = viewer_id and created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Daily submission limit reached';
  end if;
  insert into public.catalog_submission_supporters (submission_id, user_id)
  values (v_submission_id, viewer_id) on conflict do nothing;
  return jsonb_build_object('id', v_submission_id, 'already_supported', already_supported);
end;
$$;

revoke all on function public.submit_spotify_catalog_item(text,text,text,text,text) from public, anon;
grant execute on function public.submit_spotify_catalog_item(text,text,text,text,text) to authenticated;
grant update (country_code) on public.catalog_submissions to authenticated;

notify pgrst, 'reload schema';
commit;
