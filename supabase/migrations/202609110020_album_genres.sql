begin;

alter table public.albums
  add column genre text not null default 'rap'
  check (genre in ('rap','pop','rock','electronic','rnb_soul','metal','jazz','reggae','folk_country','classical','other'));
create index albums_genre_title_idx on public.albums(genre, title, id);

alter table public.catalog_submissions
  add column genre text not null default 'rap'
  check (genre in ('rap','pop','rock','electronic','rnb_soul','metal','jazz','reggae','folk_country','classical','other'));

alter table public.catalog_import_jobs
  add column genre text not null default 'rap'
  check (genre in ('rap','pop','rock','electronic','rnb_soul','metal','jazz','reggae','folk_country','classical','other'));

drop function if exists public.submit_spotify_catalog_item(text,text,text,text,text);
create function public.submit_spotify_catalog_item(
  item_type text,
  item_id text,
  item_title text,
  item_thumbnail_url text,
  item_country_code text,
  item_genre text
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
  normalized_genre text := lower(btrim(item_genre));
begin
  if viewer_id is null then raise exception 'Authentication required'; end if;
  if item_type not in ('artist', 'album') or item_id !~ '^[A-Za-z0-9]{22}$'
    or char_length(btrim(item_title)) not between 1 and 300
    or normalized_country !~ '^[A-Z]{2}$'
    or normalized_genre not in ('rap','pop','rock','electronic','rnb_soul','metal','jazz','reggae','folk_country','classical','other')
    or (item_thumbnail_url is not null and item_thumbnail_url !~ '^https://i\.scdn\.co/') then
    raise exception 'Invalid Spotify submission';
  end if;
  if exists (
    select 1 from public.catalog_submissions
    where spotify_type=item_type and spotify_id=item_id and status='imported'
  ) then
    raise exception 'Catalog item already exists';
  end if;

  insert into public.catalog_submissions (spotify_type, spotify_id, spotify_url, title, thumbnail_url, country_code, genre)
  values (item_type, item_id, 'https://open.spotify.com/' || item_type || '/' || item_id,
    btrim(item_title), item_thumbnail_url, normalized_country, normalized_genre)
  on conflict (spotify_type, spotify_id) do update set
    title = excluded.title,
    thumbnail_url = coalesce(excluded.thumbnail_url, public.catalog_submissions.thumbnail_url),
    country_code = case when public.catalog_submissions.status in ('pending','rejected')
      then excluded.country_code else public.catalog_submissions.country_code end,
    genre = case when public.catalog_submissions.status in ('pending','rejected')
      then excluded.genre else public.catalog_submissions.genre end,
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

create or replace function public.queue_approved_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and (
    old.status is distinct from new.status or old.release_kind is distinct from new.release_kind
  ) then
    insert into public.catalog_import_jobs (submission_id, spotify_type, spotify_id, title, release_kind, genre)
    values (new.id, new.spotify_type, new.spotify_id, new.title, new.release_kind, new.genre)
    on conflict (submission_id) do update set
      release_kind = excluded.release_kind,
      genre = excluded.genre,
      status = case when public.catalog_import_jobs.status in ('completed','completed_with_errors')
        then public.catalog_import_jobs.status else 'queued' end,
      error_message = null;
  end if;
  return new;
end;
$$;

update public.catalog_import_jobs job set genre = submission.genre
from public.catalog_submissions submission where submission.id = job.submission_id;

grant update (genre) on public.catalog_submissions to authenticated;
revoke all on function public.submit_spotify_catalog_item(text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_spotify_catalog_item(text,text,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
