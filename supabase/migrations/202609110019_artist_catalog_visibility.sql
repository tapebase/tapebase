begin;

alter table public.artists
  add column catalog_visible boolean not null default false;

-- Before this flag existed, a full artist import was distinguishable from a
-- lightweight credit by its Spotify image or a completed artist submission.
update public.artists artist
set catalog_visible = true
where artist.image_url is not null
   or exists (
     select 1
     from public.catalog_submissions submission
     where submission.spotify_type = 'artist'
       and submission.spotify_id = artist.spotify_id
       and submission.status = 'imported'
   );

create index artists_catalog_country_name_idx
  on public.artists(catalog_visible, country_code, name, id);

notify pgrst, 'reload schema';
commit;
